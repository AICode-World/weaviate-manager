import { Input, Switch, Button, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useDataStore } from '../../stores/dataStore';
import { useQueryHistoryStore } from '../../stores/queryHistoryStore';
import { useI18n } from '../../i18n/I18nProvider';

const { Text } = Typography;

const SearchBar: React.FC = () => {
  const { t } = useI18n();
  const { searchMode, searchQuery, isSearching, setSearchMode, setSearchQuery, clearSearch, currentCollection } = useDataStore();
  const addQuery = useQueryHistoryStore((s) => s.addQuery);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      addQuery({
        type: searchMode === 'bm25' ? 'bm25' : 'nearText',
        query: searchQuery,
        collection: currentCollection ?? undefined,
      });
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Input.Search placeholder={t('searchPlaceholder')} value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)} onSearch={handleSearch}
        loading={isSearching} style={{ width: 280 }} size="small" />
      <Text style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--color-text-tertiary)', fontWeight: 500 }}>
        {searchMode === 'bm25' ? t('keyword') : t('semantic')}
      </Text>
      <Switch size="small" checked={searchMode === 'nearText'} onChange={(v) => setSearchMode(v ? 'nearText' : 'bm25')} />
      <Button size="small" icon={<CloseOutlined />} onClick={clearSearch} disabled={!searchQuery}>{t('clear')}</Button>
    </div>
  );
};

export default SearchBar;
