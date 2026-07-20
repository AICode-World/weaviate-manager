import { create } from 'zustand';
import type { WeaviateClient } from 'weaviate-ts-client';
import { getDashboardData } from '../services/dashboardService';
import { wrapError, reportError } from '../utils/errorHandler';

/** 仪表盘数据 */
export interface DashboardData {
  totalObjects: number;
  totalCollections: number;
  vectorDimension: number | string;
  estimatedStorage: string;
  collectionDetails: { name: string; count: number; vectorDim: number | null }[];
}

interface DashboardStore {
  dashboardData: DashboardData | null;
  dashboardLoading: boolean;

  fetchDashboardData: (client: WeaviateClient | null) => Promise<void>;
  clearDashboardData: () => void;
}

const useDashboardStore = create<DashboardStore>((set) => ({
  dashboardData: null,
  dashboardLoading: false,

  fetchDashboardData: async (client) => {
    if (!client) return;
    set({ dashboardLoading: true });
    try {
      const data = await getDashboardData(client);
      set({ dashboardData: data, dashboardLoading: false });
    } catch (e) {
      reportError(wrapError(e, 'fetchDashboardData'));
      set({ dashboardLoading: false });
    }
  },

  clearDashboardData: () => set({ dashboardData: null }),
}));

export default useDashboardStore;
export { useDashboardStore };
