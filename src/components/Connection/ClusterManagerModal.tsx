import { useState } from 'react';
import { Modal, Table, Button, Tag, Popconfirm, Form, Input, Space, Tooltip, App } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ApiOutlined, DisconnectOutlined } from '@ant-design/icons';
import { useConnectionStore } from '../../stores/connectionStore';
import { useClusterStore, type ClusterConfig } from '../../stores/clusterStore';
import { useDataStore } from '../../stores/dataStore';
import { useBridgeActions } from '../../hooks/useBridgeActions';
import { useI18n } from '../../i18n/I18nProvider';
import { createClient, testConnection, listCollections } from '../../services';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ClusterManagerModal: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useI18n();
  const { message } = App.useApp();
  const { connectionStatus } = useConnectionStore();
  const { clusters, activeClusterId, saveCluster, updateCluster, setActiveCluster } = useClusterStore();
  const { setCollections } = useDataStore();
  const { setConnection, disconnect, deleteCluster } = useBridgeActions();
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
      setConnection('connected', client, cluster.url, cluster.apiKey);
      setCollections(cols);
    } catch (e) {
      setConnection('error', null);
      message.error(e instanceof Error ? e.message : t('connectionFail'));
    } finally {
      setConnectingId(null);
    }
  };

  const handleDelete = (id: string) => {
    if (id === activeClusterId) {
      disconnect();
    }
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

  const columns = [
    { title: t('clusterName'), dataIndex: 'name', key: 'name' },
    { title: 'URL', dataIndex: 'url', key: 'url', ellipsis: true },
    {
      title: t('connected'),
      key: 'status',
      render: (_: unknown, record: ClusterConfig) =>
        record.id === activeClusterId ? (
          <Tag color="blue">{connectionStatus === 'connected' ? t('currentCluster') : t('notConnected')}</Tag>
        ) : (
          <span style={{ color: 'var(--color-text-quaternary)' }}>--</span>
        ),
    },
    {
      title: '', key: 'action', width: 160, align: 'right' as const,
      render: (_: unknown, record: ClusterConfig) => {
        const isConnecting = connectingId === record.id;
        const isConnected = record.id === activeClusterId && connectionStatus === 'connected';
        return (
          <Space size={4}>
            <Tooltip title={t('edit')}>
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
            </Tooltip>
            <Popconfirm title={record.id === activeClusterId ? t('deleteActiveClusterConfirm') : t('deleteClusterConfirm')} onConfirm={() => handleDelete(record.id)} okText={t('confirm')} cancelText={t('cancel')}>
              <Tooltip title={t('delete')}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
            {isConnected ? (
              <Tooltip title={t('disconnect')}>
                <Button
                  size="small"
                  danger
                  icon={<DisconnectOutlined />}
                  onClick={() => disconnect()}
                  style={{ fontSize: 11 }}
                >
                  {t('disconnect')}
                </Button>
              </Tooltip>
            ) : (
              <Tooltip title={t('connectBtn')}>
                <Button
                  type="primary"
                  size="small"
                  icon={<ApiOutlined />}
                  loading={isConnecting}
                  onClick={() => handleConnect(record)}
                  style={{ fontSize: 11 }}
                >
                  {t('connectBtn')}
                </Button>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <Modal
        title={t('manageClusters')}
        open={open}
        onCancel={onClose}
        footer={null}
        width={640}
      >
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            {t('addCluster')}
          </Button>
        </div>
        <Table
          dataSource={clusters}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Modal>

      <Modal
        title={adding ? t('addCluster') : t('editCluster')}
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
    </>
  );
};

export default ClusterManagerModal;
