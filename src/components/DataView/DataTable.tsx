import { useEffect, useCallback, useState, useMemo } from 'react';
import {
  Spin, Typography, Space, Popconfirm, Tooltip, Button,
  Select, Drawer, Descriptions, Checkbox, Pagination, Image, App,
} from 'antd';
import {
  EditOutlined, DeleteOutlined, FileTextOutlined, FileImageOutlined,
  FileOutlined, CloseCircleOutlined, ExportOutlined,
  VideoCameraOutlined, SoundOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import useAppStore from '../../stores/appStore';
import { fetchObjects, searchBM25, searchNearText, deleteObject } from '../../services/weaviate';
import { useI18n } from '../../i18n/I18nProvider';

const { Text } = Typography;

/* ===== 工具函数 ===== */

function getFieldValue(record: Record<string, unknown>, key: string): string | null {
  const v = record[key];
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

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

function getSourceTypeColor(sourceType: string | null): string {
  if (!sourceType) return '#8b95a8';
  const map: Record<string, string> = {
    text: '#1677ff',
    image: '#722ed1',
    screenshot: '#13c2c2',
    video_frame: '#eb2f96',
    audio_transcript: '#fa8c16',
    video_transcript: '#f5222d',
  };
  return map[sourceType.toLowerCase()] || '#8b95a8';
}

function getSourceTypeIcon(sourceType: string | null): React.ReactNode {
  if (!sourceType) return <FileOutlined />;
  const st = sourceType.toLowerCase();
  if (st === 'image' || st === 'screenshot') return <FileImageOutlined />;
  if (st === 'video_frame' || st === 'video_transcript') return <VideoCameraOutlined />;
  if (st === 'audio_transcript') return <SoundOutlined />;
  return <FileTextOutlined />;
}

function renderDetailValue(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined) return <Text type="secondary">—</Text>;
  if (typeof value === 'string') {
    const mediaType = getMediaType(value);
    if (mediaType) {
      const src = toDataUri(value);
      const s = { borderRadius: 8, objectFit: 'cover' as const, border: '1px solid var(--color-border)' };
      if (mediaType === 'image') return <Image src={src} width={120} height={120} style={s} preview={{}} />;
      if (mediaType === 'video') return <video src={src} width={200} height={140} style={s} controls preload="metadata" />;
      if (mediaType === 'audio') return <audio src={src} controls preload="metadata" style={{ width: 200, height: 32 }} />;
    }
    if (value.length > 200) {
      return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, lineHeight: 1.7 }}>{value}</div>;
    }
    return <span style={{ wordBreak: 'break-all' }}>{value}</span>;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return <span>{String(value)}</span>;
  const str = JSON.stringify(value, null, 2);
  return <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace' }}>{str}</pre>;
}

/* ===== 主组件 ===== */

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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRecord, setDrawerRecord] = useState<Record<string, unknown> | null>(null);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string | null>(null);

  /* ===== 数据加载 ===== */

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
    if (client && currentCollection) { clearSearch(); loadData(1); onSelectionChange([]); }
  }, [currentCollection, refreshKey, client]);

  useEffect(() => {
    if (searchQuery.trim()) loadSearchResults();
  }, [searchQuery, searchMode, currentCollection]);

  useEffect(() => {
    setSourceTypeFilter(null);
  }, [currentCollection]);

  const isSearchMode = searchResults.length > 0 || !!searchQuery.trim();
  const displayData = isSearchMode ? searchResults : currentData;

  /* ===== 筛选 ===== */

  const sourceTypes = useMemo(() => {
    const types = new Set<string>();
    displayData.forEach((row) => {
      const v = row.source_type;
      if (typeof v === 'string' && v.trim()) types.add(v);
    });
    return [...types].sort();
  }, [displayData]);

  const filteredData = useMemo(() => {
    if (!sourceTypeFilter) return displayData;
    return displayData.filter((row) => row.source_type === sourceTypeFilter);
  }, [displayData, sourceTypeFilter]);

  /* ===== 交互 ===== */

  const handleCardClick = (record: Record<string, unknown>) => {
    setDrawerRecord(record);
    setDrawerOpen(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const keys = filteredData.map((row) => row.__id as string).filter(Boolean);
      const newKeys = [...new Set([...selectedRowKeys, ...keys])];
      onSelectionChange(newKeys);
    } else {
      const currentPageIds = new Set(filteredData.map((row) => row.__id as string));
      onSelectionChange(selectedRowKeys.filter((k) => !currentPageIds.has(k)));
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedRowKeys, id]);
    } else {
      onSelectionChange(selectedRowKeys.filter((k) => k !== id));
    }
  };

  const handleExport = () => {
    const selectedRows = displayData.filter((row) => selectedRowKeys.includes(row.__id as string));
    if (selectedRows.length === 0) return;
    const keys = new Set<string>();
    selectedRows.forEach((row) => Object.keys(row).forEach((k) => { if (!k.startsWith('__') && k !== '_additional') keys.add(k); }));
    const headers = [...keys];
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
  };

  const handleBatchDelete = async () => {
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
  };

  const handlePageChange = async (page: number) => {
    if (!client || !currentCollection) return;
    if (page === paginationCurrent) return;
    onSelectionChange([]);
    setLoading(true);
    try {
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
  };

  if (!currentCollection) {
    return (
      <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-text-tertiary)' }}>
        {t('selectCollection')}
      </div>
    );
  }

  const allSelected = filteredData.length > 0 && filteredData.every((row) => selectedRowKeys.includes(row.__id as string));
  const indeterminate = !allSelected && filteredData.some((row) => selectedRowKeys.includes(row.__id as string));
  const hasSelection = selectedRowKeys.length > 0;

  /* ===== 渲染 ===== */

  return (
    <div className="glass-card" style={{ overflow: 'hidden' }}>
      {/* 工具栏 */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Checkbox
            checked={allSelected}
            indeterminate={indeterminate}
            onChange={(e) => handleSelectAll(e.target.checked)}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {currentCollection}
          </span>
          {!isSearchMode && (
            <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              {t('total', { n: totalCount })}
            </span>
          )}
          {isSearchMode && (
            <span className="status-dot info" style={{ color: 'var(--color-text-secondary)' }}>
              {searchMode === 'bm25' ? 'BM25' : 'Semantic'}: {displayData.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {sourceTypes.length > 1 && (
            <Select
              size="small"
              allowClear
              placeholder={t('filterByType')}
              value={sourceTypeFilter}
              onChange={(v) => setSourceTypeFilter(v ?? null)}
              style={{ width: 150 }}
              options={sourceTypes.map((st) => ({ label: st, value: st }))}
            />
          )}
        </div>
      </div>

      {/* 数据列表 */}
      <Spin spinning={isLoading || isSearching}>
        {filteredData.length === 0 ? (
          <div className="data-empty-state">
            <InboxOutlined className="data-empty-state-icon" />
            <Text type="secondary" style={{ fontSize: 14 }}>
              {isSearchMode ? t('noData') : t('noDataHint')}
            </Text>
          </div>
        ) : (
          <div className="data-card-list">
            {filteredData.map((row, idx) => {
              const id = row.__id as string;
              const isSelected = selectedRowKeys.includes(id);
              const sourceFile = getFieldValue(row, 'source_file');
              const pageNum = getFieldValue(row, 'page_num');
              const section = getFieldValue(row, 'section');
              const embedModel = getFieldValue(row, 'embed_model');
              const sourceType = getFieldValue(row, 'source_type');
              const isEmbedded = embedModel === 'text-embedding-ada-002';
              const typeColor = getSourceTypeColor(sourceType);

              return (
                <div
                  key={id ?? idx}
                  className={`data-card${isSelected ? ' selected' : ''}`}
                  onClick={() => handleCardClick(row)}
                >
                  {/* Checkbox */}
                  <div style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onChange={(e) => id && handleSelectOne(id, e.target.checked)}
                    />
                  </div>

                  {/* 类型图标 */}
                  <div
                    className="data-card-icon-wrap"
                    style={{ background: typeColor + '14', color: typeColor }}
                  >
                    {getSourceTypeIcon(sourceType)}
                  </div>

                  {/* 主体 */}
                  <div className="data-card-body">
                    <div className="data-card-header">
                      <Tooltip title={sourceFile || t('unnamedFile')}>
                        <span className="data-card-filename">
                          {sourceFile || t('unnamedFile')}
                        </span>
                      </Tooltip>
                      {pageNum && (
                        <span style={{
                          fontSize: 11, color: 'var(--color-text-tertiary)',
                          background: 'var(--color-border-secondary)',
                          borderRadius: 4, padding: '1px 6px',
                        }}>
                          {t('pageNum', { n: pageNum })}
                        </span>
                      )}
                      {sourceType && (
                        <span style={{
                          fontSize: 11, borderRadius: 4, padding: '1px 6px',
                          background: typeColor + '14', color: typeColor, fontWeight: 500,
                        }}>
                          {sourceType}
                        </span>
                      )}
                    </div>
                    {section && (
                      <div className="data-card-summary">{section}</div>
                    )}
                  </div>

                  {/* 右侧状态 + 操作 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span className={`status-dot ${isEmbedded ? 'success' : 'default'}`}>
                      {isEmbedded ? t('embedded') : t('notEmbedded')}
                    </span>
                    <div className="data-card-actions" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title={t('editBtn')}>
                        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(row)} />
                      </Tooltip>
                      <Popconfirm
                        title={t('confirmDeleteOne')}
                        onConfirm={() => { if (id) onDelete(id); }}
                        okText={t('delete')}
                        cancelText={t('cancel')}
                      >
                        <Tooltip title={t('delete')}>
                          <Button type="text" size="small" icon={<DeleteOutlined />} danger />
                        </Tooltip>
                      </Popconfirm>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Spin>

      {/* 底部分页 */}
      {!isSearchMode && filteredData.length > 0 && totalCount > 20 && (
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <Pagination
            current={paginationCurrent}
            total={totalCount}
            pageSize={20}
            showTotal={(total) => t('total', { n: total })}
            showSizeChanger={false}
            size="small"
            onChange={handlePageChange}
          />
        </div>
      )}

      {/* 底部操作栏 */}
      {hasSelection && (
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--nav-item-active)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
            {t('selectedRows', { n: selectedRowKeys.length })}
          </span>
          <Space size={8}>
            <Button size="small" icon={<ExportOutlined />} onClick={handleExport}>
              {t('exportSelected')}
            </Button>
            <Popconfirm
              title={t('confirmDeleteRows', { n: selectedRowKeys.length })}
              onConfirm={handleBatchDelete}
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
      )}

      {/* 详情 Drawer */}
      <Drawer
        title={
          drawerRecord ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: getSourceTypeColor(getFieldValue(drawerRecord, 'source_type')) + '14',
                  color: getSourceTypeColor(getFieldValue(drawerRecord, 'source_type')),
                  fontSize: 16,
                }}
              >
                {getSourceTypeIcon(getFieldValue(drawerRecord, 'source_type'))}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>
                  {getFieldValue(drawerRecord, 'source_file') || t('unnamedFile')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-quaternary)', lineHeight: 1.3 }}>
                  {t('recordDetail')}
                </div>
              </div>
            </div>
          ) : t('recordDetail')
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={520}
        className="detail-drawer"
        extra={
          drawerRecord && (
            <Space>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => { setDrawerOpen(false); onEdit(drawerRecord); }}
              >
                {t('editBtn')}
              </Button>
              <Popconfirm
                title={t('confirmDeleteOne')}
                onConfirm={() => {
                  const id = drawerRecord.__id as string;
                  if (id) { onDelete(id); setDrawerOpen(false); }
                }}
                okText={t('delete')}
                cancelText={t('cancel')}
              >
                <Button size="small" danger icon={<DeleteOutlined />}>
                  {t('delete')}
                </Button>
              </Popconfirm>
            </Space>
          )
        }
      >
        {drawerRecord && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              display: 'flex', gap: 8, flexWrap: 'wrap',
              padding: '0 0 12px', borderBottom: '1px solid var(--color-border-secondary)',
            }}>
              {getFieldValue(drawerRecord, 'source_type') && (
                <span style={{
                  fontSize: 12, borderRadius: 10, padding: '2px 10px',
                  background: getSourceTypeColor(getFieldValue(drawerRecord, 'source_type')) + '14',
                  color: getSourceTypeColor(getFieldValue(drawerRecord, 'source_type')),
                  fontWeight: 500,
                }}>
                  {getFieldValue(drawerRecord, 'source_type')}
                </span>
              )}
              <span className={`status-dot ${getFieldValue(drawerRecord, 'embed_model') === 'text-embedding-ada-002' ? 'success' : 'default'}`}>
                {getFieldValue(drawerRecord, 'embed_model') === 'text-embedding-ada-002' ? t('embedded') : t('notEmbedded')}
              </span>
              {getFieldValue(drawerRecord, 'page_num') && (
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', background: 'var(--color-border-secondary)', borderRadius: 4, padding: '2px 8px' }}>
                  {t('pageNum', { n: getFieldValue(drawerRecord, 'page_num') })}
                </span>
              )}
            </div>

            <Descriptions column={1} bordered size="small" labelStyle={{ fontWeight: 500, width: 140 }}>
              {drawerRecord.__id && (
                <Descriptions.Item label={t('recordId')}>
                  <Text copyable style={{ fontSize: 12, fontFamily: 'monospace' }}>{drawerRecord.__id as string}</Text>
                </Descriptions.Item>
              )}
              {Object.entries(drawerRecord)
                .filter(([k]) => !k.startsWith('__') && k !== '_additional')
                .sort(([a], [b]) => {
                  const priority = ['source_file', 'page_num', 'section', 'source_type', 'embed_model'];
                  const ai = priority.indexOf(a);
                  const bi = priority.indexOf(b);
                  if (ai >= 0 && bi >= 0) return ai - bi;
                  if (ai >= 0) return -1;
                  if (bi >= 0) return 1;
                  return a.localeCompare(b);
                })
                .map(([key, value]) => (
                  <Descriptions.Item key={key} label={key}>
                    {renderDetailValue(key, value)}
                  </Descriptions.Item>
                ))
              }
              {drawerRecord._additional && (() => {
                const add = drawerRecord._additional as Record<string, unknown>;
                return (
                  <>
                    {add.vector && (
                      <Descriptions.Item label={t('vectorInfo')}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {Array.isArray(add.vector) ? `${(add.vector as number[]).length} dimensions` : 'exists'}
                        </Text>
                      </Descriptions.Item>
                    )}
                  </>
                );
              })()}
            </Descriptions>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default DataTable;
