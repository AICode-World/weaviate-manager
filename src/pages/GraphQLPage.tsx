import GraphQLTab from '../components/DataView/GraphQLTab';
import { useI18n } from '../i18n/I18nProvider';

const GraphQLPage: React.FC = () => {
  const { t } = useI18n();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <div className="page-title">{t('graphqlPlayground')}</div>
          <div className="page-subtitle">{t('graphqlPlaygroundDesc')}</div>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <GraphQLTab />
      </div>
    </div>
  );
};

export default GraphQLPage;
