/**
 * GraphQL 查询字符串模板常量
 * 集中管理所有 raw GraphQL 查询，避免散落在各服务文件中
 */

/** 构建分页参数字符串 */
function buildPaginationArg(limit: number, after?: string, offset?: number): string {
  let arg = `limit: ${limit}`;
  if (offset !== undefined && offset > 0) {
    arg += `, offset: ${offset}`;
  } else if (after) {
    arg += `, after: "${after}"`;
  }
  return arg;
}

/** Aggregate count 查询 */
export const qAggregateCount = (cls: string): string =>
  `{ Aggregate { ${cls} { meta { count } } } }`;

/** Get 对象列表查询 */
export const qGetObjects = (
  cls: string,
  propFields: string,
  limit: number,
  after?: string,
  offset?: number,
): string => {
  const fieldsStr = propFields ? `${propFields} ` : '';
  return `{ Get { ${cls}(${buildPaginationArg(limit, after, offset)}) { ${fieldsStr}_additional { id } } } }`;
};

/** Get 向量维度查询（取第一条数据） */
export const qGetVectorDim = (cls: string): string =>
  `{ Get { ${cls}(limit: 1) { _additional { vector } } } }`;

/** 转义 GraphQL 字符串（处理反斜杠、引号、换行、回车、制表符） */
function escapeGraphQLString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/** BM25 关键词搜索查询 */
export const qSearchBM25 = (
  cls: string,
  propFields: string,
  query: string,
  limit: number,
): string => {
  const escaped = escapeGraphQLString(query);
  const fieldsStr = propFields ? `${propFields} ` : '';
  return `{ Get { ${cls}(limit: ${limit}, bm25: {query: "${escaped}"}) { ${fieldsStr}_additional { id score } } } }`;
};

/** nearText 语义搜索查询 */
export const qSearchNearText = (
  cls: string,
  propFields: string,
  concepts: string,
  limit: number,
  distance: number,
): string => {
  const escaped = escapeGraphQLString(concepts);
  const fieldsStr = propFields ? `${propFields} ` : '';
  return `{ Get { ${cls}(limit: ${limit}, nearText: {concepts: ["${escaped}"], distance: ${distance}}) { ${fieldsStr}_additional { id distance } } } }`;
};
