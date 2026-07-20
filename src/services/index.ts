/**
 * 服务层统一导出
 *
 * 模块结构：
 * - client.ts          — 客户端创建、连接测试、服务器信息
 * - schemaService.ts   — 集合/Schema 管理（CRUD + 属性缓存）
 * - dataService.ts     — 对象 CRUD
 * - searchService.ts   — BM25 / nearText / nearImage 搜索
 * - dashboardService.ts — 仪表盘聚合统计
 * - graphqlQueries.ts  — GraphQL 查询字符串模板常量
 */

export { createClient, testConnection, getServerInfo } from './client';

export {
  listCollections,
  getClassProperties,
  getCachedClassProperties,
  getFullSchema,
  createCollection,
  deleteCollection,
  addProperty,
  invalidatePropCache,
  PROPERTY_DATA_TYPES,
  type PropertyDataType,
  type CollectionProperty,
  type CollectionSchema,
} from './schemaService';

export {
  fetchObjects,
  insertObject,
  updateObject,
  deleteObject,
} from './dataService';

export {
  searchBM25,
  searchNearText,
  searchNearTextWithVector,
  searchNearImage,
} from './searchService';

export {
  getDashboardData,
  getCollectionStats,
} from './dashboardService';

export {
  extractGetResults,
  extractAggregateCount,
  flattenAdditional,
  extractAdditionalFields,
} from './graphqlHelpers';
