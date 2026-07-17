import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface QueryTemplate {
  id: string;
  name: string;
  query: string;
  variables: string; // JSON string
  collection?: string;
  timestamp: number;
}

interface QueryTemplateState {
  templates: QueryTemplate[];
  addTemplate: (record: Omit<QueryTemplate, 'id' | 'timestamp'>) => void;
  removeTemplate: (id: string) => void;
  clearTemplates: () => void;
  searchTemplates: (keyword: string) => QueryTemplate[];
}

export const useQueryTemplateStore = create<QueryTemplateState>()(
  persist(
    (set, get) => ({
      templates: [],

      addTemplate: (record) => {
        const now = Date.now();
        const newTemplate: QueryTemplate = {
          ...record,
          id: String(now) + '-' + Math.random().toString(36).slice(2, 6),
          timestamp: now,
        };
        set({ templates: [newTemplate, ...get().templates] });
      },

      removeTemplate: (id) => {
        set({ templates: get().templates.filter((t) => t.id !== id) });
      },

      clearTemplates: () => {
        set({ templates: [] });
      },

      searchTemplates: (keyword) => {
        const kw = keyword.toLowerCase();
        return get()
          .templates.filter(
            (t) =>
              t.name.toLowerCase().includes(kw) ||
              t.query.toLowerCase().includes(kw) ||
              t.collection?.toLowerCase().includes(kw)
          )
          .sort((a, b) => b.timestamp - a.timestamp);
      },
    }),
    {
      name: 'weaviate_query_templates',
    }
  )
);
