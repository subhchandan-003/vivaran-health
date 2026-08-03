// Light/dark theme persistence. The actual flip happens by setting
// `data-theme` on <html> — style.css keys every dark-mode override off that
// attribute (see :root[data-theme="dark"]). index.html also runs a tiny
// inline copy of getStoredTheme()+apply() synchronously before the
// stylesheet loads, so the very first paint already has the right theme
// and there's no flash of the wrong one.
const THEME_KEY = "vivaran_theme";

export function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

export function resolveTheme() {
  const stored = getStoredTheme();
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

export function initTheme() {
  applyTheme(resolveTheme());
}

export function toggleTheme() {
  const next = resolveTheme() === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* localStorage unavailable — theme just won't persist across reloads */
  }
  applyTheme(next);
  return next;
}
