import { useEffect, useState } from 'react';
import { Modal, Input, Button, Select, Space, Typography, Tag, Divider, Popconfirm, App } from 'antd';
import { ApiOutlined, SaveOutlined, DeleteOutlined, DisconnectOutlined } from '@ant-design/icons';
import useAppStore from '../../stores/appStore';
import { useI18n } from '../../i18n/I18nProvider';
import { createClient, testConnection, listCollections } from '../../services/weaviate';
import ClusterManagerModal from './ClusterManagerModal';

const { Text } = Typography;

interface ConnectionConfigModalProps {
  open: boolean;
  onClose: () => void;
}

const ConnectionConfigModal: React.FC<ConnectionConfigModalProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const { message } = App.useApp();
  const store = useAppStore();

  const [localUrl, setLocalUrl] = useState(store.url);
  const [localCred, setLocalCred] = useState(store.cred);
  const [loading, setLoading] = useState(false);
  const [clusterModalOpen, setClusterModalOpen] = useState(false);

  // 同步 store 状态到本地
  useEffect(() => {
    if (open) {
      setLocalUrl(store.url);
      setLocalCred(store.cred);
    }
  }, [open, store.url, store.cred]);

  const doConnect = async (url: string, cred: string): Promise<boolean> => {
    setLoading(true);
    try {
      const client = createClient(url.trim(), cred.trim());
      const ready = await testConnection(client);
      if (!ready) throw new Error(t('connectionFail'));
      const cols = await listCollections(client);
      store.setConnection('connected', client, url, cred);
      store.setCollections(cols);
      return true;
    } catch (e) {
      store.setConnection('error', null);
      message.error(e instanceof Error ? e.message : t('connectionFail'));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!localUrl.trim()) {
      message.warning(t('connectionInfoRequired'));
      return;
    }
    const ok = await doConnect(localUrl, localCred);
    if (ok) onClose();
  };

  const handleDisconnect = () => {
    store.disconnect();
  };

  const handleClusterChange = (value: string) => {
    if (value === '__manage__') {
      setClusterModalOpen(true);
      return;
    }
    const cluster = store.clusters.find((c) => c.id === value);
    if (!cluster) return;
    store.setActiveCluster(cluster.id);
    setLocalUrl(cluster.url);
    setLocalCred(cluster.apiKey);
    if (cluster.url.trim()) doConnect(cluster.url, cluster.apiKey);
  };

  const handleSaveAsNew = () => {
    const name = prompt(t('clusterName'));
    if (!name?.trim()) return;
    const newId = store.saveCluster({
      name: name.trim(),
      url: localUrl,
      apiKey: localCred,
      isDefault: store.clusters.length === 0,
    });
    store.setActiveCluster(newId);
    message.success(t('clusterSaveSuccess'));
  };

  const handleDeleteCluster = () => {
    if (!store.activeClusterId) return;
    store.deleteCluster(store.activeClusterId);
    setLocalUrl('http://localhost:8080');
    setLocalCred('');
    message.success(t('clusterDeleted'));
  };

  const statusTag = {
    disconnected: <Tag>{t('disconnected')}</Tag>,
    connected: <Tag color="success">{t('connected')}</Tag>,
    error: <Tag color="error">{t('failed')}</Tag>,
  }[store.connectionStatus];

  return (
    <>
      <Modal
        title={t('connectionConfig')}
        open={open}
        onCancel={onClose}
        footer={null}
        width={520}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* 集群选择器 */}
          {store.clusters.length > 0 && (
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                {t('clusters')}
              </Text>
              <Select
                value={store.activeClusterId ?? undefined}
                onChange={handleClusterChange}
                placeholder={t('selectCluster')}
                style={{ width: '100%' }}
                options={[
                  ...store.clusters.map((c) => ({
                    label: `${c.name} (${c.url})`,
                    value: c.id,
                  })),
                  { label: `⚙️ ${t('manageClusters')}`, value: '__manage__' },
                ]}
              />
            </div>
          )}

          {/* 连接信息 */}
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              {t('serviceAddr')}
            </Text>
            <Input
              placeholder="http://localhost:8080"
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
              disabled={store.connectionStatus === 'connected'}
            />
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              {t('apiKey')}
            </Text>
            <Input.Password
              placeholder={t('apiKey')}
              value={localCred}
              onChange={(e) => setLocalCred(e.target.value)}
              disabled={store.connectionStatus === 'connected'}
            />
          </div>

          {/* 状态显示 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('status')}:</Text>
            {statusTag}
            {store.connectionStatus === 'connected' && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                · {store.collections.length} {t('collections')}
              </Text>
            )}
          </div>

          <Divider style={{ margin: '8px 0' }} />

          {/* 操作按钮 */}
          <Space wrap>
            {store.connectionStatus === 'connected' ? (
              <Button icon={<DisconnectOutlined />} onClick={handleDisconnect}>
                {t('disconnect')}
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<ApiOutlined />}
                loading={loading}
                onClick={handleConnect}
              >
                {t('connectBtn')}
              </Button>
            )}

            <Button icon={<SaveOutlined />} onClick={handleSaveAsNew}>
              {t('saveAsNewCluster')}
            </Button>

            {store.activeClusterId && (
              <Popconfirm
                title={t('deleteClusterConfirm')}
                onConfirm={handleDeleteCluster}
                okText={t('confirm')}
                cancelText={t('cancel')}
              >
                <Button danger icon={<DeleteOutlined />}>
                  {t('delete')}
                </Button>
              </Popconfirm>
            )}
          </Space>
        </Space>
      </Modal>

      <ClusterManagerModal open={clusterModalOpen} onClose={() => setClusterModalOpen(false)} />
    </>
  );
};

export default ConnectionConfigModal;
