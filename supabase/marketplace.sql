-- Marketplace schema for EROLBATTLE
-- Run these statements in your Supabase SQL editor (or psql) to create tables and policies.

-- Enable pgcrypto for gen_random_uuid (if not already enabled)
create extension if not exists pgcrypto;

-- Boosters catalog
create table if not exists boosters (
  id text primary key,
  name text not null,
  description text,
  price integer not null,
  active boolean default true
);

-- Marketplace purchases
create table if not exists marketplace_purchases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  booster_id text references boosters(id),
  target_wallet text not null,
  tx_link text not null,
  price integer,
  processed boolean default false,
  processed_at timestamptz,
  processor text
);

-- Row level security
alter table boosters enable row level security;
alter table marketplace_purchases enable row level security;

-- Policies
-- Allow public select on boosters (so clients can display catalog)
create policy "public_select_boosters" on boosters for select using (true);

-- Restrict inserts/updates/deletes to authenticated or service role for boosters (optional)
create policy "auth_modify_boosters" on boosters for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- For purchases, typical flow: only server (service role) writes records. We'll add strict policies for authenticated clients, but server code should use service key which bypasses RLS.
create policy "auth_select_purchases" on marketplace_purchases for select using (auth.role() = 'authenticated');
create policy "auth_insert_purchases" on marketplace_purchases for insert with check (auth.role() = 'authenticated');

-- Seed example boosters (optional)
insert into boosters (id, name, description, price, active) values
('titan_shield', 'TITAN SHIELD', 'Reduces incoming sector damage by 20% for 3 rounds.', 500, true)
on conflict (id) do nothing;

insert into boosters (id, name, description, price, active) values
('solar_flare', 'SOLAR FLARE', 'Increase damage output of your tier by 15%.', 750, true)
on conflict (id) do nothing;

insert into boosters (id, name, description, price, active) values
('scout_pack', 'SCOUT PACK', 'Minor boost for Scout units.', 50, true)
on conflict (id) do nothing;
