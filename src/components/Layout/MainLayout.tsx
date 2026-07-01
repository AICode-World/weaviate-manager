import { useState, useCallback, useRef } from 'react';
import { Layout, Tabs, Button, Typography, Space } from 'antd';
import { UnorderedListOutlined, PictureOutlined, CodeOutlined } from '@ant-design/icons';
import ConnectionManager from '../Connection/ConnectionManager';
import CollectionList from '../Collections/CollectionList';
import SearchBar from '../DataView/SearchBar';
import DataTable from '../DataView/DataTable';
import DataManagement, { type DataManagementHandle } from '../DataView/DataManagement';
import MultiModalSearch from '../DataView/MultiModalSearch';
import GraphQLTab from '../DataView/GraphQLTab';
import useAppStore from '../../stores/appStore';
import { useI18n } from '../../i18n/I18nProvider';

const { Sider, Content } = Layout;
const { Text } = Typography;

const MainLayout: React.FC = () => {
  const { t, lang, setLang } = useI18n();
  const { connectionStatus, client } = useAppStore();
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const handleRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const dmRef = useRef<DataManagementHandle>(null);
  const handleEdit = useCallback((r: Record<string, unknown>) => dmRef.current?.openEdit(r), []);
  const handleDelete = useCallback((id: string) => dmRef.current?.handleDelete(id), []);

  const siderStyle = { background: '#f1f3f9', borderRight: '1px solid #e5e8f0' };

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #e5e8f0' }}>
        <Text strong style={{ color: '#1a1f36', fontSize: 16, letterSpacing: -0.2 }}>{t('appName')}</Text>
        <div style={{ color: '#6b7589', fontSize: 12, marginTop: 4, letterSpacing: 0.1 }}>{t('appDesc')}</div>
      </div>
      <div style={{ padding: '12px 16px 0' }}><ConnectionManager /></div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 12px' }}><CollectionList /></div>
      <div style={{ padding: '8px 16px 12px', borderTop: '1px solid #e5e8f0' }}>
        <Button
          type="text"
          size="small"
          block
          style={{ color: '#6b7589', fontSize: 12, fontWeight: 500 }}
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
        >
          {lang === 'zh' ? '🌐 中文' : '🌐 EN'}
        </Button>
      </div>
    </div>
  );

  if (connectionStatus !== 'connected' || !client) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Sider width={240} style={siderStyle}>{sidebarContent}</Sider>
        <Content style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f8fa' }}>
          <div style={{ textAlign: 'center', color: '#6b7589' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{t('pleaseConnect')}</div>
          </div>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={240} style={siderStyle}>{sidebarContent}</Sider>
      <Content style={{ padding: 20, background: '#f7f8fa', overflow: 'auto' }}>
        <Tabs defaultActiveKey="browse" size="small" items={[
          {
            key: 'browse',
            label: <span><UnorderedListOutlined /> {t('dataBrowse')}</span>,
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}><SearchBar /></div>
                  <DataManagement ref={dmRef} selectedRowKeys={selectedRowKeys} onSelectionChange={setSelectedRowKeys} onRefresh={handleRefresh} />
                </div>
                <DataTable onEdit={handleEdit} onDelete={handleDelete} refreshKey={refreshKey} selectedRowKeys={selectedRowKeys} onSelectionChange={setSelectedRowKeys} />
              </div>
            ),
          },
          { key: 'graphql', label: <span><CodeOutlined /> {t('graphqlTab')}</span>, children: <GraphQLTab /> },
          { key: 'multimodal', label: <span><PictureOutlined /> {t('multimodalSearch')}</span>, children: <MultiModalSearch /> },
        ]} style={{ background: '#fff', padding: '12px 16px 0', borderRadius: 10, boxShadow: '0 1px 3px rgba(26, 31, 54, 0.04), 0 4px 12px rgba(26, 31, 54, 0.04)' }} />
      </Content>
    </Layout>
  );
};

export default MainLayout;
