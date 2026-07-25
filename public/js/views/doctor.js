import { supabase } from "../supabaseClient.js";
import { escapeHtml, formatDate } from "../util/dom.js";
import { navigate } from "../router.js";

function shellHtml(innerHtml) {
  return `
    <div class="doctor-shell">
      <div class="doctor-banner">Vivaran Health — shared record viewer</div>
      <main class="page"><div class="container">${innerHtml}</div></main>
    </div>
  `;
}

export async function render(app, token) {
  if (!token) {
    app.innerHTML = shellHtml(`
      <h1 class="page-title">View a shared record</h1>
      <p class="page-subtitle">Enter the code the patient shared with you, or scan their QR code.</p>
      <div class="field">
        <label for="token-input">Share code</label>
        <input type="text" id="token-input" autocomplete="off" />
      </div>
      <button class="btn btn-primary btn-block" id="view-btn">View record</button>
    `);
    document.getElementById("view-btn").addEventListener("click", () => {
      const value = document.getElementById("token-input").value.trim();
      if (value) navigate(`/doctor?token=${encodeURIComponent(value)}`);
    });
    return;
  }

  app.innerHTML = shellHtml(`<div class="loading-row"><span class="spinner"></span> Loading shared record...</div>`);

  const { data, error } = await supabase.functions.invoke("resolve-share", { body: { token } });

  if (error || !data || !data.active) {
    app.innerHTML = shellHtml(`
      <div class="empty-state">
        <div class="empty-state__icon">&#128274;</div>
        <h3>This link is no longer active</h3>
        <p>${escapeHtml(data?.message) || "It may have expired or been revoked by the patient."}</p>
      </div>
    `);
    return;
  }

  const visits = data.visits || [];

  if (visits.length === 0) {
    app.innerHTML = shellHtml(`
      <div class="empty-state">
        <div class="empty-state__icon">&#128203;</div>
        <h3>No records in this share</h3>
      </div>
    `);
    return;
  }

  const visitsHtml = visits.map(renderVisit).join("");

  app.innerHTML = shellHtml(`
    <h1 class="page-title">Shared health record${visits.length > 1 ? "s" : ""}</h1>
    <div class="disclaimer-note">Patient-reported, not clinically verified.</div>
    ${visitsHtml}
  `);

  document.querySelectorAll("[data-toggle-image]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const container = document.getElementById(btn.dataset.toggleImage);
      container.style.display = container.style.display === "none" ? "block" : "none";
    });
  });
}

function renderVisit(visit) {
  const medicines = Array.isArray(visit.medicines) ? visit.medicines : [];
  const medicineRows = medicines.length
    ? medicines
        .map(
          (m) => `
        <div class="medicine-item">
          <span>${escapeHtml(m.name) || "Unnamed"}</span>
          <span style="color:var(--ink-500);">${escapeHtml(m.dosage) || "—"}</span>
        </div>
      `,
        )
        .join("")
    : `<p style="color:var(--ink-500);">No medicines recorded.</p>`;

  const imageContainerId = `img-${visit.id}`;

  return `
    <div class="card" style="margin-bottom:16px;">
      <div class="visit-card__date">${formatDate(visit.visit_date)}</div>
      <div class="visit-card__hospital">${escapeHtml(visit.hospital_name) || "Hospital not recorded"}</div>

      <div class="detail-row">
        <span class="detail-row__label">Doctor</span>
        <span class="detail-row__value">${escapeHtml(visit.doctor_name) || "Not recorded"}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row__label">Diagnosis</span>
        <span class="detail-row__value">${escapeHtml(visit.diagnosis_summary) || "Not recorded"}</span>
      </div>

      <h4 style="margin:16px 0 6px;">Medicines</h4>
      ${medicineRows}

      ${visit.notes ? `<h4 style="margin:16px 0 6px;">Notes</h4><p>${escapeHtml(visit.notes)}</p>` : ""}

      ${visit.image_url ? `
        <button class="image-toggle" data-toggle-image="${imageContainerId}" style="margin-top:16px;">
          <span>View original document</span><span>&#8595;</span>
        </button>
        <div id="${imageContainerId}" style="display:none;margin-top:10px;">
          <img class="image-preview" src="${visit.image_url}" alt="Original document" />
        </div>
      ` : ""}
    </div>
  `;
}
