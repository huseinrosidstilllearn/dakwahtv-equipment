# 🛡️ Laporan Audit Keamanan & Bug Bounty: Dakwah TV Equipment Library (v4.0.0)

Berdasarkan metodologi pengujian keamanan aplikasi web (*Bug Bounty & Defensive Code Audit Framework*), berikut adalah hasil analisis mendalam terhadap arsitektur, kode sumber (*frontend React*), dan konfigurasi backend Supabase (PostgreSQL RLS, Cloudflare Workers, & API Gateway).

---

## 📊 Ringkasan Eksekutif (Severity Matrix)

| ID | Kerentanan / Bug Class | Severity | File / Komponen Terdampak | Dampak Utama |
|---|---|:---:|---|---|
| **VULN-01** | **Vertical Privilege Escalation ke Admin via RLS Profiles** | 🔴 **CRITICAL** (CVSS 9.1) | [`supabase_schema.sql:103-104`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/supabase_schema.sql#L103-L104) | Pengguna biasa dapat mengubah rolenya sendiri menjadi `admin` penuh. |
| **VULN-02** | **Hardcoded Secret Token (Fonnte WA & Cloudflare Worker)** | 🔴 **CRITICAL** (CVSS 8.6) | [`src/utils/whatsapp.js:113`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/src/utils/whatsapp.js#L113), [`src/utils/spaPdf.js:372`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/src/utils/spaPdf.js#L372) | Kuota WA dibajak/spam, unggah file bebas ke bucket Cloudflare R2. |
| **VULN-03** | **Bypass Approval & Booking Status Tampering** | 🟠 **HIGH** (CVSS 8.1) | [`supabase_schema.sql:138-140`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/supabase_schema.sql#L138-L140) | Peminjam dapat menyetujui peminjamannya sendiri tanpa izin admin. |
| **VULN-04** | **Massive PII Exposure via Public Select Policy** | 🟠 **HIGH** (CVSS 7.5) | [`supabase_schema.sql:98`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/supabase_schema.sql#L98), [`supabase_schema.sql:131`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/supabase_schema.sql#L131) | Siapa pun tanpa login bisa mengikis No HP, NIM, nama lengkap, dan data peminjaman. |
| **VULN-05** | **Race Condition & Double-Booking (No DB Constraint)** | 🟡 **MEDIUM** (CVSS 6.5) | [`src/pages/Katalog.jsx:360-369`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/src/pages/Katalog.jsx#L360-L369) | Bentrok jadwal masih bisa terjadi melalui request bersamaan (*concurrency*). |
| **VULN-06** | **Stored XSS via Unsanitized Equipment Name** | 🟡 **MEDIUM** (CVSS 6.1) | [`src/components/CartModal.jsx:159`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/src/components/CartModal.jsx#L159) | Eksekusi script jahat di browser admin/peminjam lain via nama alat bentrok. |
| **VULN-07** | **Permissive CSP (`unsafe-inline`, `unsafe-eval`)** | 🔵 **LOW** (CVSS 3.7) | [`public/_headers:50`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/public/_headers#L50) | Proteksi CSP tidak dapat mencegah eksekusi payload XSS secara efektif. |

---

## 🔍 Pembahasan Rinci Tiap Temuan (Defensive Analysis)

---

### 🔴 VULN-01: Vertical Privilege Escalation to Admin via Profile Update
- **CWE-269**: *Improper Privilege Management*
- **Lokasi**: [`supabase_schema.sql:103-104`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/supabase_schema.sql#L103-L104)

#### Mekanisme Kerentanan:
Pada aturan RLS tabel `profiles`:
```sql
create policy "Users can update own profile." on profiles 
  for update using (auth.uid() = id);
```
Kebijakan ini mengizinkan pengguna yang telah login untuk meng-update **seluruh kolom** di baris profil miliknya sendiri. Tabel `profiles` memiliki kolom `role text default 'user'`.

Karena tidak ada klausul `with check` atau trigger proteksi tingkat kolom, pengguna umum yang login dapat langsung mengirim request PostgREST:
```http
PATCH /rest/v1/profiles?id=eq.<uid_sendiri>
Authorization: Bearer <token_jwt_user_biasa>
Content-Type: application/json

{
  "role": "admin"
}
```
PostgreSQL akan mengevaluasi `auth.uid() = id` (Bernilai **TRUE**). Pengguna tersebut seketika berubah menjadi `admin` dan memperoleh kendali penuh atas Dashboard Admin.

#### Rekomendasi Perbaikan:
Batasi agar pengguna biasa tidak dapat mengubah kolom `role` miliknya sendiri, atau pisahkan validasi dengan trigger PostgreSQL:
```sql
-- Buat trigger agar pengguna non-admin tidak bisa menaikkan rolenya sendiri
create or replace function protect_profile_role()
returns trigger as $$
begin
  if new.role <> old.role and not exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Tidak memiliki izin untuk mengubah role.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_protect_profile_role on profiles;
create trigger tr_protect_profile_role
  before update on profiles
  for each row execute function protect_profile_role();
```

---

### 🔴 VULN-02: Kebocoran Secret Token di Client-Side Code
- **CWE-798**: *Use of Hard-coded Credentials*
- **Lokasi**: 
  1. [`src/utils/whatsapp.js:113`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/src/utils/whatsapp.js#L113) (`token = '6zWjLzHFtYJavkm7y3qT'`)
  2. [`src/utils/spaPdf.js:372`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/src/utils/spaPdf.js#L372) & [`src/pages/Katalog.jsx:331`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/src/pages/Katalog.jsx#L331) (`Bearer DakwahTV_Aman_2026`)

#### Mekanisme Kerentanan:
Kode frontend React dibundel dan dikirim ke browser pengguna. Siapa pun dapat membuka *DevTools &rarr; Sources* atau memeriksa *Network Tab* untuk mengambil:
1. **Fonnte API Token**: Digunakan untuk mengirim pesan WhatsApp mengatasnamakan nomor resmi studio ke nomor mana pun di dunia, menghabiskan saldo Fonnte, atau melihat log obrolan bot.
2. **Cloudflare Worker Bearer Token**: Mengizinkan siapa pun mengirim file biner/HTML berbahaya ke R2 storage pada domain publik `spa.dakwahtv.my.id`.

#### Rekomendasi Perbaikan:
1. **Pindahkan Pengiriman WhatsApp ke Serverless/Edge Function**:
   Jangan panggil `api.fonnte.com` langsung dari browser pengguna. Gunakan Supabase Edge Function atau Cloudflare Worker yang menyimpan Fonnte Token di Environment Variables rahasia (`FONNTE_TOKEN`).
2. **R2 Signed Upload URL**:
   Jangan gunakan token statis `DakwahTV_Aman_2026`. Buat endpoint Cloudflare Worker yang hanya mengizinkan *presigned upload URL* dengan tipe konten terbatas (`application/pdf` atau `image/*`) dan ukuran maksimum.

---

### 🟠 VULN-03: Bypass Approval & Booking Status Tampering (Insecure Authorization)
- **CWE-639**: *Authorization Bypass Through User-Controlled Key*
- **Lokasi**: [`supabase_schema.sql:138-141`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/supabase_schema.sql#L138-L140)

#### Mekanisme Kerentanan:
Kebijakan RLS untuk tabel `bookings`:
```sql
create policy "Users can update own bookings, admin can update all" on bookings 
  for update using (
    auth.uid() = uid or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
```
Kebijakan ini mengizinkan pengguna mengubah data `bookings` miliknya. Karena tidak ada pembatasan kolom, peminjam dapat mengubah status booking mereka sendiri dari `pending` menjadi `approved` atau `active`:
```http
PATCH /rest/v1/bookings?id=eq.<booking_id_milik_user>
Authorization: Bearer <user_jwt>

{
  "status": "approved",
  "doc_url": "https://attacker.com/fake_surat.pdf"
}
```
Peminjam dapat menyetujui peminjamannya secara ilegal tanpa persetujuan tim teknis/admin.

#### Rekomendasi Perbaikan:
Batasi hak `update` pengguna biasa pada tabel `bookings`. Pengguna biasa hanya boleh mengedit peminjaman jika statusnya masih `pending`, dan **tidak boleh mengubah kolom `status` atau `doc_url`**:
```sql
-- Batasi update booking: hanya Admin yang bisa ubah status menjadi approved/active/returned
create or replace function protect_booking_status()
returns trigger as $$
begin
  if new.status <> old.status and not exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ) then
    -- Peminjam biasa hanya boleh membatalkan booking (status: 'cancelled') jika status awal 'pending'
    if new.status = 'cancelled' and old.status = 'pending' then
      return new;
    else
      raise exception 'Hanya Admin yang dapat mengubah status peminjaman.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_protect_booking_status on bookings;
create trigger tr_protect_booking_status
  before update on bookings
  for each row execute function protect_booking_status();
```

---

### 🟠 VULN-04: Kebocoran Data Pribadi (PII) Mahasiswa & Kru Studio
- **CWE-200**: *Exposure of Sensitive Information to an Unauthorized Actor*
- **Lokasi**: [`supabase_schema.sql:98`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/supabase_schema.sql#L98) & [`supabase_schema.sql:131`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/supabase_schema.sql#L131)

#### Mekanisme Kerentanan:
Kebijakan RLS saat ini:
```sql
create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Allow public select on bookings" on bookings for select using (true);
```
Kolom tabel `bookings` dan `profiles` memuat Nomor Handphone (`user_phone`), Nomor Induk Mahasiswa (`user_nim`), Nama Asli (`user_name`), Program/Dept, dan riwayat kegiatan.

Siapa pun di internet tanpa login cukup menggunakan *curl* atau Postman bersama Publishable Key Supabase untuk mengunduh seluruh basis data mahasiswa/kru Dakwah TV:
```bash
curl "https://fkdbgmcphqvejborcesc.supabase.co/rest/v1/bookings?select=user_name,user_phone,user_nim,purpose" \
  -H "apikey: sb_publishable_XMeUalHSU1OKdf9raG6-Rw_uCzDhbCF"
```

#### Rekomendasi Perbaikan:
1. **Profiles**: Hanya izinkan publik melihat `id`, `display_name`, dan `role`. Sembunyikan `phone` dan `nim`:
   - Atau batasi: Pengguna hanya dapat melihat profilnya sendiri, admin melihat semua.
2. **Bookings**: Kembalikan kebijakan RLS:
   ```sql
   drop policy if exists "Allow public select on bookings" on bookings;
   create policy "Users view own bookings, admin views all" on bookings 
     for select using (
       auth.uid() = uid or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
     );
   ```
   Untuk ketersediaan kalender publik, gunakan tabel `config` (`publicAvailability`) yang hanya memuat ID barang dan rentang tanggal tanpa data identitas peminjam.

---

### 🟡 VULN-05: Concurrency Race Condition pada Booking (Double-Booking)
- **CWE-362**: *Concurrent Execution using Shared Resource with Improper Synchronization*
- **Lokasi**: [`src/pages/Katalog.jsx:360-369`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/src/pages/Katalog.jsx#L360-L369)

#### Mekanisme Kerentanan:
Pengecekan bentrok tanggal (`checkDateConflicts`) dilakukan **hanya di sisi client browser (React state)**. Database PostgreSQL tidak memiliki constraint pengecualian (*exclusion constraint*).
Jika dua kru mengajukan kamera yang sama untuk jam/tanggal yang sama secara bersamaan (selisih milidetik):
1. Browser Kru A mengecek: Status Ready.
2. Browser Kru B mengecek: Status Ready.
3. Keduanya mengeksekusi `insert into bookings` dan `booking_items`.
4. Kedua booking berhasil tersimpan &rarr; **Terjadi bentrok jadwal ganda (*Double Booking*)**.

#### Rekomendasi Perbaikan:
Tambahkan fungsi validasi atau constraint di database PostgreSQL:
```sql
-- Validasi bentrok sebelum insert di PostgreSQL
create or replace function check_booking_conflict()
returns trigger as $$
declare
  v_conflict integer;
begin
  select count(*) into v_conflict
  from booking_items bi
  join bookings b on b.id = bi.booking_id
  where bi.inventory_id = new.inventory_id
    and b.status in ('approved', 'active', 'pending')
    and exists (
      select 1 from bookings cur 
      where cur.id = new.booking_id 
        and (cur.date_start, cur.date_end) overlaps (b.date_start, b.date_end)
    );

  if v_conflict > 0 then
    raise exception 'Alat ini sudah dibooking pada jadwal tersebut.';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger tr_check_booking_conflict
  before insert on booking_items
  for each row execute function check_booking_conflict();
```

---

### 🟡 VULN-06: Stored DOM XSS pada Modal Keranjang
- **CWE-79**: *Cross-site Scripting (DOM-based / Stored)*
- **Lokasi**: [`src/components/CartModal.jsx:159`](file:///D:/00%20VIBE%20CODE/Anti%20Gravity/equipment-catalog-dakwahtv/src/components/CartModal.jsx#L159)

#### Mekanisme Kerentanan:
Pada `CartModal.jsx`:
```javascript
const conflicts = checkDateConflicts(startInput?.value, e.target.value);
if (conflicts && conflicts.length > 0) {
  setConflictWarn({ 
    hasConflict: true, 
    message: `⚠️ Alat berikut sudah terbooking pada tanggal tersebut: <strong>${conflicts.join(', ')}</strong>. Silakan pilih tanggal lain.` 
  });
}
...
<div dangerouslySetInnerHTML={{ __html: conflictWarn.message }}></div>
```
Nama alat (`conflicts`) digabungkan langsung ke dalam string HTML tanpa sanitasi (*escaping*). Jika ada nama alat di inventaris yang memuat karakter HTML/JS (misal: `Sony FX3 <img src=x onerror=alert(1)>`), kode tersebut akan langsung dieksekusi saat modal menampilkan pesan bentrok tanggal.

#### Rekomendasi Perbaikan:
Ganti penggunaan `dangerouslySetInnerHTML` dengan elemen JSX standar React:
```jsx
// Ganti:
// <div dangerouslySetInnerHTML={{ __html: conflictWarn.message }}></div>

// Menjadi rendering JSX aman (React otomatis melakukan HTML encoding):
<div className="text-xs leading-relaxed font-medium">
  ⚠️ Alat berikut sudah terbooking pada tanggal tersebut:{' '}
  <strong>{conflictNames.join(', ')}</strong>. Silakan pilih tanggal lain.
</div>
```

---

## 📋 Prioritas Perbaikan Sebelum Repo Diubah ke Publik

Jika repositori ini ingin diubah statusnya menjadi **Public** di GitHub, lakukan tindakan pencegahan berikut terlebih dahulu:

1. **Amankan RLS PostgreSQL** (Terapkan patch `protect_profile_role` dan `protect_booking_status` di Supabase SQL Editor).
2. **Cabut (*Revoke*) & Rotasi Token Fonnte**: Token `'6zWjLzHFtYJavkm7y3qT'` sudah terekam di riwayat commit GitHub. Segera buat token baru di dashboard Fonnte dan simpan di Environment Variables server/worker, bukan di file `.js` React.
3. **Amankan Worker R2**: Ubah Worker agar menggunakan otentikasi dinamis atau batasi endpoint ke domain Cloudflare Pages saja.
4. **Hapus `dangerouslySetInnerHTML`** di `CartModal.jsx` untuk meniadakan potensi DOM XSS.

Apakah Anda ingin saya bantu membuatkan file skrip migrasi SQL perbaikan untuk Supabase dan mengamankan kode `CartModal.jsx` sekarang?