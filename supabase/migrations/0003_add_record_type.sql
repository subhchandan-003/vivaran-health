-- Adds an optional record-type classification to visits (consultation, lab
-- report, prescription, vaccination, imaging, ...), so the timeline and
-- detail views can show a type badge. Nullable and additive — existing rows
-- get null and simply render without a badge; no RLS change required since
-- the existing per-column-agnostic policies on visits already cover it.

alter table public.visits
  add column if not exists record_type text;

alter table public.visits
  drop constraint if exists visits_record_type_check;

alter table public.visits
  add constraint visits_record_type_check
    check (record_type is null or record_type in (
      'consultation', 'lab_report', 'prescription', 'vaccination', 'imaging', 'other'
    ));
