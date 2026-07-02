import { Badge, Typography, Space } from 'antd';
import useAppStore from '../../stores/appStore';
import { useI18n } from '../../i18n/I18nProvider';

const { Text } = Typography;

const ConnectionManager: React.FC = () => {
  const { t } = useI18n();
  const store = useAppStore();

  const activeCluster = store.clusters.find((c) => c.id === store.activeClusterId);

  const statusMap = {
    disconnected: { status: 'default' as const, text: t('disconnected') },
    connected: { status: 'success' as const, text: t('connected') },
    error: { status: 'error' as const, text: t('failed') },
  };

  const { status, text } = statusMap[store.connectionStatus];

  return (
    <div style={{
      padding: '8px 12px',
      background: 'var(--color-bg-container)',
      borderRadius: 6,
      border: '1px solid var(--color-border-secondary)',
    }}>
      <Space size={8}>
        <Badge status={status} />
        <div>
          <Text strong style={{ fontSize: 13, display: 'block', lineHeight: 1.2 }}>
            {activeCluster?.name || t('noClusters')}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {text}
            {store.connectionStatus === 'connected' && ` · ${store.collections.length} ${t('collections')}`}
          </Text>
        </div>
      </Space>
    </div>
  );
};

export default ConnectionManager;
