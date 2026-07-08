import { create } from 'zustand';
import type { WeaviateClient } from 'weaviate-ts-client';
import * as weaviateApi from '../services/weaviate';
import { encrypt, decrypt, isEncrypted } from '../utils/crypto';
import { wrapError, reportError, userFriendlyMessage } from '../utils/errorHandler';

/** 集群配置 */
export interface ClusterConfig {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  isDefault: boolean;
}

/** 仪表盘数据 */
export interface DashboardData {
  totalObjects: number;
  totalCollections: number;
  vectorDimension: number | string;
  estimatedStorage: string;
  collectionDetails: { name: string; count: number; vectorDim: number | null }[];
}

/** 主题模式 */
export type ThemeMode = 'light' | 'dark' | 'system';

/** 品牌色预设 */
export const THEME_PRESETS = [
  { name: 'blue', color: '#1677ff' },
  { name: 'green', color: '#10b981' },
  { name: 'purple', color: '#8b5cf6' },
  { name: 'orange', color: '#f97316' },
  { name: 'pink', color: '#ec4899' },
] as const;

/** 主题偏好 */
export interface ThemePrefs {
  themeMode: ThemeMode;
  themeColor: string;
}

const CLUSTERS_KEY = 'weaviate_clusters';
const THEME_PREFS_KEY = 'weaviate_theme_prefs';
const UI_PREFS_KEY = 'weaviate_ui_prefs';

const DEFAULT_THEME_PREFS: ThemePrefs = { themeMode: 'light', themeColor: '#1677ff' };

function loadThemePrefs(): ThemePrefs {
  try {
    const raw = localStorage.getItem(THEME_PREFS_KEY);
    if (!raw) return { ...DEFAULT_THEME_PREFS };
    return { ...DEFAULT_THEME_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_THEME_PREFS };
  }
}

function saveThemePrefs(prefs: ThemePrefs) {
  localStorage.setItem(THEME_PREFS_KEY, JSON.stringify(prefs));
}

function loadClustersFromStorage(): ClusterConfig[] {
  try {
    const raw = localStorage.getItem(CLUSTERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function decryptClusterApiKeys(clusters: ClusterConfig[]): Promise<ClusterConfig[]> {
  const result: ClusterConfig[] = [];
  for (const c of clusters) {
    const cluster = { ...c };
    if (c.apiKey && isEncrypted(JSON.parse(c.apiKey))) {
      try {
        const encrypted = JSON.parse(c.apiKey);
        cluster.apiKey = await decrypt(encrypted);
      } catch {
        // 解密失败保留密文，用户需要重新输入
        cluster.apiKey = '';
      }
    }
    result.push(cluster);
  }
  return result;
}

async function encryptClusterApiKeys(clusters: ClusterConfig[]): Promise<ClusterConfig[]> {
  const result: ClusterConfig[] = [];
  for (const c of clusters) {
    const cluster = { ...c };
    if (cluster.apiKey && !isEncrypted(cluster.apiKey)) {
      try {
        const encrypted = await encrypt(cluster.apiKey);
        cluster.apiKey = JSON.stringify(encrypted);
      } catch {
        // 加密失败保留明文
      }
    }
    result.push(cluster);
  }
  return result;
}

async function saveClustersToStorage(clusters: ClusterConfig[]) {
  const secured = await encryptClusterApiKeys(clusters);
  localStorage.setItem(CLUSTERS_KEY, JSON.stringify(secured));
}

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

  // 多集群
  clusters: ClusterConfig[];
  activeClusterId: string | null;

  // 仪表盘
  dashboardData: DashboardData | null;
  dashboardLoading: boolean;

  // 主题
  themeMode: ThemeMode;
  themeColor: string;

  // 响应式
  sidebarCollapsed: boolean;

  setConnection: (status: AppStore['connectionStatus'], client: WeaviateClient | null, url?: string, cred?: string) => void;
  setCollections: (list: string[]) => void;
  setCurrentCollection: (name: string | null) => void;
  refreshCollections: () => Promise<void>;
  setData: (data: Record<string, unknown>[], total: number, cursors: { after: string | null; before: string | null }) => void;
  setLoading: (loading: boolean) => void;
  setSearchMode: (mode: AppStore['searchMode']) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: Record<string, unknown>[]) => void;
  setSearching: (loading: boolean) => void;
  clearSearch: () => void;
  disconnect: () => void;
  setPaginationPage: (page: number) => void;
  setMultiModalResults: (results: Record<string, unknown>[]) => void;
  setMultiModalSearching: (loading: boolean) => void;

  // 多集群方法
  loadClusters: () => void;
  saveCluster: (cluster: Omit<ClusterConfig, 'id'>) => string;
  updateCluster: (id: string, data: Partial<ClusterConfig>) => void;
  deleteCluster: (id: string) => void;
  setActiveCluster: (id: string | null) => void;

  // 仪表盘
  fetchDashboardData: () => Promise<void>;
  clearDashboardData: () => void;

  // 主题
  setThemeMode: (mode: ThemeMode) => void;
  setThemeColor: (color: string) => void;

  // 响应式
  setSidebarCollapsed: (collapsed: boolean) => void;
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

  clusters: [],
  activeClusterId: null,

  dashboardData: null,
  dashboardLoading: false,

  themeMode: loadThemePrefs().themeMode,
  themeColor: loadThemePrefs().themeColor,

  sidebarCollapsed: (() => {
    try {
      const raw = localStorage.getItem(UI_PREFS_KEY);
      if (raw) return JSON.parse(raw).sidebarCollapsed ?? false;
    } catch { /* ignore */ }
    return false;
  })(),

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
      // 连接断开时清空仪表盘
      dashboardData: status === 'connected' ? s.dashboardData : null,
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
  disconnect: () => set({
    connectionStatus: 'disconnected', client: null, collections: [], currentCollection: null,
    currentData: [], totalCount: 0, cursors: { after: null, before: null },
    searchQuery: '', searchResults: [], multiModalResults: [], paginationCurrent: 1,
    dashboardData: null,
  }),
  setPaginationPage: (page) => set({ paginationCurrent: page }),
  setMultiModalResults: (results) => set({ multiModalResults: results }),
  setMultiModalSearching: (loading) => set({ isMultiModalSearching: loading }),

  // ============ 多集群 ============
  loadClusters: async () => {
    const raw = loadClustersFromStorage();
    // 解密 API Keys + 检测是否需要迁移明文旧数据
    let needsMigration = false;
    const clusters = await decryptClusterApiKeys(raw);
    // 检查是否有未加密的明文 key 需要迁移
    for (const c of raw) {
      if (c.apiKey && !isEncrypted(c.apiKey)) needsMigration = true;
    }
    if (needsMigration) {
      await saveClustersToStorage(clusters);
    }

    // 自动发现环境变量中预设的默认连接
    const defaultUrl = import.meta.env.VITE_DEFAULT_WEAVIATE_URL;
    const defaultApiKey = import.meta.env.VITE_DEFAULT_API_KEY ?? '';
    if (defaultUrl && !clusters.some((c) => c.url === defaultUrl)) {
      const envCluster: ClusterConfig = {
        id: `env-${Date.now()}`,
        name: defaultApiKey ? 'Env Default (auth)' : 'Env Default',
        url: defaultUrl,
        apiKey: defaultApiKey,
        isDefault: clusters.length === 0,
      };
      clusters.unshift(envCluster);
    }

    const active = clusters.find((c) => c.isDefault)?.id ?? clusters[0]?.id ?? null;
    set({ clusters, activeClusterId: active });
  },

  saveCluster: (cluster) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newOne: ClusterConfig = { ...cluster, id };
    const clusters = [...get().clusters, newOne];
    // 第一个或明确 default 则设为 isDefault
    if (clusters.length === 1 || cluster.isDefault) {
      clusters.forEach((c) => { c.isDefault = c.id === id; });
    }
    saveClustersToStorage(clusters);
    set({ clusters, activeClusterId: cluster.isDefault || get().activeClusterId == null ? id : get().activeClusterId });
    return id;
  },

  updateCluster: (id, data) => {
    const clusters = get().clusters.map((c) => {
      if (c.id === id) return { ...c, ...data };
      // 如果当前编辑的集群被设为 default，其他都取消 default
      if (data.isDefault && c.id !== id) return { ...c, isDefault: false };
      return c;
    });
    saveClustersToStorage(clusters);
    set({ clusters });
  },

  deleteCluster: (id) => {
    const clusters = get().clusters.filter((c) => c.id !== id);
    // 删掉后如果没 default，把第一个设为 default
    if (!clusters.some((c) => c.isDefault) && clusters.length > 0) {
      clusters[0].isDefault = true;
    }
    saveClustersToStorage(clusters);
    const { activeClusterId } = get();
    const updates: Partial<AppStore> = { clusters };
    if (activeClusterId === id) {
      const next = clusters[0]?.id ?? null;
      updates.activeClusterId = next;
      // 如果删的是当前连接的集群，断开连接
      updates.connectionStatus = 'disconnected';
      updates.client = null;
      updates.collections = [];
      updates.currentCollection = null;
      updates.currentData = [];
      updates.totalCount = 0;
      updates.dashboardData = null;
    }
    set(updates);
  },

  setActiveCluster: (id) => set({ activeClusterId: id }),

  // ============ 仪表盘 ============
  fetchDashboardData: async () => {
    const { client } = get();
    if (!client) return;
    set({ dashboardLoading: true });
    try {
      const data = await weaviateApi.getDashboardData(client);
      set({ dashboardData: data, dashboardLoading: false });
    } catch (e) {
      reportError(wrapError(e, 'fetchDashboardData'));
      set({ dashboardLoading: false });
    }
  },

  clearDashboardData: () => set({ dashboardData: null }),

  // ============ 主题 ============
  setThemeMode: (mode) => {
    const prefs = { themeMode: mode, themeColor: get().themeColor };
    saveThemePrefs(prefs);
    set({ themeMode: mode });
  },

  setThemeColor: (color) => {
    const prefs = { themeMode: get().themeMode, themeColor: color };
    saveThemePrefs(prefs);
    set({ themeColor: color });
  },

  // ============ 响应式 ============
  setSidebarCollapsed: (collapsed) => {
    try {
      localStorage.setItem(UI_PREFS_KEY, JSON.stringify({ sidebarCollapsed: collapsed }));
    } catch { /* ignore */ }
    set({ sidebarCollapsed: collapsed });
  },
}));

export default useAppStore;
