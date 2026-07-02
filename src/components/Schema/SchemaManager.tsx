import { useEffect, useState } from 'react';
import {
  Button, Table, Tag, Modal, Form, Input, Select,
  Popconfirm, Space, message, Typography, Alert, Empty, Spin, Collapse,
} from 'antd';
import {
  AppstoreOutlined, PlusOutlined, DeleteOutlined, ReloadOutlined, ApiOutlined,
} from '@ant-design/icons';
import EmptyState from '../Common/EmptyState';
import useAppStore from '../../stores/appStore';
import { useI18n } from '../../i18n/I18nProvider';
import {
  getFullSchema, createCollection, deleteCollection, addProperty,
  PROPERTY_DATA_TYPES, type CollectionSchema, type CollectionProperty, type PropertyDataType,
} from '../../services/weaviate';

const { Text } = Typography;

const SchemaManager: React.FC = () => {
  const { t } = useI18n();
  const { client, connectionStatus, refreshCollections } = useAppStore();
  const [schemas, setSchemas] = useState<CollectionSchema[]>([]);
  const [loading, setLoading] = useState(false);

  const VECTORIZER_OPTIONS = [
    { label: t('noneManualVector'), value: 'none' },
    { label: 'text2vec-openai', value: 'text2vec-openai' },
    { label: 'text2vec-cohere', value: 'text2vec-cohere' },
    { label: 'text2vec-huggingface', value: 'text2vec-huggingface' },
    { label: 'text2vec-transformers', value: 'text2vec-transformers' },
    { label: 'multi2vec-clip', value: 'multi2vec-clip' },
    { label: 'img2vec-neural', value: 'img2vec-neural' },
  ];

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();

  const [propModalOpen, setPropModalOpen] = useState(false);
  const [propForm] = Form.useForm();
  const [propTarget, setPropTarget] = useState<string | null>(null);

  const loadSchema = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const data = await getFullSchema(client);
      setSchemas(data);
    } catch {
      message.error(t('loadFail'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (client) loadSchema();
  }, [client]);

  const handleCreate = async () => {
    if (!client) return;
    try {
      const values = await createForm.validateFields();
      const properties: CollectionProperty[] = (values.properties || []).map((p: { name: string; dataType: string }) => ({
        name: p.name,
        dataType: [p.dataType] as PropertyDataType[],
      }));
      await createCollection(client, values.name, properties, values.vectorizer);
      message.success(t('collectionCreated'));
      setCreateOpen(false);
      createForm.resetFields();
      await loadSchema();
      refreshCollections();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return; // form validation
      message.error(e instanceof Error ? e.message : t('operationFail'));
    }
  };

  const handleDeleteCollection = async (name: string) => {
    if (!client) return;
    try {
      await deleteCollection(client, name);
      message.success(t('collectionDeleted'));
      await loadSchema();
      refreshCollections();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('operationFail'));
    }
  };

  const handleAddProperty = async () => {
    if (!client || !propTarget) return;
    try {
      const values = await propForm.validateFields();
      await addProperty(client, propTarget, {
        name: values.name,
        dataType: [values.dataType] as PropertyDataType[],
        description: values.description,
      });
      message.success(t('propertyAdded'));
      setPropModalOpen(false);
      propForm.resetFields();
      setPropTarget(null);
      await loadSchema();
      refreshCollections();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(e instanceof Error ? e.message : t('operationFail'));
    }
  };

  if (connectionStatus !== 'connected' || !client) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
          <ApiOutlined style={{ fontSize: 48, marginBottom: 16, color: 'var(--color-text-quaternary)' }} />
          <div style={{ fontSize: 16, fontWeight: 500 }}>{t('pleaseConnect')}</div>
        </div>
      </div>
    );
  }

  const propertyColumns = [
    { title: t('propertyName'), dataIndex: 'name', key: 'name' },
    {
      title: t('dataType'), dataIndex: 'dataType', key: 'dataType',
      render: (types: string[]) => types.map((dt) => <Tag key={dt} color="blue">{dt}</Tag>),
    },
  ];

  return (
    <Spin spinning={loading}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AppstoreOutlined style={{ fontSize: 20, color: 'var(--color-primary, #1677ff)' }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {t('schemaManagement')}
            </span>
            <Text style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              ({schemas.length})
            </Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadSchema} loading={loading}>
              {t('refresh')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              {t('createCollection')}
            </Button>
          </Space>
        </div>

        <Alert type="info" showIcon message={t('removePropertyNote')} style={{ marginTop: 8, marginBottom: 8 }} />

        {schemas.length === 0 ? (
          <EmptyState
            icon={<AppstoreOutlined />}
            title={t('noCollectionsHint')}
            actionText={t('createCollection')}
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <Collapse
            items={schemas.map((schema) => ({
              key: schema.name,
              label: (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <Space>
                    <Text strong>{schema.name}</Text>
                    <Tag>{schema.properties.length} {t('propertyName').toLowerCase()}</Tag>
                    {schema.vectorizer && <Tag color="purple">{schema.vectorizer}</Tag>}
                  </Space>
                </div>
              ),
              extra: (
                <Space onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setPropTarget(schema.name);
                      setPropModalOpen(true);
                    }}
                  >
                    {t('addProperty')}
                  </Button>
                  <Popconfirm
                    title={t('confirmDeleteCollection', { name: schema.name })}
                    onConfirm={() => handleDeleteCollection(schema.name)}
                    okText={t('confirm')}
                    cancelText={t('cancel')}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      {t('delete')}
                    </Button>
                  </Popconfirm>
                </Space>
              ),
              children: (
                <Table
                  dataSource={schema.properties}
                  columns={propertyColumns}
                  rowKey="name"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: <Empty description={t('noProperties')} /> }}
                />
              ),
            }))}
          />
        )}
      </div>

      {/* 创建集合 Modal */}
      <Modal
        title={t('createCollection')}
        open={createOpen}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        onOk={handleCreate}
        okText={t('confirm')}
        cancelText={t('cancel')}
        width={600}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }} initialValues={{ vectorizer: 'none', properties: [] }}>
          <Form.Item name="name" label={t('collectionName')} rules={[{ required: true, message: t('collectionNamePlaceholder') }]}>
            <Input placeholder={t('collectionNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="vectorizer" label={t('vectorizer')}>
            <Select options={VECTORIZER_OPTIONS} />
          </Form.Item>
          <Form.List name="properties">
            {(fields, { add, remove }) => (
              <>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('propertyName')}</Text>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item {...field} name={[field.name, 'name']} rules={[{ required: true }]} noStyle>
                      <Input placeholder={t('propertyName')} style={{ width: 200 }} />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'dataType']} rules={[{ required: true }]} noStyle>
                      <Select
                        options={PROPERTY_DATA_TYPES.map((dt) => ({ label: dt, value: dt }))}
                        placeholder={t('dataType')}
                        style={{ width: 140 }}
                      />
                    </Form.Item>
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  {t('addProperty')}
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* 添加属性 Modal */}
      <Modal
        title={`${t('addProperty')} - ${propTarget}`}
        open={propModalOpen}
        onCancel={() => { setPropModalOpen(false); propForm.resetFields(); setPropTarget(null); }}
        onOk={handleAddProperty}
        okText={t('confirm')}
        cancelText={t('cancel')}
        destroyOnHidden
      >
        <Form form={propForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={t('propertyName')} rules={[{ required: true }]}>
            <Input placeholder={t('propertyName')} />
          </Form.Item>
          <Form.Item name="dataType" label={t('dataType')} rules={[{ required: true }]}>
            <Select
              options={PROPERTY_DATA_TYPES.map((dt) => ({ label: dt, value: dt }))}
              placeholder={t('dataType')}
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Spin>
  );
};

export default SchemaManager;
