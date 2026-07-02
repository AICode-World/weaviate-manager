/**
 * Monaco Editor 懒加载配置
 * Worker 已在 main.tsx 中静态配置，这里只初始化 loader
 * 仅在 GraphQL tab 打开时调用
 */
export async function initMonaco() {
  const [monaco, { loader }] = await Promise.all([
    import('monaco-editor'),
    import('@monaco-editor/react'),
  ]);
  loader.config({ monaco });
}
