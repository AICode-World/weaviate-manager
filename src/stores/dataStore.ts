import { create } from 'zustand';
import type { WeaviateClient } from 'weaviate-ts-client';
import { listCollections } from '../services';
import { wrapError, reportError } from '../utils/errorHandler';

interface DataStore {
  collections: string[];
  currentCollection: string | null;
  isRefreshing: boolean;
  currentData: Record<string, unknown>[];
  totalCount: number;
  cursors: { after: string | null; before: string | null };
  isLoading: boolean;
  searchMode: 'bm25' | 'nearText';
  searchQuery: string;
  searchResults: Record<string, unknown>[];
  isSearching: boolean;
  isMultiModalSearching: boolean;
  multiModalResults: Record<string, unknown>[];
  paginationCurrent: number;

  setCollections: (list: string[]) => void;
  setCurrentCollection: (name: string | null) => void;
  refreshCollections: (client: WeaviateClient | null) => Promise<void>;
  setData: (data: Record<string, unknown>[], total: number, cursors: { after: string | null; before: string | null }) => void;
  setLoading: (loading: boolean) => void;
  setSearchMode: (mode: 'bm25' | 'nearText') => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: Record<string, unknown>[]) => void;
  setSearching: (loading: boolean) => void;
  clearSearch: () => void;
  setPaginationPage: (page: number) => void;
  setMultiModalResults: (results: Record<string, unknown>[]) => void;
  setMultiModalSearching: (loading: boolean) => void;
  resetData: () => void;
}

const useDataStore = create<DataStore>((set, get) => ({
  collections: [],
  currentCollection: null,
  isRefreshing: false,
  currentData: [],
  totalCount: 0,
  cursors: { after: null, before: null },
  isLoading: false,
  searchMode: 'bm25',
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  isMultiModalSearching: false,
  multiModalResults: [],
  paginationCurrent: 1,

  setCollections: (list) => set({ collections: list }),

  setCurrentCollection: (name) =>
    set({ currentCollection: name, paginationCurrent: 1, cursors: { after: null, before: null } }),

  refreshCollections: async (client) => {
    if (!client) return;
    const { currentCollection } = get();
    set({ isRefreshing: true });
    try {
      const list = await listCollections(client);
      set({ collections: list, isRefreshing: false });
      if (currentCollection && !list.includes(currentCollection)) {
        set({ currentCollection: null, currentData: [], totalCount: 0, cursors: { after: null, before: null }, paginationCurrent: 1 });
      }
    } catch (e) {
      reportError(wrapError(e, 'refreshCollections'));
      set({ isRefreshing: false });
    }
  },

  setData: (data, total, cursors) => set({ currentData: data, totalCount: total, cursors }),
  setLoading: (loading) => set({ isLoading: loading }),
  setSearchMode: (mode) => set({ searchMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setSearching: (loading) => set({ isSearching: loading }),
  clearSearch: () => set({ searchQuery: '', searchResults: [], searchMode: 'bm25' }),
  setPaginationPage: (page) => set({ paginationCurrent: page }),
  setMultiModalResults: (results) => set({ multiModalResults: results }),
  setMultiModalSearching: (loading) => set({ isMultiModalSearching: loading }),

  resetData: () =>
    set({
      collections: [],
      currentCollection: null,
      currentData: [],
      totalCount: 0,
      cursors: { after: null, before: null },
      searchQuery: '',
      searchResults: [],
      multiModalResults: [],
      paginationCurrent: 1,
    }),
}));

export default useDataStore;
export { useDataStore };
