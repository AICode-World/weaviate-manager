import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type QueryType = 'graphql' | 'bm25' | 'nearText' | 'nearImage';

export interface QueryRecord {
  id: string;
  type: QueryType;
  query: string;
  variables?: string;
  collection?: string;
  timestamp: number;
  resultCount?: number;
  isFavorite: boolean;
}

const MAX_RECORDS = 200;
const DEDUPE_WINDOW_MS = 5 * 60 * 1000; // 5 分钟内相同查询去重

interface QueryHistoryState {
  history: QueryRecord[];
  addQuery: (record: Omit<QueryRecord, 'id' | 'timestamp' | 'isFavorite'>) => void;
  removeQuery: (id: string) => void;
  toggleFavorite: (id: string) => void;
  clearHistory: () => void;
  getRecentQueries: (limit?: number) => QueryRecord[];
  getFavoriteQueries: () => QueryRecord[];
  searchQueries: (keyword: string) => QueryRecord[];
}

export const useQueryHistoryStore = create<QueryHistoryState>()(
  persist(
    (set, get) => ({
      history: [],

      addQuery: (record) => {
        const now = Date.now();
        const current = get().history;

        // 5 分钟内相同 type+query+collection → 更新时间戳
        const existingIdx = current.findIndex(
          (r) =>
            r.type === record.type &&
            r.query === record.query &&
            r.collection === record.collection
        );
        if (existingIdx >= 0 && now - current[existingIdx].timestamp < DEDUPE_WINDOW_MS) {
          const updated = [...current];
          updated[existingIdx] = {
            ...updated[existingIdx],
            timestamp: now,
            resultCount: record.resultCount ?? updated[existingIdx].resultCount,
          };
          set({ history: updated });
          return;
        }

        const newRecord: QueryRecord = {
          ...record,
          id: String(now) + '-' + Math.random().toString(36).slice(2, 6),
          timestamp: now,
          isFavorite: false,
        };

        // 新增记录放最前，超过上限裁剪最旧的
        const next = [newRecord, ...current].slice(0, MAX_RECORDS);
        set({ history: next });
      },

      removeQuery: (id) => {
        set({ history: get().history.filter((r) => r.id !== id) });
      },

      toggleFavorite: (id) => {
        set({
          history: get().history.map((r) =>
            r.id === id ? { ...r, isFavorite: !r.isFavorite } : r
          ),
        });
      },

      clearHistory: () => {
        // 保留收藏项
        set({ history: get().history.filter((r) => r.isFavorite) });
      },

      getRecentQueries: (limit = 20) => {
        return get()
          .history.slice()
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
      },

      getFavoriteQueries: () => {
        return get()
          .history.filter((r) => r.isFavorite)
          .sort((a, b) => b.timestamp - a.timestamp);
      },

      searchQueries: (keyword) => {
        const kw = keyword.toLowerCase();
        return get()
          .history.filter(
            (r) =>
              r.query.toLowerCase().includes(kw) ||
              r.collection?.toLowerCase().includes(kw)
          )
          .sort((a, b) => b.timestamp - a.timestamp);
      },
    }),
    {
      name: 'weaviate_query_history',
    }
  )
);

/** 格式化相对时间 */
export function formatRelativeTime(
  timestamp: number,
  t: (key: string, params?: Record<string, number>) => string
): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return t('daysAgo', { n: days });
  if (hours > 0) return t('hoursAgo', { n: hours });
  if (minutes > 0) return t('minutesAgo', { n: minutes });
  return t('justNow');
}
