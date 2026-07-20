/**
 * useBridgeActions — 跨 store 协调方法
 *
 * 这些方法需要同时操作多个子 store，无法归入单个 store：
 * - setConnection: 连接/断开时需要同时清空 data + dashboard
 * - disconnect:    断开时需要同时清空 data + dashboard
 * - refreshCollections: 需要 connectionStore 的 client
 * - fetchDashboardData: 需要 connectionStore 的 client
 * - deleteCluster:  删除活跃集群时需要自动断开连接
 */

import { useCallback } from 'react';
import type { WeaviateClient } from 'weaviate-ts-client';
import { useConnectionStore, type ConnectionStatus } from '../stores/connectionStore';
import { useClusterStore } from '../stores/clusterStore';
import { useDataStore } from '../stores/dataStore';
import { useDashboardStore } from '../stores/dashboardStore';

export function useBridgeActions() {
  const conn = useConnectionStore();
  const cluster = useClusterStore();
  const data = useDataStore();
  const dash = useDashboardStore();

  const setConnection = useCallback(
    (
      status: ConnectionStatus,
      client: WeaviateClient | null,
      url?: string,
      cred?: string,
      serverVersion?: string,
      latency?: number | null,
    ) => {
      conn.setConnection(status, client, url, cred, serverVersion, latency);
      if (status !== 'connected') {
        data.resetData();
        dash.clearDashboardData();
      }
    },
    [conn, data, dash],
  );

  const disconnect = useCallback(() => {
    conn.disconnect();
    data.resetData();
    dash.clearDashboardData();
  }, [conn, data, dash]);

  const refreshCollections = useCallback(
    () => data.refreshCollections(conn.client),
    [data, conn],
  );

  const fetchDashboardData = useCallback(
    () => dash.fetchDashboardData(conn.client),
    [dash, conn],
  );

  const deleteCluster = useCallback(
    (id: string) => {
      const wasActive = cluster.activeClusterId === id;
      cluster.deleteCluster(id);
      if (wasActive) {
        conn.disconnect();
        data.resetData();
        dash.clearDashboardData();
      }
    },
    [cluster, conn, data, dash],
  );

  return { setConnection, disconnect, refreshCollections, fetchDashboardData, deleteCluster };
}
