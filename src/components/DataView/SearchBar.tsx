import { Input, Switch, Button, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import useAppStore from '../../stores/appStore';
import { useI18n } from '../../i18n/I18nProvider';

const { Text } = Typography;

const SearchBar: React.FC = () => {
  const { t } = useI18n();
  const { searchMode, searchQuery, isSearching, setSearchMode, setSearchQuery, clearSearch } = useAppStore();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Input.Search placeholder={t('searchPlaceholder')} value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)} loading={isSearching} style={{ width: 280 }} size="small" />
      <Text style={{ fontSize: 12, whiteSpace: 'nowrap', color: '#6b7589', fontWeight: 500 }}>
        {searchMode === 'bm25' ? t('keyword') : t('semantic')}
      </Text>
      <Switch size="small" checked={searchMode === 'nearText'} onChange={(v) => setSearchMode(v ? 'nearText' : 'bm25')} />
      <Button size="small" icon={<CloseOutlined />} onClick={clearSearch} disabled={!searchQuery}>{t('clear')}</Button>
    </div>
  );
};

export default SearchBar;
