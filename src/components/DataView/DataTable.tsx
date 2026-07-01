import { useEffect, useCallback } from 'react';
import { Table, Spin, Empty, Typography, Pagination, Image, Tag, Space, Popconfirm, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import useAppStore from '../../stores/appStore';
import { fetchObjects, searchBM25, searchNearText } from '../../services/weaviate';
import { message } from 'antd';
import { useI18n } from '../../i18n/I18nProvider';

const { Text } = Typography;

function getMediaType(str: string): 'image' | 'video' | 'audio' | null {
  const m = str.match(/^data:(image|video|audio)\//);
  if (m) return m[1] as 'image' | 'video' | 'audio';
  if (str.startsWith('/9j/') || str.startsWith('iVBOR') || str.startsWith('R0lGOD') || str.startsWith('UklGR')) return 'image';
  return null;
}

function toDataUri(raw: string): string {
  if (raw.startsWith('data:')) return raw;
  const mime = raw.startsWith('/9j/') ? 'image/jpeg'
    : raw.startsWith('iVBOR') ? 'image/png'
    : raw.startsWith('R0lGOD') ? 'image/gif'
    : raw.startsWith('UklGR') ? 'image/webp'
    : 'image/jpeg';
  return `data:${mime};base64,${raw}`;
}

function renderCell(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return <Text type="secondary">—</Text>;
  if (typeof value === 'string') {
    const mediaType = getMediaType(value);
    if (mediaType) {
      const src = toDataUri(value);
      const s = { borderRadius: 4, objectFit: 'cover' as const, border: '1px solid #e5e8f0' };
      if (mediaType === 'image') return <Image src={src} width={48} height={48} style={s} preview={{}} />;
      if (mediaType === 'video') return <video src={src} width={96} height={64} style={s} controls preload="metadata" />;
      if (mediaType === 'audio') return <audio src={src} controls preload="metadata" style={{ width: 140, height: 32 }} />;
    }
    if (value.length > 80) {
      return <Tooltip title={value} overlayStyle={{ maxWidth: 500 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 300 }}>{value}</span>
      </Tooltip>;
    }
    return <span>{value}</span>;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return <span>{String(value)}</span>;
  const str = JSON.stringify(value);
  if (str.length > 80) {
    return <Tooltip title={str} overlayStyle={{ maxWidth: 400 }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 180 }}>{str.slice(0, 80)}…</span>
    </Tooltip>;
  }
  return <span>{str}</span>;
}

function columnWidth(key: string): number {
  if (key === 'text' || key === 'caption') return 350;
  if (key === 'section' || key === 'source_file') return 200;
  if (key === 'image') return 80;
  if (key.includes('timestamp') || key === 'uploaded_at') return 180;
  return 140;
}

const PRIORITY_KEYS = ['text', 'caption', 'image', 'section', 'source_type'];

const DataTable: React.FC<{
  onEdit: (record: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  refreshKey: number;
  selectedRowKeys: string[];
  onSelectionChange: (keys: string[]) => void;
}> = ({ onEdit, onDelete, refreshKey, selectedRowKeys, onSelectionChange }) => {
  const { t } = useI18n();
  const {
    client, currentCollection, currentData, totalCount,
    isLoading, paginationCurrent,
    searchMode, searchQuery, searchResults, isSearching,
    setData, setLoading, setPaginationPage,
    setSearchResults, setSearching, clearSearch,
  } = useAppStore();

  const loadData = useCallback(async (page: number, after?: string) => {
    if (!client || !currentCollection) return;
    setLoading(true);
    setSearchResults([]);
    try {
      const result = await fetchObjects(client, currentCollection, 20, after);
      setData(result.objects, result.total, { after: result.after, before: result.before });
      setPaginationPage(page);
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('loadFail'));
    } finally { setLoading(false); }
  }, [client, currentCollection, setData, setLoading, setPaginationPage, setSearchResults]);

  const loadSearchResults = useCallback(async () => {
    if (!client || !currentCollection || !searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = searchMode === 'bm25'
        ? await searchBM25(client, currentCollection, searchQuery)
        : await searchNearText(client, currentCollection, searchQuery);
      setSearchResults(results);
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('searchFail'));
    } finally { setSearching(false); }
  }, [client, currentCollection, searchQuery, searchMode, setSearchResults, setSearching]);

  useEffect(() => {
    if (client && currentCollection) { clearSearch(); loadData(1); }
  }, [currentCollection, refreshKey, client]);

  useEffect(() => {
    if (searchQuery.trim()) loadSearchResults();
  }, [searchQuery, searchMode, currentCollection]);

  const isSearchMode = searchResults.length > 0 || !!searchQuery.trim();
  const displayData = isSearchMode ? searchResults : currentData;

  const allKeys = new Set<string>();
  displayData.forEach((row) => Object.keys(row).forEach((k) => allKeys.add(k)));
  allKeys.delete('_additional');
  const sortedKeys = [...allKeys].filter((k) => !k.startsWith('__')).sort((a, b) => {
    const ai = PRIORITY_KEYS.indexOf(a), bi = PRIORITY_KEYS.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });

  const columns = sortedKeys.map((key) => ({
    title: key,
    dataIndex: key,
    key,
    render: renderCell,
    width: columnWidth(key),
  }));

  columns.push({
    title: t('actions'),
    key: '_actions',
    width: 80,
    fixed: 'right' as const,
    render: (_: unknown, record: Record<string, unknown>) => (
      <Space size={4}>
        <EditOutlined
          style={{ cursor: 'pointer', color: '#1677ff', padding: 4, borderRadius: 4 }}
          onClick={() => onEdit(record)}
        />
        <Popconfirm title={t('confirmDeleteOne')} onConfirm={() => { const id = record.__id as string; if (id) onDelete(id); }} okText={t('delete')} cancelText={t('cancel')}>
          <DeleteOutlined style={{ cursor: 'pointer', color: '#ff4d4f', padding: 4, borderRadius: 4 }} />
        </Popconfirm>
      </Space>
    ),
  });

  const dataSource = displayData.map((row, idx) => {
    const flat: Record<string, unknown> = { __id: row.__id };
    if (row._additional) flat._additional = row._additional;
    Object.entries(row).forEach(([k, v]) => { if (k !== '_additional' && !k.startsWith('__')) flat[k] = v; });
    return { ...flat, key: (row.__id as string) ?? String(idx) };
  });

  if (!currentCollection) {
    return <div style={{ textAlign: 'center', padding: 80, color: '#6b7589' }}>{t('selectCollection')}</div>;
  }

  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '0 0 16px', boxShadow: '0 1px 3px rgba(26, 31, 54, 0.04), 0 4px 12px rgba(26, 31, 54, 0.04)' }}>
      {isSearchMode && (
        <div style={{ padding: '12px 16px 0' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {searchMode === 'bm25' ? `🔍 ${t('keyword')}` : `🧠 ${t('semantic')}`} {t('search')} —
            {t('results')}: {displayData.length}
          </Text>
        </div>
      )}
      {!isSearchMode && (
        <div style={{ padding: '12px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 13 }}>
            <Text strong>{currentCollection}</Text>
            <Text type="secondary"> · {t('total', { n: totalCount })}</Text>
          </Text>
        </div>
      )}

      <Spin spinning={isLoading || isSearching}>
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          size="middle"
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty description={t('noData')} style={{ padding: 40 }} /> }}
          rowSelection={{ selectedRowKeys, onChange: (keys) => onSelectionChange(keys as string[]) }}
          style={{ marginTop: 8 }}
        />
      </Spin>

      {!isSearchMode && totalCount > 0 && (
        <div style={{ textAlign: 'center', padding: '16px 0 0' }}>
          <Pagination
            current={paginationCurrent}
            total={totalCount}
            pageSize={20}
            showSizeChanger={false}
            showTotal={(n) => t('total', { n })}
            onChange={async (page) => {
              if (!client || !currentCollection) return;
              setLoading(true);
              try {
                let after: string | undefined;
                for (let i = 1; i < page; i++) { const r = await fetchObjects(client, currentCollection, 20, after); after = r.after ?? undefined; }
                const r = await fetchObjects(client, currentCollection, 20, after);
                setData(r.objects, r.total, { after: r.after, before: r.before });
                setPaginationPage(page);
              } catch (e: unknown) {
                message.error(e instanceof Error ? e.message : t('paginationFail'));
              } finally { setLoading(false); }
            }}
          />
        </div>
      )}
    </div>
  );
};

export default DataTable;
