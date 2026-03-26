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
  'bg-primary': '#0e1218',
  'bg-secondary': '#080b0f',
  'bg-tertiary': '#141920',
  'bg-floating': '#060810',
  'color-surface': '#0e1218',
  'color-surface-elevated': '#141920',
  'text-primary': '#dde4ef',
  'text-secondary': '#9ba8b8',
  'text-muted': '#4a5568',
  'text-link': '#5b9bd5',
  'brand-primary': '#c8a84a',
  'brand-hover': '#e8cc7a',
  'color-secondary': '#5b9bd5',
  'status-online': '#4caf84',
  'status-idle': '#e8a838',
  'status-dnd': '#e85454',
  'danger': '#e85454',
  'success': '#4caf84',
  'border-subtle': 'rgba(200, 168, 74, 0.12)',
  'color-border': 'rgba(200, 168, 74, 0.12)',
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
