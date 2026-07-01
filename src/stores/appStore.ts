import { create } from 'zustand';
import type { WeaviateClient } from 'weaviate-ts-client';
import * as weaviateApi from '../services/weaviate';

interface AppStore {
  connectionStatus: 'disconnected' | 'connected' | 'error';
  client: WeaviateClient | null;
  url: string;
  cred: string;
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

  setConnection: (status: AppStore['connectionStatus'], client: WeaviateClient | null, url?: string, cred?: string) => void;
  setCollections: (list: string[]) => void;
  setCurrentCollection: (name: string | null) => void;
  refreshCollections: () => Promise<void>;
  setData: (data: Record<string, unknown>[], total: number, cursors: { after: string | null; before: string | null }) => void;
  setLoading: (loading: boolean) => void;
  setSearchMode: (mode: AppStore['searchMode']) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: Record<string, unknown>[]) => void;
  setSearching: (searching: boolean) => void;
  clearSearch: () => void;
  disconnect: () => void;
  setPaginationPage: (page: number) => void;
  setMultiModalResults: (results: Record<string, unknown>[]) => void;
  setMultiModalSearching: (loading: boolean) => void;
}

const useAppStore = create<AppStore>((set, get) => ({
  connectionStatus: 'disconnected',
  client: null,
  url: 'http://localhost:8080',
  cred: '',
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

  setConnection: (status, client, url, cred) =>
    set((s) => ({
      connectionStatus: status, client,
      url: url ?? s.url, cred: cred ?? s.cred,
      collections: status === 'connected' ? s.collections : [],
      currentCollection: status === 'connected' ? s.currentCollection : null,
      currentData: status === 'connected' ? s.currentData : [],
      totalCount: status === 'connected' ? s.totalCount : 0,
      searchResults: [], searchQuery: '', multiModalResults: [],
      paginationCurrent: 1, cursors: { after: null, before: null },
    })),

  setCollections: (list) => set({ collections: list }),
  setCurrentCollection: (name) => set({ currentCollection: name, paginationCurrent: 1, cursors: { after: null, before: null } }),

  refreshCollections: async () => {
    const { client, currentCollection } = get();
    if (!client) return;
    set({ isRefreshing: true });
    try {
      const list = await weaviateApi.listCollections(client);
      set({ collections: list, isRefreshing: false });
      if (currentCollection && !list.includes(currentCollection)) {
        set({ currentCollection: null, currentData: [], totalCount: 0, cursors: { after: null, before: null }, paginationCurrent: 1 });
      }
    } catch {
      set({ isRefreshing: false });
    }
  },

  setData: (data, total, cursors) => set({ currentData: data, totalCount: total, cursors }),
  setLoading: (loading) => set({ isLoading: loading }),
  setSearchMode: (mode) => set({ searchMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setSearching: (searching) => set({ isSearching: searching }),
  clearSearch: () => set({ searchQuery: '', searchResults: [], searchMode: 'bm25' }),
  disconnect: () => set({
    connectionStatus: 'disconnected', client: null, collections: [], currentCollection: null,
    currentData: [], totalCount: 0, cursors: { after: null, before: null },
    searchQuery: '', searchResults: [], multiModalResults: [], paginationCurrent: 1,
  }),
  setPaginationPage: (page) => set({ paginationCurrent: page }),
  setMultiModalResults: (results) => set({ multiModalResults: results }),
  setMultiModalSearching: (loading) => set({ isMultiModalSearching: loading }),
}));

export default useAppStore;
