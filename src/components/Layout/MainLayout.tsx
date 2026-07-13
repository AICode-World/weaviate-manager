import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { Layout, Button, Spin, Badge, Modal, Input, Form, App } from 'antd';
import {
  DashboardOutlined, DatabaseOutlined, AppstoreOutlined,
  CloudServerOutlined, SettingOutlined, CodeOutlined,
  PictureOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import useAppStore from '../../stores/appStore';
import { useI18n } from '../../i18n/I18nProvider';
import { createClient, testConnection, listCollections } from '../../services/weaviate';
import AppTour from '../Onboarding/AppTour';

const Dashboard = lazy(() => import('../../pages/Dashboard'));
const DataPage = lazy(() => import('../../pages/DataPage'));
const SchemaManager = lazy(() => import('../Schema/SchemaManager'));
const GraphQLPage = lazy(() => import('../../pages/GraphQLPage'));
const MultimodalPage = lazy(() => import('../../pages/MultimodalPage'));
const ConnectionPage = lazy(() => import('../../pages/ConnectionPage'));
const SettingsPage = lazy(() => import('../../pages/SettingsPage'));

const { Sider, Content } = Layout;

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
}
interface NavSection {
  label: string;
  items: NavItem[];
}

const MainLayout: React.FC = () => {
  const { t } = useI18n();
  const { message } = App.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    connectionStatus, loadClusters, clusters, activeClusterId,
    sidebarCollapsed, setSidebarCollapsed,
    saveCluster, setActiveCluster, setConnection, setCollections,
    setCurrentCollection,
  } = useAppStore();

  // 首次进入引导
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingForm] = Form.useForm();

  // Tour refs
  const connectionRef = useRef<HTMLDivElement>(null);
  const collectionsRef = useRef<HTMLDivElement>(null);
  const dashboardBtnRef = useRef<HTMLDivElement>(null);
  const dataBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const done = localStorage.getItem('weaviate_onboarding_done');
    if (!done && connectionStatus !== 'connected') {
      setOnboardingOpen(true);
    }
  }, []);

  const handleOnboardingConnect = async () => {
    try {
      const values = await onboardingForm.validateFields();
      setOnboardingLoading(true);
      const client = createClient(values.url.trim(), (values.apiKey || '').trim());
      const ready = await testConnection(client);
      if (!ready) throw new Error(t('connectionFail'));
      const cols = await listCollections(client);
      const id = saveCluster({
        name: values.url.includes('localhost') ? 'Local' : 'My Instance',
        url: values.url,
        apiKey: values.apiKey || '',
        isDefault: true,
      });
      setActiveCluster(id);
      setConnection('connected', client, values.url, values.apiKey || '');
      setCollections(cols);
      if (cols.length > 0) setCurrentCollection(cols[0]);
      message.success(t('connectSuccess'));
      setOnboardingOpen(false);
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(e instanceof Error ? e.message : t('connectionFail'));
    } finally {
      setOnboardingLoading(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setSidebarCollapsed(true);
      else if (window.innerWidth >= 1024) setSidebarCollapsed(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setSidebarCollapsed]);

  useEffect(() => { loadClusters(); }, [loadClusters]);

  const currentPath = location.pathname;
  const siderWidth = sidebarCollapsed ? 68 : 240;

  const activeCluster = clusters.find((c) => c.id === activeClusterId);

  const navSections: NavSection[] = [
    {
      label: t('dashboard'),
      items: [
        { key: '/', icon: <DashboardOutlined />, label: t('dashboard') },
        { key: '/data', icon: <DatabaseOutlined />, label: t('dataBrowsePage') },
        { key: '/schema', icon: <AppstoreOutlined />, label: t('schemaManagement') },
        { key: '/graphql', icon: <CodeOutlined />, label: 'GraphQL' },
        { key: '/multimodal', icon: <PictureOutlined />, label: t('multimodalSearchTitle') },
      ],
    },
    {
      label: t('connectionManagement'),
      items: [
        {
          key: '/connections', icon: <CloudServerOutlined />, label: t('connectionManagement'),
          badge: <Badge count={clusters.length} size="small" color="#9ca3af" />,
        },
        { key: '/settings', icon: <SettingOutlined />, label: t('settings') },
      ],
    },
  ];

  const isActive = (key: string) => {
    if (key === '/') return currentPath === '/';
    return currentPath.startsWith(key);
  };

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Sider width={siderWidth} className="glass-sidebar" collapsible={false} trigger={null}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Brand */}
          <div style={{
            padding: sidebarCollapsed ? '20px 12px 12px' : '20px 16px 14px',
            display: 'flex',
            justifyContent: sidebarCollapsed ? 'center' : 'space-between',
            alignItems: sidebarCollapsed ? 'center' : 'flex-start',
          }}>
            {sidebarCollapsed ? (
              <img src="/logo.svg" alt="" style={{ width: 30, height: 30 }} />
            ) : (
              <>
                <div className="brand-block">
                  <div className="brand-name">
                    <span className="brand-weaviate">Weaviate</span>
                    <span className="brand-manager">Manager</span>
                  </div>
                  <div className="brand-tagline">{t('appDesc')}</div>
                </div>
                <Button
                  type="text"
                  size="small"
                  icon={<MenuFoldOutlined />}
                  onClick={() => setSidebarCollapsed(true)}
                  style={{ color: 'var(--color-text-quaternary)', marginTop: 2 }}
                />
              </>
            )}
          </div>

          {!sidebarCollapsed && <div style={{ height: 1, background: 'var(--color-border)', margin: '0 16px' }} />}

          {/* Collapse button (when collapsed) */}
          {sidebarCollapsed && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
              <Button
                type="text"
                size="small"
                icon={<MenuUnfoldOutlined />}
                onClick={() => setSidebarCollapsed(false)}
                style={{ color: 'var(--color-text-quaternary)' }}
              />
            </div>
          )}

          {/* Nav */}
          <div style={{ flex: 1, overflow: 'auto', padding: sidebarCollapsed ? '8px 8px' : '8px 12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {navSections.map((section, sIdx) => (
                <div key={sIdx}>
                  {!sidebarCollapsed && (
                    <div className="nav-group-label">{section.label}</div>
                  )}
                  {sidebarCollapsed && sIdx > 0 && (
                    <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 8px' }} />
                  )}
                  {section.items.map((item) => {
                    // Assign refs for Tour targets
                    let ref: React.RefObject<HTMLDivElement | null> | undefined;
                    if (item.key === '/') ref = dashboardBtnRef;
                    else if (item.key === '/data') ref = dataBtnRef;
                    else if (item.key === '/connections') ref = connectionRef;
                    return (
                    <div
                      key={item.key}
                      ref={ref as React.RefObject<HTMLDivElement>}
                      className={`nav-item${isActive(item.key) ? ' active' : ''}`}
                      onClick={() => navigate(item.key)}
                      style={sidebarCollapsed ? { justifyContent: 'center', padding: '9px 0' } : {}}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      {item.icon}
                      {!sidebarCollapsed && (
                        <>
                          <span style={{ flex: 1 }}>{item.label}</span>
                          {item.badge}
                        </>
                      )}
                    </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Connection status footer */}
          <div style={{
            padding: sidebarCollapsed ? '8px' : '10px 14px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
          onClick={() => navigate('/connections')}
          title={sidebarCollapsed ? (activeCluster?.name || t('noClusters')) : undefined}
          >
            <Badge
              status={connectionStatus === 'connected' ? 'success' : connectionStatus === 'error' ? 'error' : 'default'}
            />
            {!sidebarCollapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeCluster?.name || t('noClusters')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-quaternary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {connectionStatus === 'connected' ? `${activeCluster?.url || ''}` : t('disconnected')}
                </div>
              </div>
            )}
          </div>
        </div>
      </Sider>

      <Layout style={{ background: 'transparent' }}>
        <Content style={{ padding: 24, overflow: 'auto', background: 'transparent' }}>
          <div key={location.pathname} className="page-fade-in">
            <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}><Spin size="large" /></div>}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/data" element={<DataPage />} />
                <Route path="/schema" element={<SchemaManager />} />
                <Route path="/graphql" element={<GraphQLPage />} />
                <Route path="/multimodal" element={<MultimodalPage />} />
                <Route path="/connections" element={<ConnectionPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </Content>
      </Layout>

      {/* 首次进入引导覆盖层 */}
      <Modal
        open={onboardingOpen}
        footer={null}
        closable={false}
        width={480}
        centered
        maskClosable={false}
        styles={{ mask: { background: 'rgba(10,14,39,0.85)' }, body: { borderRadius: 16, padding: '48px 40px' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          {/* Logo */}
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, #1677ff, #7b9bff)',
            borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 22,
          }}>W</div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('welcomeTitle')}</div>
            <div style={{ fontSize: 14, color: '#6B6B6B' }}>{t('welcomeDesc')}</div>
          </div>

          {/* 步骤指示器 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 6, background: '#1677FF', borderRadius: 3 }} />
            <div style={{ width: 6, height: 6, background: '#D9D9D9', borderRadius: 3 }} />
            <div style={{ width: 6, height: 6, background: '#D9D9D9', borderRadius: 3 }} />
          </div>

          {/* 连接表单 */}
          <Spin spinning={onboardingLoading}>
            <Form form={onboardingForm} layout="vertical" style={{ width: '100%' }} initialValues={{ url: 'http://localhost:8080' }}>
              <Form.Item name="url" label={t('weaviateUrl')} rules={[{ required: true }]}>
                <Input placeholder="http://localhost:8080" size="large" />
              </Form.Item>
              <Form.Item name="apiKey" label={t('apiKey')}>
                <Input.Password placeholder={t('apiKeyHint')} size="large" />
              </Form.Item>
              <Button type="primary" block size="large" onClick={handleOnboardingConnect} loading={onboardingLoading}>
                {t('connectBtn')}
              </Button>
            </Form>
          </Spin>

          <Button
            type="text"
            size="small"
            style={{ color: '#999', fontSize: 13 }}
            onClick={() => {
              localStorage.setItem('weaviate_onboarding_done', '1');
              setOnboardingOpen(false);
            }}
          >
            {t('skip')}
          </Button>
        </div>
      </Modal>

      {/* 功能引导 Tour */}
      {connectionStatus === 'connected' && (
        <AppTour refs={{ connection: connectionRef, collections: collectionsRef, dashboardBtn: dashboardBtnRef, dataBtn: dataBtnRef }} />
      )}
    </Layout>
  );
};

export default MainLayout;
