/**
 * GraphQL 响应解析工具
 *
 * Weaviate GraphQL 查询返回的结构:
 * { data: { Get: { ClassName: [...objects] } } }
 * 每个对象包含 _additional { id, distance, score, ... }
 *
 * 这些工具函数统一处理上述结构的提取和展平，
 * 避免在各处重复编写类型断言和字段映射。
 */

/** 从 GraphQL 响应中提取 Get[className] 数组 */
export function extractGetResults(
  data: unknown,
  className: string,
): Record<string, unknown>[] {
  const get = (data as Record<string, unknown> | null | undefined)?.Get as
    Record<string, unknown> | undefined;
  return (get?.[className] as Record<string, unknown>[] | undefined) ?? [];
}

/** 从 GraphQL 响应中提取 Aggregate[className].meta.count */
export function extractAggregateCount(
  data: unknown,
  className: string,
): number {
  const agg = (data as Record<string, unknown> | null | undefined)?.Aggregate as
    Record<string, unknown> | undefined;
  return (agg?.[className] as Array<{ meta: { count: number } }> | undefined)?.[0]?.meta?.count ?? 0;
}

/**
 * 展平 _additional 字段到对象顶层（以 __ 前缀），
 * 并从对象中删除 _additional 键。
 *
 * 例如: { _additional: { id: 'x', distance: 0.1 }, name: 'foo' }
 *    → { __id: 'x', __distance: 0.1, name: 'foo' }
 */
export function flattenAdditional(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const flat: Record<string, unknown> = { ...obj };
  const add = flat._additional as Record<string, unknown> | undefined;
  if (add) {
    for (const [key, value] of Object.entries(add)) {
      flat[`__${key}`] = value;
    }
    delete flat._additional;
  }
  return flat;
}

/**
 * 提取 _additional 中的字段到对象顶层（__ 前缀），但保留 _additional 键。
 * 用于需要同时访问原始 _additional 和展平字段的场景（如数据浏览页的编辑/删除）。
 */
export function extractAdditionalFields(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const add = obj._additional as Record<string, unknown> | undefined;
  if (!add) return obj;
  const result: Record<string, unknown> = { ...obj };
  for (const [key, value] of Object.entries(add)) {
    result[`__${key}`] = value;
  }
  return result;
}
