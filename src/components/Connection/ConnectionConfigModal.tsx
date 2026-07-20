import { useEffect, useState } from 'react';
import { Modal, Input, Button, Select, Space, Typography, Tag, Divider, Popconfirm, App } from 'antd';
import { ApiOutlined, SaveOutlined, DeleteOutlined, DisconnectOutlined } from '@ant-design/icons';
import { useConnectionStore } from '../../stores/connectionStore';
import { useClusterStore } from '../../stores/clusterStore';
import { useDataStore } from '../../stores/dataStore';
import { useBridgeActions } from '../../hooks/useBridgeActions';
import { useI18n } from '../../i18n/I18nProvider';
import { createClient, testConnection, listCollections } from '../../services';
import ClusterManagerModal from './ClusterManagerModal';

const { Text } = Typography;

interface ConnectionConfigModalProps {
  open: boolean;
  onClose: () => void;
}

const ConnectionConfigModal: React.FC<ConnectionConfigModalProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const { message } = App.useApp();
  const { url, cred, connectionStatus } = useConnectionStore();
  const { clusters, activeClusterId, saveCluster, setActiveCluster } = useClusterStore();
  const { setCollections, collections } = useDataStore();
  const { setConnection, disconnect, deleteCluster } = useBridgeActions();

  const [localUrl, setLocalUrl] = useState(url);
  const [localCred, setLocalCred] = useState(cred);
  const [loading, setLoading] = useState(false);
  const [clusterModalOpen, setClusterModalOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalUrl(url);
      setLocalCred(cred);
    }
  }, [open, url, cred]);

  const doConnect = async (urlVal: string, credVal: string): Promise<boolean> => {
    setLoading(true);
    try {
      const client = createClient(urlVal.trim(), credVal.trim());
      const ready = await testConnection(client);
      if (!ready) throw new Error(t('connectionFail'));
      const cols = await listCollections(client);
      setConnection('connected', client, urlVal, credVal);
      setCollections(cols);
      return true;
    } catch (e) {
      setConnection('error', null);
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
    disconnect();
  };

  const handleClusterChange = (value: string) => {
    if (value === '__manage__') {
      setClusterModalOpen(true);
      return;
    }
    const cluster = clusters.find((c) => c.id === value);
    if (!cluster) return;
    setActiveCluster(cluster.id);
    setLocalUrl(cluster.url);
    setLocalCred(cluster.apiKey);
    if (cluster.url.trim()) doConnect(cluster.url, cluster.apiKey);
  };

  const handleSaveAsNew = () => {
    const name = prompt(t('clusterName'));
    if (!name?.trim()) return;
    const newId = saveCluster({
      name: name.trim(),
      url: localUrl,
      apiKey: localCred,
      isDefault: clusters.length === 0,
    });
    setActiveCluster(newId);
    message.success(t('clusterSaveSuccess'));
  };

  const handleDeleteCluster = () => {
    if (!activeClusterId) return;
    deleteCluster(activeClusterId);
    setLocalUrl('http://localhost:8080');
    setLocalCred('');
    message.success(t('clusterDeleted'));
  };

  const statusTag = {
    disconnected: <Tag>{t('disconnected')}</Tag>,
    connected: <Tag color="success">{t('connected')}</Tag>,
    error: <Tag color="error">{t('failed')}</Tag>,
  }[connectionStatus];

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
          {clusters.length > 0 && (
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                {t('clusters')}
              </Text>
              <Select
                value={activeClusterId ?? undefined}
                onChange={handleClusterChange}
                placeholder={t('selectCluster')}
                style={{ width: '100%' }}
                options={[
                  ...clusters.map((c) => ({
                    label: `${c.name} (${c.url})`,
                    value: c.id,
                  })),
                  { label: `⚙️ ${t('manageClusters')}`, value: '__manage__' },
                ]}
              />
            </div>
          )}

          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              {t('serviceAddr')}
            </Text>
            <Input
              placeholder="http://localhost:8080"
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
              disabled={connectionStatus === 'connected'}
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
              disabled={connectionStatus === 'connected'}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('status')}:</Text>
            {statusTag}
            {connectionStatus === 'connected' && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                · {collections.length} {t('collections')}
              </Text>
            )}
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <Space wrap>
            {connectionStatus === 'connected' ? (
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

            {activeClusterId && (
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
