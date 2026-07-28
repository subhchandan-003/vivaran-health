// Minimal hash router. Routes are registered as { pattern, render(params) }.
// pattern segments starting with ":" are captured as params.

const routes = [];
let notFoundHandler = () => `<div class="container"><p>Page not found.</p></div>`;

export function route(pattern, render) {
  routes.push({ pattern, render });
}

export function setNotFound(fn) {
  notFoundHandler = fn;
}

function matchRoute(hash) {
  const path = hash.replace(/^#/, "").split("?")[0] || "/";
  const search = hash.includes("?") ? hash.split("?").slice(1).join("?") : "";
  const query = Object.fromEntries(new URLSearchParams(search));
  const pathSegments = path.split("/").filter(Boolean);

  for (const r of routes) {
    const patternSegments = r.pattern.split("/").filter(Boolean);
    if (patternSegments.length !== pathSegments.length) continue;
    const params = {};
    let matched = true;
    for (let i = 0; i < patternSegments.length; i++) {
      const p = patternSegments[i];
      const s = pathSegments[i];
      if (p.startsWith(":")) {
        params[p.slice(1)] = decodeURIComponent(s);
      } else if (p !== s) {
        matched = false;
        break;
      }
    }
    if (matched) return { render: r.render, params, query };
  }
  return null;
}

async function doRender(app, match) {
  if (!match) {
    app.innerHTML = notFoundHandler();
    return;
  }
  await match.render(app, match.params, match.query);
}

export async function renderCurrentRoute() {
  const app = document.getElementById("app");
  const hash = window.location.hash || "#/";
  const match = matchRoute(hash);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // View Transitions cross-fade old page -> new page, but the browser holds
  // a frozen screenshot of the old page until the update callback's promise
  // resolves — fine for this app's near-instant local-mode fetches, but a
  // real backend over a slow connection could leave that screenshot frozen
  // for seconds with no spinner visible. skipTransition() after a short
  // grace period drops the freeze (the render keeps running underneath) so
  // slow renders fall back to the plain, spinner-visible path instead.
  if (!reducedMotion && document.startViewTransition) {
    const transition = document.startViewTransition(() => doRender(app, match));
    const bail = setTimeout(() => transition.skipTransition(), 250);
    transition.finished.finally(() => clearTimeout(bail));
    await transition.finished;
  } else {
    await doRender(app, match);
  }
}

export function startRouter() {
  window.addEventListener("hashchange", renderCurrentRoute);
  renderCurrentRoute();
}

export function navigate(path) {
  window.location.hash = path;
}
