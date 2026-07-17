/**
 * Monaco Editor 懒加载配置
 * Worker + Monaco 本体均在调用时才加载，不污染入口文件
 * 仅在 GraphQL tab 打开时调用
 */
export async function initMonaco() {
  // 按需加载 worker（只加载 editor + json，去掉 ts/css/html）
  const [EditorWorker, JSONWorker, monaco, { loader }] = await Promise.all([
    import('monaco-editor/esm/vs/editor/editor.worker?worker'),
    import('monaco-editor/esm/vs/language/json/json.worker?worker'),
    import('monaco-editor'),
    import('@monaco-editor/react'),
  ]);

  // 配置 worker 工厂
  self.MonacoEnvironment = {
    getWorker(_, label) {
      if (label === 'json') return new JSONWorker.default();
      return new EditorWorker.default();
    },
  };

  loader.config({ monaco });
}
