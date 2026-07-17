import { useState } from 'react';
import { Button, Popconfirm, Form, Input, Modal, App, Empty, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined, DisconnectOutlined } from '@ant-design/icons';
import useAppStore, { type ClusterConfig } from '../stores/appStore';
import { useI18n } from '../i18n/I18nProvider';
import { createClient, testConnection, listCollections, getServerInfo } from '../services/weaviate';

const ConnectionPage: React.FC = () => {
  const { t } = useI18n();
  const { message } = App.useApp();
  const {
    clusters, activeClusterId, connectionStatus,
    saveCluster, updateCluster, deleteCluster, disconnect,
    setActiveCluster, setConnection, setCollections,
    setCurrentCollection,
    serverVersion, latency,
  } = useAppStore();
  const [editing, setEditing] = useState<ClusterConfig | null>(null);
  const [adding, setAdding] = useState(false);
  const [form] = Form.useForm();
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const handleConnect = async (cluster: ClusterConfig) => {
    if (!cluster.url.trim()) {
      message.warning(t('connectionInfoRequired'));
      return;
    }
    setConnectingId(cluster.id);
    setActiveCluster(cluster.id);
    try {
      const client = createClient(cluster.url.trim(), cluster.apiKey.trim());
      const ready = await testConnection(client);
      if (!ready) throw new Error(t('connectionFail'));
      const cols = await listCollections(client);
      // Fetch real server version and latency
      let svVersion = '';
      let svLatency: number | null = null;
      try {
        const info = await getServerInfo(client);
        svVersion = info.version;
        svLatency = info.latency;
      } catch { /* meta already worked in testConnection, ignore */ }
      setConnection('connected', client, cluster.url, cluster.apiKey, svVersion, svLatency);
      setCollections(cols);
      if (cols.length > 0) setCurrentCollection(cols[0]);
      message.success(t('connectSuccess'));
    } catch (e) {
      setConnection('error', null);
      message.error(e instanceof Error ? e.message : t('connectionFail'));
    } finally {
      setConnectingId(null);
    }
  };

  const handleDelete = (id: string) => {
    if (id === activeClusterId) disconnect();
    deleteCluster(id);
    message.success(t('clusterDeleted'));
  };

  const handleEdit = (cluster: ClusterConfig) => {
    setEditing(cluster);
    setAdding(false);
    form.setFieldsValue({ name: cluster.name, url: cluster.url, apiKey: cluster.apiKey });
  };

  const handleAdd = () => {
    setAdding(true);
    setEditing(null);
    form.resetFields();
  };

  const handleSaveEdit = async () => {
    try {
      const values = await form.validateFields();
      if (adding) {
        saveCluster({
          name: values.name,
          url: values.url,
          apiKey: values.apiKey || '',
          isDefault: clusters.length === 0,
        });
        message.success(t('clusterSaveSuccess'));
        setAdding(false);
      } else if (editing) {
        updateCluster(editing.id, values);
        message.success(t('clusterSaveSuccess'));
        setEditing(null);
      }
      form.resetFields();
    } catch {
      // validation failed
    }
  };

  const getStatusBadge = (cluster: ClusterConfig) => {
    if (cluster.id !== activeClusterId) {
      return <span className="conn-status-badge conn-status-disconnected"><span className="dot" />{t('notConnected')}</span>;
    }
    if (connectionStatus === 'connected') {
      return <span className="conn-status-badge conn-status-connected"><span className="dot" />{t('connected')}</span>;
    }
    if (connectionStatus === 'error') {
      return <span className="conn-status-badge conn-status-failed"><span className="dot" />{t('connectionFailed')}</span>;
    }
    return <span className="conn-status-badge conn-status-disconnected"><span className="dot" />{t('disconnected')}</span>;
  };

  return (
    <Spin spinning={connectingId !== null}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Page Header */}
        <div className="page-header">
          <div>
            <div className="page-title">{t('connectionManagement')}</div>
            <div className="page-subtitle">{t('connectionManageDesc')}</div>
          </div>
          <div className="page-header-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              {t('addConnection')}
            </Button>
          </div>
        </div>

        {/* Connection Cards */}
        {clusters.length === 0 ? (
          <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
            <Empty description={t('noClusters')} />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ marginTop: 16 }}>
              {t('addConnection')}
            </Button>
          </div>
        ) : (
          <div className="conn-grid">
            {clusters.map((cluster) => {
              const isActive = cluster.id === activeClusterId;
              const isConnected = isActive && connectionStatus === 'connected';
              return (
                <div key={cluster.id} className="conn-card">
                  {cluster.isDefault && <div className="conn-default-tag">{t('defaultCluster')}</div>}
                  <div style={{ marginBottom: 10 }}>
                    <div className="conn-card-name">{cluster.name}</div>
                    <div className="conn-card-url">{cluster.url}</div>
                  </div>
                  {getStatusBadge(cluster)}
                  <div className="conn-card-meta">
                    <div className="conn-card-meta-item">{t('version')}: <strong>{isConnected ? (serverVersion ? `v${serverVersion}` : '—') : '—'}</strong></div>
                    <div className="conn-card-meta-item">{t('latency')}: <strong>{isConnected && latency !== null ? `${latency}ms` : '—'}</strong></div>
                  </div>
                  <div className="conn-card-actions">
                    {isConnected ? (
                      <Button size="small" danger icon={<DisconnectOutlined />} onClick={() => disconnect()}>
                        {t('disconnect')}
                      </Button>
                    ) : (
                      <Button type="primary" size="small" icon={<ApiOutlined />} loading={connectingId === cluster.id} onClick={() => handleConnect(cluster)}>
                        {t('connectBtn')}
                      </Button>
                    )}
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(cluster)}>{t('editBtn')}</Button>
                    <Popconfirm
                      title={isActive ? t('deleteActiveClusterConfirm') : t('deleteClusterConfirm')}
                      onConfirm={() => handleDelete(cluster.id)}
                      okText={t('confirm')}
                      cancelText={t('cancel')}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                </div>
              );
            })}
            {/* Add new card */}
            <div className="conn-add-card" onClick={handleAdd}>
              <PlusOutlined style={{ fontSize: 24, color: 'var(--color-text-quaternary)' }} />
              <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>{t('addNewConnection')}</span>
            </div>
          </div>
        )}

      </div>

      {/* Add/Edit Modal */}
      <Modal
        title={adding ? t('addConnection') : t('editCluster')}
        open={adding || !!editing}
        onCancel={() => { setAdding(false); setEditing(null); form.resetFields(); }}
        onOk={handleSaveEdit}
        okText={t('confirm')}
        cancelText={t('cancel')}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={t('clusterName')} rules={[{ required: true, message: t('clusterNameRequired') }]}>
            <Input placeholder={t('clusterName')} />
          </Form.Item>
          <Form.Item name="url" label={t('serviceAddr')} rules={[{ required: true }]}>
            <Input placeholder="http://localhost:8080" />
          </Form.Item>
          <Form.Item name="apiKey" label={t('apiKey')}>
            <Input.Password placeholder={t('apiKey')} />
          </Form.Item>
        </Form>
      </Modal>
    </Spin>
  );
};

export default ConnectionPage;
