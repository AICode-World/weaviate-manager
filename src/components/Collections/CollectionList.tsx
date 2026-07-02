import { Menu, Button, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../../stores/appStore';
import { useI18n } from '../../i18n/I18nProvider';

const { Text } = Typography;

const CollectionList: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { collections, currentCollection, isRefreshing, setCurrentCollection, refreshCollections, connectionStatus } = useAppStore();
  if (connectionStatus !== 'connected') return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0 8px' }}>
        <Text style={{ color: 'var(--color-text-tertiary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 600 }}>
          {t('collections')} ({collections.length})
        </Text>
        <Button type="text" size="small" icon={<ReloadOutlined spin={isRefreshing} />}
          onClick={refreshCollections} disabled={isRefreshing} style={{ color: 'var(--color-text-quaternary)' }} />
      </div>
      {collections.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <Text style={{ color: 'var(--color-text-quaternary)', fontSize: 12, display: 'block', marginBottom: 8 }}>{t('noCollections')}</Text>
          <Button type="link" size="small" onClick={() => navigate('/schema')} style={{ fontSize: 12 }}>
            {t('goToSchema')}
          </Button>
        </div>
      ) : (
        <Menu mode="inline" selectedKeys={currentCollection ? [currentCollection] : []}
          items={collections.map((n) => ({ key: n, label: n }))}
          onClick={({ key }) => setCurrentCollection(key)} style={{ background: 'transparent', borderInlineEnd: 'none', fontWeight: 500 }} />
      )}
    </div>
  );
};

export default CollectionList;
