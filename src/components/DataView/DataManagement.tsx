import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Button, Modal, Form, Input, InputNumber, Upload, Popconfirm,
  Space, Progress, message, Select, DatePicker, Alert,
} from 'antd';
import {
  PlusOutlined, ExportOutlined, ImportOutlined, DeleteOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import dayjs from 'dayjs';
import useAppStore from '../../stores/appStore';
import {
  insertObject, updateObject, deleteObject,
  fetchAllObjects, getClassProperties,
} from '../../services/weaviate';
import { useI18n } from '../../i18n/I18nProvider';

/** 字段类型描述 */
interface FieldDef {
  name: string;
  dataType: string[];
  isBlob: boolean;
  isInt: boolean;
  isNumber: boolean;
  isDate: boolean;
}

/** 常见字段的建议值 */
const FIELD_SUGGESTIONS: Record<string, string[]> = {
  source_type: ['text', 'image', 'screenshot', 'video_frame', 'audio_transcript', 'video_transcript'],
  embed_model: ['text-embedding-v4', 'text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002', 'bge-large-zh-v1.5', 'bge-m3'],
  file_id: [],
  section: [],
};

export interface DataManagementHandle {
  openCreate: () => void;
  openEdit: (record: Record<string, unknown>) => void;
  handleDelete: (id: string) => void;
}

/** 检测 base64 图片类型并补全 data URI 前缀 */
function ensureDataUri(raw: string): string {
  if (raw.startsWith('data:')) return raw;
  const mime = raw.startsWith('/9j/') ? 'image/jpeg'
    : raw.startsWith('iVBORw0KGgo') ? 'image/png'
    : raw.startsWith('R0lGOD') ? 'image/gif'
    : raw.startsWith('UklGR') ? 'image/webp'
    : 'image/jpeg';
  return `data:${mime};base64,${raw}`;
}

/** 去掉 data URI 前缀，还原裸 base64（供 Weaviate API 存储用） */
function stripDataUri(uri: string): string {
  if (!uri.startsWith('data:')) return uri;
  const idx = uri.indexOf(';base64,');
  return idx >= 0 ? uri.slice(idx + 8) : uri;
}

/** 通用描述字段名（换图时需要提醒同步更新） */
const DESC_FIELD_NAMES = ['caption', 'description', 'text', 'desc', 'alt_text', 'summary'];

/** 找到集合中的描述字段名 */
function findDescField(fields: FieldDef[]): string | null {
  for (const name of DESC_FIELD_NAMES) {
    if (fields.some((f) => f.name === name)) return name;
  }
  return null;
}

/** 数据管理：新增、编辑、删除、导入、导出 */
const DataManagement = forwardRef<DataManagementHandle, {
  selectedRowKeys: string[];
  onSelectionChange: (keys: string[]) => void;
  onRefresh: () => void;
}>(({ selectedRowKeys, onSelectionChange, onRefresh }, ref) => {
  const { client, currentCollection, url: storeUrl } = useAppStore();
  const { t } = useI18n();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Record<string, unknown> | null>(null);
  const [form] = Form.useForm();
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; fail: number } | null>(null);
  // 编辑时记录原始 blob 值，用于检测图片是否被更换
  const [originalBlobs, setOriginalBlobs] = useState<Record<string, string | null>>({});
  // 图片预览
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 实时检测 blob 是否被更换
  const blobFieldNames = fields.filter((f) => f.isBlob).map((f) => f.name);
  const watchedBlobs = Form.useWatch(blobFieldNames, form) as (UploadFile[] | undefined)[] | undefined;
  const descField = findDescField(fields);
  const blobChangedNow = editingRecord && descField && blobFieldNames.some((name, i) => {
    const fileList = watchedBlobs?.[i];
    if (!Array.isArray(fileList) || fileList.length === 0) return false;
    // 新上传的文件有 originFileObj，必然是新换的
    if (fileList[0]?.originFileObj) return true;
    const url = fileList[0]?.url;
    if (!url) return false;
    const curr = stripDataUri(url);
    const orig = originalBlobs[name];
    return orig !== undefined && curr !== orig;
  });

  /** 加载集合属性 */
  const loadFields = async () => {
    if (!client || !currentCollection) return;
    try {
      const props = await getClassProperties(client, currentCollection);
      setFields(props.map((p) => ({
        name: p.name,
        dataType: p.dataType ?? [],
        isBlob: (p.dataType ?? []).some((t) => t.toLowerCase().includes('blob')),
        isInt: (p.dataType ?? []).some((t) => t.toLowerCase() === 'int'),
        isNumber: (p.dataType ?? []).some((t) => ['number', 'float'].some((k) => t.toLowerCase().includes(k))),
        isDate: (p.dataType ?? []).some((t) => t.toLowerCase() === 'date'),
      })));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (currentCollection) loadFields();
  }, [currentCollection]);

  /** 打开新增弹窗 */
  const openCreate = () => {
    setEditingRecord(null);
    setOriginalBlobs({});
    form.resetFields();
    setModalOpen(true);
  };

  /** 打开编辑弹窗 */
  const openEdit = (record: Record<string, unknown>) => {
    setEditingRecord(record);
    const values: Record<string, unknown> = {};
    const blobs: Record<string, string | null> = {};
    fields.forEach((f) => {
      if (f.isBlob && typeof record[f.name] === 'string') {
        blobs[f.name] = record[f.name] as string;
        const uri = ensureDataUri(record[f.name] as string);
        values[f.name] = [{
          uid: '-1', name: f.name, status: 'done',
          url: uri, thumbUrl: uri,
        }];
      } else {
        values[f.name] = record[f.name];
      }
    });
    setOriginalBlobs(blobs);
    // date 字段转为 dayjs 对象
    fields.forEach((f) => {
      if (f.isDate && typeof values[f.name] === 'string') {
        values[f.name] = dayjs(values[f.name] as string);
      }
    });
    form.setFieldsValue(values);
    setModalOpen(true);
  };

  /** 删除单条 */
  const handleDelete = async (id: string) => {
    if (!client || !currentCollection) return;
    try {
      await deleteObject(client, currentCollection, id);
      message.success(t('deleteSuccess'));
      onRefresh();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('deleteFail'));
    }
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({ openCreate, openEdit, handleDelete }), [fields, client, currentCollection]);

  /** 提交表单（新增或编辑） */
  const handleSubmit = async () => {
    if (!client || !currentCollection) return;
    try {
      const values = await form.validateFields();
      // 处理 blob 字段：统一转为裸 base64 存 Weaviate
      for (const f of fields) {
        if (!f.isBlob) continue;
        const fileList = values[f.name];
        if (!Array.isArray(fileList) || fileList.length === 0) {
          delete values[f.name]; // 用户删除了图片
          continue;
        }
        const item = fileList[0];
        if (item.originFileObj) {
          const uri = await fileToBase64(item.originFileObj as File);
          values[f.name] = stripDataUri(uri);
        } else if (item.url) {
          values[f.name] = stripDataUri(item.url);
        } else {
          delete values[f.name];
        }
      }
      // date 字段转为 ISO 字符串
      for (const f of fields) {
        if (f.isDate && values[f.name]) {
          values[f.name] = dayjs.isDayjs(values[f.name])
            ? values[f.name].toISOString()
            : values[f.name];
        }
      }
      // 移除空值（Weaviate 不接受 undefined/null）
      Object.keys(values).forEach((k) => {
        if (values[k] === undefined || values[k] === null || values[k] === '') delete values[k];
      });
      if (editingRecord) {
        const id = (editingRecord.__id as string) ?? '';
        const add = editingRecord._additional as Record<string, unknown> | undefined;
        const vector = add?.vector as number[] | undefined;

        // 检测 blob 是否被更换但描述未更新
        const descName = findDescField(fields);
        const blobFields = fields.filter((f) => f.isBlob);
        if (descName && blobFields.length > 0) {
          const blobChanged = blobFields.some(
            (f) => originalBlobs[f.name] !== values[f.name],
          );
          const origDesc = (editingRecord[descName] as string) ?? '';
          const currDesc = (values[descName] as string) ?? '';
          if (blobChanged && origDesc === currDesc) {
            const confirmed = await new Promise<boolean>((resolve) => {
              Modal.confirm({
                title: t('mediaChanged'),
                content: t('descNotUpdated', { name: descName }),
                okText: t('confirm'),
                cancelText: t('cancel'),
                onOk: () => resolve(true),
                onCancel: () => resolve(false),
              });
            });
            if (!confirmed) return;
          }
        }

        await updateObject(client, currentCollection, id, values, vector, storeUrl);
        message.success(t('updateSuccess'));
      } else {
        await insertObject(client, currentCollection, values);
        message.success(t('createSuccess'));
      }
      setModalOpen(false);
      onRefresh();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return; // form validation
      message.error(e instanceof Error ? e.message : t('operationFail'));
    }
  };

  /** 文件转 Base64 */
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  /** 批量删除 */
  const handleBatchDelete = async () => {
    if (!client || !currentCollection) return;
    let success = 0;
    let fail = 0;
    for (const id of selectedRowKeys) {
      try {
        await deleteObject(client, currentCollection, id);
        success++;
      } catch {
        fail++;
      }
    }
    message.info(t('deleteDone', { s: success, f: fail }));
    onSelectionChange([]);
    onRefresh();
  };

  /** 导出 CSV */
  const handleExport = async () => {
    if (!client || !currentCollection) return;
    message.loading({ content: t('exporting'), key: 'export' });
    try {
      const all = await fetchAllObjects(client, currentCollection);
      if (all.length === 0) {
        message.warning({ content: t('noDataExport'), key: 'export' });
        return;
      }
      const allKeys = new Set<string>();
      all.forEach((row) => Object.keys(row).forEach((k) => { if (!k.startsWith('__')) allKeys.add(k); }));
      const headers = [...allKeys];

      const csvRows = [headers.join(',')];
      for (const row of all) {
        const vals = headers.map((h) => {
          const v = row[h];
          if (v === null || v === undefined) return '';
          if (typeof v === 'string' && v.startsWith('data:')) return '存在';
          const s = String(v);
          return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        });
        csvRows.push(vals.join(','));
      }

      const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentCollection}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success({ content: t('exportDone', { n: all.length }), key: 'export' });
    } catch (e: unknown) {
      message.error({ content: e instanceof Error ? e.message : t('exportFail'), key: 'export' });
    }
  };

  /** 导入 CSV */
  const handleImport = async () => {
    if (!client || !currentCollection || !importFile) return;
    const file = importFile;
    const text = await file.text();
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) {
      message.warning(t('csvEmpty'));
      return;
    }
    const headers = parseCSVLine(lines[0]);
    let success = 0;
    let fail = 0;
    const total = lines.length - 1;

    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      const data: Record<string, unknown> = {};
      headers.forEach((h, idx) => {
        const raw = vals[idx] ?? '';
        const f = fields.find((fd) => fd.name === h);
        if (f) {
          if (f.isInt) data[h] = parseInt(raw, 10) || 0;
          else if (f.isNumber) data[h] = parseFloat(raw) || 0;
          else if (f.isDate && raw) data[h] = new Date(raw).toISOString();
          else data[h] = raw || undefined;
        } else {
          data[h] = raw || undefined;
        }
      });
      // 移除空值
      Object.keys(data).forEach((k) => {
        if (data[k] === undefined || data[k] === '' || data[k] === null) delete data[k];
      });
      try {
        await insertObject(client, currentCollection, data);
        success++;
      } catch {
        fail++;
      }
      setImportProgress(Math.round((i / total) * 100));
    }
    setImportResult({ success, fail });
    message.success(t('csvImportDone', { s: success, f: fail }));
    onRefresh();
  };

  /** 获取当前 blob 字段值中的 media URL */
  const getBlobUrl = (fieldName: string): string | null => {
    const v = form.getFieldValue(fieldName);
    if (!v) return null;
    // Upload 组件格式: [{url: 'data:...'}]
    if (Array.isArray(v) && v[0]?.url) return v[0].url as string;
    // 或者字符串格式
    if (typeof v === 'string' && v.startsWith('data:')) return v;
    return null;
  };

  /** 检测 media MIME 类型 */
  const getMediaKind = (url: string): 'image' | 'video' | 'audio' | null => {
    const m = url.match(/^data:(image|video|audio)\//);
    return m ? m[1] as 'image' | 'video' | 'audio' : null;
  };

  /** 渲染表单字段 */
  const renderFormField = (f: FieldDef) => {
    const suggestions = FIELD_SUGGESTIONS[f.name];

    if (f.isBlob) {
      return (
        <Upload
          maxCount={1}
          beforeUpload={() => false}
          listType="picture-card"
          onPreview={(file) => setPreviewImage(file.url ?? file.thumbUrl ?? null)}
        >
          <UploadOutlined /> {t('upload')}
        </Upload>
      );
    }

    if (f.isInt || f.isNumber) {
      return <InputNumber style={{ width: '100%' }} />;
    }

    if (f.isDate) {
      return <DatePicker style={{ width: '100%' }} showTime />;
    }

    if (suggestions !== undefined) {
      return (
        <Select
          mode={undefined}
          allowClear
          showSearch
          placeholder={t('selectOrInput') + ' ' + f.name}
          options={suggestions.map((s) => ({ label: s, value: s }))}
        />
      );
    }

    return <Input.TextArea rows={2} />;
  };

  return (
    <>
      <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate}>
          {t('add')}
        </Button>
        {selectedRowKeys.length > 0 && (
          <Popconfirm
            title={t('confirmDeleteRows', { n: selectedRowKeys.length })}
            onConfirm={handleBatchDelete}
            okText={t('confirm')}
            cancelText={t('cancel')}
          >
            <Button danger size="small" icon={<DeleteOutlined />}>
              {t('batchDelete')} ({selectedRowKeys.length})
            </Button>
          </Popconfirm>
        )}
        <Button size="small" icon={<ExportOutlined />} onClick={handleExport}>
          {t('exportCSV')}
        </Button>
        <Button size="small" icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
          {t('importCSV')}
        </Button>
      </Space>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingRecord ? t('edit') : t('new')}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          {fields.map((f) => (
            <Form.Item
              key={f.name}
              name={f.name}
              label={f.name}
              {...(f.isBlob ? { valuePropName: 'fileList', getValueFromEvent: (e: unknown) => (Array.isArray(e) ? e : (e as { fileList?: UploadFile[] })?.fileList ?? []) } : {})}
            >
              {renderFormField(f)}
            </Form.Item>
          ))}
          {blobChangedNow && descField && (
            <Alert
              type="warning"
              showIcon
              message={t('syncDesc', { name: descField })}
              style={{ marginBottom: 12 }}
            />
          )}
        </Form>
      </Modal>

      {/* 导入弹窗 */}
      <Modal
        title={t('importCSV')}
        open={importOpen}
        onOk={handleImport}
        onCancel={() => { setImportOpen(false); setImportResult(null); setImportProgress(0); }}
        okText={t('startImport')}
        okButtonProps={{ disabled: !importFile }}
      >
        <Upload.Dragger
          accept=".csv"
          maxCount={1}
          beforeUpload={(file) => { setImportFile(file); return false; }}
          onRemove={() => setImportFile(null)}
        >
          <UploadOutlined style={{ fontSize: 24 }} />
          <p>{t('csvHint')}</p>
        </Upload.Dragger>
        {importProgress > 0 && importProgress < 100 && (
          <Progress percent={importProgress} style={{ marginTop: 16 }} />
        )}
        {importResult && (
          <div style={{ marginTop: 8 }}>
            成功: {importResult.success} / 失败: {importResult.fail}
          </div>
        )}
      </Modal>

      {/* 图片预览 */}
      <Modal
        open={!!previewImage}
        footer={null}
        onCancel={() => setPreviewImage(null)}
        width="auto"
        centered
      >
        {previewImage && <img src={previewImage} style={{ maxWidth: '80vw', maxHeight: '80vh' }} alt="preview" />}
      </Modal>
    </>
  );
});

/** 简易 CSV 行解析（处理引号转义） */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

export default DataManagement;
