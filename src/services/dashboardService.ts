import type { WeaviateClient } from 'weaviate-ts-client';
import { listCollections } from './schemaService';
import { qAggregateCount, qGetVectorDim } from './graphqlQueries';
import { extractGetResults, extractAggregateCount } from './graphqlHelpers';
import { withRetry } from '../utils/retry';

/** 获取单个集合的对象数量和向量维度 */
export async function getCollectionStats(
  client: WeaviateClient,
  className: string,
): Promise<{ count: number; vectorDim: number | null }> {
  // 对象数量
  let count = 0;
  try {
    const aggRes = await client.graphql.raw().withQuery(qAggregateCount(className)).do();
    count = extractAggregateCount(aggRes.data, className);
  } catch {
    count = 0;
  }

  // 向量维度（取第一条数据）
  let vectorDim: number | null = null;
  if (count > 0) {
    try {
      const res = await client.graphql.raw().withQuery(qGetVectorDim(className)).do();
      const objects = extractGetResults(res.data, className);
      const vec = (objects[0]?._additional as Record<string, unknown> | undefined)?.vector;
      if (Array.isArray(vec)) vectorDim = vec.length;
    } catch {
      vectorDim = null;
    }
  }
  return { count, vectorDim };
}

/** 限制并发数的批量执行 */
async function parallelLimit<T>(tasks: (() => Promise<T>)[], limit = 5): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit);
    results.push(...await Promise.all(batch.map((t) => t())));
  }
  return results;
}

/** 仪表盘数据：总对象数、集合数、向量维度、预估存储、各集合详情 */
export async function getDashboardData(
  client: WeaviateClient,
): Promise<{
  totalObjects: number;
  totalCollections: number;
  vectorDimension: number | string;
  estimatedStorage: string;
  collectionDetails: { name: string; count: number; vectorDim: number | null }[];
}> {
  const collections = await listCollections(client);

  // 限制并发为 5，避免大量集合时请求堆积
  const stats = await parallelLimit(
    collections.map((name) => () => withRetry(() => getCollectionStats(client, name)).then((s) => ({ name, ...s }))),
    5,
  );

  const totalObjects = stats.reduce((s, c) => s + c.count, 0);
  const totalCollections = collections.length;

  // 向量维度：取所有非空维度，去重
  const dims = [...new Set(stats.map((c) => c.vectorDim).filter((d): d is number => d !== null))];
  let vectorDimension: number | string = '-';
  if (dims.length === 1) vectorDimension = dims[0];
  else if (dims.length > 1) vectorDimension = 'mixed';

  // 预估存储 MB（按 float32 计算：对象数 × 维度 × 4 字节 / 1024 / 1024）
  let estimatedStorage = '-';
  if (typeof vectorDimension === 'number') {
    const mb = (totalObjects * vectorDimension * 4) / 1024 / 1024;
    estimatedStorage = mb.toFixed(1);
  }

  return { totalObjects, totalCollections, vectorDimension, estimatedStorage, collectionDetails: stats };
}
