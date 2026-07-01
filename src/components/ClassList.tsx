import { List, Space, Typography, Spin, Badge, Tooltip } from 'antd';
import { DatabaseOutlined, ThunderboltOutlined } from '@ant-design/icons';
import useWeaviateStore from '../store/useWeaviateStore';

const { Text } = Typography;

/**
 * 侧边栏集合列表组件
 * 展示所有 Weaviate Class，点击选中后右侧加载对象详情
 */
const ClassList: React.FC = () => {
  const { classes, selectedClass, classesLoading, setSelectedClass, connection } =
    useWeaviateStore();

  if (!connection.connected) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <Text type="secondary">请先连接 Weaviate</Text>
      </div>
    );
  }

  if (classesLoading) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <Spin tip="加载集合中..." />
      </div>
    );
  }

  return (
    <List
      header={
        <Text strong style={{ fontSize: 14 }}>
          <DatabaseOutlined /> 集合列表 ({classes.length})
        </Text>
      }
      dataSource={classes}
      renderItem={(cls) => {
        const isActive = selectedClass === cls.name;
        return (
          <List.Item
            key={cls.name}
            onClick={() => setSelectedClass(isActive ? null : cls.name)}
            style={{
              cursor: 'pointer',
              padding: '10px 16px',
              borderRadius: 6,
              marginBottom: 2,
              background: isActive ? '#e6f4ff' : 'transparent',
              border: isActive ? '1px solid #1677ff' : '1px solid transparent',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isActive)
                (e.currentTarget as HTMLElement).style.background = '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              if (!isActive)
                (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <List.Item.Meta
              avatar={
                <Badge
                  status={isActive ? 'processing' : 'default'}
                  color={isActive ? '#1677ff' : undefined}
                />
              }
              title={
                <Tooltip title={cls.description || cls.name}>
                  <Text
                    strong={isActive}
                    style={{
                      color: isActive ? '#1677ff' : undefined,
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 180,
                    }}
                  >
                    {cls.name}
                  </Text>
                </Tooltip>
              }
              description={
                <Space size={4}>
                  {cls.vectorIndexType && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      <ThunderboltOutlined /> {cls.vectorIndexType}
                    </Text>
                  )}
                  {cls.properties && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {cls.properties.length} 属性
                    </Text>
                  )}
                </Space>
              }
            />
          </List.Item>
        );
      }}
      style={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}
    />
  );
};

export default ClassList;
