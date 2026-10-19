import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { normalizeBooking, fmtDate } from '../utils/normalize';
import { parsePurposeString } from '../utils/keperluan';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Info, 
  MessageCircle, 
  Calendar, 
  Clock, 
  Package, 
  FileText, 
  User, 
  Phone, 
  Building, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

export default function Surat() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [secretaryPhone, setSecretaryPhone] = useState('6285748805720'); // Default nomor sekretaris Dakwah TV

  useEffect(() => {
    // Fetch secretary / admin WA numbers from config
    const fetchSecretaryContact = async () => {
      try {
        const { data } = await supabase.from('config').select('value').eq('key', 'adminWaNumbers').maybeSingle();
        if (data?.value) {
          const numbers = Array.isArray(data.value) ? data.value : [data.value];
          if (numbers.length > 0 && numbers[0]) {
            const clean = String(numbers[0]).replace(/[^0-9]/g, '');
            if (clean) setSecretaryPhone(clean);
          }
        }
      } catch (err) {
        console.warn("Could not fetch secretary contact:", err);
      }
    };
    fetchSecretaryContact();

    if (id) {
      const fetchBookingData = async () => {
        try {
          const { data, error } = await supabase
            .from('bookings')
            .select('*, booking_items(inventory(*))')
            .eq('id', id)
            .maybeSingle();

          if (data) {
            setBooking(normalizeBooking(data));
          }
        } catch (e) {
          console.error("Error fetching booking details:", e);
        } finally {
          setLoading(false);
        }
      };
      fetchBookingData();
    }
  }, [id]);

  const parsedPurpose = booking ? parsePurposeString(booking.purpose) : null;
  const CatIcon = parsedPurpose?.category?.icon;

  const generateSecretaryWaLink = () => {
    const phone = secretaryPhone.startsWith('0') ? '62' + secretaryPhone.slice(1) : secretaryPhone;
    if (!booking) {
      const text = encodeURIComponent(
        "Halo Sekretaris Dakwah TV, saya ingin berkoordinasi perihal pengurusan berkas surat resmi / SPA peminjaman alat produksi Dakwah TV."
      );
      return `https://wa.me/${phone}?text=${text}`;
    }

    const itemsStr = (booking.items || []).map(i => i.name).join(', ') || '-';
    const text = encodeURIComponent(
      `Assalamu'alaikum Wr. Wb. Halo Sekretaris Dakwah TV,\n\n` +
      `Saya ingin berkoordinasi mengenai pengurusan surat resmi (SPA / Izin Fisik) untuk peminjaman alat yang telah diajukan di sistem:\n\n` +
      `📌 *ID Booking:* #${booking.id}\n` +
      `👤 *Peminjam:* ${booking.userName || '-'}\n` +
      `📺 *Unit/Departemen:* ${booking.userDept || '-'}\n` +
      `🎯 *Keperluan:* [${parsedPurpose?.category?.label}] ${parsedPurpose?.details || booking.purpose}\n` +
      `📅 *Periode:* ${fmtDate(booking.dateStart)} s/d ${fmtDate(booking.dateEnd)}\n` +
      `📦 *Alat:* ${itemsStr}\n\n` +
      `Mohon informasinya perihal kelengkapan surat resmi bertanda tangan. Terima kasih!`
    );
    return `https://wa.me/${phone}?text=${text}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-teal selection:text-background">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border py-4 px-4 sm:px-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/logo-mark.png" className="h-8 w-8 object-contain drop-shadow-sm group-hover:scale-105 transition-transform" alt="Logo" />
            <span className="font-heading font-black text-lg tracking-tight uppercase text-foreground">
              DAKWAH <span className="text-teal">TV</span>
            </span>
          </Link>
          <span className="hidden sm:inline text-xs font-mono px-2.5 py-0.5 rounded-full bg-teal/10 text-teal border border-teal/20 font-bold">
            Administrasi & Surat
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link 
            to="/katalog" 
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-foreground/75 hover:text-foreground hover:bg-muted rounded-xl transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Katalog Alat
          </Link>
          <Link 
            to="/dashboard" 
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal text-background hover:bg-teal-light rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            Dashboard Peminjam
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        
        {/* Banner Kebijakan Surat */}
        <div className="bg-gradient-to-br from-teal/10 via-card to-card border border-teal/30 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-teal/10 blur-3xl rounded-full pointer-events-none" />
          
          <div className="flex items-start gap-4 sm:gap-5 relative z-10">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-teal/15 text-teal border border-teal/30 flex items-center justify-center flex-shrink-0 shadow-sm">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal/15 text-teal text-[11px] font-mono font-bold uppercase tracking-wider border border-teal/30">
                <Sparkles className="w-3.5 h-3.5" /> Kebijakan Peminjaman Baru
              </div>

              <h1 className="text-2xl sm:text-3xl font-black font-heading tracking-tight text-foreground">
                Persetujuan Langsung <span className="text-teal">(Direct Approval)</span>
              </h1>

              <p className="text-sm sm:text-base text-foreground/75 leading-relaxed">
                Kini sistem peminjaman alat di Dakwah TV telah disederhanakan. Anda <strong>tidak perlu mencetak atau membuat Surat Peminjaman Alat (SPA) mandiri</strong> di website. Pengajuan peminjaman alat yang masuk akan langsung disetujui oleh Admin & Tim Teknis di sistem.
              </p>

              <div className="bg-background/60 border border-border/80 rounded-2xl p-4 sm:p-5 mt-4 text-xs sm:text-sm text-foreground/80 space-y-2">
                <div className="font-bold text-foreground flex items-center gap-2">
                  <Info className="w-4 h-4 text-teal" /> Memerlukan Surat Fisik Resmi Bertanda Tangan?
                </div>
                <p className="leading-relaxed">
                  Apabila kegiatan/acara Anda memerlukan surat permohonan resmi fisik (misal: untuk dispensasi kuliah, perizinan kampus, atau MoU Ormawa), pembuatan dan penerbitan berkas resmi kini <strong>ditangani langsung secara terpadu oleh Sekretaris Dakwah TV</strong>.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap gap-3">
                <a 
                  href={generateSecretaryWaLink()}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md hover:shadow-emerald-600/20"
                >
                  <MessageCircle className="w-4 h-4" /> Hubungi Sekretaris Dakwah TV via WhatsApp
                </a>
                <Link
                  to="/katalog"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-muted/60 hover:bg-muted text-foreground font-semibold text-xs sm:text-sm rounded-xl transition-all border border-border"
                >
                  Ajukan Peminjaman Alat Baru
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Detail Booking Terpilih (Jika ada ID) */}
        {loading ? (
          <div className="p-8 text-center bg-card border border-border rounded-2xl animate-pulse">
            <div className="w-8 h-8 border-3 border-teal border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-mono text-foreground/50">Memuat rincian data booking...</p>
          </div>
        ) : booking ? (
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border gap-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-foreground/50 block mb-1">DATA PENGAJUAN</span>
                <h2 className="text-xl font-bold font-heading flex items-center gap-2">
                  Booking #{booking.id}
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full bg-teal/15 text-teal border border-teal/30 text-xs font-mono font-bold uppercase w-fit">
                {booking.status === 'approved' || booking.status === 'letter_ready' ? 'Disetujui (Siap Diambil)' : booking.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-background border border-border p-4 rounded-xl">
                <span className="text-[10px] font-mono text-foreground/50 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-teal" /> Nama Peminjam
                </span>
                <div className="font-bold text-sm">{booking.userName || '-'}</div>
                <div className="text-xs text-foreground/60 font-mono mt-0.5">{booking.userNim ? `NIM: ${booking.userNim}` : ''}</div>
              </div>

              <div className="bg-background border border-border p-4 rounded-xl">
                <span className="text-[10px] font-mono text-foreground/50 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-teal" /> Kontak WhatsApp
                </span>
                <div className="font-bold text-sm font-mono">{booking.userPhone || '-'}</div>
              </div>

              <div className="bg-background border border-border p-4 rounded-xl sm:col-span-2">
                <span className="text-[10px] font-mono text-foreground/50 uppercase tracking-wider block mb-1">
                  Kategori & Keperluan
                </span>
                <div className="flex items-center gap-2 mb-2">
                  {CatIcon && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${parsedPurpose.category.badgeColor}`}>
                      <CatIcon className="w-3.5 h-3.5" />
                      {parsedPurpose.category.badge}
                    </span>
                  )}
                  <span className="text-xs text-foreground/60 font-mono">
                    {parsedPurpose.category.deptLabel}: {booking.userDept || '-'}
                  </span>
                </div>
                <div className="text-sm font-medium text-foreground/90">
                  {parsedPurpose.details || booking.purpose || '-'}
                </div>
              </div>

              <div className="bg-background border border-border p-4 rounded-xl sm:col-span-2">
                <span className="text-[10px] font-mono text-foreground/50 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal" /> Periode Peminjaman
                </span>
                <div className="font-bold text-sm font-mono">
                  {fmtDate(booking.dateStart)} s/d {fmtDate(booking.dateEnd)}
                </div>
              </div>
            </div>

            {/* Peralatan */}
            <div className="pt-2">
              <span className="text-xs font-mono uppercase tracking-wider text-teal font-bold block mb-3 flex items-center gap-1.5">
                <Package className="w-4 h-4" /> Daftar Alat Dipinjam ({(booking.items || []).length} Unit)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(booking.items || []).map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-background border border-border text-xs font-semibold flex items-center justify-between">
                    <span className="text-foreground">{item.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-foreground/60">
                      {item.cat || 'Alat'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* 4 Langkah Alur Peminjaman Baru */}
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 space-y-6">
          <h3 className="font-heading font-bold text-lg sm:text-xl text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-teal" /> Alur Cepat Peminjaman Alat Dakwah TV
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-background border border-border space-y-2">
              <div className="w-7 h-7 rounded-full bg-teal/15 text-teal font-mono font-bold flex items-center justify-center text-xs">
                1
              </div>
              <h4 className="font-bold text-sm">Pilih di Katalog</h4>
              <p className="text-xs text-foreground/65 leading-relaxed">
                Pilih alat yang Anda butuhkan, tentukan tanggal pinjam & kembali, lalu kirim pengajuan.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-background border border-border space-y-2">
              <div className="w-7 h-7 rounded-full bg-teal/15 text-teal font-mono font-bold flex items-center justify-center text-xs">
                2
              </div>
              <h4 className="font-bold text-sm">Persetujuan Langsung</h4>
              <p className="text-xs text-foreground/65 leading-relaxed">
                Admin & Tim Teknis menyetujui peminjaman langsung di sistem tanpa perlu terbit surat di web.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-background border border-border space-y-2">
              <div className="w-7 h-7 rounded-full bg-teal/15 text-teal font-mono font-bold flex items-center justify-center text-xs">
                3
              </div>
              <h4 className="font-bold text-sm">Surat Fisik (Opsional)</h4>
              <p className="text-xs text-foreground/65 leading-relaxed">
                Jika membutuhkan surat izin fisik/resmi bertanda tangan, hubungi Sekretaris Dakwah TV.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-background border border-border space-y-2">
              <div className="w-7 h-7 rounded-full bg-teal/15 text-teal font-mono font-bold flex items-center justify-center text-xs">
                4
              </div>
              <h4 className="font-bold text-sm">Ambil di Studio</h4>
              <p className="text-xs text-foreground/65 leading-relaxed">
                Kru atau peminjam mengambil peralatan di Studio Dakwah TV sesuai jadwal yang disetujui.
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
