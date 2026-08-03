import { supabase } from "../dataClient.js";
import { mountPage } from "../util/layout.js";
import { escapeHtml, formatDate } from "../util/dom.js";
import { navigate } from "../router.js";

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// visitId: single visit, from the "Share" button on a visit's detail page.
// visitIds: an array of visit ids, from multi-select on the timeline. When
// present, this takes priority and the scope is fixed to "selected_visits" —
// there's no scope switcher in that case, the patient already chose exactly
// which records to include.
export async function render(app, visitId, visitIds) {
  mountPage(app, { title: "Share", showBack: true }, `<div class="loading-row"><span class="spinner"></span> Loading...</div>`);
  const content = document.getElementById("page-content");

  const multiMode = Array.isArray(visitIds) && visitIds.length > 0;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user.id;

  let visitLabel = null;
  let selectedVisits = [];

  if (multiMode) {
    const { data: visits } = await supabase.from("visits").select("id, hospital_name, visit_date").in("id", visitIds).eq("user_id", userId);
    selectedVisits = visits || [];
    if (selectedVisits.length === 0) {
      content.innerHTML = `<div class="alert alert-error">These visits could not be found.</div>`;
      return;
    }
  } else if (visitId) {
    const { data: visit } = await supabase
      .from("visits")
      .select("hospital_name, visit_date")
      .eq("id", visitId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!visit) {
      content.innerHTML = `<div class="alert alert-error">This visit could not be found.</div>`;
      return;
    }
    visitLabel = visit.hospital_name || "this visit";
  }

  let scope = multiMode ? "selected_visits" : visitId ? "single_visit" : "full_history";

  function paintForm() {
    const scopeRow = multiMode
      ? `
        <div class="card" style="margin-bottom:18px;">
          <div style="font-weight:600;margin-bottom:8px;">${selectedVisits.length} record${selectedVisits.length === 1 ? "" : "s"} selected</div>
          <div class="stack" style="gap:6px;">
            ${selectedVisits
              .map(
                (v) => `
              <div style="display:flex;justify-content:space-between;font-size:0.88rem;color:var(--ink-700);">
                <span>${escapeHtml(v.hospital_name) || "Hospital not recorded"}</span>
                <span style="color:var(--ink-500);">${formatDate(v.visit_date)}</span>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `
      : `
        <div class="share-scope-row">
          <div class="share-scope-option ${scope === "single_visit" ? "selected" : ""}" data-scope="single_visit" ${!visitId ? "aria-disabled='true'" : ""}>
            Single visit${visitLabel ? `<div style="font-weight:400;font-size:0.78rem;margin-top:4px;">${escapeHtml(visitLabel)}</div>` : ""}
          </div>
          <div class="share-scope-option ${scope === "full_history" ? "selected" : ""}" data-scope="full_history">
            Full history
          </div>
        </div>
      `;

    content.innerHTML = `
      <h1 class="page-title">Share a record</h1>
      <p class="page-subtitle">Generate a link and QR code a doctor can open instantly — no login, no app install.</p>

      ${scopeRow}

      <div class="alert alert-info">This link expires automatically in 48 hours, or you can revoke it any time from "My shared links".</div>

      <button class="btn btn-primary btn-block" id="generate-btn">Generate share link</button>
    `;

    if (!multiMode && visitId) {
      content.querySelectorAll(".share-scope-option").forEach((el) => {
        el.addEventListener("click", () => {
          scope = el.dataset.scope;
          paintForm();
        });
      });
    }

    document.getElementById("generate-btn").addEventListener("click", handleGenerate);
  }

  async function handleGenerate() {
    const btn = document.getElementById("generate-btn");
    btn.disabled = true;
    btn.textContent = "Generating...";

    try {
      const token = randomToken();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.from("share_links").insert({
        token,
        scope,
        visit_id: scope === "single_visit" ? visitId : null,
        visit_ids: scope === "selected_visits" ? visitIds : null,
        user_id: userId,
        expires_at: expiresAt,
      });
      if (error) throw error;

      paintResult(token);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Generate share link";
      alert(err.message || "Could not create the share link.");
    }
  }

  function paintResult(token) {
    const shareUrl = `${window.location.origin}${window.location.pathname}#/doctor?token=${token}`;

    content.innerHTML = `
      <h1 class="page-title">Ready to share</h1>
      <p class="page-subtitle">Have the doctor scan this QR code, or send them the link.</p>

      <div class="card qr-wrap">
        <canvas id="qr-canvas"></canvas>
        <div class="share-link-box">
          <input type="text" id="share-url" readonly value="${escapeHtml(shareUrl)}" />
          <button class="btn btn-secondary" id="copy-btn">Copy</button>
        </div>
      </div>

      <div class="action-row">
        <button class="btn btn-secondary" id="view-shares-btn">My shared links</button>
        <button class="btn btn-primary" id="done-btn">Done</button>
      </div>
    `;

    // Wire up all buttons FIRST, and keep QR generation guarded below — even
    // though QRCode is now vendored locally (no CDN/network dependency), a
    // rendering failure here must never take Copy/My shared links/Done with it.
    document.getElementById("copy-btn").addEventListener("click", async () => {
      const input = document.getElementById("share-url");
      input.select();
      try {
        await navigator.clipboard.writeText(shareUrl);
        const btn = document.getElementById("copy-btn");
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy"), 1500);
      } catch {
        document.execCommand("copy");
      }
    });

    document.getElementById("view-shares-btn").addEventListener("click", () => navigate("/shares"));
    document.getElementById("done-btn").addEventListener("click", () => navigate(visitId ? `/visit/${visitId}` : "/timeline"));

    try {
      if (typeof QRCode === "undefined") throw new Error("QR code library did not load");
      QRCode.toCanvas(document.getElementById("qr-canvas"), shareUrl, { width: 220, margin: 1, color: { dark: "#1f2937" } });
    } catch {
      document.getElementById("qr-canvas").outerHTML =
        '<p style="color:var(--ink-500);font-size:0.85rem;">QR code unavailable right now — the link below still works.</p>';
    }
  }

  paintForm();
}
