import { create } from 'zustand';
import { encrypt, decrypt, isEncrypted, isUnlocked } from '../utils/crypto';

/** 集群配置 */
export interface ClusterConfig {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  isDefault: boolean;
}

const CLUSTERS_KEY = 'weaviate_clusters';

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

/**
 * 尝试解密所有集群的 API Key。
 * 主密码未解锁或密码错误时，apiKey 置空并返回 true 表示需要重新输入。
 */
async function decryptClusterApiKeys(clusters: ClusterConfig[]): Promise<{ clusters: ClusterConfig[]; needsPassword: boolean }> {
  const result: ClusterConfig[] = [];
  let needsPassword = false;
  for (const c of clusters) {
    const cluster = { ...c };
    if (c.apiKey) {
      try {
        const parsed = JSON.parse(c.apiKey);
        if (isEncrypted(parsed)) {
          if (!isUnlocked()) {
            // 有加密数据但主密钥未解锁
            cluster.apiKey = '';
            needsPassword = true;
          } else {
            try {
              cluster.apiKey = await decrypt(parsed);
            } catch {
              // 解密失败（密码错误），需要重新输入
              cluster.apiKey = '';
              needsPassword = true;
            }
          }
        }
      } catch {
        // apiKey 不是 JSON — 明文，保持原样
      }
    }
    result.push(cluster);
  }
  return { clusters: result, needsPassword };
}

/** 加密集群 API Key（仅在主密码解锁时加密） */
async function encryptClusterApiKeys(clusters: ClusterConfig[]): Promise<ClusterConfig[]> {
  if (!isUnlocked()) return clusters;
  const result: ClusterConfig[] = [];
  for (const c of clusters) {
    const cluster = { ...c };
    if (cluster.apiKey) {
      // 检查是否已经是加密格式
      try {
        const parsed = JSON.parse(cluster.apiKey);
        if (isEncrypted(parsed)) {
          // 已加密，跳过
          result.push(cluster);
          continue;
        }
      } catch {
        // 不是 JSON，是明文
      }
      // 明文加密
      try {
        cluster.apiKey = JSON.stringify(await encrypt(cluster.apiKey));
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

interface ClusterStore {
  clusters: ClusterConfig[];
  activeClusterId: string | null;
  needsMasterPassword: boolean;

  loadClusters: () => Promise<void>;
  saveCluster: (cluster: Omit<ClusterConfig, 'id'>) => string;
  updateCluster: (id: string, data: Partial<ClusterConfig>) => void;
  deleteCluster: (id: string) => void;
  setActiveCluster: (id: string | null) => void;
  /** 主密码解锁后重新解密并加密所有 API Key */
  reEncryptApiKeys: () => Promise<void>;
}

const useClusterStore = create<ClusterStore>((set, get) => ({
  clusters: [],
  activeClusterId: null,
  needsMasterPassword: false,

  loadClusters: async () => {
    const raw = loadClustersFromStorage();
    const { clusters, needsPassword } = await decryptClusterApiKeys(raw);

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
    set({ clusters, activeClusterId: active, needsMasterPassword: needsPassword });
  },

  saveCluster: (cluster) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newOne: ClusterConfig = { ...cluster, id };
    const clusters = [...get().clusters, newOne];
    if (clusters.length === 1 || cluster.isDefault) {
      clusters.forEach((c) => { c.isDefault = c.id === id; });
    }
    saveClustersToStorage(clusters).catch((e) => console.error('[clusterStore] saveCluster failed:', e));
    set({ clusters, activeClusterId: cluster.isDefault || get().activeClusterId == null ? id : get().activeClusterId });
    return id;
  },

  updateCluster: (id, data) => {
    const clusters = get().clusters.map((c) => {
      if (c.id === id) return { ...c, ...data };
      if (data.isDefault && c.id !== id) return { ...c, isDefault: false };
      return c;
    });
    saveClustersToStorage(clusters).catch((e) => console.error('[clusterStore] updateCluster failed:', e));
    set({ clusters });
  },

  deleteCluster: (id) => {
    const clusters = get().clusters.filter((c) => c.id !== id);
    if (!clusters.some((c) => c.isDefault) && clusters.length > 0) {
      clusters[0].isDefault = true;
    }
    saveClustersToStorage(clusters).catch((e) => console.error('[clusterStore] deleteCluster failed:', e));
    const { activeClusterId } = get();
    const updates: Partial<ClusterStore> = { clusters };
    if (activeClusterId === id) {
      updates.activeClusterId = clusters[0]?.id ?? null;
    }
    set(updates);
  },

  setActiveCluster: (id) => set({ activeClusterId: id }),

  reEncryptApiKeys: async () => {
    const raw = loadClustersFromStorage();
    // 主密码已解锁，重新解密所有 API Key（用新密码）
    const { clusters } = await decryptClusterApiKeys(raw);
    // 然后重新加密存储
    await saveClustersToStorage(clusters);
    set({ clusters, needsMasterPassword: false });
  },
}));

export default useClusterStore;
export { useClusterStore };
