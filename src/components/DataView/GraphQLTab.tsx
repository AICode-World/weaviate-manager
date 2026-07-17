import { useState, useRef, useCallback, useEffect, Suspense, lazy } from 'react';
import { Button, Spin, Select, Drawer, Modal, Input, message, Checkbox, Tooltip } from 'antd';
import {
  PlayCircleOutlined, ClearOutlined, HistoryOutlined, SaveOutlined,
  CodeOutlined, FolderOpenOutlined, PlusOutlined, DeleteOutlined,
  ThunderboltOutlined, DownOutlined, UpOutlined,
} from '@ant-design/icons';
import useAppStore from '../../stores/appStore';
import { useQueryHistoryStore, type QueryRecord } from '../../stores/queryHistoryStore';
import { useQueryTemplateStore, type QueryTemplate } from '../../stores/queryTemplateStore';
import QueryHistoryPanel from './QueryHistoryPanel';
import QueryTemplatePanel from './QueryTemplatePanel';
import DiffViewModal from './DiffViewModal';
import { getClassProperties, listCollections } from '../../services/weaviate';
import { useI18n } from '../../i18n/I18nProvider';
import { initMonaco } from '../../monacoSetup';

const Editor = lazy(async () => {
  await initMonaco();
  const mod = await import('@monaco-editor/react');
  return { default: mod.default };
});

// ── Types ──
interface VarRow {
  key: string;
  value: string;
  enabled: boolean;
}

// ── Utils ──
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function syntaxHighlight(json: string): string {
  return escapeHtml(json).replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+\.?\d*)/g,
    (match) => {
      let color = '#cc7a00';
      if (/^"/.test(match)) {
        color = /:$/.test(match) ? '#0066cc' : '#00875a';
      } else if (/true|false/.test(match)) {
        color = '#722ed1';
      } else if (/null/.test(match)) {
        color = '#8c8c8c';
      }
      return `<span style="color:${color}">${match}</span>`;
    },
  );
}

function tryParseValue(val: string): unknown {
  const trimmed = val.trim();
  if (!trimmed) return '';
  try { return JSON.parse(trimmed); } catch { return val; }
}

function rowsToVariablesString(rows: VarRow[]): string {
  const obj: Record<string, unknown> = {};
  for (const row of rows) {
    if (!row.enabled || !row.key.trim()) continue;
    obj[row.key] = tryParseValue(row.value);
  }
  return Object.keys(obj).length ? JSON.stringify(obj, null, 2) : '';
}

function variablesStringToRows(str: string): VarRow[] {
  if (!str || !str.trim()) return [{ key: '', value: '', enabled: true }];
  try {
    const obj = JSON.parse(str);
    const entries = Object.entries(obj);
    if (entries.length === 0) return [{ key: '', value: '', enabled: true }];
    return entries.map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
      enabled: true,
    }));
  } catch {
    return [{ key: '', value: '', enabled: true }];
  }
}

/**
 * Build a params string from var rows, e.g. "limit: 10, keyword: \"AI\""
 */
function buildParamsString(rows: VarRow[]): string {
  return rows
    .filter((r) => r.enabled && r.key.trim())
    .map((r) => {
      const val = r.value.trim();
      // Smart quoting: numbers, booleans, already-quoted, objects/arrays stay raw
      const isRaw = /^(true|false|-?\d+\.?\d*)$/.test(val) || /^["\[{]/.test(val) || val === '';
      const finalVal = isRaw ? val : `"${val}"`;
      return `${r.key.trim()}: ${finalVal}`;
    })
    .join(', ');
}

/**
 * Find the collection's parentheses in the query and replace their content.
 * Returns the updated query, or the original if collection not found.
 */
function syncQueryParams(queryText: string, collectionName: string | null, rows: VarRow[]): string {
  if (!collectionName) return queryText;

  // Find "CollectionName(" — allow optional whitespace
  const searchStr = collectionName + '(';
  let idx = queryText.indexOf(searchStr);
  if (idx === -1) {
    // Try with space: "CollectionName ("
    const altStr = collectionName + ' (';
    idx = queryText.indexOf(altStr);
    if (idx === -1) return queryText;
  }

  // Position right after the "("
  const paramStart = idx + collectionName.length + 1;

  // Find the matching closing ")" — track nesting for (), {}, []
  let depth = 1;
  let paramEnd = paramStart;
  for (let i = paramStart; i < queryText.length; i++) {
    const ch = queryText[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) { paramEnd = i; break; }
    }
  }

  const newParams = buildParamsString(rows);
  return queryText.slice(0, paramStart) + newParams + queryText.slice(paramEnd);
}

// ── Glass style ──
const glassStyle: React.CSSProperties = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(var(--glass-blur))',
  WebkitBackdropFilter: 'blur(var(--glass-blur))',
  border: '1px solid var(--glass-border)',
  boxShadow: 'var(--glass-shadow)',
};

// ── Panel header ──
const PanelHeader: React.FC<{
  title: string;
  icon?: React.ReactNode;
  iconColor?: string;
  badge?: number;
  extra?: React.ReactNode;
  onToggle?: () => void;
  collapsed?: boolean;
}> = ({ title, icon, iconColor = '#4a00e0', badge, extra, onToggle, collapsed }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 14px',
      height: 36,
      flexShrink: 0,
      borderBottom: '1px solid var(--color-border)',
      userSelect: 'none',
    }}
  >
    {icon && <span style={{ color: iconColor, fontSize: 14, display: 'flex', alignItems: 'center' }}>{icon}</span>}
    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: 0.3 }}>{title}</span>
    {badge !== undefined && badge > 0 && (
      <span style={{
        fontSize: 10, background: iconColor, color: '#fff', borderRadius: 8,
        padding: '0 6px', lineHeight: '16px', fontWeight: 500,
      }}>
        {badge}
      </span>
    )}
    {extra && <div style={{ marginLeft: 'auto' }}>{extra}</div>}
    {onToggle && (
      <Button
        size="small"
        type="text"
        icon={collapsed ? <UpOutlined /> : <DownOutlined />}
        onClick={onToggle}
        style={{ marginLeft: extra ? 0 : 'auto', color: 'var(--color-text-tertiary)' }}
      />
    )}
  </div>
);

// ── Main Component ──
const GraphQLTab: React.FC = () => {
  const { t } = useI18n();
  const { client, url, cred } = useAppStore();
  const [query, setQuery] = useState('{\n  Get {\n    \n  }\n}');
  const [varRows, setVarRows] = useState<VarRow[]>([{ key: '', value: '', enabled: true }]);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultCount, setResultCount] = useState<number | undefined>(undefined);
  const [collections, setCollections] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffSource, setDiffSource] = useState<QueryRecord | null>(null);
  const [diffTarget, setDiffTarget] = useState<QueryRecord | null>(null);

  // Layout: top split (query | variables) + bottom results panel
  const [editorPct, setEditorPct] = useState(60);
  const [resultHeight, setResultHeight] = useState(260);
  const [resultCollapsed, setResultCollapsed] = useState(false);

  const editorPctRef = useRef(60);
  const resultHeightRef = useRef(260);
  const dragMode = useRef<'horizontal' | 'vertical' | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);

  const addQuery = useQueryHistoryStore((s) => s.addQuery);
  const addTemplate = useQueryTemplateStore((s) => s.addTemplate);

  useEffect(() => { editorPctRef.current = editorPct; }, [editorPct]);
  useEffect(() => { resultHeightRef.current = resultHeight; }, [resultHeight]);

  useEffect(() => {
    if (client) listCollections(client).then(setCollections).catch(() => {});
  }, [client]);

  // ── Drag logic ──
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragMode.current) return;

    if (dragMode.current === 'horizontal' && topRef.current) {
      const rect = topRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      const newPct = Math.max(25, Math.min(80, pct));
      editorPctRef.current = newPct;
      setEditorPct(newPct);
    } else if (dragMode.current === 'vertical' && outerRef.current) {
      const rect = outerRef.current.getBoundingClientRect();
      const fromBottom = rect.bottom - e.clientY;
      const newH = Math.max(80, Math.min(rect.height - 120, fromBottom));
      resultHeightRef.current = newH;
      setResultHeight(newH);
    }
  }, []);
  const handleMouseUp = useCallback(() => { dragMode.current = null; }, []);
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ── Collection select ──
  const handleSelect = async (name: string) => {
    setSelected(name);
    if (!client) return;
    // Default variables: limit
    const defaultRows: VarRow[] = [{ key: 'limit', value: '10', enabled: true }];
    try {
      const props = await getClassProperties(client, name);
      const fields = props.map((p) => `      ${p.name}`).join('\n');
      const baseQuery = `{\n  Get {\n    ${name}() {\n${fields}\n      _additional {\n        id\n      }\n    }\n  }\n}`;
      // Sync params into the query immediately
      setQuery(syncQueryParams(baseQuery, name, defaultRows));
      setVarRows(defaultRows);
    } catch {
      const baseQuery = `{\n  Get {\n    ${name}() {\n      _additional {\n        id\n      }\n    }\n  }\n}`;
      setQuery(syncQueryParams(baseQuery, name, defaultRows));
      setVarRows(defaultRows);
    }
  };

  // ── Variable row ops (with real-time query sync) ──
  const updateRow = (index: number, patch: Partial<VarRow>) => {
    setVarRows((prev) => {
      const next = prev.map((r, i) => (i === index ? { ...r, ...patch } : r));
      // Real-time: update query params immediately
      if (selected) setQuery((q) => syncQueryParams(q, selected, next));
      return next;
    });
  };
  const addRow = () => {
    setVarRows((prev) => {
      const next = [...prev, { key: '', value: '', enabled: true }];
      return next;
    });
  };
  const removeRow = (index: number) => {
    setVarRows((prev) => {
      const next = prev.length <= 1 ? [{ key: '', value: '', enabled: true }] : prev.filter((_, i) => i !== index);
      // Real-time: update query params
      if (selected) setQuery((q) => syncQueryParams(q, selected, next));
      return next;
    });
  };

  // ── Execute ──
  const handleRun = async () => {
    if (!client || !query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setResultCount(undefined);
    try {
      const graphqlUrl = `${url.replace(/\/+$/, '')}/v1/graphql`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cred) headers['Authorization'] = `Bearer ${cred}`;
      const res = await fetch(graphqlUrl, { method: 'POST', headers, body: JSON.stringify({ query }) });
      const data = await res.json();
      if (data.errors) {
        setError(data.errors.map((e: { message: string }) => e.message).join('\n'));
      } else {
        setResult(data.data ?? data);
        const resultData = data.data ?? data;
        let count: number | undefined;
        try {
          const getObj = (resultData as Record<string, unknown>)?.Get as Record<string, unknown> | undefined;
          const firstClass = getObj ? (Object.values(getObj)[0] as unknown[]) : undefined;
          count = Array.isArray(firstClass) ? firstClass.length : undefined;
        } catch { /* ignore */ }
        setResultCount(count);
        addQuery({ type: 'graphql', query, variables: rowsToVariablesString(varRows) || undefined, collection: selected ?? undefined, resultCount: count });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('graphqlFail'));
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers ──
  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    addTemplate({ name: templateName.trim(), query, variables: rowsToVariablesString(varRows), collection: selected ?? undefined });
    message.success(t('templateSaved'));
    setSaveModalOpen(false);
    setTemplateName('');
  };

  const handleLoadTemplate = (template: QueryTemplate) => {
    setQuery(template.query);
    setVarRows(variablesStringToRows(template.variables || ''));
    if (template.collection) setSelected(template.collection);
    setTemplateOpen(false);
  };

  const handleForkQuery = (record: QueryRecord) => {
    setQuery(record.query);
    setVarRows(variablesStringToRows(record.variables || ''));
    if (record.collection) setSelected(record.collection);
    setHistoryOpen(false);
    message.success(t('forked'));
  };

  const handleCompare = (source: QueryRecord, target: QueryRecord) => {
    setDiffSource(source);
    setDiffTarget(target);
    setDiffOpen(true);
    setHistoryOpen(false);
  };

  const handleClear = () => {
    setResult(null);
    setError(null);
    setResultCount(undefined);
  };

  const activeVarCount = varRows.filter((r) => r.enabled && r.key.trim()).length;

  // ── Shared styles ──
  const iconBtnStyle: React.CSSProperties = { borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' };

  return (
    <div ref={outerRef} style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* ════ Toolbar ════ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 14px',
          borderRadius: 'var(--radius-lg)',
          flexShrink: 0,
          ...glassStyle,
        }}
      >
        {/* Collection selector */}
        <Select
          placeholder={t('graphqlSelect')}
          value={selected}
          onChange={handleSelect}
          options={collections.map((c) => ({ label: c, value: c }))}
          style={{ width: 200 }}
          allowClear
        />

        {/* Divider */}
        <div style={{ width: 1, height: 22, background: 'var(--color-border)', flexShrink: 0 }} />

        {/* Action buttons */}
        <Button type="primary" icon={<PlayCircleOutlined />} loading={loading} onClick={handleRun} style={iconBtnStyle}>
          {t('graphqlRun')}
        </Button>
        <Button icon={<ClearOutlined />} onClick={handleClear} style={iconBtnStyle}>
          {t('graphqlClear')}
        </Button>
        <Button icon={<SaveOutlined />} onClick={() => setSaveModalOpen(true)} style={iconBtnStyle}>
          {t('saveAsTemplate')}
        </Button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Icon-only buttons for panels */}
        <Tooltip title={t('queryHistory')}>
          <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)} style={iconBtnStyle} />
        </Tooltip>
        <Tooltip title={t('myTemplates')}>
          <Button icon={<FolderOpenOutlined />} onClick={() => setTemplateOpen(true)} style={iconBtnStyle} />
        </Tooltip>
      </div>

      {/* ════ Top: Query Editor (60%) | Variables (40%) ════ */}
      <div
        ref={topRef}
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          ...glassStyle,
        }}
      >
        {/* ── Query Editor ── */}
        <div style={{ width: `${editorPct}%`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <PanelHeader title={t('queryTitle')} icon={<CodeOutlined />} iconColor="#722ed1" />
          <div style={{ flex: 1, minHeight: 0 }}>
            <Suspense
              fallback={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Spin />
                </div>
              }
            >
              <Editor
                height="100%"
                language="graphql"
                theme="vs"
                value={query}
                onChange={(val) => setQuery(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  padding: { top: 8 },
                  fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
                  lineNumbersMinChars: 3,
                  renderLineHighlight: 'all',
                  smoothScrolling: true,
                }}
              />
            </Suspense>
          </div>
        </div>

        {/* ── Horizontal Drag Handle ── */}
        <div
          onMouseDown={(e) => { e.preventDefault(); dragMode.current = 'horizontal'; }}
          style={{
            width: 4,
            cursor: 'col-resize',
            flexShrink: 0,
            background: 'var(--color-border)',
            position: 'relative',
            zIndex: 10,
            transition: 'background 0.15s',
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'var(--color-text-quaternary)'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'var(--color-border)'; }}
        />

        {/* ── Variables (Postman-style Key-Value, real-time sync) ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <PanelHeader
            title={t('variables')}
            icon={<CodeOutlined />}
            iconColor="#1677ff"
            badge={activeVarCount}
          />
          {/* Hint banner */}
          <div style={{
            padding: '6px 12px',
            background: 'var(--color-fill-quaternary)',
            borderBottom: '1px solid var(--color-border)',
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
            lineHeight: 1.5,
            flexShrink: 0,
          }}>
            {t('variablesHint')}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '10px 12px' }}>
            {varRows.map((row, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 0',
                  opacity: row.enabled ? 1 : 0.45,
                  transition: 'opacity 0.15s',
                }}
              >
                <Checkbox
                  checked={row.enabled}
                  onChange={(e) => updateRow(i, { enabled: e.target.checked })}
                  style={{ flexShrink: 0 }}
                />
                <Input
                  size="small"
                  placeholder={t('varKeyPlaceholder')}
                  value={row.key}
                  onChange={(e) => updateRow(i, { key: e.target.value })}
                  style={{
                    flex: 1,
                    fontFamily: "'JetBrains Mono', Consolas, monospace",
                    borderRadius: 6,
                  }}
                />
                <span style={{ color: 'var(--color-text-quaternary)', fontSize: 12, flexShrink: 0 }}>:</span>
                <Input
                  size="small"
                  placeholder={t('varValuePlaceholder')}
                  value={row.value}
                  onChange={(e) => updateRow(i, { value: e.target.value })}
                  style={{ flex: 1.2, fontFamily: "'JetBrains Mono', Consolas, monospace", borderRadius: 6 }}
                />
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeRow(i)}
                  style={{ flexShrink: 0 }}
                />
              </div>
            ))}
            <Button
              size="small"
              type="dashed"
              icon={<PlusOutlined />}
              onClick={addRow}
              block
              style={{ borderRadius: 8, marginTop: 8 }}
            >
              {t('addVariable')}
            </Button>
          </div>
        </div>
      </div>

      {/* ════ Vertical Drag Handle ════ */}
      {!resultCollapsed && (
        <div
          onMouseDown={(e) => { e.preventDefault(); dragMode.current = 'vertical'; }}
          style={{
            height: 5,
            cursor: 'row-resize',
            flexShrink: 0,
            background: 'transparent',
            position: 'relative',
            zIndex: 10,
            margin: '-2px 0',
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'var(--color-text-quaternary)'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
        />
      )}

      {/* ════ Bottom: Results Panel (full width) ════ */}
      <div
        style={{
          height: resultCollapsed ? 36 : resultHeight,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          transition: resultCollapsed ? 'height 0.2s ease' : 'none',
          ...glassStyle,
        }}
      >
        <PanelHeader
          title={t('responseTitle')}
          icon={<ThunderboltOutlined />}
          iconColor="#52c41a"
          extra={
            result && !error ? (
              <span style={{ fontSize: 11, color: '#52c41a', fontWeight: 500 }}>
                {resultCount !== undefined ? `${resultCount} ${t('records')}` : 'OK'}
              </span>
            ) : error ? (
              <span style={{ fontSize: 11, color: '#ff4d4f', fontWeight: 500 }}>Error</span>
            ) : undefined
          }
          onToggle={() => setResultCollapsed((v) => !v)}
          collapsed={resultCollapsed}
        />
        {!resultCollapsed && (
          <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg-base)' }}>
            <Spin spinning={loading}>
              {error ? (
                <pre style={{
                  color: '#ff4d4f', fontSize: 13, whiteSpace: 'pre-wrap',
                  margin: 0, padding: 14, fontFamily: "'JetBrains Mono', Consolas, monospace", lineHeight: 1.6,
                }}>
                  {error}
                </pre>
              ) : result ? (
                <pre style={{
                  fontSize: 13, margin: 0, padding: 14, whiteSpace: 'pre-wrap',
                  fontFamily: "'JetBrains Mono', Consolas, monospace", lineHeight: 1.6,
                }} dangerouslySetInnerHTML={{ __html: syntaxHighlight(JSON.stringify(result, null, 2)) }} />
              ) : (
                <div style={{
                  color: 'var(--color-text-quaternary)', padding: '40px 0', textAlign: 'center',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                }}>
                  <ThunderboltOutlined style={{ fontSize: 32, color: 'var(--color-text-quaternary)', opacity: 0.4 }} />
                  <div style={{ fontSize: 13 }}>{t('responseEmpty')}</div>
                </div>
              )}
            </Spin>
          </div>
        )}
      </div>

      {/* ════ Drawers ════ */}
      <Drawer
        title={t('queryHistory')}
        placement="right"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        styles={{ body: { padding: 0 }, wrapper: { width: 380 } }}
      >
        <QueryHistoryPanel
          onLoadQuery={(record) => {
            setQuery(record.query);
            setVarRows(variablesStringToRows(record.variables || ''));
            if (record.collection) setSelected(record.collection);
            setHistoryOpen(false);
          }}
          onForkQuery={handleForkQuery}
          onCompare={handleCompare}
        />
      </Drawer>

      <Drawer
        title={t('myTemplates')}
        placement="right"
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        styles={{ body: { padding: 0 }, wrapper: { width: 380 } }}
      >
        <QueryTemplatePanel onLoadTemplate={handleLoadTemplate} />
      </Drawer>

      {/* ════ Save Template Modal ════ */}
      <Modal
        title={t('saveAsTemplate')}
        open={saveModalOpen}
        onOk={handleSaveTemplate}
        onCancel={() => { setSaveModalOpen(false); setTemplateName(''); }}
        okText={t('confirm')}
        cancelText={t('cancel')}
        okButtonProps={{ disabled: !templateName.trim() }}
      >
        <Input
          placeholder={t('templateNamePlaceholder')}
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          onPressEnter={handleSaveTemplate}
          autoFocus
        />
      </Modal>

      {/* ════ Diff Modal ════ */}
      <DiffViewModal
        open={diffOpen}
        onClose={() => setDiffOpen(false)}
        source={diffSource}
        target={diffTarget}
      />
    </div>
  );
};

export default GraphQLTab;
