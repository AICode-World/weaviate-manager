import { create } from 'zustand';

/** Weaviate 连接状态 */
export interface ConnectionState {
  host: string;       // Weaviate 服务地址，如 http://localhost:8080
  apiKey: string;    // API Key（可选，Weaviate Cloud 需要）
  connected: boolean; // 是否已连通
  loading: boolean;   // 连接测试中
  error: string | null; // 错误信息
}

/** 集合（Class）信息 */
export interface WeaviateClass {
  name: string;
  description?: string;
  properties?: Array<{ name: string; dataType: string[] }>;
  vectorIndexType?: string;
}

/** State / Action 的完整类型定义 */
interface WeaviateStore {
  // --- 连接 ---
  connection: ConnectionState;
  setConnection: (host: string, apiKey: string) => void;
  testConnection: () => Promise<void>;

  // --- 集合 ---
  classes: WeaviateClass[];
  selectedClass: string | null;
  classesLoading: boolean;
  setSelectedClass: (name: string | null) => void;
  fetchClasses: () => Promise<void>;

  // --- 对象 ---
  objects: Record<string, any>[];
  objectsTotal: number;
  objectsLoading: boolean;
  fetchObjects: (className: string, page: number, pageSize: number) => Promise<void>;

  // --- GraphQL ---
  graphQLResult: Record<string, any> | null;
  graphQLLoading: boolean;
  runGraphQL: (query: string) => Promise<void>;

  // --- 向量检索 ---
  searchResults: Record<string, any>[];
  searchLoading: boolean;
  searchVector: (className: string, text: string, limit: number) => Promise<void>;
}

/**
 * 全局状态（Zustand）
 * 所有与 Weaviate 远程交互都通过此 store 统一管理，组件只负责 UI 渲染
 */
const useWeaviateStore = create<WeaviateStore>((set, get) => ({
  // ========== 连接状态 ==========
  connection: {
    host: 'http://localhost:8080',
    apiKey: '',
    connected: false,
    loading: false,
    error: null,
  },

  setConnection: (host, apiKey) =>
    set((s) => ({ connection: { ...s.connection, host, apiKey } })),

  /** 测试 Weaviate 连接：使用 /v1/meta 端点验证连通性 */
  testConnection: async () => {
    const { host, apiKey } = get().connection;
    set((s) => ({ connection: { ...s.connection, loading: true, error: null } }));

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res = await fetch(`${host}/v1/meta`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      set((s) => ({
        connection: { ...s.connection, connected: true, loading: false, error: null },
      }));
    } catch (e: any) {
      set((s) => ({
        connection: {
          ...s.connection,
          connected: false,
          loading: false,
          error: e.message || '连接失败，请检查地址和 API Key',
        },
      }));
    }
  },

  // ========== 集合（Class） ==========
  classes: [],
  selectedClass: null,
  classesLoading: false,

  setSelectedClass: (name) => set({ selectedClass: name }),

  /** 获取所有 Schema Class 列表 */
  fetchClasses: async () => {
    const { host, apiKey } = get().connection;
    set({ classesLoading: true });

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res = await fetch(`${host}/v1/schema`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      set({
        classes: (data.classes || []).map((c: any) => ({
          name: c.class,
          description: c.description,
          properties: c.properties?.map((p: any) => ({ name: p.name, dataType: p.dataType })),
          vectorIndexType: c.vectorIndexType,
        })),
        classesLoading: false,
      });
    } catch (e: any) {
      set({ classesLoading: false, classes: [] });
    }
  },

  // ========== 对象 ==========
  objects: [],
  objectsTotal: 0,
  objectsLoading: false,

  /** 分页获取某个 Class 下的对象（含向量） */
  fetchObjects: async (className, page, pageSize) => {
    set({ objectsLoading: true });

    try {
      const { host, apiKey } = get().connection;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const offset = (page - 1) * pageSize;
      const gql = `{ Get { ${className}(limit: ${pageSize}, offset: ${offset}) { _additional { id vector } } } }`;

      // 先获取属性列表以便构建完整查询
      const schemaRes = await fetch(`${host}/v1/schema`, { headers });
      const schemaData = await schemaRes.json();
      const targetClass = schemaData.classes?.find((c: any) => c.class === className);
      const propFields = (targetClass?.properties || []).map((p: any) => p.name);

      // 构建带属性的 GraphQL 查询
      const propStr = propFields.length > 0 ? propFields.join(' ') : '';
      const fullGql = `{ Get { ${className}(limit: ${pageSize}, offset: ${offset}) { ${propStr} _additional { id vector } } } }`;

      const gqlRes = await fetch(`${host}/v1/graphql`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: fullGql }),
      });
      const gqlData = await gqlRes.json();

      const objects = gqlData?.data?.Get?.[className] || [];

      // 同时获取总数
      const countGql = `{ Aggregate { ${className} { meta { count } } } }`;
      const countRes = await fetch(`${host}/v1/graphql`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: countGql }),
      });
      const countData = await countRes.json();
      const total = countData?.data?.Aggregate?.[className]?.[0]?.meta?.count || 0;

      set({ objects, objectsTotal: total, objectsLoading: false });
    } catch (e: any) {
      set({ objectsLoading: false, objects: [], objectsTotal: 0 });
    }
  },

  // ========== GraphQL ==========
  graphQLResult: null,
  graphQLLoading: false,

  /** 执行自定义 GraphQL 查询 */
  runGraphQL: async (query: string) => {
    set({ graphQLLoading: true, graphQLResult: null });

    try {
      const { host, apiKey } = get().connection;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res = await fetch(`${host}/v1/graphql`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      set({ graphQLResult: data, graphQLLoading: false });
    } catch (e: any) {
      set({ graphQLLoading: false, graphQLResult: { error: e.message } });
    }
  },

  // ========== 向量检索 ==========
  searchResults: [],
  searchLoading: false,

  /** 近文本检索：输入文本，返回相似度 Top-K */
  searchVector: async (className, text, limit) => {
    set({ searchLoading: true, searchResults: [] });

    try {
      const { host, apiKey } = get().connection;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      // 获取属性列表
      const schemaRes = await fetch(`${host}/v1/schema`, { headers });
      const schemaData = await schemaRes.json();
      const targetClass = schemaData.classes?.find((c: any) => c.class === className);
      const propFields = (targetClass?.properties || []).map((p: any) => p.name);
      const propStr = propFields.length > 0 ? propFields.join(' ') : '';

      const gql = `{ Get { ${className}(nearText: { concepts: ["${text}"] }, limit: ${limit}) { ${propStr} _additional { id distance certainty } } } }`;

      const res = await fetch(`${host}/v1/graphql`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: gql }),
      });
      const data = await res.json();

      set({
        searchResults: data?.data?.Get?.[className] || [],
        searchLoading: false,
      });
    } catch (e: any) {
      set({ searchLoading: false, searchResults: [] });
    }
  },
}));

export default useWeaviateStore;
