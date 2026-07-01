import { Menu, Button, Spin, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import useAppStore from '../../stores/appStore';
import { useI18n } from '../../i18n/I18nProvider';

const { Text } = Typography;

const CollectionList: React.FC = () => {
  const { t } = useI18n();
  const { collections, currentCollection, isRefreshing, setCurrentCollection, refreshCollections, connectionStatus } = useAppStore();
  if (connectionStatus !== 'connected') return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0 8px' }}>
        <Text style={{ color: '#6b7589', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 600 }}>
          {t('collections')} ({collections.length})
        </Text>
        <Button type="text" size="small" icon={isRefreshing ? <Spin size="small" /> : <ReloadOutlined />}
          onClick={refreshCollections} disabled={isRefreshing} style={{ color: '#9aa3b5' }} />
      </div>
      {collections.length === 0 ? (
        <Text style={{ color: '#9aa3b5', fontSize: 12 }}>{t('noCollections')}</Text>
      ) : (
        <Menu mode="inline" selectedKeys={currentCollection ? [currentCollection] : []}
          items={collections.map((n) => ({ key: n, label: n }))}
          onClick={({ key }) => setCurrentCollection(key)} style={{ background: 'transparent', borderInlineEnd: 'none', fontWeight: 500 }} />
      )}
    </div>
  );
};

export default CollectionList;
