import React, { useState } from 'react';
import { 
  X, Calendar as CalendarIcon, User, CreditCard, Smartphone, 
  Briefcase, FileText, AlertTriangle, Info, ShoppingBag, Trash2, CheckCircle2 
} from 'lucide-react';

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
  
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
      id="cart-overlay" 
      onClick={(e) => { if (e.target.id === 'cart-overlay') onClose(); }}
    >
      <div 
        className="fixed inset-y-0 right-0 w-full sm:max-w-md md:max-w-lg bg-card/95 dark:bg-[#0c171d]/95 backdrop-blur-2xl border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden" 
        id="cart-modal"
      >
        
        {/* Drawer Header */}
        <div className="p-5 border-b border-border bg-muted/30 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg tracking-tight text-foreground flex items-center gap-2">
                Keranjang Booking Alat
              </h2>
              <div className="text-xs font-mono text-primary font-bold">
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
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* Auth requirement warning if not logged in */}
          {(!currentUser || currentUser.isAnonymous) && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-2xl p-4 flex gap-3 shadow-sm animate-in fade-in">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs uppercase tracking-wider mb-1">Perlu Login Akun</p>
                <p className="text-xs leading-relaxed mb-3 opacity-90">
                  Untuk mengajukan peminjaman alat resmi dan penerbitan surat SPA, Anda wajib masuk dengan akun terdaftar.
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

          {/* Cart Items List */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-[11px] font-mono text-foreground/60 uppercase tracking-wider font-bold">
                Peralatan Yang Dipinjam ({cart.length})
              </label>
              {cart.length > 0 && (
                <span className="text-[10px] text-foreground/40 font-mono">Siap diterbitkan SPA</span>
              )}
            </div>

            {cart.length > 0 ? (
              <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                {cart.map((c, i) => (
                  <div 
                    key={i} 
                    className="flex justify-between items-center p-3 bg-muted/30 border border-border rounded-xl group hover:border-primary/50 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {c.img ? (
                        <img src={c.img} alt={c.name} className="w-10 h-10 object-contain rounded-lg bg-background/50 p-1 flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
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
            ) : (
              <div className="text-center p-8 text-foreground/50 font-mono text-xs border border-border border-dashed rounded-2xl">
                Keranjang masih kosong. Pilih alat dari katalog untuk memulai.
              </div>
            )}
          </div>
          
          {/* Booking Form */}
          <form onSubmit={submitBooking} className="space-y-4 pt-4 border-t border-border">
            <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 text-primary">
              <FileText className="w-4 h-4" /> Formulir Peminjam & Jadwal
            </div>

            <div className="space-y-3.5">
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
                    className="w-full bg-muted/40 border border-border rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary text-xs transition-all" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-mono text-foreground/60 uppercase tracking-wider mb-1 font-bold">
                  NIM / NIC Dakwah TV
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                  <input 
                    name="nim" 
                    required 
                    placeholder="Nomor Induk Mahasiswa / NIC"
                    className="w-full bg-muted/40 border border-border rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary text-xs transition-all" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-foreground/60 uppercase tracking-wider mb-1 font-bold">
                  Asal Peminjam
                </label>
                <select 
                  name="origin" 
                  value={origin} 
                  onChange={(e) => setOrigin(e.target.value)} 
                  className="w-full bg-muted/40 border border-border rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-primary text-xs transition-all font-medium cursor-pointer"
                >
                  <option value="internal">Internal Dakwah TV</option>
                  <option value="eksternal">Eksternal (UKM lain / Fakultas Dakwah)</option>
                </select>
              </div>
              
              {origin === 'eksternal' && (
                <div className="p-3.5 bg-muted/40 border border-border rounded-xl space-y-2">
                  <label className="flex items-center gap-1.5 text-[10px] font-mono text-foreground/70 uppercase tracking-wider font-bold">
                    <FileText className="w-3.5 h-3.5 text-primary" /> Dokumen Pendukung 
                    <span className="text-destructive">*wajib</span>
                  </label>
                  <p className="text-[11px] text-foreground/50">Upload foto KTM atau Surat Pengantar peminjaman.</p>
                  <input 
                    type="file" 
                    name="doc" 
                    accept="image/*" 
                    className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" 
                  />
                </div>
              )}
              
              <div>
                <label className="block text-[10px] font-mono text-foreground/60 uppercase tracking-wider mb-1 font-bold">
                  Departemen / Unit Produksi
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                  <input 
                    name="dept" 
                    placeholder="Misal: Creative Media / Program Berita" 
                    className="w-full bg-muted/40 border border-border rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary text-xs transition-all" 
                  />
                </div>
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
                    placeholder="08xxxxxxxxxx" 
                    className="w-full bg-muted/40 border border-border rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary text-xs transition-all" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-foreground/60 uppercase tracking-wider mb-1 font-bold">
                  Keperluan Produksi / Syuting
                </label>
                <textarea 
                  name="purpose" 
                  rows="2" 
                  placeholder="Sebutkan kegiatan syuting atau proker dengan jelas..." 
                  className="w-full bg-muted/40 border border-border rounded-xl p-3 focus:outline-none focus:border-primary text-xs transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-foreground/60 uppercase tracking-wider mb-1 font-bold">
                    Tgl Ambil
                  </label>
                  <input 
                    name="start" 
                    type="date" 
                    required 
                    onChange={(e) => {
                      const endInput = e.target.form?.end;
                      const conflicts = checkDateConflicts(e.target.value, endInput?.value);
                      if (conflicts && conflicts.length > 0) {
                        setConflictWarn({ hasConflict: true, conflictItems: conflicts });
                      } else if (e.target.value && endInput?.value) {
                        setConflictWarn({ hasConflict: false, message: '✅ Tanggal tersedia.' });
                      } else {
                        setConflictWarn(null);
                      }
                    }}
                    className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-primary text-xs transition-all cursor-pointer" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-foreground/60 uppercase tracking-wider mb-1 font-bold">
                    Tgl Kembali
                  </label>
                  <input 
                    name="end" 
                    type="date" 
                    required 
                    onChange={(e) => {
                      const startInput = e.target.form?.start;
                      const conflicts = checkDateConflicts(startInput?.value, e.target.value);
                      if (conflicts && conflicts.length > 0) {
                        setConflictWarn({ hasConflict: true, conflictItems: conflicts });
                      } else if (startInput?.value && e.target.value) {
                        setConflictWarn({ hasConflict: false, message: '✅ Tanggal tersedia.' });
                      } else {
                        setConflictWarn(null);
                      }
                    }}
                    className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-primary text-xs transition-all cursor-pointer" 
                  />
                </div>
              </div>
            </div>

            {/* Conflict Warning Box */}
            {conflictWarn && (
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
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
                      <strong className="underline">{conflictWarn.conflictItems?.join(', ')}</strong>. Silakan pilih jadwal lain.
                    </>
                  ) : (
                    conflictWarn.message
                  )}
                </div>
              </div>
            )}
            
            {/* Drawer Action Buttons */}
            <div className="pt-3 flex flex-col gap-2">
              <button 
                type="submit" 
                disabled={isSubmitting || (conflictWarn && conflictWarn.hasConflict) || cart.length === 0} 
                className="w-full py-3 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 cursor-pointer shadow-md shadow-primary/20"
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
        </div>
      </div>
    </div>
  );
}
