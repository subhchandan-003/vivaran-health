-- Vivaran Health — initial schema
-- Tables: profiles, visits, share_links
-- RLS scoped to auth.uid() on profiles/visits.
-- share_links: patients manage their own rows via RLS; the public/doctor-facing
-- token resolution never queries this table directly with the anon key — it
-- goes through the resolve-share edge function (service role), so no policy
-- here exposes other patients' rows.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  consent_given boolean not null default false,
  consent_timestamp timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- visits
-- ---------------------------------------------------------------------------
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  visit_date date,
  hospital_name text,
  doctor_name text,
  diagnosis_summary text,
  medicines jsonb not null default '[]'::jsonb,
  notes text,
  raw_file_path text,
  confidence_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists visits_user_id_visit_date_idx
  on public.visits (user_id, visit_date desc);

alter table public.visits enable row level security;

create policy "visits_select_own"
  on public.visits for select
  using (auth.uid() = user_id);

create policy "visits_insert_own"
  on public.visits for insert
  with check (auth.uid() = user_id);

create policy "visits_update_own"
  on public.visits for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "visits_delete_own"
  on public.visits for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger visits_set_updated_at
  before update on public.visits
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- share_links
-- ---------------------------------------------------------------------------
create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  scope text not null check (scope in ('single_visit', 'full_history')),
  visit_id uuid references public.visits (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked boolean not null default false,
  access_log jsonb not null default '[]'::jsonb,
  constraint single_visit_requires_visit_id
    check (scope <> 'single_visit' or visit_id is not null)
);

create index if not exists share_links_token_idx on public.share_links (token);
create index if not exists share_links_user_id_idx on public.share_links (user_id);

alter table public.share_links enable row level security;

-- Patients can fully manage their own share links (create, list, revoke).
-- There is deliberately NO public/anon select policy here — the doctor-facing
-- read path resolves tokens through the resolve-share edge function using the
-- service role key, so an anon client can never enumerate this table.
create policy "share_links_select_own"
  on public.share_links for select
  using (auth.uid() = user_id);

create policy "share_links_insert_own"
  on public.share_links for insert
  with check (auth.uid() = user_id);

create policy "share_links_update_own"
  on public.share_links for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "share_links_delete_own"
  on public.share_links for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: private bucket for uploaded document images
-- Path convention: {user_id}/{visit_id or uuid}-{filename}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_select_own"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents_update_own"
  on storage.objects for update
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
