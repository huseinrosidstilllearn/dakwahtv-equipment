/**
 * Global Theme Utility for Dakwah TV Equipment Catalog
 * Ensures documentElement classList ('dark') and attribute ('data-theme')
 * remain strictly synchronized with localStorage across all pages.
 */

export function getSavedTheme() {
  if (typeof window === 'undefined') return 'dark';
  return localStorage.getItem('dtv-theme') || 'dark';
}

export function applyTheme(theme) {
  if (typeof window === 'undefined') return;
  const isDark = theme === 'dark';
  const root = document.documentElement;

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  root.setAttribute('data-theme', theme);
  localStorage.setItem('dtv-theme', theme);
}

export function initTheme() {
  const saved = getSavedTheme();
  applyTheme(saved);
  return saved;
}
