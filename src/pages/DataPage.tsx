import { useState, useCallback, useRef, useEffect } from 'react';
import { Select } from 'antd';
import SearchBar from '../components/DataView/SearchBar';
import DataTable from '../components/DataView/DataTable';
import DataManagement, { type DataManagementHandle } from '../components/DataView/DataManagement';
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
  const { currentCollection, collections, setCurrentCollection, connectionStatus, totalCount } = useAppStore();

  // 自动选中第一个集合
  useEffect(() => {
    if (connectionStatus === 'connected' && collections.length > 0 && !currentCollection) {
      setCurrentCollection(collections[0]);
    }
  }, [connectionStatus, collections, currentCollection, setCurrentCollection]);

  if (connectionStatus !== 'connected') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="page-header">
          <div>
            <div className="page-title">{t('dataBrowsePage')}</div>
            <div className="page-subtitle">{t('pleaseConnect')}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">{t('dataBrowsePage')}</div>
          <div className="page-subtitle">
            {currentCollection ? `${currentCollection} · ${t('total', { n: totalCount })}` : t('selectCollection')}
          </div>
        </div>
        <div className="page-header-actions">
          {collections.length > 0 && (
            <Select
              placeholder={t('selectCollection')}
              value={currentCollection}
              onChange={(v) => setCurrentCollection(v)}
              style={{ width: 200 }}
              options={collections.map((c) => ({ label: c, value: c }))}
            />
          )}
        </div>
      </div>

      {currentCollection ? (
        <>
          {/* Toolbar */}
          <div className="glass-card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <SearchBar />
            </div>
            <DataManagement ref={dmRef} selectedRowKeys={selectedRowKeys} onSelectionChange={setSelectedRowKeys} onRefresh={handleRefresh} />
          </div>

          {/* Data Table */}
          <DataTable onEdit={handleEdit} onDelete={handleDelete} refreshKey={refreshKey} selectedRowKeys={selectedRowKeys} onSelectionChange={setSelectedRowKeys} />
        </>
      ) : (
        <div className="glass-card" style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-quaternary)' }}>
          {t('selectCollection')}
        </div>
      )}
    </div>
  );
};

export default DataPage;
