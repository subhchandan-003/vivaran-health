import { supabase } from "../dataClient.js";
import { mountPage } from "../util/layout.js";
import { escapeHtml, formatDateTime } from "../util/dom.js";
import { navigate } from "../router.js";
import { icons } from "../util/icons.js";

function statusOf(link) {
  if (link.revoked) return { label: "Revoked", cls: "badge-muted" };
  if (new Date(link.expires_at).getTime() < Date.now()) return { label: "Expired", cls: "badge-muted" };
  return { label: "Active", cls: "badge-teal" };
}

export async function render(app) {
  mountPage(app, { title: "My shared links", showBack: true }, `<div class="loading-row"><span class="spinner"></span> Loading...</div>`);
  const content = document.getElementById("page-content");

  const { data: links, error } = await supabase
    .from("share_links")
    .select("id, token, scope, created_at, expires_at, revoked, visits(hospital_name, visit_date)")
    .order("created_at", { ascending: false });

  if (error) {
    content.innerHTML = `<div class="alert alert-error">Could not load your shared links.</div>`;
    return;
  }

  if (!links || links.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">${icons.link}</div>
        <h3>No shared links yet</h3>
        <p>When you share a visit or your full history, it will show up here so you can track and revoke access.</p>
        <button class="btn btn-primary" id="back-timeline-btn" style="margin-top:10px;">Back to timeline</button>
      </div>
    `;
    document.getElementById("back-timeline-btn").addEventListener("click", () => navigate("/timeline"));
    return;
  }

  content.innerHTML = `
    <h1 class="page-title">My shared links</h1>
    <p class="page-subtitle">Every link you've generated, and who can currently see it.</p>
    <div class="stack">
      ${links
        .map((link) => {
          const status = statusOf(link);
          const scopeLabel =
            link.scope === "single_visit"
              ? `Single visit${link.visits?.hospital_name ? ` — ${escapeHtml(link.visits.hospital_name)}` : ""}`
              : "Full history";
          const canRevoke = !link.revoked && new Date(link.expires_at).getTime() >= Date.now();
          return `
            <div class="card share-link-card" data-link-id="${link.id}">
              <div class="flex-between">
                <strong>${scopeLabel}</strong>
                <span class="badge ${status.cls}">${status.label}</span>
              </div>
              <div class="detail-row"><span class="detail-row__label">Created</span><span class="detail-row__value">${formatDateTime(link.created_at)}</span></div>
              <div class="detail-row"><span class="detail-row__label">Expires</span><span class="detail-row__value">${formatDateTime(link.expires_at)}</span></div>
              ${canRevoke ? `<button class="btn btn-danger btn-block revoke-btn" style="margin-top:12px;">Revoke access</button>` : ""}
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  content.querySelectorAll(".revoke-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const card = e.target.closest("[data-link-id]");
      const linkId = card.dataset.linkId;
      btn.disabled = true;
      btn.textContent = "Revoking...";
      const { error: revokeError } = await supabase
        .from("share_links")
        .update({ revoked: true })
        .eq("id", linkId);
      if (revokeError) {
        btn.disabled = false;
        btn.textContent = "Revoke access";
        alert("Could not revoke this link. Please try again.");
        return;
      }
      render(app);
    });
  });
}
