import { useEffect, useLayoutEffect, useState } from 'react';

type ColorTheme = 'light' | 'dark';

// Keep the key in sync with the first-paint script in index.html.
const THEME_KEY = 'learning-assistant:theme';
const systemScheme = window.matchMedia('(prefers-color-scheme: dark)');

function readPreference(): ColorTheme | undefined {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : undefined;
  } catch {
    return undefined;
  }
}

function readSystemTheme(): ColorTheme {
  return systemScheme.matches ? 'dark' : 'light';
}

export function useColorTheme() {
  const [preference, setPreference] = useState(readPreference);
  const [systemTheme, setSystemTheme] = useState(readSystemTheme);
  const theme = preference ?? systemTheme;

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const syncSystemTheme = () => setSystemTheme(readSystemTheme());
    const syncPreference = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === null) setPreference(readPreference());
    };
    systemScheme.addEventListener('change', syncSystemTheme);
    window.addEventListener('storage', syncPreference);
    syncSystemTheme();
    return () => {
      systemScheme.removeEventListener('change', syncSystemTheme);
      window.removeEventListener('storage', syncPreference);
    };
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setPreference(next);
    try { localStorage.setItem(THEME_KEY, next); }
    catch { /* The current page can still switch themes. */ }
  };

  return { theme, toggleTheme };
}
