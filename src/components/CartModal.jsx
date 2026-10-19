import React, { useState } from 'react';
import { 
  X, Calendar as CalendarIcon, User, CreditCard, Smartphone, 
  Briefcase, FileText, AlertTriangle, Info, ShoppingBag, Trash2, CheckCircle2,
  ChevronDown, Building, ArrowRight, Hash
} from 'lucide-react';
import { KEPERLUAN_OPTIONS, getKeperluanConfig } from '../utils/keperluan';
import CustomSelect from './ui/CustomSelect';
import IndonesianDatePicker from './ui/IndonesianDatePicker';

function formatHumanDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function CartModal({ 
  isOpen, 
  onClose, 
  cart = [], 
  removeFromCart, 
  submitBooking, 
  currentUser, 
  openAuthModal, 
  isSubmitting, 
  conflictWarn, 
  setConflictWarn, 
  checkDateConflicts 
}) {
  const [origin, setOrigin] = useState('internal');
  const [keperluanType, setKeperluanType] = useState('program');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const activeKeperluan = getKeperluanConfig(keperluanType);

  const handleStartDateChange = (val) => {
    setStartDate(val);
    let currentEnd = endDate;
    if (endDate && val && val > endDate) {
      currentEnd = val;
      setEndDate(val);
    }
    const conflicts = checkDateConflicts(val, currentEnd);
    if (conflicts && conflicts.length > 0) {
      setConflictWarn({ hasConflict: true, conflictItems: conflicts });
    } else if (val && currentEnd) {
      setConflictWarn({ hasConflict: false, message: '✅ Tanggal tersedia, tidak ada jadwal bentrok.' });
    } else {
      setConflictWarn(null);
    }
  };

  const handleEndDateChange = (val) => {
    setEndDate(val);
    const conflicts = checkDateConflicts(startDate, val);
    if (conflicts && conflicts.length > 0) {
      setConflictWarn({ hasConflict: true, conflictItems: conflicts });
    } else if (startDate && val) {
      setConflictWarn({ hasConflict: false, message: '✅ Tanggal tersedia, tidak ada jadwal bentrok.' });
    } else {
      setConflictWarn(null);
    }
  };

  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
      id="cart-overlay" 
      onClick={(e) => { if (e.target.id === 'cart-overlay') onClose(); }}
    >
      <div 
        className="fixed inset-y-0 right-0 w-full sm:max-w-md md:max-w-lg bg-card/95 dark:bg-[#0c171d]/98 backdrop-blur-2xl border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden" 
        id="cart-modal"
      >
        
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-muted/30 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal/15 text-teal flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-lg tracking-tight text-foreground flex items-center gap-2">
                Keranjang Booking Alat
              </h2>
              <div className="text-xs font-mono text-teal font-bold">
                {cart.length} peralatan dipilih
              </div>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 text-foreground/50 hover:text-foreground rounded-xl hover:bg-muted transition-colors cursor-pointer"
            title="Tutup Keranjang"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Auth requirement warning if not logged in */}
          {(!currentUser || currentUser.isAnonymous) && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-2xl p-4 flex gap-3 shadow-sm animate-in fade-in">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <p className="font-bold text-xs uppercase tracking-wider mb-1">Perlu Login Akun</p>
                <p className="text-xs leading-relaxed mb-3 opacity-90">
                  Untuk mengajukan peminjaman alat resmi, Anda wajib masuk dengan akun terdaftar.
                </p>
                <button 
                  type="button" 
                  onClick={openAuthModal} 
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold rounded-xl text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <User className="w-3.5 h-3.5" /> Login / Daftar Akun
                </button>
              </div>
            </div>
          )}

          {/* Cart Empty State */}
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-teal/10 text-teal flex items-center justify-center">
                <ShoppingBag className="w-8 h-8 opacity-75" />
              </div>
              <div className="space-y-1.5 max-w-xs">
                <h3 className="font-heading font-bold text-base text-foreground">
                  Keranjang Peminjaman Kosong
                </h3>
                <p className="text-xs text-foreground/60 leading-relaxed">
                  Belum ada peralatan yang dipilih. Silakan klik tombol <strong>Pinjam Alat</strong> pada katalog untuk menambahkan peralatan produksi.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-teal text-background font-bold text-xs rounded-xl hover:bg-teal-light transition-all shadow-md cursor-pointer"
              >
                Pilih Alat di Katalog <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              {/* Cart Items List */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-[11px] font-mono text-foreground/60 uppercase tracking-wider font-bold">
                    Peralatan Yang Dipinjam ({cart.length})
                  </label>
                  <span className="text-[10px] text-teal font-mono font-semibold">Siap diajukan</span>
                </div>

                <div className="space-y-2 max-h-[28vh] overflow-y-auto pr-1">
                  {cart.map((c, i) => (
                    <div 
                      key={i} 
                      className="flex justify-between items-center p-3 bg-muted/30 border border-border rounded-xl group hover:border-teal/50 transition-all shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {c.img ? (
                          <img src={c.img} alt={c.name} className="w-10 h-10 object-contain rounded-lg bg-background/50 p-1 flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-teal/10 text-teal flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {c.cat ? c.cat.slice(0, 2).toUpperCase() : 'EQ'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-foreground block truncate">{c.name}</span>
                          <span className="text-[10px] font-mono text-foreground/50">{c.cat || 'Alat'}</span>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => removeFromCart(i)} 
                        className="p-1.5 text-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer" 
                        title="Hapus dari keranjang"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Booking Form */}
              <form onSubmit={submitBooking} className="space-y-5 pt-4 border-t border-border">
                
                {/* SECTION 1: IDENTITAS PEMINJAM */}
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-teal font-heading">
                    <User className="w-3.5 h-3.5" /> 1. Data Peminjam
                  </div>

                  <div className="space-y-3 bg-muted/20 border border-border/80 rounded-2xl p-3.5">
                    <div>
                      <label className="block text-[10px] font-mono text-foreground/60 uppercase tracking-wider mb-1 font-bold">
                        Nama Lengkap Peminjam
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                        <input 
                          name="name" 
                          required 
                          defaultValue={currentUser ? (currentUser.displayName || currentUser.user_metadata?.display_name || "") : ""} 
                          placeholder="Nama lengkap peminjam"
                          className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-teal text-xs transition-all font-medium" 
                        />
                      </div>
                    </div>
                    
                    {/* NIM / NIC Field with Dynamic Label & Helper */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-mono text-foreground/70 uppercase tracking-wider font-bold flex items-center gap-1.5">
                          {origin === 'internal' ? 'NIC Dakwah TV (Nomor Induk Crew)' : 'NIM / NIK / No. Identitas'}
                          <span className="text-destructive">*wajib</span>
                        </label>
                        <span className="text-[9px] font-mono text-teal bg-teal/10 px-1.5 py-0.5 rounded font-semibold uppercase">
                          {origin === 'internal' ? 'Kru Dakwah TV' : 'Eksternal'}
                        </span>
                      </div>
                      <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-foreground/40">
                          {origin === 'internal' ? <Hash className="w-4 h-4 text-teal" /> : <CreditCard className="w-4 h-4" />}
                        </div>
                        <input 
                          key={origin}
                          name="nim" 
                          required 
                          defaultValue={currentUser?.nim || currentUser?.user_metadata?.nim || ""}
                          placeholder={origin === 'internal' ? 'Contoh: DTV-024 atau 2024xxx' : 'Nomor Induk Mahasiswa / NIK KTP'}
                          className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-teal text-xs transition-all font-medium font-mono" 
                        />
                      </div>
                      <p className="text-[10px] text-foreground/50 mt-1 leading-snug">
                        {origin === 'internal' 
                          ? '*Nomor Induk Crew resmi Dakwah TV untuk pencatatan inventaris internal.' 
                          : '*Nomor Induk Mahasiswa atau NIK KTP penanggung jawab kegiatan.'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-foreground/60 uppercase tracking-wider mb-1 font-bold">
                        No. WhatsApp Aktif
                      </label>
                      <div className="relative">
                        <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                        <input 
                          name="phone" 
                          type="tel" 
                          required
                          defaultValue={currentUser?.phone || currentUser?.user_metadata?.phone || ""}
                          placeholder="08xxxxxxxxxx" 
                          className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-teal text-xs transition-all font-medium" 
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-foreground/60 uppercase tracking-wider mb-1.5 font-bold">
                        Status Peminjam
                      </label>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-background border border-border rounded-xl">
                        <button
                          type="button"
                          onClick={() => setOrigin('internal')}
                          className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            origin === 'internal'
                              ? 'bg-teal text-background shadow-xs'
                              : 'text-foreground/70 hover:text-foreground'
                          }`}
                        >
                          <Building className="w-3.5 h-3.5" /> Internal Kru
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrigin('eksternal')}
                          className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            origin === 'eksternal'
                              ? 'bg-teal text-background shadow-xs'
                              : 'text-foreground/70 hover:text-foreground'
                          }`}
                        >
                          <Briefcase className="w-3.5 h-3.5" /> Eksternal
                        </button>
                      </div>
                      <input type="hidden" name="origin" value={origin} />
                    </div>
                    
                    {origin === 'eksternal' && (
                      <div className="p-3 bg-background border border-border rounded-xl space-y-2 animate-in fade-in">
                        <label className="flex items-center gap-1.5 text-[10px] font-mono text-foreground/70 uppercase tracking-wider font-bold">
                          <FileText className="w-3.5 h-3.5 text-teal" /> Dokumen Pendukung (KTM/ID Card)
                          <span className="text-destructive">*wajib</span>
                        </label>
                        <p className="text-[11px] text-foreground/50">Unggah foto identitas KTM atau surat permohonan peminjaman.</p>
                        <input 
                          type="file" 
                          name="doc" 
                          accept="image/*" 
                          required
                          className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-teal/10 file:text-teal hover:file:bg-teal/20 cursor-pointer" 
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION 2: KEPERLUAN & TANGGAL */}
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-teal font-heading">
                    <CalendarIcon className="w-3.5 h-3.5" /> 2. Keperluan & Jadwal
                  </div>

                  <div className="space-y-3 bg-muted/20 border border-border/80 rounded-2xl p-3.5">
                    
                    {/* Kategori Keperluan (Custom Dropdown) */}
                    <div>
                      <label className="block text-[10px] font-mono text-foreground/60 uppercase tracking-wider mb-1 font-bold">
                        Kategori Keperluan Peminjaman
                      </label>
                      <CustomSelect
                        name="category_purpose"
                        value={keperluanType}
                        onChange={(val) => {
                          setKeperluanType(val);
                          if (val === 'eksternal') setOrigin('eksternal');
                        }}
                        options={KEPERLUAN_OPTIONS.map((opt) => ({
                          value: opt.value,
                          label: opt.label,
                          description: opt.desc,
                          icon: opt.icon
                        }))}
                        placeholder="Pilih Kategori Keperluan..."
                      />

                      {/* Info Badge Kategori */}
                      <div className={`mt-2 p-2.5 rounded-xl border text-[11px] flex items-center gap-2 ${activeKeperluan.badgeColor}`}>
                        {React.createElement(activeKeperluan.icon, { className: "w-4 h-4 shrink-0" })}
                        <span className="leading-snug">{activeKeperluan.desc}</span>
                      </div>
                    </div>

                    {/* Divisi / Tim Program */}
                    <div>
                      <label className="block text-[10px] font-mono text-foreground/60 uppercase tracking-wider mb-1 font-bold">
                        {activeKeperluan.deptLabel || "Divisi / Unit Peminjam"}
                      </label>
                      <div className="relative">
                        <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                        <input 
                          name="dept" 
                          required
                          defaultValue={currentUser?.dept || ""}
                          placeholder={activeKeperluan.deptPlaceholder || "Misal: Divisi Produksi"} 
                          className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-teal text-xs transition-all font-medium" 
                        />
                      </div>
                    </div>

                    {/* Rincian Kegiatan */}
                    <div>
                      <label className="block text-[10px] font-mono text-foreground/60 uppercase tracking-wider mb-1 font-bold">
                        {activeKeperluan.fieldLabel || "Rincian Kegiatan / Acara"}
                      </label>
                      <textarea 
                        name="purpose" 
                        rows="2" 
                        required
                        placeholder={activeKeperluan.placeholder || "Sebutkan nama acara / keperluan dengan jelas..."} 
                        className="w-full bg-background border border-border rounded-xl p-3 focus:outline-none focus:border-teal text-xs transition-all resize-none font-medium" 
                      />
                    </div>

                    {/* Tanggal Ambil & Kembali (Indonesian Date Pickers DD/MM/YYYY) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] font-mono text-foreground/60 uppercase tracking-wider mb-1 font-bold">
                          Tanggal Ambil (DD/MM/YYYY)
                        </label>
                        <IndonesianDatePicker
                          name="start"
                          value={startDate}
                          onChange={(val) => handleStartDateChange(val)}
                          minDate={todayStr}
                          rangeStart={startDate}
                          rangeEnd={endDate}
                          required
                          placeholder="Pilih tgl ambil"
                          align="left"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-foreground/60 uppercase tracking-wider mb-1 font-bold">
                          Tanggal Kembali (DD/MM/YYYY)
                        </label>
                        <IndonesianDatePicker
                          name="end"
                          value={endDate}
                          onChange={(val) => handleEndDateChange(val)}
                          minDate={startDate || todayStr}
                          rangeStart={startDate}
                          rangeEnd={endDate}
                          required
                          placeholder="Pilih tgl kembali"
                          align="right"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Conflict Warning Box */}
                {conflictWarn && (
                  <div className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs ${
                    conflictWarn.hasConflict 
                      ? 'bg-destructive/10 border-destructive/30 text-destructive' 
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {conflictWarn.hasConflict ? (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div className="leading-relaxed font-medium">
                      {conflictWarn.hasConflict ? (
                        <>
                          ⚠️ Alat berikut sudah terbooking pada tanggal tersebut:{' '}
                          <strong className="underline">{conflictWarn.conflictItems?.join(', ')}</strong>. Silakan pilih tanggal lain.
                        </>
                      ) : (
                        conflictWarn.message
                      )}
                    </div>
                  </div>
                )}
                
                {/* Info Surat via Sekretaris */}
                <div className="p-3.5 bg-teal/5 border border-teal/20 rounded-2xl flex items-start gap-2.5 text-xs text-foreground/80">
                  <Info className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground block text-[11px]">Persetujuan Langsung & Surat Fisik:</span>
                    <p className="text-[11px] text-foreground/70 leading-relaxed">
                      Peminjaman ini langsung disetujui di sistem oleh Admin. Jika kegiatan memerlukan berkas surat fisik bertanda tangan resmi (SPA/Izin), pengurusan dilakukan terpisah melalui <strong>Sekretaris Dakwah TV</strong>.
                    </p>
                  </div>
                </div>

                {/* Drawer Action Buttons */}
                <div className="pt-2 flex flex-col gap-2.5">
                  <button 
                    type="submit" 
                    disabled={isSubmitting || (conflictWarn && conflictWarn.hasConflict) || cart.length === 0 || !startDate || !endDate} 
                    className="w-full py-3 bg-teal text-background font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-teal-light transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 cursor-pointer shadow-md shadow-teal/20"
                  >
                    {isSubmitting ? 'Mengirim Data Pengajuan...' : 'Kirim Permintaan Booking'}
                  </button>
                  <button 
                    type="button" 
                    onClick={onClose} 
                    className="w-full py-2.5 bg-muted/40 border border-border text-foreground/80 font-bold rounded-xl hover:bg-muted transition-colors text-xs cursor-pointer"
                  >
                    Batal / Tutup Keranjang
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
