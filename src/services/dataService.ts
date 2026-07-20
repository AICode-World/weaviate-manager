import type { WeaviateClient } from 'weaviate-ts-client';
import { getCachedClassProperties } from './schemaService';
import { qGetObjects, qAggregateCount } from './graphqlQueries';
import { extractGetResults, extractAggregateCount, extractAdditionalFields } from './graphqlHelpers';
import { withRetry } from '../utils/retry';

/** 获取对象（支持游标分页或 offset 分页） */
export async function fetchObjects(
  client: WeaviateClient,
  className: string,
  limit: number = 20,
  after?: string,
  offset?: number,
): Promise<{
  objects: Record<string, unknown>[];
  total: number;
  after: string | null;
  before: string | null;
}> {
  // 使用缓存的属性列表
  let propNames: string[] = [];
  try {
    propNames = await getCachedClassProperties(client, className);
  } catch {
    // getClassProperties 失败不影响基本查询
  }
  const propFields = propNames.length > 0 ? propNames.join(' ') + ' ' : '';

  const query = qGetObjects(className, propFields, limit, after, offset);
  const result = await withRetry(() => client.graphql.raw().withQuery(query).do());

  const rawObjects = extractGetResults(result.data, className);
  // extractAdditionalFields 保留 _additional 并提取 __id 等字段
  const objects = rawObjects.map((obj) => extractAdditionalFields(obj));

  // 总数
  let total = 0;
  try {
    const countResult = await client.graphql.raw().withQuery(qAggregateCount(className)).do();
    total = extractAggregateCount(countResult.data, className);
  } catch {
    total = objects.length;
  }

  const lastItem = objects.slice(-1)[0];
  const firstItem = objects[0];
  const afterCursor = (lastItem?.__id as string) ?? null;
  const beforeCursor = (firstItem?.__id as string) ?? null;

  return { objects, total, after: afterCursor, before: beforeCursor };
}

/** 插入对象 */
export async function insertObject(
  client: WeaviateClient,
  className: string,
  data: Record<string, unknown>,
): Promise<void> {
  await client.data.creator().withClassName(className).withProperties(data).do();
}

/** 更新对象 — vectorizer:none 的集合需要传原向量 */
export async function updateObject(
  _client: WeaviateClient,
  className: string,
  id: string,
  data: Record<string, unknown>,
  vector: number[] | undefined,
  baseUrl: string,
  cred?: string,
): Promise<void> {
  if (!baseUrl) throw new Error('updateObject: baseUrl is required');
  const body: Record<string, unknown> = { properties: data, class: className };
  if (vector && vector.length > 0) body.vector = vector;
  const url = `${baseUrl.replace(/\/+$/, '')}/v1/objects/${className}/${id}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cred) headers['Authorization'] = `Bearer ${cred}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: [{ message: res.statusText }] }));
    throw new Error((err as { error?: Array<{ message: string }> }).error?.[0]?.message ?? `HTTP ${res.status}`);
  }
}

/** 删除对象 */
export async function deleteObject(
  client: WeaviateClient,
  className: string,
  id: string,
): Promise<void> {
  await client.data.deleter().withClassName(className).withId(id).do();
}
