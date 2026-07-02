import { useState } from 'react';
import { Radio, Input, Button, Upload, Spin, Card, Modal, Typography, Space, Row, Col, App } from 'antd';
import { SearchOutlined, UploadOutlined } from '@ant-design/icons';
import useAppStore from '../../stores/appStore';
import { useQueryHistoryStore } from '../../stores/queryHistoryStore';
import { searchNearTextWithVector, searchNearImage } from '../../services/weaviate';
import { useI18n } from '../../i18n/I18nProvider';

const { TextArea } = Input;
const { Text } = Typography;

/** 多模态搜索组件：文字→图片 / 图片→图片 */
const MultiModalSearch: React.FC = () => {
  const {
    client, currentCollection,
    multiModalResults, isMultiModalSearching,
    setMultiModalResults, setMultiModalSearching,
  } = useAppStore();
  const { t } = useI18n();
  const { message } = App.useApp();
  const addQuery = useQueryHistoryStore((s) => s.addQuery);

  const [searchType, setSearchType] = useState<'text' | 'image'>('text');
  const [textQuery, setTextQuery] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedItem, setSelectedItem] = useState<Record<string, unknown> | null>(null);

  /** 文字→图片搜索 */
  const handleTextSearch = async () => {
    if (!client || !currentCollection || !textQuery.trim()) return;
    setMultiModalSearching(true);
    setMultiModalResults([]);
    try {
      const results = await searchNearTextWithVector(client, currentCollection, textQuery, 12);
      setMultiModalResults(results);
      addQuery({ type: 'nearText', query: textQuery, collection: currentCollection, resultCount: results.length });
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('searchFail'));
    } finally {
      setMultiModalSearching(false);
    }
  };

  /** 图片→图片搜索 */
  const handleImageSearch = async () => {
    if (!client || !currentCollection || !imageFile) return;
    setMultiModalSearching(true);
    setMultiModalResults([]);
    try {
      const base64 = await fileToBase64(imageFile);
      const results = await searchNearImage(client, currentCollection, base64, 12);
      setMultiModalResults(results);
      addQuery({ type: 'nearImage', query: `[image: ${imageFile.name}]`, collection: currentCollection, resultCount: results.length });
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('imageSearchFail'));
    } finally {
      setMultiModalSearching(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  /** 判断值是否为 Base64 图片（支持裸 base64 和 data URI） */
  const isImage = (v: unknown): v is string => {
    if (typeof v !== 'string') return false;
    if (v.startsWith('data:image/')) return true;
    // 裸 base64 按文件头识别
    return v.startsWith('/9j/') || v.startsWith('iVBOR') || v.startsWith('R0lGOD') || v.startsWith('UklGR');
  };

  /** 查找结果中的图片字段，返回 data URI */
  const findImageField = (item: Record<string, unknown>): string | null => {
    for (const v of Object.values(item)) {
      if (isImage(v)) {
        const raw = v as string;
        if (raw.startsWith('data:')) return raw;
        // 裸 base64 补前缀
        const mime = raw.startsWith('/9j/') ? 'image/jpeg'
          : raw.startsWith('iVBOR') ? 'image/png'
          : raw.startsWith('R0lGOD') ? 'image/gif'
          : 'image/jpeg';
        return `data:${mime};base64,${raw}`;
      }
    }
    return null;
  };

  if (!currentCollection) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-quaternary)' }}>{t('pleaseSelectCollectionFirst')}</div>;
  }

  return (
    <Row gutter={16} style={{ height: 'calc(100vh - 200px)' }}>
      {/* 左侧搜索区 */}
      <Col span={10}>
        <Card size="small" title={t('searchParams')}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Radio.Group
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              size="small"
            >
              <Radio.Button value="text">{t('textSearch')}</Radio.Button>
              <Radio.Button value="image">{t('imageSearch')}</Radio.Button>
            </Radio.Group>

            {searchType === 'text' ? (
              <>
                <TextArea
                  rows={4}
                  placeholder={t('imageDescPlaceholder')}
                  value={textQuery}
                  onChange={(e) => setTextQuery(e.target.value)}
                />
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={handleTextSearch}
                  loading={isMultiModalSearching}
                  block
                >
                  {t('search')}
                </Button>
              </>
            ) : (
              <>
                <Upload.Dragger
                  accept="image/*"
                  maxCount={1}
                  beforeUpload={(file) => { setImageFile(file); return false; }}
                  onRemove={() => setImageFile(null)}
                  listType="picture"
                >
                  <UploadOutlined style={{ fontSize: 24 }} />
                  <p>{t('uploadImage')}</p>
                </Upload.Dragger>
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={handleImageSearch}
                  loading={isMultiModalSearching}
                  disabled={!imageFile}
                  block
                >
                  {t('search')}
                </Button>
              </>
            )}
          </Space>
        </Card>
      </Col>

      {/* 右侧结果区 */}
      <Col span={14}>
        <Card
          size="small"
          title={`${t('results')}${multiModalResults.length > 0 ? ` (${multiModalResults.length})` : ''}`}
          style={{ height: '100%', overflow: 'auto' }}
        >
          <Spin spinning={isMultiModalSearching}>
            {multiModalResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-quaternary)' }}>
                {t('imageSearchHint')}
              </div>
            ) : (
              <Row gutter={[8, 8]}>
                {multiModalResults.map((item, idx) => {
                  const img = findImageField(item);
                  const distance = item.__distance as number | undefined;
                  const caption = (item.caption as string) ?? (item.description as string) ?? '';
                  return (
                    <Col span={8} key={idx}>
                      <Card
                        hoverable
                        size="small"
                        cover={
                          img ? (
                            <div style={{ height: 120, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-sidebar)' }}>
                              <img src={img} alt={caption} style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }} />
                            </div>
                          ) : (
                            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-sidebar)', color: 'var(--color-text-quaternary)' }}>
                              {t('noImage')}
                            </div>
                          )
                        }
                        onClick={() => setSelectedItem(item)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Text ellipsis style={{ fontSize: 12 }}>
                          {caption || t('resultN', { n: idx + 1 })}
                        </Text>
                        {distance !== undefined && (
                          <div>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {t('distance')}: {distance.toFixed(4)}
                            </Text>
                          </div>
                        )}
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            )}
          </Spin>
        </Card>
      </Col>

      {/* 详情弹窗 */}
      <Modal
        title={t('details')}
        open={!!selectedItem}
        onCancel={() => setSelectedItem(null)}
        footer={null}
        width={600}
      >
        {selectedItem && (
          <div>
            {Object.entries(selectedItem)
              .filter(([k]) => !k.startsWith('__'))
              .map(([key, value]) => (
                <div key={key} style={{ marginBottom: 8 }}>
                  <Text strong>{key}: </Text>
                  {isImage(value) ? (
                    <img src={findImageField({ [key]: value }) ?? (value as string)} alt={key} style={{ maxWidth: 300, maxHeight: 200 }} />
                  ) : (
                    <Text>{String(value)}</Text>
                  )}
                </div>
              ))}
          </div>
        )}
      </Modal>
    </Row>
  );
};

export default MultiModalSearch;
