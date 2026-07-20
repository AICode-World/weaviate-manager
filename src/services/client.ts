import weaviate, { ApiKey, type WeaviateClient } from 'weaviate-ts-client';

/** 创建 Weaviate 客户端（浏览器兼容） */
export function createClient(url: string, cred: string): WeaviateClient {
  const urlObj = new URL(url);
  const config: { scheme: string; host: string; apiKey?: ApiKey; headers?: Record<string, string> } = {
    scheme: urlObj.protocol.replace(':', ''),
    host: `${urlObj.hostname}:${urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80')}`,
  };
  if (cred) {
    config.apiKey = new ApiKey(cred);
    config.headers = { Authorization: `Bearer ${cred}` };
  }
  return weaviate.client(config);
}

/** 测试连接 — 使用 /v1/meta (有CORS头) 代替 /v1/.well-known/ready (无CORS头) */
export async function testConnection(client: WeaviateClient): Promise<boolean> {
  try {
    await client.misc.metaGetter().do();
    return true;
  } catch {
    return false;
  }
}

/** 获取 Weaviate 服务器版本和连接延迟 */
export async function getServerInfo(client: WeaviateClient): Promise<{ version: string; latency: number }> {
  const start = performance.now();
  const meta = await client.misc.metaGetter().do() as Record<string, unknown>;
  const latency = Math.round(performance.now() - start);
  const version = (meta?.version as string) || '';
  return { version, latency };
}
