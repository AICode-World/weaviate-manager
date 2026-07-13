import { useEffect, useState } from 'react';
import { Card, Row, Col, Table, Button, Spin, Skeleton, App } from 'antd';
import {
  DatabaseOutlined, FolderOpenOutlined,
  AppstoreOutlined, CloudOutlined, ReloadOutlined, EyeOutlined, ApiOutlined,
} from '@ant-design/icons';
import EmptyState from '../components/Common/EmptyState';
import { Pie, Column } from '@ant-design/charts';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../stores/appStore';
import { useI18n } from '../i18n/I18nProvider';

// 根据品牌色动态生成图表色板（HSL 色相均匀分布）
function generateChartColors(baseColor: string, count: number = 8): string[] {
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const baseHue = Math.round(h * 360);
  const baseSat = Math.round(s * 100);
  const baseLight = Math.round(l * 100);
  return Array.from({ length: count }, (_, i) => {
    const hue = (baseHue + (360 / count) * i) % 360;
    return `hsl(${hue}, ${Math.max(baseSat, 45)}%, ${baseLight}%)`;
  });
}

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: React.ReactNode;
  label: string;
  trend?: { direction: 'up' | 'down'; text: string };
}

const StatCard: React.FC<StatCardProps> = ({ icon, iconBg, iconColor, value, label, trend }) => (
  <div className="stat-card">
    <div className="stat-icon-wrap" style={{ background: iconBg, color: iconColor }}>{icon}</div>
    <div className="stat-value">{value}</div>
    <div className="stat-label">{label}</div>
    {trend && <div className={`stat-trend ${trend.direction}`}>{trend.text}</div>}
  </div>
);

const Dashboard: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const {
    connectionStatus, client, collections,
    dashboardData, dashboardLoading, themeColor,
    setCurrentCollection, fetchDashboardData,
    activeClusterId, clusters,
  } = useAppStore();

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    if (client) {
      fetchDashboardData().then(() => setHasLoadedOnce(true));
    }
  }, [client, fetchDashboardData]);

  const handleRefresh = async () => {
    try {
      await fetchDashboardData();
    } catch {
      message.error(t('loadFail'));
    }
  };

  const handleViewData = (name: string) => {
    setCurrentCollection(name);
    navigate('/data');
  };

  if (connectionStatus !== 'connected' || !client) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
          <ApiOutlined style={{ fontSize: 48, marginBottom: 16, color: 'var(--color-text-quaternary)' }} />
          <div style={{ fontSize: 16, fontWeight: 500 }}>{t('pleaseConnect')}</div>
          <Button type="primary" onClick={() => navigate('/connections')} style={{ marginTop: 16 }}>
            {t('connectionManagement')}
          </Button>
        </div>
      </div>
    );
  }

  if (!dashboardLoading && collections.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpenOutlined />}
        title={t('noCollectionsHint')}
        actionText={t('createCollection')}
        onAction={() => navigate('/schema')}
      />
    );
  }

  const activeCluster = clusters.find((c) => c.id === activeClusterId);

  // 首次加载骨架屏
  if (!hasLoadedOnce && dashboardLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="page-header">
          <Skeleton.Input active size="small" style={{ width: 120 }} />
          <Skeleton.Button active size="small" style={{ width: 80 }} />
        </div>
        <Row gutter={[16, 16]}>
          {[0, 1, 2, 3].map((i) => (
            <Col xs={24} sm={12} lg={6} key={i}>
              <Card style={{ borderRadius: 10 }}><Skeleton active paragraph={{ rows: 0 }} /></Card>
            </Col>
          ))}
        </Row>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}><Card><Skeleton active paragraph={{ rows: 4 }} /></Card></Col>
          <Col xs={24} lg={12}><Card><Skeleton active paragraph={{ rows: 4 }} /></Card></Col>
        </Row>
      </div>
    );
  }

  // 统计卡片
  const statCards: StatCardProps[] = [
    {
      icon: <FolderOpenOutlined />, iconBg: 'rgba(22,119,255,0.1)', iconColor: '#1677ff',
      value: dashboardData?.totalCollections ?? 0, label: t('totalCollections'),
      trend: { direction: 'up', text: `↑ ${collections.length} ${t('thisWeek')}` },
    },
    {
      icon: <DatabaseOutlined />, iconBg: 'rgba(16,185,129,0.1)', iconColor: '#10b981',
      value: dashboardData?.totalObjects?.toLocaleString() ?? 0, label: t('totalObjects'),
      trend: { direction: 'up', text: `↑ ${t('todayLabel')}` },
    },
    {
      icon: <AppstoreOutlined />, iconBg: 'rgba(245,158,11,0.1)', iconColor: '#f59e0b',
      value: dashboardData?.vectorDimension === 'mixed' ? t('mixed') : (dashboardData?.vectorDimension ?? '-'),
      label: t('vectorDimension'),
    },
    {
      icon: <CloudOutlined />, iconBg: 'rgba(139,92,246,0.1)', iconColor: '#8b5cf6',
      value: dashboardData?.estimatedStorage === '-' ? '-' : `${dashboardData?.estimatedStorage}`,
      label: t('estimatedStorage'),
    },
  ];

  // 图表数据
  const pieData = (dashboardData?.collectionDetails ?? [])
    .filter((c) => c.count > 0)
    .map((c) => ({ name: c.name, count: c.count }));

  const topData = [...(dashboardData?.collectionDetails ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((c) => ({ name: c.name, count: c.count }));

  const columns = [
    { title: t('collectionName'), dataIndex: 'name', key: 'name' },
    {
      title: t('objectCount'), dataIndex: 'count', key: 'count', align: 'right' as const,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: t('vectorDimension'), dataIndex: 'vectorDim', key: 'vectorDim', align: 'right' as const,
      render: (v: number | null) => v ?? '-',
    },
    {
      title: '', key: 'action', width: 120, align: 'right' as const,
      render: (_: unknown, record: { name: string }) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewData(record.name)}>
          {t('viewData')}
        </Button>
      ),
    },
  ];

  return (
    <Spin spinning={dashboardLoading}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Page Header */}
        <div className="page-header">
          <div>
            <div className="page-title">{t('dashboard')}</div>
            <div className="page-subtitle">{activeCluster?.name || 'Weaviate'} · {activeCluster?.url || ''}</div>
          </div>
          <div className="page-header-actions">
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={dashboardLoading}>
              {t('refresh')}
            </Button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="stat-grid">
          {statCards.map((c) => <StatCard key={c.label} {...c} />)}
        </div>

        {/* Charts */}
        {pieData.length > 0 && (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card className="glass-card" title={<span style={{ fontWeight: 600 }}>{t('sizeDistribution')}</span>} style={{ borderRadius: 10 }}>
                <Pie
                  data={pieData}
                  angleField="count"
                  colorField="name"
                  height={240}
                  innerRadius={0.6}
                  label={{ text: 'name', style: { fontSize: 11 } }}
                  legend={{ color: { position: 'bottom' } }}
                  style={{ stroke: 'var(--color-bg-base)', lineWidth: 2 }}
                  scale={{ color: { range: generateChartColors(themeColor) } }}
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card className="glass-card" title={<span style={{ fontWeight: 600 }}>{t('topCollections')}</span>} style={{ borderRadius: 10 }}>
                <Column
                  data={topData}
                  xField="name"
                  yField="count"
                  colorField="name"
                  height={240}
                  label={{ text: (d: { count: number }) => d.count.toLocaleString(), textBaseline: 'bottom' }}
                  style={{ radiusTopLeft: 4, radiusTopRight: 4 }}
                  scale={{ color: { range: generateChartColors(themeColor) } }}
                  axis={{ y: { labelFormatter: (v: number) => v.toLocaleString() } }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* Collection Details Table */}
        <Card
          className="glass-card"
          title={<span style={{ fontWeight: 600 }}>{t('collections')} ({collections.length})</span>}
          style={{ borderRadius: 10 }}
          styles={{ body: { padding: 0 } }}
        >
          <Table
            dataSource={dashboardData?.collectionDetails ?? []}
            columns={columns}
            rowKey="name"
            pagination={{ pageSize: 10, size: 'small', showSizeChanger: false }}
            size="middle"
          />
        </Card>
      </div>
    </Spin>
  );
};

export default Dashboard;
