import { useEffect, useCallback } from 'react';
import { Table, Spin, Empty, Typography, Image, Space, Popconfirm, Tooltip, Alert, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EditOutlined, DeleteOutlined, ExportOutlined, CloseCircleOutlined } from '@ant-design/icons';
import useAppStore from '../../stores/appStore';
import { fetchObjects, searchBM25, searchNearText, deleteObject } from '../../services/weaviate';
import { App } from 'antd';
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
      const s = { borderRadius: 4, objectFit: 'cover' as const, border: '1px solid var(--color-border)' };
      if (mediaType === 'image') return <Image src={src} width={48} height={48} style={s} preview={{}} />;
      if (mediaType === 'video') return <video src={src} width={96} height={64} style={s} controls preload="metadata" />;
      if (mediaType === 'audio') return <audio src={src} controls preload="metadata" style={{ width: 140, height: 32 }} />;
    }
    if (value.length > 80) {
      return <Tooltip title={value} styles={{ root: { maxWidth: 500 } }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 300 }}>{value}</span>
      </Tooltip>;
    }
    return <span>{value}</span>;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return <span>{String(value)}</span>;
  const str = JSON.stringify(value);
  if (str.length > 80) {
    return <Tooltip title={str} styles={{ root: { maxWidth: 400 } }}>
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
  const { message } = App.useApp();
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
      console.error('[DataTable] loadData error:', e);
      message.error(e instanceof Error ? e.message : t('loadFail'));
    } finally { setLoading(false); }
  }, [client, currentCollection, setData, setLoading, setPaginationPage, setSearchResults, t, message]);

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
    if (client && currentCollection) { clearSearch(); loadData(1); onSelectionChange([]); }
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

  const columns: ColumnsType<Record<string, unknown>> = sortedKeys.map((key) => ({
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
    render: (_v: unknown, record: Record<string, unknown>) => (
      <Space size={4}>
        <EditOutlined
          style={{ cursor: 'pointer', color: 'var(--color-primary, #1677ff)', padding: 4, borderRadius: 4 }}
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
    return <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-text-tertiary)' }}>{t('selectCollection')}</div>;
  }

  return (
    <div style={{ background: 'var(--color-bg-base)', borderRadius: 10, padding: '0 0 16px', boxShadow: 'var(--shadow-card)' }}>
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

      {/* 批量操作栏 */}
      {selectedRowKeys.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ margin: '8px 16px 0' }}
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>{t('selectedRows', { n: selectedRowKeys.length })}</span>
              <Space>
                <Button size="small" icon={<ExportOutlined />} onClick={() => {
                  const selectedRows = displayData.filter((row) => selectedRowKeys.includes(row.__id as string));
                  if (selectedRows.length === 0) return;
                  const allKeys = new Set<string>();
                  selectedRows.forEach((row) => Object.keys(row).forEach((k) => { if (!k.startsWith('__') && k !== '_additional') allKeys.add(k); }));
                  const headers = [...allKeys];
                  const csvRows = [headers.join(',')];
                  for (const row of selectedRows) {
                    const vals = headers.map((h) => {
                      const v = row[h];
                      if (v === null || v === undefined) return '';
                      if (typeof v === 'string' && v.startsWith('data:')) return t('exists');
                      const s = String(v);
                      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
                    });
                    csvRows.push(vals.join(','));
                  }
                  const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${currentCollection}_selected_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  message.success(t('exportDone', { n: selectedRows.length }));
                }}>
                  {t('exportSelected')}
                </Button>
                <Popconfirm
                  title={t('confirmDeleteRows', { n: selectedRowKeys.length })}
                  onConfirm={async () => {
                    if (!client || !currentCollection) return;
                    const total = selectedRowKeys.length;
                    let success = 0, fail = 0;
                    const hide = message.loading({ content: t('batchProgress', { current: 0, total }), key: 'bd', duration: 0 });
                    for (let i = 0; i < selectedRowKeys.length; i++) {
                      try { await deleteObject(client, currentCollection, selectedRowKeys[i]); success++; } catch { fail++; }
                      message.loading({ content: t('batchProgress', { current: i + 1, total }), key: 'bd', duration: 0 });
                    }
                    hide();
                    message.info(t('deleteDone', { s: success, f: fail }));
                    onSelectionChange([]);
                    loadData(1);
                  }}
                  okText={t('confirm')}
                  cancelText={t('cancel')}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    {t('batchDelete')}
                  </Button>
                </Popconfirm>
                <Button size="small" icon={<CloseCircleOutlined />} onClick={() => onSelectionChange([])}>
                  {t('clearSelection')}
                </Button>
              </Space>
            </div>
          }
        />
      )}

      <Spin spinning={isLoading || isSearching}>
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={isSearchMode ? false : {
            current: paginationCurrent,
            total: totalCount,
            pageSize: 20,
            showTotal: (total) => t('total', { n: total }),
            showSizeChanger: false,
            onChange: async (page) => {
              if (!client || !currentCollection) return;
              if (page === paginationCurrent) return;
              onSelectionChange([]);
              setLoading(true);
              try {
                // 向前翻：逐页获取 cursor
                let after: string | undefined;
                for (let i = 1; i < page; i++) {
                  const r = await fetchObjects(client, currentCollection, 20, after);
                  after = r.after ?? undefined;
                }
                const r = await fetchObjects(client, currentCollection, 20, after);
                setData(r.objects, r.total, { after: r.after, before: r.before });
                setPaginationPage(page);
              } catch (e: unknown) {
                message.error(e instanceof Error ? e.message : t('paginationFail'));
              } finally { setLoading(false); }
            },
          }}
          size="middle"
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty description={t('noData')} style={{ padding: 40 }} /> }}
          rowSelection={{ selectedRowKeys, onChange: (keys) => onSelectionChange(keys as string[]) }}
          style={{ marginTop: 8 }}
        />
      </Spin>
    </div>
  );
};

export default DataTable;
