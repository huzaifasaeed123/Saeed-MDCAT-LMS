// SKN Academy LMS — theme provider
//
// Tiny, self-contained light/dark mode system. Reads from localStorage on
// mount with a fall-back to the user's OS preference. Persists every change.
// Tailwind is configured with `darkMode: 'class'`, so flipping the `.dark`
// class on <html> is all we need to swap palettes — every component using
// dark: variants picks up the new theme without re-rendering itself.
//
// Usage:
//   import useTheme from '@/core/theme/useTheme';
//   const { theme, setTheme, toggle } = useTheme();
//   <button onClick={toggle}>flip</button>

import React, { createContext, useEffect, useState, useCallback } from 'react';

export const ThemeContext = createContext(null);

const STORAGE_KEY = 'skn:theme'; // 'light' | 'dark'

// Read initial theme synchronously so the first paint matches the user's
// choice — avoids a light→dark flash on reload. SSR-safe: returns 'light'
// when `window` is missing.
//
// DEFAULT IS LIGHT. We deliberately do NOT honour `prefers-color-scheme`
// for new users — the brand is light-mode-first, and dark is opt-in via
// the in-app toggle. Once the user picks a theme, that choice persists.
const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* localStorage blocked — fall through to light */ }
  return 'light';
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getInitialTheme);

  // Apply the class to <html> + persist whenever theme changes.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else                  root.classList.remove('dark');
    try { window.localStorage.setItem(STORAGE_KEY, theme); } catch { /* noop */ }
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (next !== 'light' && next !== 'dark') return;
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};
