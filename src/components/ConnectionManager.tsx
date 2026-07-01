import { Input, Button, Card, Alert, Space, Typography } from 'antd';
import { ApiOutlined, LinkOutlined, KeyOutlined } from '@ant-design/icons';
import useWeaviateStore from '../store/useWeaviateStore';

const { Title, Text } = Typography;

/**
 * 连接管理组件
 * 提供 Weaviate 服务地址和 API Key 的配置入口，支持测试连接
 */
const ConnectionManager: React.FC = () => {
  const { connection, setConnection, testConnection } = useWeaviateStore();

  return (
    <Card
      title={
        <Space>
          <ApiOutlined />
          <span>Weaviate 连接配置</span>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 服务地址 */}
        <Input
          prefix={<LinkOutlined />}
          placeholder="Weaviate 服务地址，如 http://localhost:8080"
          value={connection.host}
          onChange={(e) => setConnection(e.target.value, connection.apiKey)}
          allowClear
        />

        {/* API Key（可选） */}
        <Input.Password
          prefix={<KeyOutlined />}
          placeholder="API Key（Weaviate Cloud 必填，本地部署可留空）"
          value={connection.apiKey}
          onChange={(e) => setConnection(connection.host, e.target.value)}
          allowClear
        />

        {/* 操作按钮 */}
        <Space>
          <Button
            type="primary"
            icon={<ApiOutlined />}
            loading={connection.loading}
            onClick={testConnection}
          >
            测试连接
          </Button>

          {connection.connected && (
            <Text type="success" strong>
              ✓ 连接成功
            </Text>
          )}
          {!connection.connected && !connection.loading && connection.host && (
            <Text type="secondary">未连接</Text>
          )}
        </Space>

        {/* 错误提示 */}
        {connection.error && (
          <Alert
            message="连接失败"
            description={connection.error}
            type="error"
            showIcon
            closable
          />
        )}
      </Space>
    </Card>
  );
};

export default ConnectionManager;
