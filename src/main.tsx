import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'antd/dist/reset.css';
import './index.css';

// Monaco Editor 本地化：避免默认从 jsDelivr CDN 加载（国内慢）
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JSONWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import CSSWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HTMLWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import TSWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new JSONWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new CSSWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new HTMLWorker();
    if (label === 'typescript' || label === 'javascript') return new TSWorker();
    return new EditorWorker();
  },
};

import { loader } from '@monaco-editor/react';
loader.config({ monaco });

import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
