import { Layout, Tabs } from 'antd';
import { UnorderedListOutlined, CodeOutlined } from '@ant-design/icons';
import ConnectionManager from '../components/ConnectionManager';
import ClassList from '../components/ClassList';
import ObjectList from '../components/ObjectList';
import GraphQLEditor from '../components/GraphQLEditor';
import VectorSearch from '../components/VectorSearch';
import useWeaviateStore from '../store/useWeaviateStore';
import { useEffect } from 'react';

const { Sider, Content } = Layout;

/**
 * 主控制台页面
 * 布局：左侧侧边栏（连接配置 + 集合列表） | 右侧内容区（数据查看 / GraphQL / 向量检索）
 */
const Dashboard: React.FC = () => {
  const { connection, fetchClasses, selectedClass } = useWeaviateStore();

  // 连接成功后自动加载集合列表
  useEffect(() => {
    if (connection.connected) {
      fetchClasses();
    }
  }, [connection.connected]);

  /** 右侧内容区的标签页配置 */
  const tabItems = [
    {
      key: 'objects',
      label: (
        <span>
          <UnorderedListOutlined /> 数据浏览
        </span>
      ),
      children: (
        <>
          <ObjectList />
          <VectorSearch />
        </>
      ),
    },
    {
      key: 'graphql',
      label: (
        <span>
          <CodeOutlined /> GraphQL 查询
        </span>
      ),
      children: <GraphQLEditor />,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 左侧侧边栏 */}
      <Sider
        width={280}
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          overflow: 'auto',
          padding: 16,
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#1677ff' }}>
            ⚡ Weaviate Manager
          </h2>
          <p style={{ margin: '4px 0 0', color: '#999', fontSize: 12 }}>
            向量数据库可视化管理
          </p>
        </div>

        <ConnectionManager />

        {connection.connected && <ClassList />}
      </Sider>

      {/* 右侧内容区 */}
      <Content style={{ padding: 16, overflow: 'auto' }}>
        {connection.connected ? (
          <Tabs
            defaultActiveKey="objects"
            items={tabItems}
            size="large"
            style={{ background: '#fff', padding: '0 16px', borderRadius: 8 }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '60vh',
              color: '#999',
              fontSize: 16,
            }}
          >
            请先在左侧连接 Weaviate 服务
          </div>
        )}
      </Content>
    </Layout>
  );
};

export default Dashboard;
