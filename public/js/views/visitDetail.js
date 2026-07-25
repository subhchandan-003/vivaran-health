import { supabase } from "../supabaseClient.js";
import { mountPage } from "../util/layout.js";
import { escapeHtml, formatDate } from "../util/dom.js";
import { navigate } from "../router.js";

export async function render(app, visitId) {
  mountPage(app, { title: "Visit", showBack: true }, `<div class="loading-row"><span class="spinner"></span> Loading...</div>`);

  const { data: visit, error } = await supabase
    .from("visits")
    .select("*")
    .eq("id", visitId)
    .maybeSingle();

  const content = document.getElementById("page-content");

  if (error || !visit) {
    content.innerHTML = `<div class="alert alert-error">This record could not be found.</div>`;
    return;
  }

  const medicines = Array.isArray(visit.medicines) ? visit.medicines : [];
  const flags = Array.isArray(visit.confidence_flags) ? visit.confidence_flags : [];

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

  content.innerHTML = `
    <h1 class="page-title">${escapeHtml(visit.hospital_name) || "Visit record"}</h1>
    <p class="page-subtitle">${formatDate(visit.visit_date)}</p>

    ${flags.length ? `<div class="alert alert-warn">Some fields on this record were low-confidence reads: ${escapeHtml(flags.join(", "))}.</div>` : ""}

    <div class="card">
      <div class="detail-row">
        <span class="detail-row__label">Doctor</span>
        <span class="detail-row__value">${escapeHtml(visit.doctor_name) || "Not recorded"}</span>
      </div>
      <div class="detail-row">
        <span class="detail-row__label">Diagnosis</span>
        <span class="detail-row__value">${escapeHtml(visit.diagnosis_summary) || "Not recorded"}</span>
      </div>
    </div>

    <h3 style="margin:22px 0 8px;">Medicines</h3>
    <div class="card">${medicineRows}</div>

    ${visit.notes ? `
      <h3 style="margin:22px 0 8px;">Notes</h3>
      <div class="card">${escapeHtml(visit.notes)}</div>
    ` : ""}

    ${visit.raw_file_path ? `
      <button class="image-toggle" id="toggle-image-btn" style="margin-top:20px;">
        <span>View original document</span><span>&#8595;</span>
      </button>
      <div id="image-container" style="display:none;margin-top:12px;"></div>
    ` : ""}

    <div class="action-row">
      <button class="btn btn-secondary" id="share-btn">Share</button>
      <button class="btn btn-danger" id="delete-btn">Delete</button>
    </div>
  `;

  const toggleBtn = document.getElementById("toggle-image-btn");
  if (toggleBtn) {
    let loaded = false;
    toggleBtn.addEventListener("click", async () => {
      const container = document.getElementById("image-container");
      const isHidden = container.style.display === "none";
      container.style.display = isHidden ? "block" : "none";
      if (isHidden && !loaded) {
        const { data: signed } = await supabase.storage
          .from("documents")
          .createSignedUrl(visit.raw_file_path, 60 * 10);
        if (signed?.signedUrl) {
          container.innerHTML = `<img class="image-preview" src="${signed.signedUrl}" alt="Original document" />`;
          loaded = true;
        } else {
          container.innerHTML = `<div class="alert alert-error">Could not load the original image.</div>`;
        }
      }
    });
  }

  document.getElementById("share-btn").addEventListener("click", () => navigate(`/share/${visit.id}`));

  document.getElementById("delete-btn").addEventListener("click", () => confirmDelete(visit));
}

function confirmDelete(visit) {
  const modalHost = document.createElement("div");
  modalHost.className = "modal-backdrop";
  modalHost.innerHTML = `
    <div class="modal-box">
      <h3>Delete this record?</h3>
      <p style="color:var(--ink-700);">This permanently removes the record and its original image, and immediately revokes any active shares that include it. This can't be undone.</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="cancel-delete">Cancel</button>
        <button class="btn btn-danger" id="confirm-delete">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalHost);

  modalHost.querySelector("#cancel-delete").addEventListener("click", () => modalHost.remove());

  modalHost.querySelector("#confirm-delete").addEventListener("click", async () => {
    const btn = modalHost.querySelector("#confirm-delete");
    btn.disabled = true;
    btn.textContent = "Deleting...";
    try {
      if (visit.raw_file_path) {
        await supabase.storage.from("documents").remove([visit.raw_file_path]);
      }
      const { error } = await supabase.from("visits").delete().eq("id", visit.id);
      if (error) throw error;
      modalHost.remove();
      navigate("/timeline");
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Delete";
      alert(err.message || "Could not delete this record.");
    }
  });
}
