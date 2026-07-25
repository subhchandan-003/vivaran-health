import { supabase } from "../dataClient.js";
import { mountPage } from "../util/layout.js";
import { escapeHtml } from "../util/dom.js";
import { navigate } from "../router.js";
import { icons } from "../util/icons.js";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.substring(result.indexOf(",") + 1);
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function render(app) {
  let selectedFile = null;
  let extracted = null;
  let confidenceFlags = [];
  let medicines = [];

  function paintDropzone(errorMessage = "") {
    mountPage(
      app,
      { title: "Upload" },
      `
      <h1 class="page-title">Upload a visit record</h1>
      <p class="page-subtitle">Photograph a prescription or report — we'll pull out the details for you to review.</p>
      ${errorMessage ? `<div class="alert alert-error">${escapeHtml(errorMessage)}</div>` : ""}
      <label class="upload-dropzone" for="file-input">
        <div class="icon">${icons.camera}</div>
        <div style="font-weight:600;color:var(--ink-900);margin-top:8px;">Tap to choose a photo or PDF page image</div>
        <div style="font-size:0.82rem;margin-top:4px;">JPEG, PNG, or WEBP</div>
      </label>
      <input type="file" id="file-input" accept="image/*" capture="environment" style="display:none;" />
    `,
    );

    document.getElementById("file-input").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      selectedFile = file;
      await paintExtracting(file);
    });
  }

  async function paintExtracting(file) {
    const previewUrl = URL.createObjectURL(file);
    mountPage(
      app,
      { title: "Upload", showBack: true },
      `
      <h1 class="page-title">Reading your document...</h1>
      <img class="image-preview" src="${previewUrl}" alt="Selected document" />
      <div class="loading-row"><span class="spinner"></span> This usually takes 10-15 seconds</div>
    `,
    );

    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("extract-record", {
        body: { image_base64: base64, media_type: file.type || "image/jpeg" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      extracted = data;
      confidenceFlags = Array.isArray(data.confidence_flags) ? data.confidence_flags : [];
      medicines = Array.isArray(data.medicines) ? data.medicines : [];
      const infoMessage = data.local_mode
        ? "Running in local demo mode — AI extraction is simulated. Enter the details below yourself; connect Supabase later for real extraction."
        : "";
      paintForm(previewUrl, "", infoMessage);
    } catch (err) {
      // Extraction failing should never block the patient — fall back to a
      // blank editable form so they can enter details manually.
      extracted = {
        visit_date: null,
        hospital_name: null,
        doctor_name: null,
        diagnosis_summary: null,
        notes: null,
      };
      confidenceFlags = [];
      medicines = [];
      paintForm(previewUrl, "We couldn't auto-read this image. You can still fill in the details below.");
    }
  }

  function fieldClass(name) {
    return confidenceFlags.includes(name) ? "field field--low-confidence" : "field";
  }

  function fieldHint(name) {
    return confidenceFlags.includes(name)
      ? `<div class="field__hint field__hint--warn">Low confidence — please double-check this field</div>`
      : "";
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

  function paintForm(previewUrl, warningMessage = "", infoMessage = "") {
    mountPage(
      app,
      { title: "Review", showBack: true },
      `
      <h1 class="page-title">Review the details</h1>
      <p class="page-subtitle">Correct anything that's wrong before saving. Fields highlighted in amber were low-confidence reads.</p>
      ${infoMessage ? `<div class="alert alert-info">${escapeHtml(infoMessage)}</div>` : ""}
      ${warningMessage ? `<div class="alert alert-warn">${escapeHtml(warningMessage)}</div>` : ""}
      <img class="image-preview" src="${previewUrl}" alt="Selected document" />

      <form id="review-form">
        <div class="${fieldClass("visit_date")}">
          <label for="visit_date">Visit date</label>
          <input type="date" id="visit_date" value="${escapeHtml(extracted.visit_date || "")}" />
          ${fieldHint("visit_date")}
        </div>
        <div class="${fieldClass("hospital_name")}">
          <label for="hospital_name">Hospital / clinic</label>
          <input type="text" id="hospital_name" value="${escapeHtml(extracted.hospital_name || "")}" />
          ${fieldHint("hospital_name")}
        </div>
        <div class="${fieldClass("doctor_name")}">
          <label for="doctor_name">Doctor</label>
          <input type="text" id="doctor_name" value="${escapeHtml(extracted.doctor_name || "")}" />
          ${fieldHint("doctor_name")}
        </div>
        <div class="${fieldClass("diagnosis_summary")}">
          <label for="diagnosis_summary">Diagnosis summary</label>
          <textarea id="diagnosis_summary">${escapeHtml(extracted.diagnosis_summary || "")}</textarea>
          ${fieldHint("diagnosis_summary")}
        </div>

        <div class="field ${confidenceFlags.includes("medicines") ? "field--low-confidence" : ""}">
          <label>Medicines</label>
          <div id="medicines-list">${renderMedicineRows()}</div>
          <button type="button" class="btn btn-ghost" id="add-med-btn">+ Add medicine</button>
          ${fieldHint("medicines")}
        </div>

        <div class="${fieldClass("notes")}">
          <label for="notes">Notes</label>
          <textarea id="notes">${escapeHtml(extracted.notes || "")}</textarea>
          ${fieldHint("notes")}
        </div>

        <button type="submit" class="btn btn-primary btn-block" id="save-btn">Save to timeline</button>
      </form>
    `,
    );

    document.getElementById("add-med-btn").addEventListener("click", () => {
      medicines.push({ name: "", dosage: "" });
      syncMedicinesFromForm(false);
      document.getElementById("medicines-list").innerHTML = renderMedicineRows();
      wireMedicineRemovers();
    });

    wireMedicineRemovers();

    document.getElementById("review-form").addEventListener("submit", (e) => handleSave(e, previewUrl));
  }

  function wireMedicineRemovers() {
    document.querySelectorAll(".med-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = btn.closest("[data-med-row]");
        const idx = Number(row.dataset.medRow);
        syncMedicinesFromForm(false);
        medicines.splice(idx, 1);
        document.getElementById("medicines-list").innerHTML = renderMedicineRows();
        wireMedicineRemovers();
      });
    });
  }

  function syncMedicinesFromForm(useDom = true) {
    if (!useDom) return;
    const rows = document.querySelectorAll("[data-med-row]");
    medicines = Array.from(rows).map((row) => ({
      name: row.querySelector(".med-name").value.trim(),
      dosage: row.querySelector(".med-dosage").value.trim(),
    }));
  }

  async function handleSave(e, previewUrl) {
    e.preventDefault();
    syncMedicinesFromForm(true);

    const saveBtn = document.getElementById("save-btn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user.id;

      let raw_file_path = null;
      if (selectedFile) {
        const ext = (selectedFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(path, selectedFile, { contentType: selectedFile.type || "image/jpeg" });
        if (uploadError) throw uploadError;
        raw_file_path = path;
      }

      const payload = {
        user_id: userId,
        visit_date: document.getElementById("visit_date").value || null,
        hospital_name: document.getElementById("hospital_name").value.trim() || null,
        doctor_name: document.getElementById("doctor_name").value.trim() || null,
        diagnosis_summary: document.getElementById("diagnosis_summary").value.trim() || null,
        medicines: medicines.filter((m) => m.name || m.dosage),
        notes: document.getElementById("notes").value.trim() || null,
        raw_file_path,
        confidence_flags: confidenceFlags,
      };

      const { data: inserted, error: insertError } = await supabase
        .from("visits")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) throw insertError;

      navigate(`/visit/${inserted.id}`);
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save to timeline";
      alert(err.message || "Could not save this record. Please try again.");
    }
  }

  paintDropzone();
}
