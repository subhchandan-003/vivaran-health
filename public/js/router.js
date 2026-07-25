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

export async function renderCurrentRoute() {
  const app = document.getElementById("app");
  const hash = window.location.hash || "#/";
  const match = matchRoute(hash);
  if (!match) {
    app.innerHTML = notFoundHandler();
    return;
  }
  await match.render(app, match.params, match.query);
}

export function startRouter() {
  window.addEventListener("hashchange", renderCurrentRoute);
  renderCurrentRoute();
}

export function navigate(path) {
  window.location.hash = path;
}
