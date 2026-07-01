import { useState } from 'react';
import { Button, Card, Space, Spin, Alert, Typography, Input } from 'antd';
import { PlayCircleOutlined, ClearOutlined, CodeOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import useWeaviateStore from '../store/useWeaviateStore';

const { Text } = Typography;
const { TextArea } = Input;

/** 默认模板查询 */
const DEFAULT_QUERY = `{
  Get {
    # 替换为你的集合名
    YourClassName(limit: 10) {
      property1
      property2
      _additional {
        id
        distance
        certainty
      }
    }
  }
}`;

/**
 * GraphQL 查询编辑器
 * 使用 Monaco Editor 提供语法高亮和自动补全
 */
const GraphQLEditor: React.FC = () => {
  const { selectedClass, graphQLResult, graphQLLoading, runGraphQL } =
    useWeaviateStore();

  const [query, setQuery] = useState(DEFAULT_QUERY);

  /** 用当前选中的集合名替换模板中的占位符 */
  const fillTemplate = () => {
    if (!selectedClass) return;
    const newQuery = query.replace(/YourClassName/g, selectedClass);
    setQuery(newQuery);
  };

  return (
    <Card
      title={
        <Space>
          <CodeOutlined />
          <span>GraphQL 查询</span>
        </Space>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 提示：可以用当前集合填充 */}
        {selectedClass && (
          <Alert
            message={
              <Space>
                <Text>当前选中集合：</Text>
                <Text code strong>{selectedClass}</Text>
                <Button size="small" type="link" onClick={fillTemplate}>
                  填充到查询
                </Button>
              </Space>
            }
            type="info"
            showIcon={false}
            style={{ padding: '4px 12px' }}
          />
        )}

        {/* Monaco 编辑器 */}
        <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
          <Editor
            height="280px"
            language="graphql"
            theme="vs-dark"
            value={query}
            onChange={(val) => setQuery(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              folding: true,
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>

        {/* 操作按钮 */}
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={graphQLLoading}
            onClick={() => runGraphQL(query)}
          >
            执行查询
          </Button>
          <Button
            icon={<ClearOutlined />}
            onClick={() => setQuery(DEFAULT_QUERY)}
          >
            重置
          </Button>
        </Space>

        {/* 查询结果 */}
        {graphQLLoading && (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin tip="查询执行中..." />
          </div>
        )}

        {graphQLResult && !graphQLLoading && (
          <Card
            size="small"
            title="查询结果"
            style={{ background: '#fafafa' }}
          >
            {graphQLResult.error ? (
              <Alert
                message="查询错误"
                description={
                  typeof graphQLResult.error === 'string'
                    ? graphQLResult.error
                    : JSON.stringify(graphQLResult.error, null, 2)
                }
                type="error"
                showIcon
              />
            ) : (
              <pre
                style={{
                  maxHeight: 400,
                  overflow: 'auto',
                  fontSize: 12,
                  margin: 0,
                  background: '#1e1e1e',
                  color: '#d4d4d4',
                  padding: 12,
                  borderRadius: 4,
                }}
              >
                {JSON.stringify(graphQLResult, null, 2)}
              </pre>
            )}
          </Card>
        )}
      </Space>
    </Card>
  );
};

export default GraphQLEditor;
