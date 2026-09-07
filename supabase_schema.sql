-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  display_name text,
  role text default 'user',
  status text default 'active',
  last_login timestamp with time zone,
  phone text,
  nim text,
  origin text,
  dept text
);

-- In case profiles already exists, add columns safely
alter table profiles add column if not exists last_login timestamp with time zone;
alter table profiles add column if not exists status text default 'active';

-- Inventory table
create table if not exists inventory (
  id uuid default uuid_generate_v4() primary key,
  cat text,
  group_name text,
  name text not null,
  status text,
  notes text,
  img text,
  "desc" text,
  qty integer default 1,
  old_key text unique
);

-- Bookings table
create table if not exists bookings (
  id text primary key,
  uid uuid references profiles(id) on delete set null,
  status text not null,
  date_start timestamp with time zone,
  date_end timestamp with time zone,
  purpose text,
  user_name text,
  user_phone text,
  user_nim text,
  origin text,
  dept text,
  doc_url text,
  return_checklist jsonb,
  return_note text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Booking Items table
create table if not exists booking_items (
  booking_id text references bookings(id) on delete cascade,
  inventory_id uuid references inventory(id) on delete restrict,
  primary key (booking_id, inventory_id)
);

-- Config table
create table if not exists config (
  key text primary key,
  value jsonb
);

-- Activity Logs
create table if not exists activity_logs (
  id uuid default uuid_generate_v4() primary key,
  action text not null,
  email text,
  timestamp timestamp with time zone default now()
);

-- Maintenance Logs
create table if not exists maintenance_logs (
  id uuid default uuid_generate_v4() primary key,
  item_name text not null,
  description text,
  reported_by text,
  timestamp timestamp with time zone default now(),
  status text default 'open'
);

-- Turn on RLS for all tables
alter table profiles enable row level security;
alter table inventory enable row level security;
alter table bookings enable row level security;
alter table booking_items enable row level security;
alter table config enable row level security;
alter table activity_logs enable row level security;
alter table maintenance_logs enable row level security;

-- Profiles Policies
drop policy if exists "Public profiles are viewable by everyone." on profiles;
create policy "Public profiles are viewable by everyone." on profiles for select using (true);

drop policy if exists "Users can insert their own profile." on profiles;
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile." on profiles;
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

drop policy if exists "Admins can update all profiles." on profiles;
create policy "Admins can update all profiles." on profiles for update using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Inventory Policies
drop policy if exists "Inventory is public." on inventory;
create policy "Inventory is public." on inventory for select using (true);

drop policy if exists "Admin can insert inventory." on inventory;
create policy "Admin can insert inventory." on inventory for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "Admin can update inventory." on inventory;
create policy "Admin can update inventory." on inventory for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "Admin can delete inventory." on inventory;
create policy "Admin can delete inventory." on inventory for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Bookings Policies
drop policy if exists "Users view own bookings, admin views all" on bookings;
drop policy if exists "Allow public select on bookings" on bookings;
create policy "Allow public select on bookings" on bookings for select using (true);

drop policy if exists "Users can insert own bookings" on bookings;
create policy "Users can insert own bookings" on bookings for insert with check (
  auth.uid() = uid
);

drop policy if exists "Users can update own bookings, admin can update all" on bookings;
create policy "Users can update own bookings, admin can update all" on bookings for update using (
  auth.uid() = uid or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "Admin can delete bookings" on bookings;
create policy "Admin can delete bookings" on bookings for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Booking Items Policies
drop policy if exists "Booking items are public for availability" on booking_items;
create policy "Booking items are public for availability" on booking_items for select using (true);

drop policy if exists "Insert booking items" on booking_items;
create policy "Insert booking items" on booking_items for insert with check (
  exists (select 1 from bookings where id = booking_items.booking_id and uid = auth.uid())
);

drop policy if exists "Admin delete booking items" on booking_items;
create policy "Admin delete booking items" on booking_items for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Config Policies
drop policy if exists "Config is public" on config;
create policy "Config is public" on config for select using (true);

drop policy if exists "Admin updates config" on config;
create policy "Admin updates config" on config for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
) with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Activity Logs Policies
drop policy if exists "Admin views logs" on activity_logs;
create policy "Admin views logs" on activity_logs for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "Admin inserts logs" on activity_logs;
create policy "Admin inserts logs" on activity_logs for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Maintenance Logs Policies
drop policy if exists "Admin views maintenance" on maintenance_logs;
create policy "Admin views maintenance" on maintenance_logs for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "Admin inserts maintenance" on maintenance_logs;
create policy "Admin inserts maintenance" on maintenance_logs for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
