import { useState, useCallback, useRef } from 'react';
import { Tabs } from 'antd';
import { UnorderedListOutlined, PictureOutlined, CodeOutlined, DatabaseOutlined } from '@ant-design/icons';
import SearchBar from '../components/DataView/SearchBar';
import DataTable from '../components/DataView/DataTable';
import DataManagement, { type DataManagementHandle } from '../components/DataView/DataManagement';
import MultiModalSearch from '../components/DataView/MultiModalSearch';
import GraphQLTab from '../components/DataView/GraphQLTab';
import useAppStore from '../stores/appStore';
import { useI18n } from '../i18n/I18nProvider';

const DataPage: React.FC = () => {
  const { t } = useI18n();
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const handleRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const dmRef = useRef<DataManagementHandle>(null);
  const handleEdit = useCallback((r: Record<string, unknown>) => dmRef.current?.openEdit(r), []);
  const handleDelete = useCallback((id: string) => dmRef.current?.handleDelete(id), []);
  const { currentCollection } = useAppStore();

  if (!currentCollection) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', color: 'var(--color-text-quaternary)' }}>
          <DatabaseOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-tertiary)' }}>{t('selectCollection')}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 搜索和操作栏 */}
      <div className="glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <SearchBar />
        </div>
        <DataManagement ref={dmRef} selectedRowKeys={selectedRowKeys} onSelectionChange={setSelectedRowKeys} onRefresh={handleRefresh} />
      </div>

      {/* 标签页 */}
      <Tabs defaultActiveKey="browse" size="small" items={[
        {
          key: 'browse',
          label: <span><UnorderedListOutlined /> {t('dataBrowse')}</span>,
          children: <DataTable onEdit={handleEdit} onDelete={handleDelete} refreshKey={refreshKey} selectedRowKeys={selectedRowKeys} onSelectionChange={setSelectedRowKeys} />,
        },
        { key: 'graphql', label: <span><CodeOutlined /> {t('graphqlTab')}</span>, children: <GraphQLTab /> },
        { key: 'multimodal', label: <span><PictureOutlined /> {t('multimodalSearch')}</span>, children: <MultiModalSearch /> },
      ]} style={{ background: 'transparent' }} />
    </div>
  );
};

export default DataPage;
