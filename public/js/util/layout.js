import { supabase } from "../dataClient.js";
import { navigate } from "../router.js";
import { icons } from "./icons.js";

// One persistent, working support contact — replace with a real inbox/WhatsApp
// number before sharing this build outside the team.
const SUPPORT_MAILTO = "mailto:support@vivaranhealth.app?subject=Vivaran%20Health%20support";

export function renderShell({ title = "Vivaran Health", showBack = false, showAccount = true } = {}) {
  const backBtn = showBack
    ? `<button class="icon-btn" id="nav-back" aria-label="Back">${icons.chevronLeft}</button>`
    : "";
  const accountBtn = showAccount
    ? `<button class="icon-btn" id="nav-shares" aria-label="My shared links">${icons.link}</button>
       <button class="icon-btn" id="nav-logout" aria-label="Log out">${icons.power}</button>`
    : "";

  return `
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
    <main class="page"><div class="container" id="page-content"></div></main>
    <footer class="app-footer">
      <a class="support-link" href="${SUPPORT_MAILTO}">Need help? Contact support</a>
    </footer>
  `;
}

export function wireShellEvents(app) {
  const backBtn = app.querySelector("#nav-back");
  if (backBtn) backBtn.addEventListener("click", () => history.back());

  const sharesBtn = app.querySelector("#nav-shares");
  if (sharesBtn) sharesBtn.addEventListener("click", () => navigate("/shares"));

  const logoutBtn = app.querySelector("#nav-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      navigate("/login");
    });
  }
}

export function mountPage(app, shellOptions, contentHtml) {
  app.innerHTML = renderShell(shellOptions);
  document.getElementById("page-content").innerHTML = contentHtml;
  wireShellEvents(app);
}
