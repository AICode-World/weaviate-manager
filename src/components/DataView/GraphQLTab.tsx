import { useState, useRef, useCallback, useEffect } from 'react';
import { Space, Button, Spin, Select, Drawer } from 'antd';
import { PlayCircleOutlined, ClearOutlined, HistoryOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import useAppStore from '../../stores/appStore';
import { useQueryHistoryStore } from '../../stores/queryHistoryStore';
import QueryHistoryPanel from './QueryHistoryPanel';
import { getClassProperties, listCollections } from '../../services/weaviate';
import { useI18n } from '../../i18n/I18nProvider';

const GraphQLTab: React.FC = () => {
  const { t } = useI18n();
  const { client, url } = useAppStore();
  const [query, setQuery] = useState('{\n  Get {\n    \n  }\n}');
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [leftWidth, setLeftWidth] = useState(50);
  const [collections, setCollections] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const addQuery = useQueryHistoryStore((s) => s.addQuery);

  useEffect(() => {
    if (client) listCollections(client).then(setCollections).catch(() => {});
  }, [client]);

  const handleSelect = async (name: string) => {
    setSelected(name);
    if (!client) return;
    try {
      const props = await getClassProperties(client, name);
      const fields = props.map((p) => `      ${p.name}`).join('\n');
      setQuery(`{\n  Get {\n    ${name}(limit: 10) {\n${fields}\n      _additional {\n        id\n      }\n    }\n  }\n}`);
    } catch {
      setQuery(`{\n  Get {\n    ${name}(limit: 10) {\n      _additional {\n        id\n      }\n    }\n  }\n}`);
    }
  };

  const handleRun = async () => {
    if (!client || !query.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const graphqlUrl = `${url.replace(/\/+$/, '')}/v1/graphql`;
      const res = await fetch(graphqlUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.errors) setError(data.errors.map((e: { message: string }) => e.message).join('\n'));
      else {
        setResult(data.data ?? data);
        // 记录到查询历史
        const resultData = data.data ?? data;
        let resultCount: number | undefined;
        try {
          const getObj = (resultData as Record<string, unknown>)?.Get as Record<string, unknown> | undefined;
          const firstClass = getObj ? Object.values(getObj)[0] as unknown[] : undefined;
          resultCount = Array.isArray(firstClass) ? firstClass.length : undefined;
        } catch { /* ignore */ }
        addQuery({ type: 'graphql', query, collection: selected ?? undefined, resultCount });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('graphqlFail'));
    } finally { setLoading(false); }
  };

  const onMouseDown = useCallback(() => { dragging.current = true; }, []);
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const pct = ((e.clientX - containerRef.current.getBoundingClientRect().left) / containerRef.current.getBoundingClientRect().width) * 100;
    setLeftWidth(Math.max(20, Math.min(80, pct)));
  }, []);
  const onMouseUp = useCallback(() => { dragging.current = false; }, []);
  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
    return () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  return (
    <div style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Space style={{ flexWrap: 'wrap' }}>
        <Select placeholder={t('graphqlSelect')} value={selected} onChange={handleSelect}
          options={collections.map((c) => ({ label: c, value: c }))} style={{ width: 200 }} allowClear />
        <Button type="primary" icon={<PlayCircleOutlined />} loading={loading} onClick={handleRun}>{t('graphqlRun')}</Button>
        <Button icon={<ClearOutlined />} onClick={() => { setResult(null); setError(null); }}>{t('graphqlClear')}</Button>
        <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>{t('queryHistory')}</Button>
      </Space>
      <div ref={containerRef} style={{ flex: 1, display: 'flex', minHeight: 0, userSelect: 'none' }}>
        <div style={{ width: `${leftWidth}%`, border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
          <Editor height="100%" language="graphql" theme="vs-dark" value={query} onChange={(val) => setQuery(val || '')}
            options={{ minimap: { enabled: false }, fontSize: 14, lineNumbers: 'on', wordWrap: 'on', scrollBeyondLastLine: false, padding: { top: 8 } }} />
        </div>
        <div onMouseDown={onMouseDown} style={{ width: 6, cursor: 'col-resize', background: 'transparent', flexShrink: 0, position: 'relative', zIndex: 10 }}>
          <div style={{ position: 'absolute', left: 2, top: 0, bottom: 0, width: 2, background: dragging.current ? 'var(--color-primary, #1677ff)' : 'var(--color-border)', transition: dragging.current ? 'none' : 'background 0.2s' }} />
        </div>
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg-base)', borderRadius: 6, border: '1px solid var(--color-border-secondary)' }}>
          <Spin spinning={loading}>
            {error ? (
              <pre style={{ color: '#ff4d4f', fontSize: 13, whiteSpace: 'pre-wrap', margin: 0, padding: 12 }}>{error}</pre>
            ) : result ? (
              <pre style={{ fontSize: 13, margin: 0, padding: 12, background: '#1e1e1e', color: '#d4d4d4', whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
            ) : (
              <div style={{ color: 'var(--color-text-quaternary)', padding: '40px 0', textAlign: 'center' }}>{t('graphqlPlaceholder')}</div>
            )}
          </Spin>
        </div>
      </div>

      {/* 查询历史抽屉 */}
      <Drawer
        title={t('queryHistory')}
        placement="right"
        width={380}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        styles={{ body: { padding: 0 } }}
      >
        <QueryHistoryPanel
          onLoadQuery={(record) => {
            setQuery(record.query);
            if (record.collection) setSelected(record.collection);
            setHistoryOpen(false);
          }}
        />
      </Drawer>
    </div>
  );
};

export default GraphQLTab;
