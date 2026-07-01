import { useState } from 'react';
import { Card, Input, Button, Space, Table, Tag, Spin, Popover, Typography, Slider } from 'antd';
import { SearchOutlined, EyeOutlined, ClearOutlined } from '@ant-design/icons';
import useWeaviateStore from '../store/useWeaviateStore';

const { Text } = Typography;

/**
 * 向量检索组件
 * 输入文本，利用 Weaviate nearText 进行语义相似度检索
 */
const VectorSearch: React.FC = () => {
  const { selectedClass, searchResults, searchLoading, searchVector } =
    useWeaviateStore();

  const [searchText, setSearchText] = useState('');
  const [topK, setTopK] = useState(5);

  const handleSearch = () => {
    if (!selectedClass || !searchText.trim()) return;
    searchVector(selectedClass, searchText.trim(), topK);
  };

  if (!selectedClass) {
    return null; // 未选中集合时不显示
  }

  // 动态构建结果表格列
  const firstResult = searchResults[0];
  const propKeys = firstResult
    ? Object.keys(firstResult).filter((k) => k !== '_additional')
    : [];

  const columns = [
    {
      title: '相似度',
      dataIndex: ['_additional', 'certainty'],
      key: 'certainty',
      width: 100,
      render: (val: number | null) => {
        if (val === null || val === undefined) return '—';
        const pct = (val * 100).toFixed(1);
        const color = val > 0.8 ? 'green' : val > 0.5 ? 'orange' : 'red';
        return <Tag color={color}>{pct}%</Tag>;
      },
    },
    ...propKeys.map((key) => ({
      title: key,
      dataIndex: key,
      key,
      ellipsis: true,
      render: (val: any) => {
        if (val === null || val === undefined) return <Text type="secondary">—</Text>;
        if (typeof val === 'object') return <Text code>{JSON.stringify(val)}</Text>;
        return String(val);
      },
    })),
    {
      title: '向量',
      dataIndex: ['_additional', 'vector'],
      key: 'vector',
      width: 80,
      render: (vector: number[] | null) => {
        if (!vector || vector.length === 0) return <Text type="secondary">无</Text>;
        return (
          <Popover
            content={
              <div style={{ maxWidth: 300, maxHeight: 200, overflow: 'auto' }}>
                <Text code style={{ fontSize: 11, wordBreak: 'break-all' }}>
                  [{vector.slice(0, 10).join(', ')}{vector.length > 10 ? ', ...' : ''}]
                </Text>
              </div>
            }
            title={`${vector.length} 维向量`}
            trigger="click"
          >
            <Tag icon={<EyeOutlined />} color="purple" style={{ cursor: 'pointer' }}>
              查看
            </Tag>
          </Popover>
        );
      },
    },
  ];

  return (
    <Card
      title={
        <Space>
          <SearchOutlined />
          <span>向量检索（nearText）</span>
          <Text type="secondary" style={{ fontSize: 12 }}>
            — 集合：{selectedClass}
          </Text>
        </Space>
      }
      style={{ marginTop: 16 }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 搜索输入 */}
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="输入检索文本，如「一只猫在草地上」"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={searchLoading}
            onClick={handleSearch}
          >
            检索
          </Button>
        </Space.Compact>

        {/* Top-K 滑块 */}
        <Space>
          <Text>返回数量：</Text>
          <Slider
            min={1}
            max={20}
            value={topK}
            onChange={setTopK}
            style={{ width: 150 }}
          />
          <Text strong>{topK}</Text>
        </Space>

        {/* 结果表格 */}
        <Spin spinning={searchLoading}>
          {searchResults.length > 0 ? (
            <Table
              columns={columns}
              dataSource={searchResults.map((obj: any, i: number) => ({
                ...obj,
                _key: obj._additional?.id || i,
              }))}
              rowKey="_key"
              size="small"
              scroll={{ x: 'max-content' }}
              pagination={false}
            />
          ) : (
            !searchLoading && (
              <Text type="secondary">输入文本后点击检索查看相似结果</Text>
            )
          )}
        </Spin>
      </Space>
    </Card>
  );
};

export default VectorSearch;
