import { 
  Tv, 
  Calendar, 
  Smartphone, 
  Users, 
  Wrench, 
  Building, 
  GraduationCap 
} from 'lucide-react';

/**
 * 7 Kategori Keperluan Peminjaman Alat Dakwah TV
 */
export const KEPERLUAN_OPTIONS = [
  {
    value: 'program',
    label: 'Program Produksi Siaran',
    desc: 'Program reguler & news resmi Dakwah TV (Muslim Kampus, FTV, Showtime, Campus Report, dll)',
    badge: 'Program Siaran',
    badgeColor: 'text-teal bg-teal/10 border-teal/30',
    icon: Tv,
    fieldLabel: 'Nama Program & Episode',
    placeholder: 'cth: Muslim Kampus - Eps. 05',
    deptLabel: 'Divisi / Tim Program',
    deptPlaceholder: 'cth: Tim Produksi Muslim Kampus'
  },
  {
    value: 'event',
    label: 'Liputan Event / Acara Kampus',
    desc: 'Wisuda UINSA, PBAK, Dies Natalis, Seminar Nasional, Festival Budaya, dll',
    badge: 'Event Kampus',
    badgeColor: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    icon: Calendar,
    fieldLabel: 'Nama Acara / Event',
    placeholder: 'cth: Wisuda ke-108 UIN Sunan Ampel Surabaya',
    deptLabel: 'Penyelenggara / Panitia Acara',
    deptPlaceholder: 'cth: Panitia Wisuda / Humas UINSA'
  },
  {
    value: 'konten',
    label: 'Konten Digital & Media Sosial',
    desc: 'Syuting Instagram Reels, TikTok, YouTube Shorts, Podcast, atau Konten Kreatif',
    badge: 'Media Sosial',
    badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    icon: Smartphone,
    fieldLabel: 'Topik / Judul Konten',
    placeholder: 'cth: Konten Edukasi TikTok & Reels Dakwah TV',
    deptLabel: 'Divisi / Tim Kreatif',
    deptPlaceholder: 'cth: Tim Sosmed / Creative Media'
  },
  {
    value: 'internal',
    label: 'Kegiatan Internal Dakwah TV',
    desc: 'Diklat kru magang, upgrading, raker, workshop, gathering, atau agenda internal TV',
    badge: 'Internal Dakwah TV',
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    icon: Users,
    fieldLabel: 'Nama Kegiatan Internal',
    placeholder: 'cth: Diklat Ruang Kru Magang Batch 2026',
    deptLabel: 'Divisi / Panitia Internal',
    deptPlaceholder: 'cth: Divisi PSDM / Panitia Diklat'
  },
  {
    value: 'operasional',
    label: 'Kebutuhan Operasional Divisi',
    desc: 'Keperluan teknis studio, pemeliharaan alat, operasional manajemen & divisi',
    badge: 'Operasional Divisi',
    badgeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    icon: Wrench,
    fieldLabel: 'Rincian Kebutuhan Operasional',
    placeholder: 'cth: Uji Coba Studio Siaran & Kalibrasi Audio',
    deptLabel: 'Divisi Pengaju',
    deptPlaceholder: 'cth: Divisi Teknisi & Studio'
  },
  {
    value: 'eksternal',
    label: 'Kerjasama / Peminjaman Eksternal',
    desc: 'Peminjaman oleh DEMA, SEMA, UKM lain, Ormawa Fakultas, atau instansi luar',
    badge: 'Eksternal / Ormawa',
    badgeColor: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    icon: Building,
    fieldLabel: 'Nama Organisasi / Kegiatan Kerjasama',
    placeholder: 'cth: Peminjaman Alat untuk Acara DEMA FDK',
    deptLabel: 'Nama Lembaga / Ormawa Peminjam',
    deptPlaceholder: 'cth: DEMA Fakultas Dakwah dan Komunikasi'
  },
  {
    value: 'akademik',
    label: 'Tugas Akademik & Praktikum Mahasiswa',
    desc: 'Praktikum siaran televisi, ujian praktek mata kuliah, karya akhir / skripsi',
    badge: 'Tugas / Praktikum',
    badgeColor: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
    icon: GraduationCap,
    fieldLabel: 'Mata Kuliah / Judul Tugas Praktikum',
    placeholder: 'cth: Tugas Akhir Praktikum Produksi TV (KPI)',
    deptLabel: 'Program Studi / Semester',
    deptPlaceholder: 'cth: Mahasiswa KPI Semester 6'
  }
];

/**
 * Mengambil konfigurasi keperluan berdasarkan value atau substring
 */
export function getKeperluanConfig(val) {
  if (!val) return KEPERLUAN_OPTIONS[0];
  const normalized = String(val).toLowerCase();
  const found = KEPERLUAN_OPTIONS.find(opt => 
    opt.value === normalized || 
    normalized.includes(opt.value) || 
    normalized.includes(opt.label.toLowerCase())
  );
  return found || KEPERLUAN_OPTIONS[0];
}

/**
 * Format teks keperluan rapi untuk disimpan di database
 */
export function formatPurposeString(categoryValue, specificDetails) {
  const opt = getKeperluanConfig(categoryValue);
  const details = (specificDetails || '').trim();
  if (!details) return `[${opt.label}]`;
  if (details.startsWith('[')) return details;
  return `[${opt.label}] ${details}`;
}

/**
 * Ekstrak kategori dan detail dari teks purpose yang tersimpan
 */
export function parsePurposeString(purposeText) {
  if (!purposeText) return { category: KEPERLUAN_OPTIONS[0], details: '' };
  const str = String(purposeText).trim();
  const match = str.match(/^\[(.*?)\]\s*(.*)$/);
  if (match) {
    const catLabel = match[1];
    const details = match[2];
    const cat = getKeperluanConfig(catLabel);
    return { category: cat, details };
  }
  return { category: getKeperluanConfig(str), details: str };
}
