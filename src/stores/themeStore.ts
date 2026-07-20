import { create } from 'zustand';

/** 主题模式 */
export type ThemeMode = 'light' | 'dark' | 'system';

/** 品牌色预设 */
export const THEME_PRESETS = [
  { name: 'blue', color: '#1677ff' },
  { name: 'green', color: '#10b981' },
  { name: 'purple', color: '#8b5cf6' },
  { name: 'orange', color: '#f97316' },
  { name: 'pink', color: '#ec4899' },
] as const;

/** 主题偏好 */
export interface ThemePrefs {
  themeMode: ThemeMode;
  themeColor: string;
}

const THEME_PREFS_KEY = 'weaviate_theme_prefs';
const UI_PREFS_KEY = 'weaviate_ui_prefs';

const DEFAULT_THEME_PREFS: ThemePrefs = { themeMode: 'light', themeColor: '#1677ff' };

function loadThemePrefs(): ThemePrefs {
  try {
    const raw = localStorage.getItem(THEME_PREFS_KEY);
    if (!raw) return { ...DEFAULT_THEME_PREFS };
    return { ...DEFAULT_THEME_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_THEME_PREFS };
  }
}

function saveThemePrefs(prefs: ThemePrefs) {
  localStorage.setItem(THEME_PREFS_KEY, JSON.stringify(prefs));
}

interface ThemeStore {
  themeMode: ThemeMode;
  themeColor: string;
  sidebarCollapsed: boolean;

  setThemeMode: (mode: ThemeMode) => void;
  setThemeColor: (color: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const useThemeStore = create<ThemeStore>((set, get) => ({
  themeMode: loadThemePrefs().themeMode,
  themeColor: loadThemePrefs().themeColor,

  sidebarCollapsed: (() => {
    try {
      const raw = localStorage.getItem(UI_PREFS_KEY);
      if (raw) return JSON.parse(raw).sidebarCollapsed ?? false;
    } catch { /* ignore */ }
    return false;
  })(),

  setThemeMode: (mode) => {
    const prefs = { themeMode: mode, themeColor: get().themeColor };
    saveThemePrefs(prefs);
    set({ themeMode: mode });
  },

  setThemeColor: (color) => {
    const prefs = { themeMode: get().themeMode, themeColor: color };
    saveThemePrefs(prefs);
    set({ themeColor: color });
  },

  setSidebarCollapsed: (collapsed) => {
    try {
      localStorage.setItem(UI_PREFS_KEY, JSON.stringify({ sidebarCollapsed: collapsed }));
    } catch { /* ignore */ }
    set({ sidebarCollapsed: collapsed });
  },
}));

export default useThemeStore;
export { useThemeStore };
