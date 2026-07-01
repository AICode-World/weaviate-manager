import { Table, Tag, Spin, Empty, Typography, Popover } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import useWeaviateStore from '../store/useWeaviateStore';

const { Text } = Typography;

/**
 * 对象列表组件
 * 分页展示选中集合下的所有对象，向量以 Popover 预览前 10 维
 */
const ObjectList: React.FC = () => {
  const {
    selectedClass,
    objects,
    objectsTotal,
    objectsLoading,
    fetchObjects,
    classes,
  } = useWeaviateStore();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 当前选中的 Class 定义
  const currentClassDef = classes.find((c) => c.name === selectedClass);

  // 当选中集合或分页变化时重新加载
  useEffect(() => {
    if (selectedClass) {
      fetchObjects(selectedClass, page, pageSize);
    }
  }, [selectedClass, page, pageSize]);

  // 切换集合时重置页码
  useEffect(() => {
    setPage(1);
  }, [selectedClass]);

  if (!selectedClass) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <Empty description="请从左侧选择一个集合" />
      </div>
    );
  }

  // 动态构建表格列：属性字段 + _additional
  const propColumns =
    currentClassDef?.properties?.map((p) => ({
      title: <Tag color="blue">{p.name}</Tag>,
      dataIndex: p.name,
      key: p.name,
      ellipsis: true,
      width: 150,
      render: (val: any) => {
        if (val === null || val === undefined) return <Text type="secondary">—</Text>;
        if (typeof val === 'object') return <Text code>{JSON.stringify(val)}</Text>;
        return String(val);
      },
    })) || [];

  const columns = [
    {
      title: '#',
      key: 'index',
      width: 50,
      render: (_: any, __: any, idx: number) => (page - 1) * pageSize + idx + 1,
    },
    ...propColumns,
    {
      title: 'ID',
      dataIndex: ['_additional', 'id'],
      key: 'id',
      ellipsis: true,
      width: 200,
      render: (val: string) => (
        <Text copyable style={{ fontSize: 12 }} code>
          {val?.slice(0, 12)}...
        </Text>
      ),
    },
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
    <div>
      <Typography.Title level={5} style={{ marginBottom: 12 }}>
        集合：{selectedClass}
        <Text type="secondary" style={{ fontSize: 14, marginLeft: 8 }}>
          共 {objectsTotal} 条
        </Text>
      </Typography.Title>

      <Spin spinning={objectsLoading}>
        <Table
          columns={columns}
          dataSource={objects.map((obj: any, i: number) => ({ ...obj, _key: obj._additional?.id || i }))}
          rowKey="_key"
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: objectsTotal,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total) => `共 ${total} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          locale={{ emptyText: <Empty description="该集合暂无对象" /> }}
        />
      </Spin>
    </div>
  );
};

export default ObjectList;
