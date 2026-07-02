import { useState } from 'react';
import { List, Tag, Button, Input, Typography, Popconfirm, Space, Empty } from 'antd';
import {
  StarOutlined, StarFilled, DeleteOutlined,
  UndoOutlined, ClearOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useQueryHistoryStore, formatRelativeTime, type QueryRecord, type QueryType } from '../../stores/queryHistoryStore';
import { useI18n } from '../../i18n/I18nProvider';

const { Text } = Typography;

interface QueryHistoryPanelProps {
  onLoadQuery: (record: QueryRecord) => void;
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

const QueryHistoryPanel: React.FC<QueryHistoryPanelProps> = ({ onLoadQuery }) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<'all' | 'favorites'>('all');
  const [keyword, setKeyword] = useState('');

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
        {hasNonFavorite && (
          <Popconfirm title={t('confirmClearHistory')} onConfirm={clearHistory} okText={t('confirm')} cancelText={t('cancel')}>
            <Button size="small" type="text" danger icon={<ClearOutlined />} />
          </Popconfirm>
        )}
      </div>

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
          renderItem={(record) => (
            <List.Item
              style={{ padding: '6px 0', cursor: 'pointer' }}
              actions={[
                <Button
                  key="run"
                  type="text"
                  size="small"
                  icon={<UndoOutlined />}
                  onClick={(e) => { e.stopPropagation(); onLoadQuery(record); }}
                  title={t('reuseQuery')}
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
              ]}
            >
              <List.Item.Meta
                avatar={<Tag color={TYPE_COLOR[record.type]} style={{ marginRight: 0 }}>{TYPE_LABEL[record.type]}</Tag>}
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
          )}
        />
      )}
    </div>
  );
};

export default QueryHistoryPanel;
