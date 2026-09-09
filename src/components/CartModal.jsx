import React, { useState } from 'react';
import { X, Calendar as CalendarIcon, User, CreditCard, Smartphone, Briefcase, FileText, AlertTriangle, Info } from 'lucide-react';

export default function CartModal({ isOpen, onClose, cart = [], removeFromCart, submitBooking, currentUser, openAuthModal, isSubmitting, conflictWarn, setConflictWarn, checkDateConflicts }) {
  const [origin, setOrigin] = useState('internal');
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in" id="cart-overlay" onClick={(e) => { if (e.target.id === 'cart-overlay') onClose(); }}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95" id="cart-modal">
        
        {/* Header */}
        <div className="p-5 border-b border-border bg-muted/30 flex justify-between items-center shrink-0">
          <div>
            <h2 className="font-black text-xl tracking-tight uppercase flex items-center gap-2">
               Booking Alat
            </h2>
            <div className="text-xs font-mono text-primary font-bold mt-1">
               {cart.length} alat dipilih
            </div>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-foreground/50 hover:text-foreground rounded-lg hover:bg-accent transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-6">
          {(!currentUser || currentUser.isAnonymous) && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-500 rounded-xl p-4 flex gap-3 shadow-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm mb-1 uppercase tracking-wider">Wajib Login</p>
                <p className="text-xs leading-relaxed mb-3 opacity-90">Fitur pengajuan booking alat khusus untuk peminjam yang telah memiliki akun terdaftar. Silakan login atau buat akun baru terlebih dahulu.</p>
                <button type="button" onClick={openAuthModal} className="px-4 py-2 bg-yellow-500 text-yellow-950 font-bold rounded-lg text-xs hover:bg-yellow-400 transition-colors inline-flex items-center gap-2">
                  <User className="w-4 h-4" /> Login / Daftar Akun
                </button>
              </div>
            </div>
          )}

          {/* Cart Items */}
          {cart.length > 0 ? (
            <div className="space-y-2">
              <label className="block text-[10px] font-mono text-foreground/50 uppercase tracking-wider mb-2">Item Terpilih</label>
              {cart.map((c, i) => (
                <div className="flex justify-between items-center p-3 bg-card border border-border rounded-xl group hover:border-teal/50 hover:shadow-glow transition-colors" key={i}>
                  <span className="font-bold text-sm text-foreground">{c.name}</span>
                  <button type="button" onClick={() => removeFromCart(i)} className="p-1.5 text-destructive/50 hover:text-white hover:bg-destructive rounded-lg transition-colors" title="Hapus">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 text-foreground/50 font-mono text-sm border border-border border-dashed rounded-xl">
               Belum ada alat yang dipilih.
            </div>
          )}
          
          <form onSubmit={submitBooking} className="space-y-4 pt-2 border-t border-border">
            <div className="space-y-4">
               <div>
                  <label className="block text-[10px] font-mono text-foreground/50 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
                  <div className="relative">
                     <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                     <input name="name" required defaultValue={currentUser ? (currentUser.displayName || "") : ""} className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all" />
                  </div>
               </div>
               
               <div>
                  <label className="block text-[10px] font-mono text-foreground/50 uppercase tracking-wider mb-1.5">NIM / NIC Dakwah TV</label>
                  <div className="relative">
                     <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                     <input name="nim" required className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all" />
                  </div>
               </div>

               <div>
                  <label className="block text-[10px] font-mono text-foreground/50 uppercase tracking-wider mb-1.5">Asal Peminjam</label>
                  <select name="origin" value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all appearance-none font-medium">
                    <option value="internal">Internal Dakwah TV</option>
                    <option value="eksternal">Eksternal (UKM lain / Fakultas Dakwah)</option>
                  </select>
               </div>
               
               {origin === 'eksternal' && (
                 <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-2">
                   <label className="flex items-center gap-1.5 text-[10px] font-mono text-foreground/70 uppercase tracking-wider font-bold">
                      <FileText className="w-3.5 h-3.5 text-primary" /> Dokumen Pendukung 
                      <span className="text-destructive">*wajib</span>
                   </label>
                   <p className="text-xs text-foreground/50">Upload foto KTM atau Surat Pengantar peminjaman.</p>
                   <input type="file" name="doc" accept="image/*" className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" />
                 </div>
               )}
               
               <div>
                  <label className="block text-[10px] font-mono text-foreground/50 uppercase tracking-wider mb-1.5">Departemen / Unit</label>
                  <div className="relative">
                     <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                     <input name="dept" placeholder="Mis. Tim Produksi Dakwah TV" className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all" />
                  </div>
               </div>

               <div>
                  <label className="block text-[10px] font-mono text-foreground/50 uppercase tracking-wider mb-1.5">No. HP / WA</label>
                  <div className="relative">
                     <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                     <input name="phone" type="tel" placeholder="08xxxxxxxxxx" className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all" />
                  </div>
               </div>

               <div>
                  <label className="block text-[10px] font-mono text-foreground/50 uppercase tracking-wider mb-1.5">Keperluan Peminjaman</label>
                  <textarea name="purpose" rows="2" placeholder="Sebutkan kegiatan/proker dengan jelas" className="w-full bg-background border border-border rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all resize-none"></textarea>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-foreground/50 uppercase tracking-wider mb-1.5">Tanggal Ambil</label>
                    <input name="start" type="date" required 
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
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-foreground/50 uppercase tracking-wider mb-1.5">Tanggal Kembali</label>
                    <input name="end" type="date" required 
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
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all" />
                  </div>
               </div>
            </div>

            {conflictWarn && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm ${conflictWarn.hasConflict ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-500'}`}>
                {conflictWarn.hasConflict ? <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" /> : <Info className="w-5 h-5 shrink-0 mt-0.5" />}
                <div className="text-xs leading-relaxed font-medium">
                  {conflictWarn.hasConflict ? (
                    <>
                      ⚠️ Alat berikut sudah terbooking pada tanggal tersebut:{' '}
                      <strong className="underline underline-offset-2">{conflictWarn.conflictItems?.join(', ')}</strong>. Silakan pilih tanggal lain.
                    </>
                  ) : (
                    conflictWarn.message
                  )}
                </div>
              </div>
            )}
            
            <div className="pt-4 flex flex-col gap-3">
               <button type="submit" disabled={isSubmitting || (conflictWarn && conflictWarn.hasConflict) || cart.length === 0} className="w-full py-3.5 bg-primary text-primary-foreground font-black uppercase tracking-wider text-sm rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2">
                 {isSubmitting ? 'Mengirim Data...' : 'Kirim Permintaan Booking'}
               </button>
               <button type="button" onClick={onClose} className="w-full py-3 bg-background border border-border text-foreground font-bold rounded-xl hover:bg-accent transition-colors text-sm">
                 Batal / Tutup
               </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
