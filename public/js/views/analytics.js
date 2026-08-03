import { supabase } from "../dataClient.js";
import { mountPage } from "../util/layout.js";
import { escapeHtml, formatDate } from "../util/dom.js";
import { navigate } from "../router.js";
import { icons } from "../util/icons.js";
import { renderBarChart, renderHBarChart, wireChartTooltip } from "../util/charts.js";
import { countUp } from "../util/countUp.js";
import { observeReveal } from "../util/reveal.js";

const MONTH_LABEL = new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" });

function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildVisitsByMonth(visits) {
  const dated = visits.filter((v) => v.visit_date);
  if (dated.length === 0) return { labels: [], values: [] };

  const counts = new Map();
  dated.forEach((v) => {
    const key = monthKey(v.visit_date);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const sortedKeys = Array.from(counts.keys()).sort();
  // Show at most the last 8 months that actually have data, so a
  // long-running account doesn't produce an unreadably wide chart.
  const shownKeys = sortedKeys.slice(-8);

  return {
    labels: shownKeys.map((k) => {
      const [y, m] = k.split("-");
      return MONTH_LABEL.format(new Date(Number(y), Number(m) - 1, 1));
    }),
    values: shownKeys.map((k) => counts.get(k)),
  };
}

function buildMedicationFrequency(visits) {
  const counts = new Map();
  visits.forEach((v) => {
    const meds = Array.isArray(v.medicines) ? v.medicines : [];
    meds.forEach((m) => {
      const name = (m.name || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      const entry = counts.get(key) || { name, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    });
  });
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

function buildPersonFrequency(visits, field) {
  const counts = new Map();
  visits.forEach((v) => {
    const name = (v[field] || "").trim();
    if (!name) return;
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export async function render(app) {
  mountPage(app, { title: "Analytics", wide: true }, `<div class="loading-row"><span class="spinner"></span> Loading your analytics...</div>`);
  const content = document.getElementById("page-content");

  const { data: userData } = await supabase.auth.getUser();
  const { data: visits, error } = await supabase
    .from("visits")
    .select("id, visit_date, hospital_name, doctor_name, medicines, record_type")
    .eq("user_id", userData.user.id)
    .order("visit_date", { ascending: true, nullsFirst: false });

  if (error) {
    content.innerHTML = `<div class="alert alert-error">Could not load your analytics. Please refresh.</div>`;
    return;
  }

  if (!visits || visits.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">${icons.barChart}</div>
        <h3>Nothing to analyze yet</h3>
        <p>Once you've logged a visit or two, this page turns your timeline into a quick health overview.</p>
        <button class="btn btn-primary" id="empty-upload-btn" style="margin-top:10px;">Upload your first record</button>
      </div>
    `;
    document.getElementById("empty-upload-btn").addEventListener("click", () => navigate("/upload"));
    return;
  }

  const hospitals = buildPersonFrequency(visits, "hospital_name");
  const doctors = buildPersonFrequency(visits, "doctor_name");
  const medications = buildMedicationFrequency(visits);
  const byMonth = buildVisitsByMonth(visits);
  const mostRecent = [...visits].reverse().find((v) => v.visit_date);

  const topMeds = medications.slice(0, 6);
  const topDoctors = doctors.slice(0, 5);
  const topHospitals = hospitals.slice(0, 5);

  content.innerHTML = `
    <h1 class="page-title">Analytics</h1>
    <p class="page-subtitle">A quick overview of your health record — built from what's already in your timeline.</p>

    <div class="stat-grid">
      <div class="stat-tile">
        <span class="icon stat-tile__icon">${icons.document}</span>
        <div class="stat-tile__value" id="stat-visits">0</div>
        <div class="stat-tile__label">Visits recorded</div>
      </div>
      <div class="stat-tile">
        <span class="icon stat-tile__icon">${icons.stethoscope}</span>
        <div class="stat-tile__value" id="stat-doctors">0</div>
        <div class="stat-tile__label">Doctors seen</div>
      </div>
      <div class="stat-tile">
        <span class="icon stat-tile__icon">${icons.building}</span>
        <div class="stat-tile__value" id="stat-hospitals">0</div>
        <div class="stat-tile__label">Hospitals / clinics</div>
      </div>
      <div class="stat-tile">
        <span class="icon stat-tile__icon">${icons.pill}</span>
        <div class="stat-tile__value" id="stat-meds">0</div>
        <div class="stat-tile__label">Medications recorded</div>
      </div>
    </div>

    ${mostRecent ? `<p class="page-subtitle" style="margin-top:20px;">Most recent visit: <strong style="color:var(--ink-900);">${formatDate(mostRecent.visit_date)}</strong> — ${escapeHtml(mostRecent.hospital_name) || "hospital not recorded"}</p>` : ""}

    <div class="analytics-grid">
      <div class="card" data-reveal style="--i:0;">
        <h3 class="chart-title">Visits over time</h3>
        ${byMonth.labels.length > 0
          ? `<div class="chart-container" id="chart-visits">${renderBarChart({ labels: byMonth.labels, values: byMonth.values })}</div>`
          : `<p style="color:var(--ink-500);">No dated visits yet.</p>`}
      </div>

      <div class="card" data-reveal style="--i:1;">
        <h3 class="chart-title">Most-recorded medications</h3>
        ${topMeds.length > 0
          ? `<div class="chart-container" id="chart-meds">${renderHBarChart({ labels: topMeds.map((m) => m.name), values: topMeds.map((m) => m.count) })}</div>`
          : `<p style="color:var(--ink-500);">No medicines recorded yet.</p>`}
      </div>
    </div>

    <div class="analytics-grid" style="margin-top:14px;">
      <div class="card" data-reveal style="--i:2;">
        <h3 class="chart-title">Doctors you've seen</h3>
        ${
          topDoctors.length > 0
            ? topDoctors
                .map(
                  (d) => `
              <div class="detail-row">
                <span class="detail-row__label">${escapeHtml(d.name)}</span>
                <span class="detail-row__value">${d.count} visit${d.count === 1 ? "" : "s"}</span>
              </div>
            `,
                )
                .join("")
            : `<p style="color:var(--ink-500);">No doctor names recorded yet.</p>`
        }
      </div>

      <div class="card" data-reveal style="--i:3;">
        <h3 class="chart-title">Hospitals & clinics</h3>
        ${
          topHospitals.length > 0
            ? topHospitals
                .map(
                  (h) => `
              <div class="detail-row">
                <span class="detail-row__label">${escapeHtml(h.name)}</span>
                <span class="detail-row__value">${h.count} visit${h.count === 1 ? "" : "s"}</span>
              </div>
            `,
                )
                .join("")
            : `<p style="color:var(--ink-500);">No hospital names recorded yet.</p>`
        }
      </div>
    </div>

    <p style="color:var(--ink-500);font-size:0.82rem;margin-top:20px;">
      Built entirely from your own recorded visits — patient-reported, not clinically verified, and nothing here is shared unless you generate a share link yourself.
    </p>
  `;

  const visitsChart = document.getElementById("chart-visits");
  if (visitsChart) wireChartTooltip(visitsChart);
  const medsChart = document.getElementById("chart-meds");
  if (medsChart) wireChartTooltip(medsChart);

  countUp(document.getElementById("stat-visits"), visits.length);
  countUp(document.getElementById("stat-doctors"), doctors.length);
  countUp(document.getElementById("stat-hospitals"), hospitals.length);
  countUp(document.getElementById("stat-meds"), medications.length);

  observeReveal(content);
}
