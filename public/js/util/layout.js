import { supabase } from "../dataClient.js";
import { navigate } from "../router.js";
import { icons } from "./icons.js";
import { resolveTheme, toggleTheme } from "./theme.js";

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

function isNavItemActive(item, path) {
  return path === item.path || (item.matchPrefix && path.startsWith(item.matchPrefix));
}

function themeToggleIcon() {
  // Shows the icon for the mode a click switches *to*.
  return resolveTheme() === "dark" ? icons.sun : icons.moon;
}

function renderSidebar() {
  const path = currentPath();
  const links = NAV_ITEMS.map((item) => `
      <a href="#${item.path}" class="app-nav-link ${isNavItemActive(item, path) ? "active" : ""}">
        <span class="icon">${icons[item.icon]}</span><span>${item.label}</span>
      </a>
    `).join("");

  return `
    <aside class="app-sidebar">
      <a href="#/timeline" class="app-sidebar__brand">
        <span class="app-header__logo"><img src="assets/logo.png" alt="" /></span>
        <span>Vivaran Health</span>
      </a>
      <nav class="app-sidebar__nav">${links}</nav>
      <button type="button" class="app-nav-link theme-toggle-inline" id="sidebar-theme-toggle">
        <span class="icon">${themeToggleIcon()}</span><span>Theme</span>
      </button>
      <button type="button" class="app-nav-link app-sidebar__logout" id="sidebar-logout">
        <span class="icon">${icons.power}</span><span>Log out</span>
      </button>
    </aside>
  `;
}

function renderBottomNav() {
  const path = currentPath();
  const links = NAV_ITEMS.map((item) => `
      <a href="#${item.path}" class="app-bottomnav__link ${isNavItemActive(item, path) ? "active" : ""}">
        <span class="icon">${icons[item.icon]}</span><span>${item.label}</span>
      </a>
    `).join("");

  return `
    <nav class="app-bottomnav" aria-label="Primary">
      <div class="app-bottomnav__row">${links}</div>
    </nav>
  `;
}

export function renderShell({ title = "Vivaran Health", showBack = false, showAccount = true, wide = false } = {}) {
  const backBtn = showBack
    ? `<button class="icon-btn" id="nav-back" aria-label="Back">${icons.chevronLeft}</button>`
    : "";
  const accountBtn = showAccount
    ? `<button class="icon-btn theme-toggle" id="nav-theme-toggle" aria-label="Toggle dark mode">${themeToggleIcon()}</button>
       <button class="icon-btn" id="nav-shares" aria-label="My shared links">${icons.link}</button>
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
      ${showAccount ? renderBottomNav() : ""}
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

  function refreshThemeIcons() {
    const icon = themeToggleIcon();
    const headerBtn = app.querySelector("#nav-theme-toggle");
    if (headerBtn) headerBtn.innerHTML = icon;
    const sidebarBtn = app.querySelector("#sidebar-theme-toggle .icon");
    if (sidebarBtn) sidebarBtn.innerHTML = icon;
  }

  function onToggleTheme() {
    toggleTheme();
    refreshThemeIcons();
  }

  const themeToggleBtn = app.querySelector("#nav-theme-toggle");
  if (themeToggleBtn) themeToggleBtn.addEventListener("click", onToggleTheme);

  const sidebarThemeToggleBtn = app.querySelector("#sidebar-theme-toggle");
  if (sidebarThemeToggleBtn) sidebarThemeToggleBtn.addEventListener("click", onToggleTheme);
}

export function mountPage(app, shellOptions, contentHtml) {
  app.innerHTML = renderShell(shellOptions);
  document.getElementById("page-content").innerHTML = contentHtml;
  wireShellEvents(app);
}
