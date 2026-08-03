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
  barChart: svg('<path d="M4 20V10"/><path d="M11 20V4"/><path d="M18 20v-7"/>', { strokeWidth: 2 }),
  pill: svg('<rect x="3" y="9.5" width="18" height="5" rx="2.5" transform="rotate(-45 12 12)"/><path d="M9 9l6 6"/>', { strokeWidth: 1.6 }),
  stethoscope: svg('<path d="M6 4v5a4 4 0 008 0V4"/><path d="M10 13v2a5 5 0 0010 0v-2.5"/><circle cx="20" cy="10" r="1.6"/>', { strokeWidth: 1.6 }),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  building: svg('<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 21v-4h6v4"/><path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01"/>', { strokeWidth: 1.6 }),
  calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>', { strokeWidth: 1.6 }),
  sun: svg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12h2.5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/>', { strokeWidth: 1.8 }),
  moon: svg('<path d="M20 14.5A8.5 8.5 0 119.5 4a6.8 6.8 0 0010.5 10.5z"/>', { strokeWidth: 1.8 }),
};

export function iconSpan(name, extraClass = "") {
  return `<span class="icon ${extraClass}">${icons[name] || ""}</span>`;
}
