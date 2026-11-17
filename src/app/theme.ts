import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const KEY = 'markov-simulator:theme';

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch { /* storage unavailable */ }
  return 'system';
}

const media = () => window.matchMedia('(prefers-color-scheme: dark)');

/**
 * Theme preference with system resolution. The resolved theme is written to <html data-theme>
 * during render (idempotent) so children that read CSS tokens in the same render see the new values.
 * index.html applies the stored preference before first paint.
 */
export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(() => media().matches);

  useEffect(() => {
    const mq = media();
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved: ResolvedTheme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
  if (document.documentElement.dataset.theme !== resolved) document.documentElement.dataset.theme = resolved;

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    try { localStorage.setItem(KEY, p); } catch { /* ignore */ }
  }, []);

  return { preference, resolved, setPreference };
}

/** Resolve CSS custom properties for libraries that need literal colors (Recharts). */
export function readTokens<K extends string>(names: readonly K[]): Record<K, string> {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(names.map((n) => [n, style.getPropertyValue(`--${n}`).trim()])) as Record<K, string>;
}
