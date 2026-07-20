import type { WeaviateClient } from 'weaviate-ts-client';

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

// ============ 属性列表缓存 ============

const propCache = new Map<string, { props: string[]; ts: number }>();
const PROP_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

/** 获取缓存的属性名列表（TTL 5 分钟） */
export async function getCachedClassProperties(client: WeaviateClient, className: string): Promise<string[]> {
  const cached = propCache.get(className);
  if (cached && Date.now() - cached.ts < PROP_CACHE_TTL) return cached.props;

  const props = await getClassProperties(client, className);
  const propNames = props.map((p) => p.name);
  propCache.set(className, { props: propNames, ts: Date.now() });
  return propNames;
}

/** 清除属性缓存（集合 Schema 变更时调用） */
export function invalidatePropCache(className?: string): void {
  if (className) {
    propCache.delete(className);
  } else {
    propCache.clear();
  }
}

// ============ Schema API ============

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
  const schemaObj = Array.isArray(schema) ? schema[0] : schema;
  return ((schemaObj as Record<string, unknown>)?.properties ?? []) as Array<{ name: string; dataType: string[] }>;
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
  invalidatePropCache(name);
}

/** 删除集合 */
export async function deleteCollection(client: WeaviateClient, name: string): Promise<void> {
  await client.schema.classDeleter().withClassName(name).do();
  invalidatePropCache(name);
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

  if (vectorizer && vectorizer !== 'none') {
    propConfig.moduleConfig = {
      [vectorizer]: { skip: property.vectorize === false },
    };
  }

  await client.schema.propertyCreator().withClassName(className).withProperty(propConfig).do();
  invalidatePropCache(className);
}
