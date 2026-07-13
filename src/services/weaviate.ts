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
  // 兼容不同版本的返回格式：可能是对象或数组
  const schemaObj = Array.isArray(schema) ? schema[0] : schema;
  return ((schemaObj as Record<string, unknown>)?.properties ?? []) as Array<{ name: string; dataType: string[] }>;
}

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
  // 获取属性列表（失败时用空列表，仍然可以查询 _additional）
  let propNames: string[] = [];
  try {
    const props = await getClassProperties(client, className);
    propNames = props.map((p) => p.name);
  } catch {
    // getClassProperties 失败不影响基本查询
  }
  const propFields = propNames.length > 0 ? propNames.join(' ') + ' ' : '';
  const fieldsStr = `${propFields}_additional { id }`;

  // 统一使用 raw GraphQL 查询（兼容性最好）
  let paginationArg = `limit: ${limit}`;
  if (offset !== undefined && offset > 0) {
    paginationArg += `, offset: ${offset}`;
  } else if (after) {
    paginationArg += `, after: "${after}"`;
  }
  const query = `{ Get { ${className}(${paginationArg}) { ${fieldsStr} } } }`;
  const result = await client.graphql.raw().withQuery(query).do();

  const rawData = (result.data as Record<string, unknown>)?.Get as Record<string, unknown> | undefined;
  const rawObjects = (rawData?.[className] ?? []) as Record<string, unknown>[];
  // 提取 _additional.id 到 __id，方便编辑/删除
  const objects = rawObjects.map((obj) => {
    const add = obj._additional as Record<string, unknown> | undefined;
    return { ...obj, _additional: obj._additional, __id: add?.id as string | undefined };
  });

  // 总数
  let total = 0;
  try {
    const countQuery = `{ Aggregate { ${className} { meta { count } } } }`;
    const countResult = await client.graphql.raw().withQuery(countQuery).do();
    const aggData = (countResult.data as Record<string, unknown>)?.Aggregate as Record<string, unknown> | undefined;
    total = (aggData?.[className] as Array<{ meta: { count: number } }>)?.[0]?.meta?.count ?? 0;
  } catch {
    // 聚合查询失败时用返回的对象数量作为 fallback
    total = objects.length;
  }

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
  let propNames: string[] = [];
  try {
    const props = await getClassProperties(client, className);
    propNames = props.map((p) => p.name);
  } catch { /* ignore */ }
  const propFields = propNames.length > 0 ? propNames.join(' ') + ' ' : '';
  const queryStr = `{ Get { ${className}(limit: ${limit}, bm25: {query: "${query.replace(/"/g, '\\"')}"}) { ${propFields}_additional { id score } } } }`;
  const result = await client.graphql.raw().withQuery(queryStr).do();
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
  let propNames: string[] = [];
  try {
    const props = await getClassProperties(client, className);
    propNames = props.map((p) => p.name);
  } catch { /* ignore */ }
  const propFields = propNames.length > 0 ? propNames.join(' ') + ' ' : '';
  const escapedConcepts = concepts.replace(/"/g, '\\"');
  const queryStr = `{ Get { ${className}(limit: ${limit}, nearText: {concepts: ["${escapedConcepts}"], distance: ${distance}}) { ${propFields}_additional { id distance } } } }`;
  const result = await client.graphql.raw().withQuery(queryStr).do();
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withNearText(nearTextArgs as any)
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

/** 获取单个集合的对象数量和向量维度 */
async function getCollectionStats(
  client: WeaviateClient,
  className: string,
): Promise<{ count: number; vectorDim: number | null }> {
  // 对象数量
  let count = 0;
  try {
    const countQuery = `{ Aggregate { ${className} { meta { count } } } }`;
    const aggRes = await client.graphql.raw().withQuery(countQuery).do();
    const aggData = (aggRes.data as Record<string, unknown>)?.Aggregate as Record<string, unknown> | undefined;
    count = (aggData?.[className] as Array<{ meta: { count: number } }>)?.[0]?.meta?.count ?? 0;
  } catch {
    count = 0;
  }

  // 向量维度（取第一条数据）
  let vectorDim: number | null = null;
  if (count > 0) {
    try {
      const res = await client.graphql
        .raw()
        .withQuery(`{ Get { ${className}(limit: 1) { _additional { vector } } } }`)
        .do();
      const vec = (res.data as Record<string, unknown>)?.Get as Record<string, unknown> | undefined;
      const arr = (vec?.[className] as Array<{ _additional?: { vector?: number[] } }>)?.[0]?._additional?.vector;
      if (Array.isArray(arr)) vectorDim = arr.length;
    } catch {
      vectorDim = null;
    }
  }
  return { count, vectorDim };
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
  const stats = await Promise.all(collections.map((name) => getCollectionStats(client, name).then((s) => ({ name, ...s }))));

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
): Promise<void> {
  if (!baseUrl) throw new Error('updateObject: baseUrl is required');
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

// ============ Schema 管理 ============

/** Weaviate 支持的属性数据类型 */
export const PROPERTY_DATA_TYPES = [
  'text', 'int', 'number', 'boolean', 'date', 'blob', 'uuid',
  'text[]', 'int[]', 'number[]', 'boolean[]', 'date[]', 'uuid[]',
] as const;

export type PropertyDataType = typeof PROPERTY_DATA_TYPES[number];

/** 集合属性定义 */
export interface CollectionProperty {
  name: string;
  dataType: PropertyDataType[];
  description?: string;
  /** 是否参与向量化（仅对有 vectorizer 的集合有效，默认 true） */
  vectorize?: boolean;
  tokenization?: string;
}

/** 集合 Schema 详情 */
export interface CollectionSchema {
  name: string;
  description?: string;
  vectorizer?: string;
  properties: CollectionProperty[];
}

/** 获取完整 Schema（含所有集合及属性详情） */
export async function getFullSchema(client: WeaviateClient): Promise<CollectionSchema[]> {
  const schema = await client.schema.getter().do();
  const classes = ((schema as Record<string, unknown>).classes as Array<Record<string, unknown>>) ?? [];
  return classes.map((cls) => ({
    name: cls.class as string,
    description: cls.description as string | undefined,
    vectorizer: cls.vectorizer as string | undefined,
    properties: ((cls.properties as Array<Record<string, unknown>>) ?? []).map((p) => ({
      name: p.name as string,
      dataType: p.dataType as PropertyDataType[],
      description: p.description as string | undefined,
    })),
  }));
}

/** 创建新集合 */
export async function createCollection(
  client: WeaviateClient,
  name: string,
  properties: CollectionProperty[],
  vectorizer?: string,
): Promise<void> {
  const classConfig: Record<string, unknown> = {
    class: name,
    properties: properties.map((p) => {
      const prop: Record<string, unknown> = {
        name: p.name,
        dataType: p.dataType,
      };
      if (p.description) prop.description = p.description;
      if (p.tokenization) prop.tokenization = p.tokenization;
      // 如果集合有 vectorizer，根据 vectorize 开关设置 moduleConfig
      if (vectorizer && vectorizer !== 'none') {
        prop.moduleConfig = {
          [vectorizer]: { skip: p.vectorize === false },
        };
      }
      return prop;
    }),
  };
  if (vectorizer && vectorizer !== 'none') {
    classConfig.vectorizer = vectorizer;
  } else {
    classConfig.vectorizer = 'none';
  }
  await client.schema.classCreator().withClass(classConfig).do();
}

/** 删除集合 */
export async function deleteCollection(client: WeaviateClient, name: string): Promise<void> {
  await client.schema.classDeleter().withClassName(name).do();
}

/** 给已有集合添加属性 */
export async function addProperty(
  client: WeaviateClient,
  className: string,
  property: CollectionProperty,
  vectorizer?: string,
): Promise<void> {
  const propConfig: Record<string, unknown> = {
    name: property.name,
    dataType: property.dataType,
  };
  if (property.description) propConfig.description = property.description;
  if (property.tokenization) propConfig.tokenization = property.tokenization;

  // 如果集合有 vectorizer，根据 vectorize 开关设置 moduleConfig
  if (vectorizer && vectorizer !== 'none') {
    propConfig.moduleConfig = {
      [vectorizer]: { skip: property.vectorize === false },
    };
  }

  await client.schema.propertyCreator().withClassName(className).withProperty(propConfig).do();
}
