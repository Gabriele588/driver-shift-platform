create table if not exists public.driver_shift_users (
  id text primary key,
  full_name text not null,
  station text not null default 'Tutte',
  username text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'kam', 'dispatcher')),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_shift_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.driver_shift_users enable row level security;
alter table public.driver_shift_state enable row level security;

drop policy if exists "server only users" on public.driver_shift_users;
drop policy if exists "server only state" on public.driver_shift_state;

create policy "server only users"
on public.driver_shift_users
for all
using (false)
with check (false);

create policy "server only state"
on public.driver_shift_state
for all
using (false)
with check (false);

