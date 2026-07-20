import { create } from 'zustand';
import type { WeaviateClient } from 'weaviate-ts-client';

export type ConnectionStatus = 'disconnected' | 'connected' | 'error';

interface ConnectionStore {
  connectionStatus: ConnectionStatus;
  client: WeaviateClient | null;
  url: string;
  cred: string;
  serverVersion: string;
  latency: number | null;

  setConnection: (
    status: ConnectionStatus,
    client: WeaviateClient | null,
    url?: string,
    cred?: string,
    serverVersion?: string,
    latency?: number | null,
  ) => void;
  disconnect: () => void;
}

const useConnectionStore = create<ConnectionStore>((set) => ({
  connectionStatus: 'disconnected',
  client: null,
  url: 'http://localhost:8080',
  cred: '',
  serverVersion: '',
  latency: null,

  setConnection: (status, client, url, cred, serverVersion, latency) =>
    set((s) => ({
      connectionStatus: status,
      client,
      url: url ?? s.url,
      cred: cred ?? s.cred,
      serverVersion: serverVersion ?? (status === 'connected' ? s.serverVersion : ''),
      latency: latency ?? (status === 'connected' ? s.latency : null),
    })),

  disconnect: () =>
    set({
      connectionStatus: 'disconnected',
      client: null,
      serverVersion: '',
      latency: null,
    }),
}));

export default useConnectionStore;
export { useConnectionStore };
