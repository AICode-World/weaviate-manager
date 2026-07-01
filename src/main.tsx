import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
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
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
          fontSize: 14,
          colorBgContainer: '#ffffff',
          colorBgLayout: '#f7f8fa',
          colorText: '#1a1f36',
          colorTextSecondary: '#4a5266',
          colorTextTertiary: '#6b7589',
          colorTextQuaternary: '#9aa3b5',
          colorTextPlaceholder: '#9aa3b5',
          colorBorder: '#e5e8f0',
          colorBorderSecondary: '#eef0f5',
          colorSuccess: '#10b981',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
        },
        components: {
          Table: {
            headerBg: '#fafbfc',
            headerColor: '#1a1f36',
            headerSplitColor: '#e5e8f0',
            rowHoverBg: '#f5f7fb',
            borderColor: '#eef0f5',
          },
          Menu: {
            itemBg: 'transparent',
            itemColor: '#4a5266',
            itemSelectedBg: '#ffffff',
            itemSelectedColor: '#1677ff',
            itemHoverBg: 'rgba(255,255,255,0.7)',
            itemHoverColor: '#1677ff',
            itemBorderRadius: 6,
            itemMarginInline: 4,
            itemPaddingInline: 12,
          },
          Card: {
            boxShadow: '0 1px 3px rgba(26, 31, 54, 0.04), 0 4px 12px rgba(26, 31, 54, 0.04)',
            borderColor: '#eef0f5',
          },
          Button: {
            borderRadius: 6,
          },
          Input: {
            borderRadius: 6,
            colorBorder: '#e5e8f0',
          },
          Select: {
            borderRadius: 6,
            colorBorder: '#e5e8f0',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </StrictMode>
);
