import { useState } from 'react';
import { Input, Button, Tag, Space, Typography } from 'antd';
import { ApiOutlined, LinkOutlined, KeyOutlined } from '@ant-design/icons';
import useAppStore from '../../stores/appStore';
import { createClient, testConnection, listCollections } from '../../services/weaviate';
import { useI18n } from '../../i18n/I18nProvider';

const { Text } = Typography;

const ConnectionManager: React.FC = () => {
  const { t } = useI18n();
  const store = useAppStore();
  const [localUrl, setLocalUrl] = useState(store.url);
  const [localCred, setLocalCred] = useState(store.cred);
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!localUrl.trim()) return;
    setLoading(true);
    try {
      const client = createClient(localUrl.trim(), localCred.trim());
      const ready = await testConnection(client);
      if (!ready) throw new Error(t('connectionFail'));
      const cols = await listCollections(client);
      store.setConnection('connected', client, localUrl, localCred);
      store.setCollections(cols);
    } catch {
      store.setConnection('error', null);
    } finally { setLoading(false); }
  };

  const statusTag = {
    disconnected: null,
    connected: <Tag color="green">{t('connected')}</Tag>,
    error: <Tag color="red">{t('failed')}</Tag>,
  }[store.connectionStatus];

  return (
    <div style={{ marginBottom: 12 }}>
      <Text style={{ color: '#6b7589', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 600 }}>
        {t('connect')}
      </Text>
      <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
        <Input prefix={<LinkOutlined style={{ color: '#9aa3b5' }} />} placeholder={t('serviceAddr')}
          value={localUrl} onChange={(e) => setLocalUrl(e.target.value)} disabled={store.connectionStatus === 'connected'} />
        <Input.Password prefix={<KeyOutlined style={{ color: '#9aa3b5' }} />} placeholder={t('apiKey')}
          value={localCred} onChange={(e) => setLocalCred(e.target.value)} disabled={store.connectionStatus === 'connected'} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {statusTag}
            {store.connectionStatus === 'connected' && <Text style={{ color: '#4a5266', fontSize: 12, fontWeight: 500 }}>{store.collections.length} {t('collections')}</Text>}
          </div>
          {store.connectionStatus === 'connected' ? (
            <Button danger size="small" onClick={() => { store.disconnect(); setLocalUrl('http://localhost:8080'); setLocalCred(''); }} style={{ fontSize: 12, fontWeight: 500 }}>{t('disconnect')}</Button>
          ) : (
            <Button type="primary" size="small" icon={<ApiOutlined />} loading={loading} onClick={handleConnect} style={{ fontSize: 12, fontWeight: 500 }}>{t('connectBtn')}</Button>
          )}
        </div>
      </Space>
    </div>
  );
};

export default ConnectionManager;
