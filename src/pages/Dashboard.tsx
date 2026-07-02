import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Button, Spin, Skeleton, App } from 'antd';
import {
  DashboardOutlined, DatabaseOutlined, FolderOpenOutlined,
  AppstoreOutlined, CloudOutlined, ReloadOutlined, EyeOutlined, ApiOutlined,
} from '@ant-design/icons';
import EmptyState from '../components/Common/EmptyState';
import { Pie, Column } from '@ant-design/charts';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../stores/appStore';
import { useI18n } from '../i18n/I18nProvider';

const CHART_COLORS = ['#1677ff', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16'];

const Dashboard: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const {
    connectionStatus, client, collections,
    dashboardData, dashboardLoading,
    setCurrentCollection, fetchDashboardData,
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

  const cards = [
    { title: t('totalObjects'), value: dashboardData?.totalObjects ?? 0, icon: <DatabaseOutlined />, color: '#1677ff' },
    { title: t('totalCollections'), value: dashboardData?.totalCollections ?? 0, icon: <FolderOpenOutlined />, color: '#10b981' },
    {
      title: t('vectorDimension'),
      value: dashboardData?.vectorDimension === 'mixed' ? t('mixed') : (dashboardData?.vectorDimension ?? '-'),
      icon: <AppstoreOutlined />, color: '#f59e0b',
    },
    {
      title: t('estimatedStorage'),
      value: dashboardData?.estimatedStorage === '-' ? '-' : `${dashboardData?.estimatedStorage} MB`,
      icon: <CloudOutlined />, color: '#8b5cf6',
    },
  ];

  // 图表数据：集合大小分布
  const pieData = (dashboardData?.collectionDetails ?? [])
    .filter((c) => c.count > 0)
    .map((c) => ({ name: c.name, count: c.count }));

  // 图表数据：TOP 5 集合对象数
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

  // 首次加载：显示骨架屏；后续刷新：显示 Spin 覆盖
  if (!hasLoadedOnce && dashboardLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton.Input active size="small" style={{ width: 120 }} />
          <Skeleton.Button active size="small" style={{ width: 80 }} />
        </div>
        <Row gutter={[16, 16]}>
          {[0, 1, 2, 3].map((i) => (
            <Col xs={24} sm={12} lg={6} key={i}>
              <Card style={{ borderRadius: 10 }}>
                <Skeleton active paragraph={{ rows: 0 }} />
              </Card>
            </Col>
          ))}
        </Row>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}><Card><Skeleton active paragraph={{ rows: 4 }} /></Card></Col>
          <Col xs={24} lg={12}><Card><Skeleton active paragraph={{ rows: 4 }} /></Card></Col>
        </Row>
        <Card><Skeleton active paragraph={{ rows: 5 }} /></Card>
      </div>
    );
  }

  return (
    <Spin spinning={dashboardLoading}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DashboardOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>{t('dashboard')}</span>
          </div>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={dashboardLoading}>
            {t('refresh')}
          </Button>
        </div>

        {/* 统计卡片 */}
        <Row gutter={[16, 16]}>
          {cards.map((c) => (
            <Col xs={24} sm={12} lg={6} key={c.title}>
              <Card style={{ borderRadius: 10 }}>
                <Statistic
                  title={<span style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>{c.title}</span>}
                  value={c.value}
                  prefix={<span style={{ color: c.color, marginRight: 8 }}>{c.icon}</span>}
                  styles={{ content: { color: 'var(--color-text-primary)', fontWeight: 600 } }}
                />
              </Card>
            </Col>
          ))}
        </Row>

        {/* 图表区 */}
        {pieData.length > 0 && (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title={<span style={{ fontWeight: 600 }}>{t('sizeDistribution')}</span>} style={{ borderRadius: 10 }}>
                <Pie
                  data={pieData}
                  angleField="count"
                  colorField="name"
                  height={240}
                  innerRadius={0.6}
                  label={{ text: 'name', style: { fontSize: 11 } }}
                  legend={{ color: { position: 'bottom' } }}
                  style={{ stroke: 'var(--color-bg-base)', lineWidth: 2 }}
                  scale={{ color: { range: CHART_COLORS } }}
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title={<span style={{ fontWeight: 600 }}>{t('topCollections')}</span>} style={{ borderRadius: 10 }}>
                <Column
                  data={topData}
                  xField="name"
                  yField="count"
                  colorField="name"
                  height={240}
                  label={{ text: (d: { count: number }) => d.count.toLocaleString(), textBaseline: 'bottom' }}
                  style={{ radiusTopLeft: 4, radiusTopRight: 4 }}
                  scale={{ color: { range: CHART_COLORS } }}
                  axis={{ y: { labelFormatter: (v: number) => v.toLocaleString() } }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* 集合详情表 */}
        <Card
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
