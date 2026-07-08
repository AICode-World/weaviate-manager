import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Layout, Button, Popover, Tooltip, Badge, App, Spin, Input, Avatar } from 'antd';
import {
  DashboardOutlined, DatabaseOutlined, AppstoreOutlined,
  SunOutlined, MoonOutlined, DesktopOutlined, QuestionCircleOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, CloudServerOutlined,
  SearchOutlined, UserOutlined,
  CaretRightOutlined,
} from '@ant-design/icons';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import ConnectionManager from '../Connection/ConnectionManager';
import CollectionList from '../Collections/CollectionList';
import ClusterManagerModal from '../Connection/ClusterManagerModal';
import AppTour, { resetTour } from '../Onboarding/AppTour';
import useAppStore, { THEME_PRESETS } from '../../stores/appStore';
import { useI18n } from '../../i18n/I18nProvider';
import { createClient, testConnection, listCollections } from '../../services/weaviate';

const Dashboard = lazy(() => import('../../pages/Dashboard'));
const DataPage = lazy(() => import('../../pages/DataPage'));
const SchemaManager = lazy(() => import('../Schema/SchemaManager'));

const { Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const { t, lang, setLang } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const {
    connectionStatus, loadClusters, clusters, activeClusterId,
    setActiveCluster, setConnection, setCollections,
    collections, currentCollection,
    themeMode, setThemeMode, themeColor, setThemeColor,
    sidebarCollapsed, setSidebarCollapsed,
  } = useAppStore();

  const [clusterModalOpen, setClusterModalOpen] = useState(false);
  const [switchLoading, setSwitchLoading] = useState<string | null>(null);
  const [dashboardExpanded, setDashboardExpanded] = useState(true);

  const handleClusterSwitch = async (clusterId: string) => {
    const cluster = clusters.find((c) => c.id === clusterId);
    if (!cluster) return;
    setSwitchLoading(clusterId);
    setActiveCluster(cluster.id);
    if (!cluster.url.trim()) {
      setSwitchLoading(null);
      return;
    }
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
      setSwitchLoading(null);
    }
  };

  // Tour refs
  const connectionRef = useRef<HTMLDivElement>(null);
  const collectionsRef = useRef<HTMLDivElement>(null);
  const dashboardBtnRef = useRef<HTMLDivElement>(null);
  const dataBtnRef = useRef<HTMLDivElement>(null);

  // 响应式
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

  useEffect(() => {
    if (clusters.length > 0 && connectionStatus === 'disconnected') {
      const defaultCluster = clusters.find((c) => c.isDefault) || clusters[0];
      if (defaultCluster && defaultCluster.id !== activeClusterId) {
        setActiveCluster(defaultCluster.id);
        setConnection('disconnected', null, defaultCluster.url, defaultCluster.apiKey);
      }
    }
  }, [clusters, connectionStatus, activeClusterId, setActiveCluster, setConnection]);

  const currentPath = location.pathname;
  const siderWidth = sidebarCollapsed ? 68 : 256;

  /* ===== 集群切换 Popover ===== */
  const clusterSwitcherContent = (
    <div style={{ width: 280 }}>
      <div style={{ padding: '4px 0 8px', borderBottom: '1px solid var(--color-border-secondary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)' }}>{t('clusters')}</span>
        <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }} onClick={() => setClusterModalOpen(true)}>
          {t('manageClusters')}
        </Button>
      </div>
      {clusters.length === 0 ? (
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{t('noClusters')}</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {clusters.map((cluster) => {
            const isActive = cluster.id === activeClusterId;
            const isLoading = switchLoading === cluster.id;
            return (
              <div
                key={cluster.id}
                onClick={() => !isLoading && handleClusterSwitch(cluster.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px', borderRadius: 8,
                  cursor: isLoading ? 'wait' : 'pointer',
                  background: isActive ? 'var(--nav-item-active)' : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--nav-item-hover)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, display: 'block', color: 'var(--color-text-primary)' }}>{cluster.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{cluster.url}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                  {isLoading && <span style={{ fontSize: 11, color: 'var(--color-primary)' }}>…</span>}
                  {isActive && (
                    <Badge status={connectionStatus === 'connected' ? 'success' : connectionStatus === 'error' ? 'error' : 'default'} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ===== 主题色选择器 ===== */
  const themeColorContent = (
    <div style={{ display: 'flex', gap: 8, padding: 4 }}>
      {THEME_PRESETS.map((preset) => (
        <Tooltip key={preset.name} title={preset.name}>
          <div
            onClick={() => setThemeColor(preset.color)}
            style={{
              width: 24, height: 24, borderRadius: '50%',
              background: preset.color, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: themeColor === preset.color ? '2px solid var(--color-text-primary)' : '2px solid transparent',
              transition: 'border-color 0.2s',
            }}
          >
            {themeColor === preset.color && (
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓</span>
            )}
          </div>
        </Tooltip>
      ))}
    </div>
  );

  /* ===== 页面标题映射 ===== */
  const getPageTitle = () => {
    if (currentPath === '/') return t('dashboard');
    if (currentPath === '/data') return t('dataBrowsePage');
    if (currentPath === '/schema') return t('schemaManagement');
    return '';
  };

  /* ===== 侧边栏 ===== */
  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ===== 品牌区 ===== */}
      <div style={{
        padding: sidebarCollapsed ? '20px 12px 12px' : '24px 20px 16px',
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

      {/* ===== 导航菜单 ===== */}
      <div style={{ flex: 1, overflow: 'auto', padding: sidebarCollapsed ? '12px 8px' : '8px 12px' }}>
        {/* 展开按钮（收起时） */}
        {sidebarCollapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <Button
              type="text"
              size="small"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setSidebarCollapsed(false)}
              style={{ color: 'var(--color-text-quaternary)' }}
            />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Connections */}
          <div ref={connectionRef}>
            <Popover content={clusterSwitcherContent} trigger="click" placement="rightTop">
              <div className="nav-item" style={sidebarCollapsed ? { justifyContent: 'center', padding: '9px 0' } : {}}>
                <CloudServerOutlined style={{ fontSize: 16 }} />
                {!sidebarCollapsed && (
                  <>
                    <span style={{ flex: 1 }}>{t('connectionManagement')}</span>
                    <Badge
                      status={connectionStatus === 'connected' ? 'success' : connectionStatus === 'error' ? 'error' : 'default'}
                      style={{ marginRight: 0 }}
                    />
                  </>
                )}
              </div>
            </Popover>
            {/* Connection status (expanded only) */}
            {!sidebarCollapsed && (
              <div style={{ padding: '0 14px 4px' }}>
                <ConnectionManager />
              </div>
            )}
          </div>

          {/* Dashboard (parent) */}
          <div>
            <div
              ref={dashboardBtnRef}
              className={`nav-item${currentPath === '/' || currentPath.startsWith('/data') || currentPath === '/schema' ? ' active' : ''}`}
              onClick={() => {
                if (sidebarCollapsed) {
                  navigate('/');
                } else {
                  setDashboardExpanded(!dashboardExpanded);
                }
              }}
              style={sidebarCollapsed ? { justifyContent: 'center', padding: '9px 0' } : {}}
            >
              <DashboardOutlined style={{ fontSize: 16 }} />
              {!sidebarCollapsed && (
                <>
                  <span style={{ flex: 1 }}>{t('dashboard')}</span>
                  <CaretRightOutlined style={{
                    fontSize: 10,
                    color: 'var(--color-text-quaternary)',
                    transform: dashboardExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }} />
                </>
              )}
            </div>

            {/* Sub-items */}
            {!sidebarCollapsed && dashboardExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2 }}>
                <div
                  ref={dataBtnRef}
                  className={`nav-item nav-item-sub${currentPath.startsWith('/data') ? ' active' : ''}`}
                  onClick={() => navigate('/data')}
                >
                  <DatabaseOutlined style={{ fontSize: 14 }} />
                  <span>{t('dataBrowsePage')}</span>
                </div>
                <div
                  className={`nav-item nav-item-sub${currentPath === '/schema' ? ' active' : ''}`}
                  onClick={() => navigate('/schema')}
                >
                  <AppstoreOutlined style={{ fontSize: 14 }} />
                  <span>{t('schemaManagement')}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collection list (only on data page) */}
        {!sidebarCollapsed && currentPath.startsWith('/data') && connectionStatus === 'connected' && (
          <div ref={collectionsRef} style={{ marginTop: 12 }}>
            <CollectionList />
          </div>
        )}
      </div>

    </div>
  );

  /* ===== 右侧顶栏 ===== */
  const topBarContent = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 24px',
      borderBottom: '1px solid var(--color-border)',
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }}>
      {/* 左侧：页面标题 / Collections 信息 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {currentPath.startsWith('/data') && connectionStatus === 'connected' ? (
          <>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Collections
            </span>
            <span style={{
              fontSize: 12, fontWeight: 600, color: 'var(--color-text-tertiary)',
              background: 'var(--nav-item-active)', borderRadius: 10,
              padding: '2px 10px', lineHeight: '20px',
            }}>
              {collections.length}
            </span>
            {currentCollection && (
              <>
                <span style={{ color: 'var(--color-text-quaternary)', fontSize: 16, fontWeight: 300 }}>/</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                  {currentCollection}
                </span>
              </>
            )}
          </>
        ) : (
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {getPageTitle()}
          </span>
        )}
      </div>

      {/* 右侧：搜索 + 语言 + 主题 + 主题色 + 引导 + 头像 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--color-text-quaternary)' }} />}
          placeholder={t('searchPlaceholder')}
          size="small"
          style={{ width: 200, borderRadius: 10 }}
          allowClear
        />
        <Tooltip title={t(lang === 'zh' ? 'switchToEn' : 'switchToZh')}>
          <Button type="text" size="small" style={{ color: 'var(--color-text-tertiary)', fontSize: 11, fontWeight: 600 }} onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
            {t(lang === 'zh' ? 'langLabelZh' : 'langLabelEn')}
          </Button>
        </Tooltip>
        <Tooltip title={t(themeMode === 'light' ? 'themeLight' : themeMode === 'dark' ? 'themeDark' : 'themeSystem')}>
          <Button
            type="text"
            size="small"
            icon={themeMode === 'light' ? <SunOutlined /> : themeMode === 'dark' ? <MoonOutlined /> : <DesktopOutlined />}
            style={{ color: 'var(--color-text-tertiary)' }}
            onClick={() => setThemeMode(themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'system' : 'light')}
          />
        </Tooltip>
        <Popover content={themeColorContent} trigger="click" placement="bottomRight">
          <Button type="text" size="small" style={{ width: 22, height: 22, padding: 0, borderRadius: '50%', background: themeColor, border: 'none', flexShrink: 0 }} />
        </Popover>
        <Tooltip title={t('replayTour')}>
          <Button type="text" size="small" icon={<QuestionCircleOutlined />} style={{ color: 'var(--color-text-quaternary)' }} onClick={resetTour} />
        </Tooltip>
        <div style={{ width: 1, height: 18, background: 'var(--color-border)', margin: '0 4px' }} />
        <Avatar size={30} icon={<UserOutlined />} style={{ background: themeColor, cursor: 'pointer' }} />
      </div>
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Sider
        width={siderWidth}
        className="glass-sidebar"
        collapsible={false}
        trigger={null}
      >
        {sidebarContent}
      </Sider>
      <Layout style={{ background: 'transparent' }}>
        {topBarContent}
        <Content style={{ padding: 24, overflow: 'auto', background: 'transparent' }}>
          <div key={location.pathname} className="page-fade-in">
            <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}><Spin size="large" /></div>}>
              <Routes>
                <Route path="/" element={<div style={{ height: '100%' }}><Dashboard /></div>} />
                <Route path="/data" element={<DataPage />} />
                <Route path="/schema" element={<SchemaManager />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </Content>
      </Layout>
      <ClusterManagerModal open={clusterModalOpen} onClose={() => setClusterModalOpen(false)} />
      <AppTour refs={{
        connection: connectionRef,
        collections: collectionsRef,
        dashboardBtn: dashboardBtnRef,
        dataBtn: dataBtnRef,
      }} />
    </Layout>
  );
};

export default MainLayout;
