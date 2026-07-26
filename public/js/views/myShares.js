import { supabase } from "../dataClient.js";
import { mountPage } from "../util/layout.js";
import { escapeHtml, formatDate, formatDateTime } from "../util/dom.js";
import { navigate } from "../router.js";
import { icons } from "../util/icons.js";

function statusOf(link) {
  if (link.revoked) return { label: "Revoked", cls: "badge-muted", active: false };
  if (new Date(link.expires_at).getTime() < Date.now()) return { label: "Expired", cls: "badge-muted", active: false };
  return { label: "Active", cls: "badge-teal", active: true };
}

function scopeLabel(link) {
  if (link.scope === "single_visit") {
    return `Single visit${link.visits?.hospital_name ? ` — ${escapeHtml(link.visits.hospital_name)}` : ""}`;
  }
  if (link.scope === "selected_visits") {
    const n = Array.isArray(link.visit_ids) ? link.visit_ids.length : 0;
    return `${n} selected visit${n === 1 ? "" : "s"}`;
  }
  return "Full history";
}

// Fetches the actual visits behind a share link, for the "view contents"
// preview — lets the patient audit exactly what a link exposes before
// deciding whether to revoke it.
async function loadShareContents(link) {
  const cols = "id, visit_date, hospital_name, diagnosis_summary";
  if (link.scope === "single_visit") {
    const { data } = await supabase.from("visits").select(cols).eq("id", link.visit_id);
    return data || [];
  }
  if (link.scope === "selected_visits") {
    const ids = Array.isArray(link.visit_ids) ? link.visit_ids : [];
    if (ids.length === 0) return [];
    const { data } = await supabase.from("visits").select(cols).in("id", ids);
    return data || [];
  }
  const { data } = await supabase
    .from("visits")
    .select(cols)
    .order("visit_date", { ascending: false, nullsFirst: false });
  return data || [];
}

export async function render(app) {
  mountPage(app, { title: "My shared links", showBack: true, wide: true }, `<div class="loading-row"><span class="spinner"></span> Loading...</div>`);
  const content = document.getElementById("page-content");

  const { data: links, error } = await supabase
    .from("share_links")
    .select("id, token, scope, created_at, expires_at, revoked, visit_id, visit_ids, visits(hospital_name, visit_date)")
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

  let tab = "active"; // 'active' | 'past'

  function paint() {
    const activeLinks = links.filter((l) => statusOf(l).active);
    const pastLinks = links.filter((l) => !statusOf(l).active);
    const visible = tab === "active" ? activeLinks : pastLinks;

    content.innerHTML = `
      <h1 class="page-title">My shared links</h1>
      <p class="page-subtitle">Every link you've generated, and who can currently see it.</p>

      <div class="auth-tabs" style="margin-bottom:18px;">
        <button type="button" class="auth-tab ${tab === "active" ? "active" : ""}" data-tab="active">Active (${activeLinks.length})</button>
        <button type="button" class="auth-tab ${tab === "past" ? "active" : ""}" data-tab="past">Expired / revoked (${pastLinks.length})</button>
      </div>

      ${
        visible.length === 0
          ? `<p style="color:var(--ink-500);text-align:center;padding:24px 0;">${tab === "active" ? "No active shares right now." : "Nothing here yet."}</p>`
          : `<div class="card-grid">
              ${visible
                .map((link, i) => {
                  const status = statusOf(link);
                  const canRevoke = status.active;
                  return `
                    <div class="card share-link-card" data-link-id="${link.id}" style="--i:${i};">
                      <div class="flex-between">
                        <strong>${scopeLabel(link)}</strong>
                        <span class="badge ${status.cls}">${status.label}</span>
                      </div>
                      <div class="detail-row"><span class="detail-row__label">Created</span><span class="detail-row__value">${formatDateTime(link.created_at)}</span></div>
                      <div class="detail-row"><span class="detail-row__label">Expires</span><span class="detail-row__value">${formatDateTime(link.expires_at)}</span></div>

                      <button class="image-toggle view-contents-btn" data-link-id="${link.id}" aria-expanded="false" style="margin-top:12px;">
                        <span>View contents</span><span class="icon">${icons.chevronDown}</span>
                      </button>
                      <div class="share-contents collapse-panel" data-link-id="${link.id}" style="margin-top:10px;"></div>

                      ${canRevoke ? `<button class="btn btn-danger btn-block revoke-btn" style="margin-top:12px;">Revoke access</button>` : ""}
                    </div>
                  `;
                })
                .join("")}
            </div>`
      }
    `;

    content.querySelectorAll(".auth-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        tab = btn.dataset.tab;
        paint();
      });
    });

    content.querySelectorAll(".view-contents-btn").forEach((btn) => {
      let loaded = false;
      btn.addEventListener("click", async () => {
        const linkId = btn.dataset.linkId;
        const panel = content.querySelector(`.share-contents[data-link-id="${linkId}"]`);
        const willOpen = !panel.classList.contains("is-open");
        panel.classList.toggle("is-open", willOpen);
        btn.setAttribute("aria-expanded", String(willOpen));
        if (willOpen && !loaded) {
          panel.innerHTML = `<div class="loading-row" style="padding:16px 0;"><span class="spinner"></span></div>`;
          const link = links.find((l) => l.id === linkId);
          const visits = await loadShareContents(link);
          panel.innerHTML = visits.length
            ? visits
                .map(
                  (v) => `
                <div class="detail-row">
                  <span class="detail-row__label">${formatDate(v.visit_date)}</span>
                  <span class="detail-row__value">${escapeHtml(v.hospital_name) || "Hospital not recorded"}${v.diagnosis_summary ? ` — ${escapeHtml(v.diagnosis_summary)}` : ""}</span>
                </div>
              `,
                )
                .join("")
            : `<p style="color:var(--ink-500);font-size:0.88rem;">No records in this share.</p>`;
          loaded = true;
        }
      });
    });

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

  paint();
}
