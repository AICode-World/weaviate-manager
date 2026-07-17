import { useState } from 'react';
import { List, Tag, Button, Input, Typography, Popconfirm, Space, Empty, Tooltip } from 'antd';
import {
  DeleteOutlined, FolderOpenOutlined, CodeOutlined,
} from '@ant-design/icons';
import { useQueryTemplateStore, type QueryTemplate } from '../../stores/queryTemplateStore';
import { formatRelativeTime } from '../../stores/queryHistoryStore';
import { useI18n } from '../../i18n/I18nProvider';

const { Text } = Typography;

interface QueryTemplatePanelProps {
  onLoadTemplate: (template: QueryTemplate) => void;
}

const QueryTemplatePanel: React.FC<QueryTemplatePanelProps> = ({ onLoadTemplate }) => {
  const { t } = useI18n();
  const [keyword, setKeyword] = useState('');

  const templates = useQueryTemplateStore((s) => s.templates);
  const removeTemplate = useQueryTemplateStore((s) => s.removeTemplate);

  let filtered = templates;
  if (keyword.trim()) {
    const kw = keyword.trim().toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.name.toLowerCase().includes(kw) ||
        t.query.toLowerCase().includes(kw) ||
        t.collection?.toLowerCase().includes(kw)
    );
  }

  const sorted = [...filtered].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
      <Input
        size="small"
        prefix={<CodeOutlined style={{ color: 'var(--color-text-quaternary)' }} />}
        placeholder={t('myTemplates')}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        allowClear
      />

      {sorted.length === 0 ? (
        <Empty description={t('noTemplates')} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '16px 0' }} />
      ) : (
        <List
          size="small"
          dataSource={sorted}
          renderItem={(template) => (
            <List.Item
              style={{ padding: '6px 0', cursor: 'pointer' }}
              actions={[
                <Button
                  key="load"
                  type="text"
                  size="small"
                  icon={<FolderOpenOutlined />}
                  onClick={(e) => { e.stopPropagation(); onLoadTemplate(template); }}
                  title={t('loadTemplate')}
                />,
                <Popconfirm
                  key="del"
                  title={t('confirmDeleteTemplate')}
                  okText={t('confirm')}
                  cancelText={t('cancel')}
                  onConfirm={(e) => { e?.stopPropagation(); removeTemplate(template.id); }}
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={<Tag color="geekblue" style={{ marginRight: 0 }}>Template</Tag>}
                title={
                  <Space size={4}>
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>{template.name}</Text>
                    {template.variables && template.variables.trim() && (
                      <Tag color="orange" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                        {t('hasVariables')}
                      </Tag>
                    )}
                  </Space>
                }
                description={
                  <Space size={4} style={{ fontSize: 11 }}>
                    {template.collection && <Text type="secondary" style={{ fontSize: 11 }}>{template.collection}</Text>}
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      · {formatRelativeTime(template.timestamp, t)}
                    </Text>
                    <Tooltip title={template.query.slice(0, 200)}>
                      <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                        · {template.query.length > 40 ? template.query.slice(0, 40) + '…' : template.query}
                      </Text>
                    </Tooltip>
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

export default QueryTemplatePanel;
