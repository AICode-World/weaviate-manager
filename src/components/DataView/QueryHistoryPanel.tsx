import { useState } from 'react';
import { List, Tag, Button, Input, Typography, Popconfirm, Space, Empty, Switch, Tooltip } from 'antd';
import {
  StarOutlined, StarFilled, DeleteOutlined,
  UndoOutlined, ClearOutlined, SearchOutlined,
  ForkOutlined, SwapOutlined,
} from '@ant-design/icons';
import { useQueryHistoryStore, formatRelativeTime, type QueryRecord, type QueryType } from '../../stores/queryHistoryStore';
import { useI18n } from '../../i18n/I18nProvider';

const { Text } = Typography;

interface QueryHistoryPanelProps {
  onLoadQuery: (record: QueryRecord) => void;
  onForkQuery: (record: QueryRecord) => void;
  onCompare: (source: QueryRecord, target: QueryRecord) => void;
}

const TYPE_COLOR: Record<QueryType, string> = {
  graphql: 'blue',
  bm25: 'green',
  nearText: 'purple',
  nearImage: 'orange',
};

const TYPE_LABEL: Record<QueryType, string> = {
  graphql: 'GraphQL',
  bm25: 'BM25',
  nearText: 'NearText',
  nearImage: 'NearImage',
};

const QueryHistoryPanel: React.FC<QueryHistoryPanelProps> = ({ onLoadQuery, onForkQuery, onCompare }) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<'all' | 'favorites'>('all');
  const [keyword, setKeyword] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const history = useQueryHistoryStore((s) => s.history);
  const removeQuery = useQueryHistoryStore((s) => s.removeQuery);
  const toggleFavorite = useQueryHistoryStore((s) => s.toggleFavorite);
  const clearHistory = useQueryHistoryStore((s) => s.clearHistory);

  // 过滤
  let filtered = history;
  if (tab === 'favorites') {
    filtered = filtered.filter((r) => r.isFavorite);
  }
  if (keyword.trim()) {
    const kw = keyword.trim().toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.query.toLowerCase().includes(kw) ||
        r.collection?.toLowerCase().includes(kw)
    );
  }

  // 按时间排序
  const sorted = [...filtered].sort((a, b) => b.timestamp - a.timestamp);
  const hasNonFavorite = history.some((r) => !r.isFavorite);

  const handleCompareToggle = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id]; // 替换第一个，保留第二个
      }
      return [...prev, id];
    });
  };

  const handleDoCompare = () => {
    if (selectedIds.length === 2) {
      const source = sorted.find((r) => r.id === selectedIds[0]);
      const target = sorted.find((r) => r.id === selectedIds[1]);
      if (source && target) {
        onCompare(source, target);
      }
    }
  };

  const exitCompare = () => {
    setCompareMode(false);
    setSelectedIds([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
      {/* 标签栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size={4}>
          <Button
            type={tab === 'all' ? 'primary' : 'text'}
            size="small"
            onClick={() => setTab('all')}
          >
            {t('queryHistory')}
          </Button>
          <Button
            type={tab === 'favorites' ? 'primary' : 'text'}
            size="small"
            onClick={() => setTab('favorites')}
          >
            {t('favorites')}
          </Button>
        </Space>
        <Space size={4}>
          <Tooltip title={compareMode ? t('exitCompare') : t('compareMode')}>
            <Switch
              size="small"
              checked={compareMode}
              onChange={(checked) => {
                if (!checked) exitCompare();
                else setCompareMode(true);
              }}
            />
          </Tooltip>
          {hasNonFavorite && !compareMode && (
            <Popconfirm title={t('confirmClearHistory')} onConfirm={clearHistory} okText={t('confirm')} cancelText={t('cancel')}>
              <Button size="small" type="text" danger icon={<ClearOutlined />} />
            </Popconfirm>
          )}
        </Space>
      </div>

      {/* 对比模式下的操作栏 */}
      {compareMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {selectedIds.length === 2
              ? t('compareSelected')
              : `${t('selectTwoToCompare')} (${selectedIds.length}/2)`}
          </Text>
          <Button
            size="small"
            type="primary"
            icon={<SwapOutlined />}
            disabled={selectedIds.length !== 2}
            onClick={handleDoCompare}
          >
            {t('compare')}
          </Button>
        </div>
      )}

      {/* 搜索框 */}
      <Input
        size="small"
        prefix={<SearchOutlined style={{ color: 'var(--color-text-quaternary)' }} />}
        placeholder={t('queryHistory')}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        allowClear
      />

      {/* 列表 */}
      {sorted.length === 0 ? (
        <Empty description={t('noHistory')} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '16px 0' }} />
      ) : (
        <List
          size="small"
          dataSource={sorted.slice(0, 50)}
          renderItem={(record) => {
            const isSelected = compareMode && selectedIds.includes(record.id);
            const selectedIndex = selectedIds.indexOf(record.id);
            return (
              <List.Item
                style={{
                  padding: '6px 0',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--color-primary-bg, #e6f4ff)' : 'transparent',
                  borderLeft: isSelected ? `3px solid var(--color-primary, #1677ff)` : '3px solid transparent',
                  paddingLeft: 8,
                  borderRadius: 4,
                }}
                onClick={() => compareMode ? handleCompareToggle(record.id) : onLoadQuery(record)}
                actions={
                  compareMode ? undefined : [
                    <Button
                      key="run"
                      type="text"
                      size="small"
                      icon={<UndoOutlined />}
                      onClick={(e) => { e.stopPropagation(); onLoadQuery(record); }}
                      title={t('reuseQuery')}
                    />,
                    <Button
                      key="fork"
                      type="text"
                      size="small"
                      icon={<ForkOutlined />}
                      onClick={(e) => { e.stopPropagation(); onForkQuery(record); }}
                      title={t('forkQuery')}
                    />,
                    <Button
                      key="fav"
                      type="text"
                      size="small"
                      icon={record.isFavorite ? <StarFilled style={{ color: '#f59e0b' }} /> : <StarOutlined />}
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(record.id); }}
                    />,
                    <Button
                      key="del"
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => { e.stopPropagation(); removeQuery(record.id); }}
                    />,
                  ]
                }
              >
                <List.Item.Meta
                  avatar={
                    <Space size={2} direction="vertical" align="center" style={{ minWidth: 48 }}>
                      <Tag color={TYPE_COLOR[record.type]} style={{ marginRight: 0 }}>{TYPE_LABEL[record.type]}</Tag>
                      {isSelected && (
                        <Tag color={selectedIndex === 0 ? 'blue' : 'green'} style={{ marginRight: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                          {selectedIndex === 0 ? t('sourceLabel') : t('targetLabel')}
                        </Tag>
                      )}
                    </Space>
                  }
                  title={
                    <Text style={{ fontSize: 12 }} ellipsis>
                      {record.query.length > 60 ? record.query.slice(0, 60) + '…' : record.query}
                    </Text>
                  }
                  description={
                    <Space size={4} style={{ fontSize: 11 }}>
                      {record.collection && <Text type="secondary" style={{ fontSize: 11 }}>{record.collection}</Text>}
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        · {formatRelativeTime(record.timestamp, t)}
                      </Text>
                      {record.resultCount !== undefined && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          · {record.resultCount} {t('results')}
                        </Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );
};

export default QueryHistoryPanel;
