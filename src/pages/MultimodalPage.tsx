import { Select, Empty, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import MultiModalSearch from '../components/DataView/MultiModalSearch';
import useAppStore from '../stores/appStore';
import { useI18n } from '../i18n/I18nProvider';

const MultimodalPage: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { collections, currentCollection, setCurrentCollection, connectionStatus } = useAppStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <div className="page-title">{t('multimodalSearchTitle')}</div>
          <div className="page-subtitle">{t('multimodalSearchDesc')}</div>
        </div>
        {connectionStatus === 'connected' && collections.length > 0 && (
          <Select
            placeholder={t('selectCollection')}
            value={currentCollection}
            onChange={(v) => setCurrentCollection(v)}
            style={{ width: 200 }}
            options={collections.map((c) => ({ label: c, value: c }))}
          />
        )}
      </div>

      {connectionStatus !== 'connected' ? (
        <div className="glass-card" style={{ padding: 60, textAlign: 'center' }}>
          <Empty description={t('pleaseConnect')} />
          <Button type="primary" onClick={() => navigate('/connections')} style={{ marginTop: 16 }}>
            {t('connectionManagement')}
          </Button>
        </div>
      ) : !currentCollection ? (
        <div className="glass-card" style={{ padding: 60, textAlign: 'center' }}>
          <Empty description={t('pleaseSelectCollectionFirst')} />
        </div>
      ) : (
        <MultiModalSearch />
      )}
    </div>
  );
};

export default MultimodalPage;
