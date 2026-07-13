import { useState } from 'react';
import { Button, Input, Form, App, Spin } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import useAppStore from '../stores/appStore';
import { useI18n } from '../i18n/I18nProvider';
import { createClient, testConnection, listCollections } from '../services/weaviate';

const OnboardingPage: React.FC = () => {
  const { t } = useI18n();
  const { message } = App.useApp();
  const { saveCluster, setActiveCluster, setConnection, setCollections } = useAppStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const client = createClient(values.url.trim(), (values.apiKey || '').trim());
      const ready = await testConnection(client);
      if (!ready) throw new Error(t('connectionFail'));
      const cols = await listCollections(client);
      // Save as a cluster
      const id = saveCluster({
        name: values.url.includes('localhost') ? 'Local' : 'My Instance',
        url: values.url,
        apiKey: values.apiKey || '',
        isDefault: true,
      });
      setActiveCluster(id);
      setConnection('connected', client, values.url, values.apiKey || '');
      setCollections(cols);
      message.success(t('connectSuccess'));
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(e instanceof Error ? e.message : t('connectionFail'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-wrap">
      <div className="onboarding-card">
        {/* Logo */}
        <div style={{
          width: 52, height: 52,
          background: 'linear-gradient(135deg, var(--color-primary, #1677ff), #7b9bff)',
          borderRadius: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 22,
          margin: '0 auto 16px',
        }}>W</div>

        <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          {t('welcomeTitle')}
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 24 }}>
          {t('welcomeDesc')}
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {[1, 2, 3].map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600,
                background: step === 1 ? 'var(--color-primary, #1677ff)' : 'rgba(0,0,0,0.06)',
                color: step === 1 ? '#fff' : 'var(--color-text-quaternary)',
              }}>{step}</div>
              {i < 2 && <div style={{ width: 36, height: 2, background: 'var(--color-border)' }} />}
            </div>
          ))}
        </div>

        {/* Form */}
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" initialValues={{ url: 'http://localhost:8080' }}>
          <Form.Item name="url" label={t('weaviateUrl')} rules={[{ required: true }]}>
            <Input placeholder="http://localhost:8080" />
          </Form.Item>
          <div style={{ fontSize: 11, color: 'var(--color-text-quaternary)', marginTop: -8, marginBottom: 12 }}>
            {t('weaviateUrlHint')}
          </div>

          <Form.Item name="apiKey" label={t('apiKey')}>
            <Input.Password placeholder={t('apiKey')} />
          </Form.Item>
          <div style={{ fontSize: 11, color: 'var(--color-text-quaternary)', marginTop: -8, marginBottom: 12 }}>
            {t('apiKeyHint')}
          </div>

          <Button type="primary" block size="large" icon={<ArrowRightOutlined />} onClick={handleConnect} loading={loading}>
            {t('testAndConnect')}
          </Button>
        </Form>
      </Spin>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <a href="https://console.weaviate.cloud/" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--color-primary, #1677ff)' }}>
            {t('useWeaviateCloud')} →
          </a>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
