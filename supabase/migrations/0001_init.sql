-- =============================================================
-- WorldLens database schema
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- It is safe to re-run: it uses IF NOT EXISTS / CREATE OR REPLACE where possible.
-- =============================================================

-- ----- Extensions -------------------------------------------------
create extension if not exists "pgcrypto";

-- ----- Roles enum -------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'user');
  end if;
end$$;

-- ----- updated_at helper -----------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================
-- profiles
-- =============================================================
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  home_country text,
  preferred_language text default 'en',
  preferred_currency text default 'USD',
  notification_preferences jsonb default '{"push": true, "email": false, "safety_alerts": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =============================================================
-- user_roles
-- =============================================================
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  unique (user_id, role)
);

-- has_role helper (security definer to avoid RLS recursion)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- =============================================================
-- trips
-- =============================================================
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  destination text,
  start_date date,
  end_date date,
  cover_image_url text,
  is_public boolean default false,
  share_code text unique,
  shareable_story text,
  ai_summary text,
  ai_overview text,
  ai_best_time_to_visit text,
  ai_itinerary jsonb,
  ai_must_try jsonb,
  ai_packing_tips text[],
  ai_budget_estimate jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trips_updated_at on public.trips;
create trigger trips_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

-- =============================================================
-- scan_entries
-- =============================================================
create table if not exists public.scan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  category text not null,
  name text,
  description text,
  image_url text,
  extracted_text text,
  latitude double precision,
  longitude double precision,
  location_name text,
  ai_analysis jsonb,
  prices jsonb,
  tips text[],
  warnings text[],
  notes text,
  is_favorite boolean default false,
  created_at timestamptz not null default now()
);

-- =============================================================
-- spending_records
-- =============================================================
create table if not exists public.spending_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_entry_id uuid references public.scan_entries(id) on delete set null,
  amount numeric not null,
  currency text not null default 'USD',
  category text not null,
  merchant text,
  location_name text,
  notes text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

-- =============================================================
-- ai_usage
-- =============================================================
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  session_id text,
  date date not null default current_date,
  call_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

drop trigger if exists ai_usage_updated_at on public.ai_usage;
create trigger ai_usage_updated_at
  before update on public.ai_usage
  for each row execute function public.set_updated_at();

-- =============================================================
-- New user -> auto-create profile + default role
-- =============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- Row Level Security
-- =============================================================
alter table public.profiles        enable row level security;
alter table public.user_roles      enable row level security;
alter table public.trips           enable row level security;
alter table public.scan_entries    enable row level security;
alter table public.spending_records enable row level security;
alter table public.ai_usage        enable row level security;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id);

-- user_roles (read your own roles)
drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own" on public.user_roles
  for select using (auth.uid() = user_id);

-- trips: owner full access + public can read shared trips
drop policy if exists "trips_select_own" on public.trips;
create policy "trips_select_own" on public.trips
  for select using (auth.uid() = user_id);
drop policy if exists "trips_select_public" on public.trips;
create policy "trips_select_public" on public.trips
  for select using (is_public = true);
drop policy if exists "trips_insert_own" on public.trips;
create policy "trips_insert_own" on public.trips
  for insert with check (auth.uid() = user_id);
drop policy if exists "trips_update_own" on public.trips;
create policy "trips_update_own" on public.trips
  for update using (auth.uid() = user_id);
drop policy if exists "trips_delete_own" on public.trips;
create policy "trips_delete_own" on public.trips
  for delete using (auth.uid() = user_id);

-- scan_entries
drop policy if exists "scan_entries_select_own" on public.scan_entries;
create policy "scan_entries_select_own" on public.scan_entries
  for select using (auth.uid() = user_id);
drop policy if exists "scan_entries_insert_own" on public.scan_entries;
create policy "scan_entries_insert_own" on public.scan_entries
  for insert with check (auth.uid() = user_id);
drop policy if exists "scan_entries_update_own" on public.scan_entries;
create policy "scan_entries_update_own" on public.scan_entries
  for update using (auth.uid() = user_id);
drop policy if exists "scan_entries_delete_own" on public.scan_entries;
create policy "scan_entries_delete_own" on public.scan_entries
  for delete using (auth.uid() = user_id);

-- spending_records
drop policy if exists "spending_select_own" on public.spending_records;
create policy "spending_select_own" on public.spending_records
  for select using (auth.uid() = user_id);
drop policy if exists "spending_insert_own" on public.spending_records;
create policy "spending_insert_own" on public.spending_records
  for insert with check (auth.uid() = user_id);
drop policy if exists "spending_update_own" on public.spending_records;
create policy "spending_update_own" on public.spending_records
  for update using (auth.uid() = user_id);
drop policy if exists "spending_delete_own" on public.spending_records;
create policy "spending_delete_own" on public.spending_records
  for delete using (auth.uid() = user_id);

-- ai_usage (per-user counters)
drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage
  for select using (auth.uid() = user_id);
drop policy if exists "ai_usage_insert_own" on public.ai_usage;
create policy "ai_usage_insert_own" on public.ai_usage
  for insert with check (auth.uid() = user_id);
drop policy if exists "ai_usage_update_own" on public.ai_usage;
create policy "ai_usage_update_own" on public.ai_usage
  for update using (auth.uid() = user_id);
