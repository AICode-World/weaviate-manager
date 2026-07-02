import { useEffect, useState } from 'react';
import { HashRouter } from 'react-router-dom';
import { App as AntdApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { I18nProvider, useI18n } from './i18n/I18nProvider';
import useAppStore from './stores/appStore';
import MainLayout from './components/Layout/MainLayout';

/** 获取系统是否偏好暗色 */
function getSystemDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/** 亮色 token */
function buildLightTokens(colorPrimary: string) {
  return {
    token: {
      colorPrimary,
      borderRadius: 8,
      fontSize: 14,
      colorBgContainer: '#ffffff',
      colorBgLayout: '#f7f8fa',
      colorBgElevated: '#ffffff',
      colorText: '#1a1f36',
      colorTextSecondary: '#4a5266',
      colorTextTertiary: '#6b7589',
      colorTextQuaternary: '#9aa3b5',
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
        itemSelectedColor: colorPrimary,
        itemHoverBg: 'rgba(255,255,255,0.7)',
        itemHoverColor: colorPrimary,
        itemBorderRadius: 6,
        itemMarginInline: 4,
        itemPaddingInline: 12,
      },
      Card: {
        boxShadow: '0 1px 3px rgba(26, 31, 54, 0.04), 0 4px 12px rgba(26, 31, 54, 0.04)',
        borderColor: '#eef0f5',
      },
      Button: { borderRadius: 6 },
      Input: { borderRadius: 6, colorBorder: '#e5e8f0' },
      Select: { borderRadius: 6, colorBorder: '#e5e8f0' },
    },
  };
}

/** 暗色 token */
function buildDarkTokens(colorPrimary: string) {
  return {
    token: {
      colorPrimary,
      borderRadius: 8,
      fontSize: 14,
      colorBgContainer: '#1a1d2e',
      colorBgLayout: '#0f1117',
      colorBgElevated: '#222538',
      colorText: '#e4e6ed',
      colorTextSecondary: '#b0b8c9',
      colorTextTertiary: '#7a839a',
      colorTextQuaternary: '#5a6377',
      colorBorder: '#2a2e3e',
      colorBorderSecondary: '#232636',
      colorSuccess: '#10b981',
      colorWarning: '#f59e0b',
      colorError: '#ef4444',
    },
    components: {
      Table: {
        headerBg: '#1e2130',
        headerColor: '#e4e6ed',
        headerSplitColor: '#2a2e3e',
        rowHoverBg: '#252840',
        borderColor: '#2a2e3e',
      },
      Menu: {
        itemBg: 'transparent',
        itemColor: '#b0b8c9',
        itemSelectedBg: '#252840',
        itemSelectedColor: colorPrimary,
        itemHoverBg: 'rgba(255,255,255,0.06)',
        itemHoverColor: colorPrimary,
        itemBorderRadius: 6,
        itemMarginInline: 4,
        itemPaddingInline: 12,
      },
      Card: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2)',
        borderColor: '#2a2e3e',
      },
      Button: { borderRadius: 6 },
      Input: { borderRadius: 6, colorBorder: '#2a2e3e' },
      Select: { borderRadius: 6, colorBorder: '#2a2e3e' },
    },
  };
}

/** 主题 Provider：根据 themeMode 和 themeColor 动态切换 antd 主题 + data-theme */
const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { themeMode, themeColor } = useAppStore();
  const [systemDark, setSystemDark] = useState(getSystemDark());

  // 监听系统主题变化
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // 解析实际主题
  const resolvedDark = themeMode === 'system' ? systemDark : themeMode === 'dark';

  // 同步 data-theme 属性到 html 根元素
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedDark ? 'dark' : 'light');
  }, [resolvedDark]);

  const themeConfig = resolvedDark
    ? buildDarkTokens(themeColor)
    : buildLightTokens(themeColor);

  return (
    <ConfigProvider theme={{ ...themeConfig, algorithm: resolvedDark ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      {children}
    </ConfigProvider>
  );
};

const AppContent: React.FC = () => {
  const { lang } = useI18n();
  return (
    <ConfigProvider locale={lang === 'zh' ? zhCN : enUS}>
      <ThemeProvider>
        <AntdApp>
          <MainLayout />
        </AntdApp>
      </ThemeProvider>
    </ConfigProvider>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <I18nProvider>
        <AppContent />
      </I18nProvider>
    </HashRouter>
  );
};

export default App;
