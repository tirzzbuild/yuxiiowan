-- YuxiioDev Premium database schema
-- Run this in Supabase SQL Editor before deploying.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '',
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.request_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  ok boolean not null default false,
  status_code integer,
  duration_ms integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists request_logs_user_created_idx on public.request_logs(user_id, created_at desc);
create index if not exists request_logs_created_idx on public.request_logs(created_at desc);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    'user'
  ) on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.request_logs enable row level security;

-- Browser users can read/update their own safe profile fields only.
drop policy if exists "profile select own" on public.profiles;
create policy "profile select own" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "profile update own" on public.profiles;
create policy "profile update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
-- Prevent users from escalating their role through direct table updates.
create or replace function public.protect_profile_role()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.role is distinct from old.role and auth.role() <> 'service_role' then
    raise exception 'Role changes must go through the trusted server admin endpoint';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_role_trigger on public.profiles;
create trigger protect_profile_role_trigger before update on public.profiles
for each row execute procedure public.protect_profile_role();

-- Logs are private to their owner; all writes are performed by the server service role.
drop policy if exists "logs select own" on public.request_logs;
create policy "logs select own" on public.request_logs for select to authenticated using (auth.uid() = user_id);
revoke all on public.profiles from anon;
revoke all on public.request_logs from anon;
grant select, update on public.profiles to authenticated;
grant select on public.request_logs to authenticated;

-- After the first account has registered, promote it manually in SQL Editor:
-- update public.profiles set role = 'admin' where email = 'YOUR_ADMIN_EMAIL';
