// Shared record_type vocabulary — kept in one place since upload/edit/detail/
// timeline all need the same label+icon mapping. Matches the CHECK constraint
// in supabase/migrations/0003_add_record_type.sql.
export const RECORD_TYPES = [
  { value: "consultation", label: "Consultation", icon: "stethoscope" },
  { value: "lab_report", label: "Lab report", icon: "document" },
  { value: "prescription", label: "Prescription", icon: "pill" },
  { value: "vaccination", label: "Vaccination", icon: "shieldCheck" },
  { value: "imaging", label: "Imaging", icon: "building" },
  { value: "other", label: "Other", icon: "calendar" },
];

const BY_VALUE = new Map(RECORD_TYPES.map((t) => [t.value, t]));

export function recordTypeMeta(value) {
  return BY_VALUE.get(value) || null;
}
