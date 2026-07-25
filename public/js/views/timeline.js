import { supabase } from "../dataClient.js";
import { mountPage } from "../util/layout.js";
import { escapeHtml, formatDate } from "../util/dom.js";
import { navigate } from "../router.js";

export async function render(app) {
  mountPage(app, { title: "Timeline" }, `<div class="loading-row"><span class="spinner"></span> Loading your timeline...</div>`);

  const { data: visits, error } = await supabase
    .from("visits")
    .select("id, visit_date, hospital_name, doctor_name, diagnosis_summary")
    .order("visit_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const content = document.getElementById("page-content");

  if (error) {
    content.innerHTML = `<div class="alert alert-error">Could not load your timeline. Please refresh.</div>`;
    return;
  }

  if (!visits || visits.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">&#128203;</div>
        <h3>No records yet</h3>
        <p>Upload a photo of a prescription or report to build your health timeline.</p>
        <button class="btn btn-primary" id="empty-upload-btn" style="margin-top:10px;">Upload your first record</button>
      </div>
    `;
    document.getElementById("empty-upload-btn").addEventListener("click", () => navigate("/upload"));
    return;
  }

  const cards = visits
    .map(
      (v) => `
      <a class="card visit-card" href="#/visit/${v.id}">
        <div class="visit-card__row">
          <span class="visit-card__date">${formatDate(v.visit_date)}</span>
        </div>
        <div class="visit-card__hospital">${escapeHtml(v.hospital_name) || "Hospital not recorded"}</div>
        <p class="visit-card__summary">${escapeHtml(v.diagnosis_summary) || "No summary recorded"}</p>
      </a>
    `,
    )
    .join("");

  content.innerHTML = `
    <div class="flex-between" style="margin-bottom:20px;">
      <div>
        <h1 class="page-title mt-0">Your timeline</h1>
        <p class="page-subtitle mb-0">${visits.length} visit${visits.length === 1 ? "" : "s"} recorded</p>
      </div>
    </div>
    <div class="stack" style="gap:0;">${cards}</div>
    <div style="position:sticky;bottom:16px;margin-top:24px;">
      <button class="btn btn-primary btn-block" id="upload-btn">+ Upload a visit</button>
    </div>
  `;

  document.getElementById("upload-btn").addEventListener("click", () => navigate("/upload"));
}
