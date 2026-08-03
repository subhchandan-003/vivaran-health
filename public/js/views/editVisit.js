import { supabase } from "../dataClient.js";
import { mountPage } from "../util/layout.js";
import { escapeHtml } from "../util/dom.js";
import { navigate } from "../router.js";
import { icons } from "../util/icons.js";
import { RECORD_TYPES } from "../util/recordTypes.js";

export async function render(app, visitId) {
  mountPage(app, { title: "Edit visit", showBack: true }, `<div class="loading-row"><span class="spinner"></span> Loading...</div>`);
  const content = document.getElementById("page-content");

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user.id;
  const { data: visit, error } = await supabase
    .from("visits")
    .select("*")
    .eq("id", visitId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !visit) {
    content.innerHTML = `<div class="alert alert-error">This record could not be found.</div>`;
    return;
  }

  let medicines = Array.isArray(visit.medicines) ? visit.medicines.map((m) => ({ ...m })) : [];

  let previewUrl = null;
  if (visit.raw_file_path) {
    const { data: signed } = await supabase.storage.from("documents").createSignedUrl(visit.raw_file_path, 60 * 10);
    previewUrl = signed?.signedUrl || null;
  }

  function renderMedicineRows() {
    if (medicines.length === 0) {
      return `<p style="color:var(--ink-500);font-size:0.9rem;">No medicines added yet.</p>`;
    }
    return medicines
      .map(
        (m, i) => `
      <div class="card" style="padding:12px 14px;margin-bottom:8px;" data-med-row="${i}">
        <div style="display:flex;gap:8px;">
          <input type="text" class="med-name" placeholder="Medicine name" value="${escapeHtml(m.name || "")}" style="flex:1;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;" />
          <input type="text" class="med-dosage" placeholder="Dosage" value="${escapeHtml(m.dosage || "")}" style="flex:1;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;" />
          <button type="button" class="icon-btn med-remove" aria-label="Remove medicine">${icons.close}</button>
        </div>
      </div>
    `,
      )
      .join("");
  }

  function wireMedicineRemovers() {
    document.querySelectorAll(".med-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = btn.closest("[data-med-row]");
        const idx = Number(row.dataset.medRow);
        syncMedicinesFromForm();
        medicines.splice(idx, 1);
        document.getElementById("medicines-list").innerHTML = renderMedicineRows();
        wireMedicineRemovers();
      });
    });
  }

  function syncMedicinesFromForm() {
    const rows = document.querySelectorAll("[data-med-row]");
    medicines = Array.from(rows).map((row) => ({
      name: row.querySelector(".med-name").value.trim(),
      dosage: row.querySelector(".med-dosage").value.trim(),
    }));
  }

  function paint() {
    content.innerHTML = `
      <h1 class="page-title">Edit visit</h1>
      <p class="page-subtitle">Update any details below — changes save to this record right away.</p>

      ${previewUrl ? `<img class="image-preview" src="${previewUrl}" alt="Original document" />` : ""}

      <form id="edit-form">
        <div class="field">
          <label for="record_type">Record type</label>
          <select id="record_type">
            <option value="">Not specified</option>
            ${RECORD_TYPES.map((t) => `<option value="${t.value}" ${visit.record_type === t.value ? "selected" : ""}>${t.label}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="visit_date">Visit date</label>
          <input type="date" id="visit_date" value="${escapeHtml(visit.visit_date || "")}" />
        </div>
        <div class="field">
          <label for="hospital_name">Hospital / clinic</label>
          <input type="text" id="hospital_name" value="${escapeHtml(visit.hospital_name || "")}" />
        </div>
        <div class="field">
          <label for="doctor_name">Doctor</label>
          <input type="text" id="doctor_name" value="${escapeHtml(visit.doctor_name || "")}" />
        </div>
        <div class="field">
          <label for="diagnosis_summary">Diagnosis summary</label>
          <textarea id="diagnosis_summary">${escapeHtml(visit.diagnosis_summary || "")}</textarea>
        </div>

        <div class="field">
          <label>Medicines</label>
          <div id="medicines-list">${renderMedicineRows()}</div>
          <button type="button" class="btn btn-ghost" id="add-med-btn">+ Add medicine</button>
        </div>

        <div class="field">
          <label for="notes">Notes</label>
          <textarea id="notes">${escapeHtml(visit.notes || "")}</textarea>
        </div>

        <div class="action-row">
          <button type="button" class="btn btn-secondary" id="cancel-btn">Cancel</button>
          <button type="submit" class="btn btn-primary" id="save-btn">Save changes</button>
        </div>
      </form>
    `;

    document.getElementById("add-med-btn").addEventListener("click", () => {
      syncMedicinesFromForm();
      medicines.push({ name: "", dosage: "" });
      document.getElementById("medicines-list").innerHTML = renderMedicineRows();
      wireMedicineRemovers();
    });

    document.getElementById("cancel-btn").addEventListener("click", () => navigate(`/visit/${visitId}`));

    wireMedicineRemovers();

    document.getElementById("edit-form").addEventListener("submit", handleSave);
  }

  async function handleSave(e) {
    e.preventDefault();
    syncMedicinesFromForm();

    const saveBtn = document.getElementById("save-btn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    const payload = {
      record_type: document.getElementById("record_type").value || null,
      visit_date: document.getElementById("visit_date").value || null,
      hospital_name: document.getElementById("hospital_name").value.trim() || null,
      doctor_name: document.getElementById("doctor_name").value.trim() || null,
      diagnosis_summary: document.getElementById("diagnosis_summary").value.trim() || null,
      medicines: medicines.filter((m) => m.name || m.dosage),
      notes: document.getElementById("notes").value.trim() || null,
    };

    const { error: updateError } = await supabase.from("visits").update(payload).eq("id", visitId).eq("user_id", userId);

    if (updateError) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save changes";
      alert(updateError.message || "Could not save your changes. Please try again.");
      return;
    }

    navigate(`/visit/${visitId}`);
  }

  paint();
}
