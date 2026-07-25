// Small hand-authored inline SVG icon set — no external icon font or CDN, so
// icons render reliably offline and never flash-of-missing-glyph. Each icon
// is sized in `em` so it scales with the surrounding font-size, the same way
// the emoji characters it replaces used to.
function svg(paths, { viewBox = "0 0 24 24", strokeWidth = 2 } = {}) {
  return `<svg viewBox="${viewBox}" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="vertical-align:-0.125em;">${paths}</svg>`;
}

export const icons = {
  chevronLeft: svg('<path d="M15 18l-6-6 6-6"/>'),
  chevronDown: svg('<path d="M6 9l6 6 6-6"/>'),
  link: svg('<path d="M9 15l6-6"/><path d="M11 6l1-1a4 4 0 015.7 5.7l-1.6 1.6"/><path d="M13 18l-1 1A4 4 0 016.3 13.3l1.6-1.6"/>'),
  power: svg('<path d="M12 3v9"/><path d="M18.4 6.6a8 8 0 11-12.8 0"/>'),
  document: svg('<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 3V2a1 1 0 011-1h4a1 1 0 011 1v1"/><path d="M9 9h6M9 13h6M9 17h3"/>', { strokeWidth: 1.5 }),
  camera: svg('<path d="M4 8a2 2 0 012-2h1.5l1-1.5h7l1 1.5H18a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"/><circle cx="12" cy="12.5" r="3.5"/>', { strokeWidth: 1.5 }),
  close: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>', { strokeWidth: 1.5 }),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 0c0 1.5-1.5 2-2.5 3"/><path d="M12 17h.01"/>', { strokeWidth: 1.5 }),
  shieldCheck: svg('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/>', { strokeWidth: 1.6 }),
};

export function iconSpan(name, extraClass = "") {
  return `<span class="icon ${extraClass}">${icons[name] || ""}</span>`;
}
