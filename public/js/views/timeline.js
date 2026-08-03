import { supabase } from "../dataClient.js";
import { mountPage } from "../util/layout.js";
import { escapeHtml, formatDate } from "../util/dom.js";
import { navigate } from "../router.js";
import { icons } from "../util/icons.js";
import { recordTypeMeta } from "../util/recordTypes.js";

export async function render(app) {
  mountPage(app, { title: "Timeline", wide: true }, `<div class="loading-row"><span class="spinner"></span> Loading your timeline...</div>`);

  const { data: userData } = await supabase.auth.getUser();
  const { data: visits, error } = await supabase
    .from("visits")
    .select("id, visit_date, hospital_name, doctor_name, diagnosis_summary, record_type")
    .eq("user_id", userData.user.id)
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
        <div class="empty-state__icon">${icons.document}</div>
        <h3>No records yet</h3>
        <p>Upload a photo of a prescription or report to build your health timeline.</p>
        <button class="btn btn-primary" id="empty-upload-btn" style="margin-top:10px;">Upload your first record</button>
      </div>
    `;
    document.getElementById("empty-upload-btn").addEventListener("click", () => navigate("/upload"));
    return;
  }

  let selectMode = false;
  const selectedIds = new Set();

  function paint() {
    const canSelect = visits.length >= 2;

    const cards = visits
      .map((v, i) => {
        const typeMeta = recordTypeMeta(v.record_type);
        const inner = `
          <div class="visit-card__row">
            <span class="visit-card__date">${formatDate(v.visit_date)}</span>
            ${typeMeta ? `<span class="record-type-badge"><span class="icon">${icons[typeMeta.icon]}</span>${typeMeta.label}</span>` : ""}
          </div>
          <div class="visit-card__hospital">${escapeHtml(v.hospital_name) || "Hospital not recorded"}</div>
          <p class="visit-card__summary">${escapeHtml(v.diagnosis_summary) || "No summary recorded"}</p>
        `;

        if (selectMode) {
          const checked = selectedIds.has(v.id);
          return `
            <label class="card visit-card visit-card--selectable ${checked ? "is-checked" : ""}" data-visit-id="${v.id}" style="--i:${i};">
              <input type="checkbox" class="visit-select-checkbox" data-visit-id="${v.id}" ${checked ? "checked" : ""} />
              <div class="visit-card__content">${inner}</div>
            </label>
          `;
        }

        return `
          <a class="card visit-card" href="#/visit/${v.id}" style="--i:${i};">${inner}</a>
        `;
      })
      .join("");

    const selectToggle = canSelect
      ? `<button class="btn btn-ghost" id="select-toggle-btn">${selectMode ? "Cancel" : "Select"}</button>`
      : "";

    content.innerHTML = `
      <div class="flex-between" style="margin-bottom:20px;">
        <div>
          <h1 class="page-title mt-0">Your timeline</h1>
          <p class="page-subtitle mb-0">${visits.length} visit${visits.length === 1 ? "" : "s"} recorded</p>
        </div>
        ${selectToggle}
      </div>
      <div class="card-grid">${cards}</div>
      <div style="position:sticky;bottom:16px;margin-top:24px;">
        ${
          selectMode
            ? `<button class="btn btn-primary btn-block" id="share-selected-btn" ${selectedIds.size === 0 ? "disabled" : ""}>Share ${selectedIds.size} selected</button>`
            : `<button class="btn btn-primary btn-block" id="upload-btn">+ Upload a visit</button>`
        }
      </div>
    `;

    const selectBtn = document.getElementById("select-toggle-btn");
    if (selectBtn) {
      selectBtn.addEventListener("click", () => {
        selectMode = !selectMode;
        if (!selectMode) selectedIds.clear();
        paint();
      });
    }

    if (selectMode) {
      content.querySelectorAll(".visit-select-checkbox").forEach((cb) => {
        cb.addEventListener("change", () => {
          const id = cb.dataset.visitId;
          if (cb.checked) selectedIds.add(id);
          else selectedIds.delete(id);
          paint();
        });
      });
      const shareBtn = document.getElementById("share-selected-btn");
      if (shareBtn) {
        shareBtn.addEventListener("click", () => {
          if (selectedIds.size === 0) return;
          navigate(`/share?ids=${Array.from(selectedIds).join(",")}`);
        });
      }
    } else {
      const uploadBtn = document.getElementById("upload-btn");
      if (uploadBtn) uploadBtn.addEventListener("click", () => navigate("/upload"));
    }
  }

  paint();
}
