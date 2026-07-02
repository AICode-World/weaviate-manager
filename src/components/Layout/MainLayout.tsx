import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Layout, Button, Typography, Popover, Tooltip, Badge, App, Spin } from 'antd';
import {
  DashboardOutlined, DatabaseOutlined, AppstoreOutlined,
  SunOutlined, MoonOutlined, DesktopOutlined, QuestionCircleOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, CloudServerOutlined,
} from '@ant-design/icons';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import ConnectionManager from '../Connection/ConnectionManager';
import CollectionList from '../Collections/CollectionList';
import ClusterManagerModal from '../Connection/ClusterManagerModal';
import AppTour, { resetTour } from '../Onboarding/AppTour';
import useAppStore, { THEME_PRESETS } from '../../stores/appStore';
import { useI18n } from '../../i18n/I18nProvider';
import { createClient, testConnection, listCollections } from '../../services/weaviate';

// 路由懒加载：每个页面只在访问时下载
const Dashboard = lazy(() => import('../../pages/Dashboard'));
const DataPage = lazy(() => import('../../pages/DataPage'));
const SchemaManager = lazy(() => import('../Schema/SchemaManager'));

const { Sider, Content } = Layout;
const { Text } = Typography;

const MainLayout: React.FC = () => {
  const { t, lang, setLang } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const {
    connectionStatus, loadClusters, clusters, activeClusterId,
    setActiveCluster, setConnection, setCollections,
    themeMode, setThemeMode, themeColor, setThemeColor,
    sidebarCollapsed, setSidebarCollapsed,
  } = useAppStore();

  const [clusterModalOpen, setClusterModalOpen] = useState(false);
  const [switchLoading, setSwitchLoading] = useState<string | null>(null);

  // 切换集群连接
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
  const dashboardBtnRef = useRef<HTMLButtonElement>(null);
  const dataBtnRef = useRef<HTMLButtonElement>(null);

  // 响应式：双向监听窗口宽度
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      } else if (window.innerWidth >= 1024) {
        setSidebarCollapsed(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setSidebarCollapsed]);

  // 初始化集群，并自动填入默认集群配置
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
  const siderWidth = sidebarCollapsed ? 64 : 240;
  const siderStyle = { background: 'var(--color-bg-sidebar)', borderRight: '1px solid var(--color-border)' };

  // 集群切换 Popover 内容
  const clusterSwitcherContent = (
    <div style={{ width: 280 }}>
      <div style={{ padding: '4px 0 8px', borderBottom: '1px solid var(--color-border-secondary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong style={{ fontSize: 13 }}>{t('clusters')}</Text>
        <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }} onClick={() => setClusterModalOpen(true)}>
          {t('manageClusters')}
        </Button>
      </div>
      {clusters.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>{t('noClusters')}</Text>
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 6,
                  cursor: isLoading ? 'wait' : 'pointer',
                  background: isActive ? 'var(--color-primary-bg, rgba(22,119,255,0.08))' : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--color-bg-hover, rgba(0,0,0,0.04))'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ fontSize: 12, display: 'block' }}>{cluster.name}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }} ellipsis>{cluster.url}</Text>
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

  // 主题色选择器 Popover 内容
  const themeColorContent = (
    <div style={{ display: 'flex', gap: 8, padding: 4 }}>
      {THEME_PRESETS.map((preset) => (
        <Tooltip key={preset.name} title={preset.name}>
          <div
            onClick={() => setThemeColor(preset.color)}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: preset.color,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 头部 */}
      <div style={{ padding: sidebarCollapsed ? '16px 8px' : '20px 16px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {!sidebarCollapsed && (
          <>
            <div>
              <Text strong style={{ color: 'var(--color-text-primary)', fontSize: 16, letterSpacing: -0.2 }}>{t('appName')}</Text>
              <div style={{ color: 'var(--color-text-tertiary)', fontSize: 12, marginTop: 4, letterSpacing: 0.1 }}>{t('appDesc')}</div>
            </div>
          </>
        )}
        <Button
          type="text"
          size="small"
          icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{ color: 'var(--color-text-tertiary)' }}
        />
      </div>

      {!sidebarCollapsed && (
        <div ref={connectionRef} style={{ padding: '12px 16px 0' }}>
          <Popover content={clusterSwitcherContent} trigger="click" placement="rightTop">
            <Button
              type="text"
              size="small"
              block
              icon={<CloudServerOutlined />}
              style={{ justifyContent: 'flex-start', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}
            >
              {t('connectionManagement')}
            </Button>
          </Popover>
          <div style={{ height: 4 }} />
          <ConnectionManager />
        </div>
      )}

      {/* 导航菜单：垂直排列避免文字溢出 */}
      <div style={{ padding: sidebarCollapsed ? '8px 4px' : '8px 16px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Button
            ref={dashboardBtnRef}
            type={currentPath === '/' ? 'primary' : 'text'}
            size="small"
            block
            icon={<DashboardOutlined />}
            onClick={() => navigate('/')}
            style={{ fontSize: 12, fontWeight: 500, justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
          >
            {!sidebarCollapsed && t('dashboard')}
          </Button>
          <Button
            ref={dataBtnRef}
            type={currentPath.startsWith('/data') ? 'primary' : 'text'}
            size="small"
            block
            icon={<DatabaseOutlined />}
            onClick={() => navigate('/data')}
            style={{ fontSize: 12, fontWeight: 500, justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
          >
            {!sidebarCollapsed && t('dataBrowsePage')}
          </Button>
          <Button
            type={currentPath === '/schema' ? 'primary' : 'text'}
            size="small"
            block
            icon={<AppstoreOutlined />}
            onClick={() => navigate('/schema')}
            style={{ fontSize: 12, fontWeight: 500, justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
          >
            {!sidebarCollapsed && t('schemaManagement')}
          </Button>
        </div>
      </div>

      {/* 集合列表：仅数据浏览页显示 */}
      {!sidebarCollapsed && currentPath.startsWith('/data') && connectionStatus === 'connected' && (
        <div ref={collectionsRef} style={{ flex: 1, overflow: 'auto', padding: sidebarCollapsed ? '8px' : '8px 16px 12px' }}>
          <CollectionList />
        </div>
      )}
      {!currentPath.startsWith('/data') && <div style={{ flex: 1 }} />}
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={siderWidth} style={siderStyle} collapsible={false}>
        {sidebarContent}
      </Sider>
      <Layout>
        {/* 右上角控制区 */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 8,
          padding: '12px 20px',
          background: 'var(--color-bg-container)',
          borderBottom: '1px solid var(--color-border-secondary)',
        }}>
          <Tooltip title={t(lang === 'zh' ? 'switchToEn' : 'switchToZh')}>
            <Button type="text" size="small" style={{ color: 'var(--color-text-tertiary)', fontSize: 12, fontWeight: 500 }} onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
              🌐 {t(lang === 'zh' ? 'langLabelZh' : 'langLabelEn')} ⇄
            </Button>
          </Tooltip>
          <Tooltip title={t(themeMode === 'light' ? 'themeLight' : themeMode === 'dark' ? 'themeDark' : 'themeSystem')}>
            <Button type="text" size="small" icon={themeMode === 'light' ? <SunOutlined /> : themeMode === 'dark' ? <MoonOutlined /> : <DesktopOutlined />} style={{ color: 'var(--color-text-tertiary)' }} onClick={() => setThemeMode(themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'system' : 'light')} />
          </Tooltip>
          <Popover content={themeColorContent} trigger="click" placement="bottomRight">
            <Button
              type="text"
              size="small"
              style={{ width: 24, height: 24, padding: 0, borderRadius: '50%', background: themeColor, border: 'none' }}
            />
          </Popover>
          <Tooltip title={t('replayTour')}>
            <Button
              type="text"
              size="small"
              icon={<QuestionCircleOutlined />}
              style={{ color: 'var(--color-text-tertiary)' }}
              onClick={resetTour}
            />
          </Tooltip>
        </div>
        <Content style={{ padding: 20, background: 'var(--color-bg-layout)', overflow: 'auto' }}>
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
