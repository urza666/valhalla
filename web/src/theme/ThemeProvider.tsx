/**
 * ThemeProvider — loads theme tokens and applies them as CSS variables.
 * Ported from lan-party-platform. In Valhalla, themes are loaded from
 * the settings store (localStorage) rather than an API.
 */
import { useEffect, type ReactNode } from 'react';
import { useSettingsStore } from '../stores/settings';

interface ThemeProviderProps {
  children: ReactNode;
}

// Default theme tokens — can be overridden by user preferences or server config
const DEFAULT_TOKENS: Record<string, string> = {
  'bg-primary': '#313338',
  'bg-secondary': '#2b2d31',
  'bg-tertiary': '#1e1f22',
  'bg-floating': '#111214',
  'text-primary': '#f2f3f5',
  'text-secondary': '#b5bac1',
  'text-muted': '#6d6f78',
  'text-link': '#00a8fc',
  'brand-primary': '#5865f2',
  'brand-hover': '#4752c4',
  'status-online': '#23a55a',
  'status-idle': '#f0b232',
  'status-dnd': '#f23f43',
  'danger': '#f23f43',
  'success': '#23a55a',
  'border-subtle': '#3f4147',
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { theme } = useSettingsStore();

  // Apply theme mode (dark/light)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Apply CSS variable tokens
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(DEFAULT_TOKENS).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  }, []);

  // Listen for OS color scheme changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't explicitly set a theme
      const savedTheme = localStorage.getItem('theme');
      if (!savedTheme) {
        useSettingsStore.getState().setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return <>{children}</>;
}
