import { useEffect, useState } from 'react';
import { HashRouter } from 'react-router-dom';
import { App as AntdApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { I18nProvider, useI18n } from './i18n/I18nProvider';
import { useThemeStore } from './stores/themeStore';
import MainLayout from './components/Layout/MainLayout';
import ErrorBoundary from './components/Common/ErrorBoundary';

function getSystemDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/** 亮色 token — 毛玻璃极简 */
function buildLightTokens(colorPrimary: string) {
  return {
    token: {
      colorPrimary,
      borderRadius: 12,
      fontSize: 14,
      colorBgContainer: 'rgba(255,255,255,0.8)',
      colorBgLayout: '#f3f4f8',
      colorBgElevated: '#ffffff',
      colorText: '#1a1a2e',
      colorTextSecondary: '#3d3d56',
      colorTextTertiary: '#6b6b80',
      colorTextQuaternary: '#9a9ab0',
      colorBorder: 'rgba(0,0,0,0.06)',
      colorBorderSecondary: 'rgba(0,0,0,0.04)',
      colorSuccess: '#10b981',
      colorWarning: '#f59e0b',
      colorError: '#ef4444',
    },
    components: {
      Table: {
        headerBg: 'rgba(255,255,255,0.6)',
        headerColor: '#1a1a2e',
        headerSplitColor: 'rgba(0,0,0,0.04)',
        rowHoverBg: 'rgba(74,0,224,0.03)',
        borderColor: 'rgba(0,0,0,0.04)',
        borderRadius: 12,
      },
      Menu: {
        itemBg: 'transparent',
        itemColor: '#3d3d56',
        itemSelectedBg: 'rgba(74,0,224,0.08)',
        itemSelectedColor: '#1a1a2e',
        itemHoverBg: 'rgba(0,0,0,0.04)',
        itemHoverColor: '#1a1a2e',
        itemBorderRadius: 8,
        itemMarginInline: 4,
        itemPaddingInline: 14,
      },
      Card: {
        boxShadow: '0 1px 4px rgba(26,26,46,0.04), 0 4px 16px rgba(26,26,46,0.05)',
        borderColor: 'rgba(0,0,0,0.04)',
        borderRadiusLG: 16,
      },
      Button: { borderRadius: 10 },
      Input: { borderRadius: 10, colorBorder: 'rgba(0,0,0,0.08)' },
      Select: { borderRadius: 10, colorBorder: 'rgba(0,0,0,0.08)' },
      Drawer: { borderRadiusLG: 16 },
      Modal: { borderRadiusLG: 16 },
    },
  };
}

/** 暗色 token — 毛玻璃极简 */
function buildDarkTokens(colorPrimary: string) {
  return {
    token: {
      colorPrimary,
      borderRadius: 12,
      fontSize: 14,
      colorBgContainer: 'rgba(24,27,46,0.85)',
      colorBgLayout: '#0e1019',
      colorBgElevated: '#222538',
      colorText: '#e8e8f0',
      colorTextSecondary: '#b8b8cc',
      colorTextTertiary: '#7a7a96',
      colorTextQuaternary: '#52526a',
      colorBorder: 'rgba(255,255,255,0.07)',
      colorBorderSecondary: 'rgba(255,255,255,0.04)',
      colorSuccess: '#10b981',
      colorWarning: '#f59e0b',
      colorError: '#ef4444',
    },
    components: {
      Table: {
        headerBg: 'rgba(24,27,46,0.6)',
        headerColor: '#e8e8f0',
        headerSplitColor: 'rgba(255,255,255,0.04)',
        rowHoverBg: 'rgba(255,255,255,0.04)',
        borderColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
      },
      Menu: {
        itemBg: 'transparent',
        itemColor: '#b8b8cc',
        itemSelectedBg: 'rgba(74,0,224,0.2)',
        itemSelectedColor: '#e8e8f0',
        itemHoverBg: 'rgba(255,255,255,0.05)',
        itemHoverColor: '#e8e8f0',
        itemBorderRadius: 8,
        itemMarginInline: 4,
        itemPaddingInline: 14,
      },
      Card: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.2)',
        borderColor: 'rgba(255,255,255,0.06)',
        borderRadiusLG: 16,
      },
      Button: { borderRadius: 10 },
      Input: { borderRadius: 10, colorBorder: 'rgba(255,255,255,0.1)' },
      Select: { borderRadius: 10, colorBorder: 'rgba(255,255,255,0.1)' },
      Drawer: { borderRadiusLG: 16 },
      Modal: { borderRadiusLG: 16 },
    },
  };
}

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { themeMode, themeColor } = useThemeStore();
  const [systemDark, setSystemDark] = useState(getSystemDark());

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const resolvedDark = themeMode === 'system' ? systemDark : themeMode === 'dark';

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
          <ErrorBoundary>
            <MainLayout />
          </ErrorBoundary>
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
