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

/** 获取所有集合名称（按字母排序） */
export async function listCollections(client: WeaviateClient): Promise<string[]> {
  const schema = await client.schema.getter().do();
  return ((schema as Record<string, unknown>).classes as Array<{ class: string }> ?? [])
    .map((c) => c.class)
    .sort((a, b) => a.localeCompare(b));
}

/** 获取集合属性 */
export async function getClassProperties(
  client: WeaviateClient,
  className: string,
): Promise<Array<{ name: string; dataType: string[] }>> {
  const schema = await client.schema.classGetter().withClassName(className).do();
  return ((schema as Record<string, unknown>).properties ?? []) as Array<{ name: string; dataType: string[] }>;
}

/** 游标分页获取对象 */
export async function fetchObjects(
  client: WeaviateClient,
  className: string,
  limit: number = 20,
  after?: string,
): Promise<{
  objects: Record<string, unknown>[];
  total: number;
  after: string | null;
  before: string | null;
}> {
  const props = await getClassProperties(client, className);
  const propNames = props.map((p) => p.name);
  const allFields = [...propNames, '_additional { id vector }'];
  const fieldsStr = allFields.join(' ');

  // 构建查询
  const gqlGet = client.graphql.get().withClassName(className).withLimit(limit).withFields(fieldsStr);
  if (after) gqlGet.withAfter(after);

  const result = await gqlGet.do();
  const rawData = (result.data as Record<string, unknown>)?.Get as Record<string, unknown> | undefined;
  const rawObjects = (rawData?.[className] ?? []) as Record<string, unknown>[];
  // 提取 _additional.id 到 __id，方便编辑/删除
  const objects = rawObjects.map((obj) => {
    const add = obj._additional as Record<string, unknown> | undefined;
    return { ...obj, __id: add?.id as string | undefined };
  });

  // 总数
  const countResult = await client.graphql
    .aggregate()
    .withClassName(className)
    .withFields('meta { count }')
    .do();
  const aggData = (countResult.data as Record<string, unknown>)?.Aggregate as Record<string, unknown> | undefined;
  const total = (aggData?.[className] as Array<{ meta: { count: number } }>)?.[0]?.meta?.count ?? 0;

  const lastItem = objects.slice(-1)[0];
  const firstItem = objects[0];
  const afterCursor = (lastItem?._additional as Record<string, unknown>)?.id as string | null ?? null;
  const beforeCursor = (firstItem?._additional as Record<string, unknown>)?.id as string | null ?? null;

  return { objects, total, after: afterCursor, before: beforeCursor };
}

/** BM25 关键词搜索 */
export async function searchBM25(
  client: WeaviateClient,
  className: string,
  query: string,
  limit: number = 20,
): Promise<Record<string, unknown>[]> {
  const props = await getClassProperties(client, className);
  const propNames = props.map((p) => p.name);
  const gqlGet = client.graphql.get().withClassName(className).withBm25({ query }).withLimit(limit)
    .withFields([...propNames, '_additional { id score }'].join(' '));

  const result = await gqlGet.do();
  const rawData = (result.data as Record<string, unknown>)?.Get as Record<string, unknown> | undefined;
  return ((rawData?.[className] ?? []) as Record<string, unknown>[]).map((obj) => {
    const flat: Record<string, unknown> = { ...obj };
    const add = flat._additional as Record<string, unknown> | undefined;
    if (add) {
      flat.__score = add.score;
      flat.__id = add.id;
      delete flat._additional;
    }
    return flat;
  });
}

/** 语义搜索 */
export async function searchNearText(
  client: WeaviateClient,
  className: string,
  concepts: string,
  limit: number = 20,
  distance: number = 0.7,
): Promise<Record<string, unknown>[]> {
  const props = await getClassProperties(client, className);
  const propNames = props.map((p) => p.name);
  const gqlGet = client.graphql
    .get()
    .withClassName(className)
    .withNearText({ concepts: [concepts], distance })
    .withLimit(limit)
    .withFields([...propNames, '_additional { id distance }'].join(' '));

  const result = await gqlGet.do();
  const rawData = (result.data as Record<string, unknown>)?.Get as Record<string, unknown> | undefined;
  return ((rawData?.[className] ?? []) as Record<string, unknown>[]).map((obj) => {
    const flat: Record<string, unknown> = { ...obj };
    const add = flat._additional as Record<string, unknown> | undefined;
    if (add) {
      flat.__distance = add.distance;
      flat.__id = add.id;
      delete flat._additional;
    }
    return flat;
  });
}

/** 多模态文字搜索 */
export async function searchNearTextWithVector(
  client: WeaviateClient,
  className: string,
  text: string,
  limit: number = 12,
  targetVector?: string,
): Promise<Record<string, unknown>[]> {
  const props = await getClassProperties(client, className);
  const propNames = props.map((p) => p.name);
  const nearTextArgs: Record<string, unknown> = { concepts: [text] };
  if (targetVector) nearTextArgs.targetVectors = [targetVector];
  const gqlGet = client.graphql
    .get()
    .withClassName(className)
    .withNearText(nearTextArgs)
    .withLimit(limit)
    .withFields([...propNames, '_additional { id distance }'].join(' '));

  const result = await gqlGet.do();
  const rawData = (result.data as Record<string, unknown>)?.Get as Record<string, unknown> | undefined;
  return ((rawData?.[className] ?? []) as Record<string, unknown>[]).map((obj) => {
    const flat: Record<string, unknown> = { ...obj };
    const add = flat._additional as Record<string, unknown> | undefined;
    if (add) {
      flat.__distance = add.distance;
      flat.__id = add.id;
      delete flat._additional;
    }
    return flat;
  });
}

/** 图片相似搜索 */
export async function searchNearImage(
  client: WeaviateClient,
  className: string,
  imageBase64: string,
  limit: number = 12,
  distance: number = 0.7,
): Promise<Record<string, unknown>[]> {
  const props = await getClassProperties(client, className);
  const propNames = props.map((p) => p.name);
  const gqlGet = client.graphql
    .get()
    .withClassName(className)
    .withNearImage({ image: imageBase64, distance })
    .withLimit(limit)
    .withFields([...propNames, '_additional { id distance }'].join(' '));

  const result = await gqlGet.do();
  const rawData = (result.data as Record<string, unknown>)?.Get as Record<string, unknown> | undefined;
  return ((rawData?.[className] ?? []) as Record<string, unknown>[]).map((obj) => {
    const flat: Record<string, unknown> = { ...obj };
    const add = flat._additional as Record<string, unknown> | undefined;
    if (add) {
      flat.__distance = add.distance;
      flat.__id = add.id;
      delete flat._additional;
    }
    return flat;
  });
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
  client: WeaviateClient,
  className: string,
  id: string,
  data: Record<string, unknown>,
  vector?: number[],
  baseUrl: string = 'http://localhost:8080',
): Promise<void> {
  const body: Record<string, unknown> = { properties: data, class: className };
  if (vector && vector.length > 0) body.vector = vector;
  const url = `${baseUrl.replace(/\/+$/, '')}/v1/objects/${className}/${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
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

/** 导出全部对象 */
export async function fetchAllObjects(
  client: WeaviateClient,
  className: string,
): Promise<Record<string, unknown>[]> {
  const props = await getClassProperties(client, className);
  const propNames = props.map((p) => p.name);

  const allObjects: Record<string, unknown>[] = [];
  let after: string | undefined;

  while (true) {
    const gqlGet = client.graphql.get().withClassName(className).withLimit(100)
      .withFields([...propNames, '_additional { id }'].join(' '));
    if (after) gqlGet.withAfter(after);

    const result = await gqlGet.do();
    const rawData = (result.data as Record<string, unknown>)?.Get as Record<string, unknown> | undefined;
    const batch = (rawData?.[className] ?? []) as Record<string, unknown>[];
    if (batch.length === 0) break;

    allObjects.push(...batch.map((obj) => {
      const flat: Record<string, unknown> = { ...obj };
      const add = flat._additional as Record<string, unknown> | undefined;
      if (add) { flat.__id = add.id; delete flat._additional; }
      return flat;
    }));

    after = (batch[batch.length - 1]?._additional as Record<string, unknown>)?.id as string | undefined;
    if (batch.length < 100) break;
  }

  return allObjects;
}
