-- AutoTool v2 backend schema
-- Client-facing tables use RLS. Never expose service-role/secret keys in the extension.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.browser_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  device_key text not null,
  name text not null default 'Chrome Extension',
  extension_version text not null default 'unknown',
  last_seen_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, device_key)
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'review_assist',
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  config jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  persona text,
  prompt_version text not null default 'comment-v2',
  config jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.schedule_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  browser_instance_id uuid references public.browser_instances(id) on delete set null,
  local_schedule_id text not null,
  name text not null,
  enabled boolean not null default true,
  interval_minutes integer not null check (interval_minutes between 15 and 1440),
  max_posts integer not null check (max_posts between 1 and 20),
  start_hour integer not null check (start_hour between 0 and 23),
  end_hour integer not null check (end_hour between 0 and 23),
  account_context_key text,
  account_label text,
  revision bigint not null default 1,
  last_synced_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, local_schedule_id)
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  browser_instance_id uuid references public.browser_instances(id) on delete set null,
  local_event_id text not null,
  event_type text not null,
  category text not null,
  level text not null check (level in ('INFO','WARN','ERROR')),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique(user_id, browser_instance_id, local_event_id)
);

create index if not exists browser_instances_user_seen_idx
  on public.browser_instances(user_id, last_seen_at desc);
create index if not exists campaigns_user_status_idx
  on public.campaigns(user_id, status);
create index if not exists ai_profiles_user_updated_idx
  on public.ai_profiles(user_id, updated_at desc);
create index if not exists schedule_definitions_user_enabled_idx
  on public.schedule_definitions(user_id, enabled);
create index if not exists analytics_events_user_occurred_idx
  on public.analytics_events(user_id, occurred_at desc);
create index if not exists analytics_events_browser_occurred_idx
  on public.analytics_events(browser_instance_id, occurred_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists browser_instances_set_updated_at on public.browser_instances;
create trigger browser_instances_set_updated_at before update on public.browser_instances
for each row execute procedure public.set_updated_at();

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at before update on public.campaigns
for each row execute procedure public.set_updated_at();

drop trigger if exists ai_profiles_set_updated_at on public.ai_profiles;
create trigger ai_profiles_set_updated_at before update on public.ai_profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists schedule_definitions_set_updated_at on public.schedule_definitions;
create trigger schedule_definitions_set_updated_at before update on public.schedule_definitions
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.browser_instances enable row level security;
alter table public.campaigns enable row level security;
alter table public.ai_profiles enable row level security;
alter table public.schedule_definitions enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists "profiles own rows" on public.profiles;
create policy "profiles own rows" on public.profiles
for all to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "browser instances own rows" on public.browser_instances;
create policy "browser instances own rows" on public.browser_instances
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "campaigns own rows" on public.campaigns;
create policy "campaigns own rows" on public.campaigns
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "ai profiles own rows" on public.ai_profiles;
create policy "ai profiles own rows" on public.ai_profiles
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "schedules own rows" on public.schedule_definitions;
create policy "schedules own rows" on public.schedule_definitions
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "analytics own rows" on public.analytics_events;
create policy "analytics own rows" on public.analytics_events
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.browser_instances to authenticated;
grant select, insert, update, delete on public.campaigns to authenticated;
grant select, insert, update, delete on public.ai_profiles to authenticated;
grant select, insert, update, delete on public.schedule_definitions to authenticated;
grant select, insert on public.analytics_events to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
