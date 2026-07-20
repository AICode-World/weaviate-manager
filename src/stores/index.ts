/**
 * Stores 统一导出
 *
 * Store 结构：
 * - connectionStore  — 连接状态 / client / 服务器版本
 * - clusterStore     — 多集群配置 CRUD + 加密
 * - dataStore        — 集合列表 / 数据 / 分页 / 搜索
 * - dashboardStore   — 仪表盘统计
 * - themeStore       — 主题 / 侧边栏
 * - queryHistoryStore — 查询历史
 * - queryTemplateStore — 查询模板
 */

export { default as useConnectionStore, type ConnectionStatus } from './connectionStore';
export { default as useClusterStore, type ClusterConfig } from './clusterStore';
export { default as useDataStore } from './dataStore';
export { default as useDashboardStore, type DashboardData } from './dashboardStore';
export { default as useThemeStore, type ThemeMode, type ThemePrefs, THEME_PRESETS } from './themeStore';
