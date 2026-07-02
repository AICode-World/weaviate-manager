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
        <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
          <DatabaseOutlined style={{ fontSize: 48, marginBottom: 16, color: 'var(--color-text-quaternary)' }} />
          <div style={{ fontSize: 16, fontWeight: 500 }}>{t('selectCollection')}</div>
        </div>
      </div>
    );
  }

  return (
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
    ]} style={{ background: 'var(--color-bg-base)', padding: '12px 16px 0', borderRadius: 10, boxShadow: 'var(--shadow-card)' }} />
  );
};

export default DataPage;
