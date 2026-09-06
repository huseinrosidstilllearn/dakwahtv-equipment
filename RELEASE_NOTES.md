# 🚀 Release Notes — Version 4.0.0
### *Dakwah TV Equipment Library: The Cloud & Precision PDF Era*

**Tanggal Rilis:** 6 September 2026  
**Status:** Major Production Release  
**Tag:** 4.0.0

---

## 🌟 Ikhtisar Pembaruan (Highlights)

Versi **4.0.0** merupakan lompatan terbesar (*major milestone*) dalam evolusi sistem peminjaman alat produksi Dakwah TV. Pembaruan ini mentransformasi aplikasi dari arsitektur NoSQL tradisional menjadi ekosistem cloud modern berperforma tinggi yang didukung oleh **Supabase (PostgreSQL)**, **Gotenberg Engine**, **Cloudflare R2 Storage**, dan **Automated WhatsApp Bot**.

---

## 📋 Detail Fitur Baru & Peningkatan (Changelog)

### 1. 🔄 Migrasi Total ke Supabase (PostgreSQL & Realtime)
* **Arsitektur Relasional Tangguh:** Menggantikan Firebase Realtime Database dengan PostgreSQL pada Supabase.
* **Row Level Security (RLS):** Keamanan tingkat baris untuk tabel profiles, ookings, inventory, config, dan ctivity_logs.
* **Realtime WebSocket Channels:** Pembaruan status ketersediaan alat, inventaris, dan pengajuan booking disinkronkan ke seluruh klien secara instan (latensi < 50ms) tanpa reload halaman.
* **Relational Booking Items:** Relasi many-to-many antara ookings dan inventory via tabel ooking_items.

### 2. 📄 Pipeline Surat Peminjaman Alat (SPA) Gotenberg + Cloudflare R2
* **Konversi Headless LibreOffice:** Mengintegrasikan mikroservis Gotenberg untuk mengubah berkas DOCX resmi menjadi PDF secara otomatis dengan akurasi 100% identik terhadap template Word.
* **Jaminan Tepat 1 Halaman A4:** Mengoptimasi aset template Word (	emplate_reguler.docx & 	emplate_news.docx), merestrukturisasi tanda tangan inline, dan memangkas font .odttf embedded sebesar 93% (dari 4.8 MB menjadi 336 KB), menghasilkan konversi instan di bawah 2 detik.
* **Cloudflare R2 CDN Custom Domain:** File PDF disimpan di Cloudflare R2 dengan custom domain https://spa.dakwahtv.my.id/spa-pdfs/..., aman dari pemblokiran ISP lokal dan ramah pembukaan file di perangkat mobile/WhatsApp.

### 3. 🛡️ Alur Generator Surat Sebelum Persetujuan Admin (Pre-Approval Flow)
* **Akses Surat Sebelum Approval:** Admin kini dapat mengakses dan meninjau generator surat SPA saat status booking masih pending langsung dari Card Booking maupun Modal Detail.
* **Editor Data Surat Terintegrasi:** Admin dapat mengoreksi nama program, nama produser penanggung jawab, episode, atau tanggal produksi sebelum persetujuan diberikan.
* **Persetujuan Satu Sentuhan di Halaman Surat:** Tombol *"Setujui Booking & Kirim WA"* di halaman /admin/surat/:id otomatis memproses PDF ke R2, menyimpan doc_url ke database, dan menembakkan notifikasi WhatsApp ke peminjam.
* **Background Auto-Generation pada Dashboard:** Jika admin menyetujui langsung dari dashboard, sistem secara otomatis mengeksekusi pipeline DOCX &rarr; Gotenberg &rarr; R2 di latar belakang sebelum mengirimkan pesan WhatsApp.

### 4. 🤖 Notifikasi Otomatis Bot WhatsApp (Fonnte API)
* **Pengiriman Tautan PDF Langsung:** Variabel {link_surat} pada template WhatsApp userApproved kini secara otomatis mengarah ke link unduh langsung PDF dari Cloudflare R2 (https://spa.dakwahtv.my.id/spa-pdfs/...), menghapus keharusan bagi peminjam untuk masuk ke web generator.
* **Failover Cerdas:** Jika server konversi Gotenberg sedang tidak aktif, sistem secara elegan beralih ke tautan web generator agar proses persetujuan dan pengiriman WA tidak terputus.
* **Editor Template WA Dinamis:** Admin dapat menyesuaikan format teks pesan notifikasi (Approved, Rejected, Pending, Return, Reminder) secara langsung dari dashboard.

### 5. 🔍 Manajemen Siklus Hidup & Kontrol Kualitas Alat
* **Formulir Pengembalian Fisik:** Pilihan verifikasi kondisi tiap alat saat dikembalikan (Lengkap, Rusak, Hilang).
* **Otomasi Status Stok:** 
  * Pengambilan alat (ctive) &rarr; Alat otomatis berstatus *Not Ready*.
  * Pengembalian berstatus rusak &rarr; Alat otomatis bermutasi ke status *Attention (Perlu Perbaikan)*.
  * Pengembalian lengkap &rarr; Alat otomatis kembali *Ready*.
* **Log Servis & Maintenance:** Pencatatan biaya perbaikan, teknisi, dan estimasi waktu reparasi alat.
* **Audit Activity Trail:** Rekam jejak seluruh mutasi status dan aksi admin tercatat secara kronologis.

### 6. 📊 Fitur Tambahan & Penyempurnaan UI
* **Ekspor Excel:** Kemampuan mengunduh rekapitulasi data peminjaman dan inventaris ke format .xlsx.
* **Tema Gelap & Terang Otomatis:** Penyempurnaan kontras visual Glassmorphism untuk kenyamanan navigasi siang maupun malam.
* **Pembersihan Dependensi:** Menghapus pustaka Firebase yang tidak terpakai dan mengoptimalkan bundle Vite.

---

## 📦 Panduan Upgrade dari Versi Sebelumnya

Bagi pengembang yang melakukan deploy ulang:
1. Pastikan skema tabel Supabase telah dieksekusi menggunakan berkas supabase_schema.sql.
2. Pasang variabel lingkungan baru pada dashboard hosting Cloudflare Pages sesuai panduan .env.example.
3. Pastikan domain custom spa.dakwahtv.my.id telah aktif di bucket Cloudflare R2.
4. Jalankan 
pm install dan 
pm run build.

---

<div align="center">
  <b>Dakwah TV UINSA — Laboratorium & Studio Produksi Siaran</b><br/>
  <i>Inovasi Digital untuk Kemudahan Kru dan Pengelolaan Aset Produksi</i>
</div>
