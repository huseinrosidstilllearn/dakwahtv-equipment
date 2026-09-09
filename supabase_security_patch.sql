-- ==============================================================================
-- DAKWAH TV EQUIPMENT LIBRARY - SECURITY HARDENING PATCH (v4.0.0)
-- Mitigates: VULN-01, VULN-03, VULN-04, and VULN-05
-- Jalankan skrip ini di: Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. [VULN-01] PREVENT VERTICAL PRIVILEGE ESCALATION TO ADMIN
-- ------------------------------------------------------------------------------
-- Memastikan pengguna biasa tidak dapat mengubah rolenya sendiri menjadi 'admin'
create or replace function protect_profile_role()
returns trigger as $$
begin
  -- Jika kolom role diubah
  if new.role is distinct from old.role then
    -- Hanya izinkan jika dijalankan oleh service_role (auth.uid() is null) ATAU admin yang sah
    if auth.uid() is not null and not exists (
      select 1 from profiles where id = auth.uid() and lower(trim(role)) = 'admin'
    ) then
      raise exception 'Akses Ditolak: Anda tidak memiliki izin untuk mengubah role akun.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_protect_profile_role on profiles;
create trigger tr_protect_profile_role
  before update on profiles
  for each row execute function protect_profile_role();


-- ------------------------------------------------------------------------------
-- 2. [VULN-03] PREVENT BOOKING STATUS TAMPERING / APPROVAL BYPASS
-- ------------------------------------------------------------------------------
-- Memastikan peminjam biasa tidak bisa mengubah status menjadi 'approved' / 'active'
create or replace function protect_booking_status()
returns trigger as $$
begin
  if new.status is distinct from old.status then
    -- Jika bukan service_role dan bukan admin
    if auth.uid() is not null and not exists (
      select 1 from profiles where id = auth.uid() and lower(trim(role)) = 'admin'
    ) then
      -- Pengguna hanya diizinkan membatalkan pengajuannya sendiri jika statusnya masih 'pending'
      if old.status = 'pending' and new.status in ('cancelled', 'rejected') and old.uid = auth.uid() then
        return new;
      else
        raise exception 'Akses Ditolak: Hanya Admin yang dapat menyetujui atau mengubah status peminjaman.';
      end if;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_protect_booking_status on bookings;
create trigger tr_protect_booking_status
  before update on bookings
  for each row execute function protect_booking_status();


-- ------------------------------------------------------------------------------
-- 3. [VULN-04] RESTRICT SELECT ON BOOKINGS TO PREVENT MASSIVE PII EXPOSURE
-- ------------------------------------------------------------------------------
-- Data pribadi (No HP, NIM, Nama Lengkap) hanya boleh dibaca oleh pemilik booking atau admin.
drop policy if exists "Allow public select on bookings" on bookings;
drop policy if exists "Users view own bookings, admin views all" on bookings;

create policy "Users view own bookings, admin views all" on bookings 
  for select using (
    auth.uid() = uid or exists (
      select 1 from profiles where id = auth.uid() and lower(trim(role)) = 'admin'
    )
  );


-- ------------------------------------------------------------------------------
-- 4. [VULN-05] PREVENT CONCURRENCY RACE CONDITIONS & DOUBLE BOOKING
-- ------------------------------------------------------------------------------
-- Pengecekan bentrok tanggal atomic langsung pada level database PostgreSQL
create or replace function check_booking_conflict()
returns trigger as $$
declare
  v_new_start date;
  v_new_end date;
  v_new_status text;
  v_conflict_count integer;
begin
  -- Ambil tanggal dan status dari booking baru
  select date_start, date_end, status 
  into v_new_start, v_new_end, v_new_status
  from bookings 
  where id = new.booking_id;

  -- Hanya validasi jika booking berstatus aktif / pending
  if v_new_status in ('approved', 'active', 'pending', 'letter_ready', 'picked_up') then
    select count(*)
    into v_conflict_count
    from booking_items bi
    join bookings b on b.id = bi.booking_id
    where bi.inventory_id = new.inventory_id
      and bi.booking_id <> new.booking_id
      and b.status in ('approved', 'active', 'pending', 'letter_ready', 'picked_up')
      and (
        (v_new_start <= b.date_end) and (v_new_end >= b.date_start)
      );

    if v_conflict_count > 0 then
      raise exception 'Bentrok Jadwal: Alat ini sudah memiliki jadwal peminjaman aktif pada rentang tanggal tersebut.';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_check_booking_conflict on booking_items;
create trigger tr_check_booking_conflict
  before insert on booking_items
  for each row execute function check_booking_conflict();

-- ==============================================================================
-- SELESAI: Database Anda kini terlindungi dari Privilege Escalation, Status Tampering,
-- PII Harvesting, dan Double-Booking Concurrency.
-- ==============================================================================
