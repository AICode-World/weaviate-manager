import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Button, Modal, Form, Input, InputNumber, Upload, Popconfirm,
  Space, Progress, Select, DatePicker, Alert, App, Radio, Checkbox, Switch, Typography,
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
  getClassProperties, fetchObjects,
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
  handleExportSelected: () => void;
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
  const { message } = App.useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Record<string, unknown> | null>(null);
  const [form] = Form.useForm();
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; fail: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 编辑时记录原始 blob 值，用于检测图片是否被更换
  const [originalBlobs, setOriginalBlobs] = useState<Record<string, string | null>>({});
  // 图片预览
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  // 导出 CSV 弹窗
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportRange, setExportRange] = useState<'all' | 'selected' | 'current'>('all');
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [exportFields, setExportFields] = useState<string[]>([]);
  const [exportEncoding, setExportEncoding] = useState('UTF-8');
  const [exportHeader, setExportHeader] = useState(true);
  const [exporting, setExporting] = useState(false);

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
  useImperativeHandle(ref, () => ({ openCreate, openEdit, handleDelete, handleExportSelected }), [fields, client, currentCollection, selectedRowKeys]);

  /** 提交表单（新增或编辑） */
  const handleSubmit = async () => {
    if (!client || !currentCollection) return;
    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
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
    const total = selectedRowKeys.length;
    let success = 0;
    let fail = 0;
    const hide = message.loading({ content: t('batchProgress', { current: 0, total }), key: 'batchDelete', duration: 0 });
    for (let i = 0; i < selectedRowKeys.length; i++) {
      try {
        await deleteObject(client, currentCollection, selectedRowKeys[i]);
        success++;
      } catch { fail++; }
      hide();
      message.loading({ content: t('batchProgress', { current: i + 1, total }), key: 'batchDelete', duration: 0 });
    }
    hide();
    message.info(t('deleteDone', { s: success, f: fail }));
    onSelectionChange([]);
    onRefresh();
  };

  /** 导出 CSV：打开导出弹窗 */
  const handleExport = () => {
    if (!currentCollection) return;
    // 从 Weaviate Schema 获取完整属性列表（而非从行数据中提取）
    const fieldList = fields.map((f) => f.name);
    setAvailableFields(fieldList);
    setExportFields(fieldList); // 默认全选
    // 如果有选中数据，默认选中模式
    setExportRange(selectedRowKeys.length > 0 ? 'selected' : 'all');
    setExportModalOpen(true);
  };

  /** 执行导出 */
  const doExport = async () => {
    if (!client || !currentCollection) return;
    setExporting(true);
    try {
      const { currentData, searchResults, searchQuery, paginationCurrent } = useAppStore.getState();
      const isSearchMode = searchResults.length > 0 || !!searchQuery.trim();

      let rowsToExport: Record<string, unknown>[] = [];

      if (exportRange === 'all') {
        if (isSearchMode) {
          // 搜索模式下"全部"=所有搜索结果
          rowsToExport = searchResults;
        } else {
          // 从 Weaviate 拉取全部数据（分页遍历）
          const allRows: Record<string, unknown>[] = [];
          let after: string | undefined;
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const result = await fetchObjects(client, currentCollection, 100, after);
            allRows.push(...result.objects);
            if (result.after && result.objects.length === 100) {
              after = result.after;
            } else {
              break;
            }
          }
          rowsToExport = allRows;
        }
      } else if (exportRange === 'selected') {
        const displayData = isSearchMode ? searchResults : currentData;
        rowsToExport = displayData.filter((row) => selectedRowKeys.includes(row.__id as string));
      } else {
        // 当前页
        const displayData = isSearchMode ? searchResults : currentData;
        rowsToExport = displayData;
      }

      if (rowsToExport.length === 0) {
        message.warning(t('noDataExport'));
        return;
      }

      const headers = exportFields.length > 0
        ? exportFields
        : fields.map((f) => f.name);
      const csvRows: string[] = [];
      if (exportHeader) {
        csvRows.push(headers.join(','));
      }
      for (const row of rowsToExport) {
        const vals = headers.map((h) => {
          const v = row[h];
          if (v === null || v === undefined) return '';
          if (typeof v === 'string' && v.startsWith('data:')) return t('exists');
          const s = String(v);
          return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        });
        csvRows.push(vals.join(','));
      }
      const bom = exportEncoding === 'UTF-8' ? '\ufeff' : '';
      const blob = new Blob([bom + csvRows.join('\n')], { type: `text/csv;charset=${exportEncoding}` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const rangeSuffix = exportRange === 'selected' ? '_selected' : exportRange === 'current' ? `_page${paginationCurrent}` : '_all';
      a.download = `${currentCollection}${rangeSuffix}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(t('exportDone', { n: rowsToExport.length }));
      setExportModalOpen(false);
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('operationFail'));
    } finally {
      setExporting(false);
    }
  };


  /** 导出选中行为 CSV */
  const handleExportSelected = () => {
    if (!currentCollection || selectedRowKeys.length === 0) return;
    const { currentData, searchResults, searchQuery } = useAppStore.getState();
    const isSearchMode = searchResults.length > 0 || !!searchQuery.trim();
    const displayData = isSearchMode ? searchResults : currentData;
    const selectedRows = displayData.filter((row) => selectedRowKeys.includes(row.__id as string));
    if (selectedRows.length === 0) {
      message.warning(t('noDataExport'));
      return;
    }
    const allKeys = new Set<string>();
    selectedRows.forEach((row) => Object.keys(row).forEach((k) => { if (!k.startsWith('__') && k !== '_additional') allKeys.add(k); }));
    const headers = [...allKeys];
    const csvRows = [headers.join(',')];
    for (const row of selectedRows) {
      const vals = headers.map((h) => {
        const v = row[h];
        if (v === null || v === undefined) return '';
        if (typeof v === 'string' && v.startsWith('data:')) return '存在';
        const s = String(v);
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      });
      csvRows.push(vals.join(','));
    }
    const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentCollection}_selected_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(t('exportDone', { n: selectedRows.length }));
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
        confirmLoading={submitting}
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
          <div style={{ marginTop: 8, color: 'var(--color-text-tertiary)' }}>
            {t('csvImportDone', { s: importResult.success, f: importResult.fail })}
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

      {/* 导出 CSV 弹窗 */}
      <Modal
        title={t('exportCSV')}
        open={exportModalOpen}
        onCancel={() => setExportModalOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setExportModalOpen(false)} disabled={exporting}>{t('cancel')}</Button>
            <Button type="primary" onClick={doExport} loading={exporting}>{t('exportCSV')}</Button>
          </Space>
        }
        width={560}
        destroyOnHidden
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 16 }}>
          {/* 导出范围 */}
          <div>
            <Typography.Text strong style={{ display: 'block', marginBottom: 10 }}>{t('exportRange')}</Typography.Text>
            <Radio.Group value={exportRange} onChange={(e) => setExportRange(e.target.value)}>
              <Space direction="vertical" size={8}>
                <Radio value="all">{t('exportAllData')}</Radio>
                <Radio value="selected" disabled={selectedRowKeys.length === 0}>
                  {t('exportSelectedData')} ({selectedRowKeys.length} {t('records')})
                </Radio>
                <Radio value="current">{t('exportCurrentPage')}</Radio>
              </Space>
            </Radio.Group>
          </div>
          {/* 导出字段 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #F0F0F0' }}>
              <Typography.Text strong>{t('exportFields')}</Typography.Text>
              <Checkbox
                checked={availableFields.length > 0 && exportFields.length === availableFields.length}
                indeterminate={exportFields.length > 0 && exportFields.length < availableFields.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    setExportFields([...availableFields]);
                  } else {
                    setExportFields([]);
                  }
                }}
              >
                {t('selectAll')} ({exportFields.length}/{availableFields.length})
              </Checkbox>
            </div>
            <Checkbox.Group
              value={exportFields}
              onChange={(checked) => setExportFields(checked as string[])}
              style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}
            >
              {availableFields.map((field) => (
                <Checkbox key={field} value={field} style={{ fontSize: 13 }}>{field}</Checkbox>
              ))}
            </Checkbox.Group>
          </div>
          {/* 格式选项 */}
          <div>
            <Typography.Text strong style={{ display: 'block', marginBottom: 10 }}>{t('formatOptions')}</Typography.Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography.Text type="secondary">{t('fileEncoding')}</Typography.Text>
                <Select
                  value={exportEncoding}
                  onChange={setExportEncoding}
                  size="small"
                  style={{ width: 120 }}
                  options={[
                    { label: 'UTF-8', value: 'UTF-8' },
                    { label: 'GBK', value: 'GBK' },
                    { label: 'ASCII', value: 'ASCII' },
                  ]}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography.Text type="secondary">{t('includeHeader')}</Typography.Text>
                <Switch checked={exportHeader} onChange={setExportHeader} size="small" />
              </div>
            </div>
          </div>
        </div>
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
