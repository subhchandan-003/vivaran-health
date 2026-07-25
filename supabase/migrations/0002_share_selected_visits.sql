-- Adds a third share scope: "selected_visits" — a patient-chosen subset of
-- visits bundled into one share link (multi-select from the timeline),
-- alongside the existing "single_visit" and "full_history" scopes.

alter table public.share_links
  add column if not exists visit_ids uuid[];

alter table public.share_links
  drop constraint if exists share_links_scope_check;

alter table public.share_links
  add constraint share_links_scope_check
    check (scope in ('single_visit', 'full_history', 'selected_visits'));

alter table public.share_links
  drop constraint if exists single_visit_requires_visit_id;

alter table public.share_links
  add constraint single_visit_requires_visit_id
    check (scope <> 'single_visit' or visit_id is not null);

alter table public.share_links
  add constraint selected_visits_requires_visit_ids
    check (scope <> 'selected_visits' or (visit_ids is not null and array_length(visit_ids, 1) > 0));
