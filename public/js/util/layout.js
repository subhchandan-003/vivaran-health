import { supabase } from "../dataClient.js";
import { navigate } from "../router.js";
import { icons } from "./icons.js";

// One persistent, working support contact — replace with a real inbox/WhatsApp
// number before sharing this build outside the team.
const SUPPORT_MAILTO = "mailto:support@vivaranhealth.app?subject=Vivaran%20Health%20support";

const NAV_ITEMS = [
  { path: "/timeline", label: "Timeline", icon: "document", matchPrefix: "/visit" },
  { path: "/analytics", label: "Analytics", icon: "barChart" },
  { path: "/upload", label: "Upload", icon: "camera" },
  { path: "/shares", label: "Shared links", icon: "link" },
];

function currentPath() {
  return (window.location.hash || "#/").replace(/^#/, "").split("?")[0] || "/";
}

function renderSidebar() {
  const path = currentPath();
  const links = NAV_ITEMS.map((item) => {
    const active = path === item.path || (item.matchPrefix && path.startsWith(item.matchPrefix));
    return `
      <a href="#${item.path}" class="app-nav-link ${active ? "active" : ""}">
        <span class="icon">${icons[item.icon]}</span><span>${item.label}</span>
      </a>
    `;
  }).join("");

  return `
    <aside class="app-sidebar">
      <a href="#/timeline" class="app-sidebar__brand">
        <span class="app-header__logo"><img src="assets/logo.png" alt="" /></span>
        <span>Vivaran Health</span>
      </a>
      <nav class="app-sidebar__nav">${links}</nav>
      <button type="button" class="app-nav-link app-sidebar__logout" id="sidebar-logout">
        <span class="icon">${icons.power}</span><span>Log out</span>
      </button>
    </aside>
  `;
}

export function renderShell({ title = "Vivaran Health", showBack = false, showAccount = true, wide = false } = {}) {
  const backBtn = showBack
    ? `<button class="icon-btn" id="nav-back" aria-label="Back">${icons.chevronLeft}</button>`
    : "";
  const accountBtn = showAccount
    ? `<button class="icon-btn" id="nav-shares" aria-label="My shared links">${icons.link}</button>
       <button class="icon-btn" id="nav-logout" aria-label="Log out">${icons.power}</button>`
    : "";

  return `
    <div class="app-shell">
      ${showAccount ? renderSidebar() : ""}
      <div class="app-main">
        <header class="app-header">
          <div class="container app-header__row">
            <div style="display:flex;align-items:center;gap:8px;">
              ${backBtn}
              <a href="#/timeline" class="app-header__brand">
                <span class="app-header__logo"><img src="assets/logo.png" alt="" /></span>
                <span>Vivaran Health</span>
              </a>
            </div>
            <div class="app-header__actions">${accountBtn}</div>
          </div>
        </header>
        <main class="page"><div class="container ${wide ? "container--wide" : ""}" id="page-content"></div></main>
        <footer class="app-footer">
          <a class="support-link" href="${SUPPORT_MAILTO}">Need help? Contact support</a>
        </footer>
      </div>
    </div>
  `;
}

export function wireShellEvents(app) {
  const backBtn = app.querySelector("#nav-back");
  if (backBtn) backBtn.addEventListener("click", () => history.back());

  const sharesBtn = app.querySelector("#nav-shares");
  if (sharesBtn) sharesBtn.addEventListener("click", () => navigate("/shares"));

  async function doLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  const logoutBtn = app.querySelector("#nav-logout");
  if (logoutBtn) logoutBtn.addEventListener("click", doLogout);

  const sidebarLogoutBtn = app.querySelector("#sidebar-logout");
  if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener("click", doLogout);
}

export function mountPage(app, shellOptions, contentHtml) {
  app.innerHTML = renderShell(shellOptions);
  document.getElementById("page-content").innerHTML = contentHtml;
  wireShellEvents(app);
}
