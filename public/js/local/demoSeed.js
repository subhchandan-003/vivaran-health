// Seeds a rich, deterministic demo account directly into the local mock's
// tables — a separate account from the blank "Quick log in" test user, so a
// genuine empty-state/fresh-signup flow is still demonstrable alongside a
// fully-populated one. Tells one patient's story across multiple cities,
// hospitals, doctors, dates, and record types.
//
// Re-running this (e.g. clicking "Explore with demo data" more than once)
// wipes and re-inserts the canonical dataset rather than accumulating
// duplicates, and never touches any other account's rows (Phase 0's
// user_id-scoped reads/writes keep this fully isolated).
import { readTable, writeTable, uuid } from "./store.js";

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_EMAIL = "demo.patient@vivaran.local";
export const DEMO_PASSWORD = "DemoPass123!";
const DEMO_NAME = "Ananya Verma";

// Days-ago offsets so the story always reads as "recent history" relative to
// whenever the demo is run, rather than drifting into the past on a fixed
// calendar. Spans roughly 15 months.
const VISITS = [
  { daysAgo: 3, hospital: "Fortis Hospital, Bengaluru", doctor: "Dr. Meera Nair", record_type: "consultation",
    diagnosis: "Follow-up for mild hypertension — blood pressure trending down on current medication.",
    medicines: [{ name: "Amlodipine", dosage: "5mg, once daily" }],
    notes: "Continue current dose. Re-check BP in 6 weeks. Reduce salt intake." },

  { daysAgo: 18, hospital: "SRL Diagnostics, Bengaluru", doctor: "Dr. Arjun Rao", record_type: "lab_report",
    diagnosis: "Routine blood work — lipid panel and HbA1c within normal range.",
    medicines: [],
    notes: "Fasting glucose 94 mg/dL, LDL 108 mg/dL, HbA1c 5.4%. No action needed." },

  { daysAgo: 40, hospital: "Apollo Hospital, Chennai", doctor: "Dr. Kavita Iyer", record_type: "prescription",
    diagnosis: "Seasonal allergic rhinitis with mild skin irritation.",
    medicines: [{ name: "Cetirizine", dosage: "10mg, once daily at night" }, { name: "Calamine lotion", dosage: "apply twice daily" }],
    notes: "Avoid known allergens. Follow up only if symptoms persist beyond 2 weeks.",
    confidence_flags: ["doctor_name"] },

  { daysAgo: 65, hospital: "AIIMS, New Delhi", doctor: "Dr. Rohan Gupta", record_type: "consultation",
    diagnosis: "Viral fever with body ache, resolving.",
    medicines: [{ name: "Paracetamol", dosage: "650mg, thrice daily as needed" }],
    notes: "Rest and hydration advised. No red-flag symptoms." },

  { daysAgo: 90, hospital: "Manipal Hospital, Pune", doctor: "Dr. Sanjay Mehta", record_type: "imaging",
    diagnosis: "Chest X-ray — clear lung fields, no acute findings.",
    medicines: [],
    notes: "Ordered to rule out infection after persistent cough. Report clear." },

  { daysAgo: 120, hospital: "Fortis Hospital, Bengaluru", doctor: "Dr. Meera Nair", record_type: "consultation",
    diagnosis: "Initial evaluation for elevated blood pressure readings at home.",
    medicines: [{ name: "Amlodipine", dosage: "5mg, once daily" }],
    notes: "Started on antihypertensive. Home BP monitoring advised twice daily." },

  { daysAgo: 150, hospital: "Kokilaben Dhirubhai Ambani Hospital, Mumbai", doctor: "Dr. Priya Menon", record_type: "consultation",
    diagnosis: "Recurrent migraine, likely stress-triggered.",
    medicines: [{ name: "Rizatriptan", dosage: "10mg, at onset of headache" }],
    notes: "Keep a headache diary. Follow up if frequency increases.",
    confidence_flags: ["medicines"] },

  { daysAgo: 180, hospital: "Apollo Hospital, Chennai", doctor: "Dr. Arjun Rao", record_type: "lab_report",
    diagnosis: "Vitamin D deficiency identified on annual panel.",
    medicines: [{ name: "Vitamin D3", dosage: "60,000 IU, once weekly for 8 weeks" }],
    notes: "Re-test levels after supplementation course." },

  { daysAgo: 210, hospital: "AIIMS, New Delhi", doctor: "Dr. Rohan Gupta", record_type: "vaccination",
    diagnosis: "Annual influenza vaccination administered.",
    medicines: [],
    notes: "No adverse reaction observed. Next dose due in 12 months." },

  { daysAgo: 250, hospital: "Manipal Hospital, Pune", doctor: "Dr. Sanjay Mehta", record_type: "consultation",
    diagnosis: "Lower back strain from travel — mechanical, no red flags.",
    medicines: [{ name: "Aceclofenac", dosage: "100mg, twice daily for 5 days" }],
    notes: "Physiotherapy referral given. Avoid heavy lifting for 2 weeks." },

  { daysAgo: 290, hospital: "Fortis Hospital, Bengaluru", doctor: "Dr. Kavita Iyer", record_type: "other",
    diagnosis: "Annual full-body health checkup — overall results satisfactory.",
    medicines: [],
    notes: "Recommended to continue current diet and exercise routine." },

  { daysAgo: 330, hospital: "Apollo Hospital, Chennai", doctor: "Dr. Priya Menon", record_type: "prescription",
    diagnosis: "Acute sinusitis with nasal congestion.",
    medicines: [{ name: "Amoxicillin", dosage: "500mg, thrice daily for 7 days" }, { name: "Nasal saline spray", dosage: "as needed" }],
    notes: "Complete full antibiotic course even if symptoms improve early." },

  { daysAgo: 380, hospital: "AIIMS, New Delhi", doctor: "Dr. Arjun Rao", record_type: "lab_report",
    diagnosis: "Thyroid function panel — mildly elevated TSH, within borderline range.",
    medicines: [],
    notes: "Monitor with a repeat test in 6 months; no treatment started yet." },

  { daysAgo: 410, hospital: "Kokilaben Dhirubhai Ambani Hospital, Mumbai", doctor: "Dr. Meera Nair", record_type: "imaging",
    diagnosis: "Routine dental X-ray, no cavities detected.",
    medicines: [],
    notes: "Next dental checkup recommended in 12 months." },

  { daysAgo: 440, hospital: "Manipal Hospital, Pune", doctor: "Dr. Rohan Gupta", record_type: "consultation",
    diagnosis: "First consultation after relocating — general health baseline established.",
    medicines: [],
    notes: "No active concerns. Records requested from previous city's clinics." },
];

function daysAgoToDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function buildVisitRows() {
  const now = new Date().toISOString();
  return VISITS.map((v) => ({
    id: uuid(),
    user_id: DEMO_USER_ID,
    visit_date: daysAgoToDate(v.daysAgo),
    hospital_name: v.hospital,
    doctor_name: v.doctor,
    diagnosis_summary: v.diagnosis,
    medicines: v.medicines,
    notes: v.notes,
    record_type: v.record_type,
    raw_file_path: null,
    confidence_flags: v.confidence_flags || [],
    created_at: now,
    updated_at: now,
  }));
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildShareLinkRows(visitRows) {
  const now = new Date();
  const nowIso = now.toISOString();
  const hoursFromNow = (h) => new Date(now.getTime() + h * 60 * 60 * 1000).toISOString();

  return [
    // Active — single visit, still well within its 48h window.
    {
      id: uuid(),
      token: randomToken(),
      scope: "single_visit",
      visit_id: visitRows[0].id,
      visit_ids: null,
      user_id: DEMO_USER_ID,
      created_at: nowIso,
      expires_at: hoursFromNow(40),
      revoked: false,
      access_log: [{ accessed_at: nowIso }],
    },
    // Revoked — was a full-history share, patient pulled access back.
    {
      id: uuid(),
      token: randomToken(),
      scope: "full_history",
      visit_id: null,
      visit_ids: null,
      user_id: DEMO_USER_ID,
      created_at: hoursFromNow(-96),
      expires_at: hoursFromNow(-48),
      revoked: true,
      access_log: [{ accessed_at: hoursFromNow(-95) }, { accessed_at: hoursFromNow(-70) }],
    },
    // Naturally expired — single visit, 48h window lapsed on its own.
    {
      id: uuid(),
      token: randomToken(),
      scope: "single_visit",
      visit_id: visitRows[4].id,
      visit_ids: null,
      user_id: DEMO_USER_ID,
      created_at: hoursFromNow(-200),
      expires_at: hoursFromNow(-152),
      revoked: false,
      access_log: [{ accessed_at: hoursFromNow(-190) }],
    },
  ];
}

function ensureDemoUserAndProfile() {
  const users = readTable("users");
  if (!users.some((u) => u.id === DEMO_USER_ID)) {
    writeTable("users", [...users, { id: DEMO_USER_ID, email: DEMO_EMAIL, password: DEMO_PASSWORD }]);
  }

  const profiles = readTable("profiles");
  if (!profiles.some((p) => p.id === DEMO_USER_ID)) {
    writeTable("profiles", [
      ...profiles,
      {
        id: DEMO_USER_ID,
        name: DEMO_NAME,
        consent_given: true,
        consent_timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ]);
  }
}

// Wipes any existing demo-account rows and re-inserts the canonical dataset,
// so repeated clicks of "Explore with demo data" always show the same clean
// set instead of accumulating duplicates.
export function seedDemoAccount() {
  ensureDemoUserAndProfile();

  const otherVisits = readTable("visits").filter((v) => v.user_id !== DEMO_USER_ID);
  const otherShareLinks = readTable("share_links").filter((l) => l.user_id !== DEMO_USER_ID);

  const visitRows = buildVisitRows();
  const shareLinkRows = buildShareLinkRows(visitRows);

  writeTable("visits", [...otherVisits, ...visitRows]);
  writeTable("share_links", [...otherShareLinks, ...shareLinkRows]);
}
