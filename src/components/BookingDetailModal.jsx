import { normalizeBooking, fmtDate } from '../utils/normalize';
import React, { useState } from 'react';
import { X, Check, XCircle, FileText, ChevronDown, AlertTriangle, Plus } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';

const BK_STATUS_LABEL = {
  pending: "Menunggu Approval",
  approved: "Disetujui",
  rejected: "Ditolak",
  expired: "Kadaluarsa",
  letter_ready: "Surat & Alat Siap Diambil",
  picked_up: "Sedang Dipinjam",
  active: "Sedang Dipinjam",
  returned: "Selesai Dikembalikan",
  returned_late: "Dikembalikan (Terlambat)"
};

export default function BookingDetailModal({ booking: rawBooking, onClose, onApprove, onReject, onGenerateLetter, onMarkLetterReady, onMarkPickedUp, onMarkReturned }) {
  const { toast } = useToast();
  const booking = normalizeBooking(rawBooking);
  const navigate = useNavigate();
  // Return Process States
  const [isReturning, setIsReturning] = useState(false);
  const [returnStatus, setReturnStatus] = useState('returned'); // 'returned' or 'returned_late'
  const [returnConditions, setReturnConditions] = useState(() => {
    const initial = {};
    if (booking && booking.items) {
      booking.items.forEach(item => {
        initial[item.name] = 'lengkap'; // use item name or a unique ID if available. Old system used item.key
      });
    }
    return initial;
  });
  const [returnNote, setReturnNote] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!booking) return null;

  const isBlacklisted = false; // Add logic if needed based on user status

  const handleGenerateClick = () => {
    navigate(`/admin/surat/${booking.id || booking._key}`);
  };

  

  const startReturnProcess = (status) => {
    setReturnStatus(status);
    setIsReturning(true);
  };

  const handleConfirmReturn = async () => {
    if (!onMarkReturned) return;
    
    let proofUrl = null;
    if (proofFile) {
      setIsUploading(true);
      try {
        const fileName = `${Date.now()}_${proofFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const workerUrl = import.meta.env.VITE_R2_WORKER_URL;
        if (!workerUrl) throw new Error("VITE_R2_WORKER_URL belum diatur");
        
        const response = await fetch(`${workerUrl}/${fileName}`, {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer DakwahTV_Aman_2026',
            'Content-Type': proofFile.type || 'application/octet-stream'
          },
          body: proofFile
        });
        
        if (!response.ok) throw new Error(`Upload gagal: ${response.statusText}`);
        const data = await response.json();
        proofUrl = data.url;
      } catch (e) {
        toast.error("Gagal upload foto bukti: " + e.message, "Upload Gagal");
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }
    
    onMarkReturned(booking, returnStatus, returnConditions, returnNote, proofUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-3xl rounded-xl border border-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-6 border-b border-border">
          <h2 className="font-display text-3xl font-bold uppercase">{isReturning ? "PROSES PENGEMBALIAN" : "DETAIL BOOKING"}</h2>
          <div className="font-mono text-sm text-foreground/60 mt-1">
            ID: {booking.id || booking._key} &middot; {isReturning ? booking.userName : (BK_STATUS_LABEL[booking.status] || booking.status)}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scroll flex flex-col gap-6">
          
          {isReturning ? (
            <>
              {/* KONDISI ALAT CHECKLIST */}
              <div>
                <h4 className="font-mono text-[10px] text-teal tracking-widest uppercase mb-3">KONDISI ALAT</h4>
                <div className="bg-background border border-border rounded-lg overflow-hidden flex flex-col">
                  {(booking.items || []).map((item, idx) => (
                    <div key={idx} className="p-4 border-b border-border last:border-b-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="font-bold text-sm">
                        {item.name} <span className="text-foreground/40 font-normal hidden sm:inline">&middot; {item.cat || ""}</span>
                      </div>
                      <div className="flex bg-background border border-border rounded-lg p-1 w-full md:w-auto">
                        <button 
                          onClick={() => setReturnConditions(prev => ({...prev, [item.name]: 'lengkap'}))}
                          className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-2 ${returnConditions[item.name] === 'lengkap' ? 'bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30' : 'text-foreground/60 hover:bg-foreground/5 border border-transparent'}`}
                        >
                          <Check className="w-3.5 h-3.5" /> LENGKAP
                        </button>
                        <button 
                          onClick={() => setReturnConditions(prev => ({...prev, [item.name]: 'rusak'}))}
                          className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-2 ${returnConditions[item.name] === 'rusak' ? 'bg-amber-500/15 text-amber-800 dark:text-yellow-400 border border-amber-500/30' : 'text-foreground/60 hover:bg-foreground/5 border border-transparent'}`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" /> RUSAK
                        </button>
                        <button 
                          onClick={() => setReturnConditions(prev => ({...prev, [item.name]: 'hilang'}))}
                          className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center justify-center gap-2 ${returnConditions[item.name] === 'hilang' ? 'bg-destructive/15 text-destructive border border-destructive/30' : 'text-foreground/60 hover:bg-foreground/5 border border-transparent'}`}
                        >
                          <X className="w-3.5 h-3.5" /> HILANG
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CATATAN PENGEMBALIAN */}
              <div>
                <h4 className="font-mono text-[10px] text-teal tracking-widest uppercase mb-3">CATATAN PENGEMBALIAN (OPSIONAL)</h4>
                <textarea 
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  className="w-full h-24 bg-background border border-border rounded-lg p-3 text-sm focus:border-teal focus:outline-none custom-scroll resize-none"
                  placeholder="Misal: lensa ada baret kecil, tas rusak resletingnya, dll."
                ></textarea>
              </div>

              {/* FOTO BUKTI KONDISI */}
              <div>
                <h4 className="font-mono text-[10px] text-teal tracking-widest uppercase mb-3">FOTO BUKTI KONDISI (OPSIONAL)</h4>
                <div className="flex gap-4 items-start">
                  {proofFile ? (
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border">
                      <img src={URL.createObjectURL(proofFile)} alt="Preview" className="w-full h-full object-cover" />
                      <button onClick={() => setProofFile(null)} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="w-24 h-24 bg-background border border-dashed border-border rounded-lg flex flex-col items-center justify-center text-foreground/50 hover:border-teal hover:text-teal transition-colors cursor-pointer">
                      <Plus className="w-6 h-6 mb-1" />
                      <span className="text-[9px] font-bold">UPLOAD</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => setProofFile(e.target.files[0])} />
                    </label>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Data Peminjam */}
              <div>
            <h4 className="font-mono text-[10px] text-teal tracking-widest uppercase mb-3">DATA PEMINJAM</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-background border border-border p-3 rounded-lg">
                <div className="text-[10px] text-foreground/50 uppercase font-mono tracking-wider mb-1">NAMA</div>
                <div className="font-bold text-sm">{booking.userName || "-"}</div>
              </div>
              <div className="bg-background border border-border p-3 rounded-lg">
                <div className="text-[10px] text-foreground/50 uppercase font-mono tracking-wider mb-1">NIM / NIC DAKWAH TV</div>
                <div className="font-bold text-sm">{booking.userNim || "-"}</div>
              </div>
              <div className="bg-background border border-border p-3 rounded-lg">
                <div className="text-[10px] text-foreground/50 uppercase font-mono tracking-wider mb-1">ASAL</div>
                <div className="font-bold text-sm">
                  {booking.userOrigin === 'eksternal' ? (
                     <span className="inline-block px-2 py-0.5 rounded border border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-400 text-[10px] font-mono font-bold">EKSTERNAL</span>
                  ) : (
                     <span className="inline-block px-2 py-0.5 rounded border border-teal-500/30 bg-teal-500/15 text-teal-700 dark:text-teal-400 text-[10px] font-mono font-bold">INTERNAL</span>
                  )}
                </div>
              </div>
              <div className="bg-background border border-border p-3 rounded-lg">
                <div className="text-[10px] text-foreground/50 uppercase font-mono tracking-wider mb-1">STATUS AKUN</div>
                <div className="font-bold text-sm flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-teal-500/30 bg-teal-500/15 text-teal-700 dark:text-teal-400 text-[10px] font-mono font-bold">
                    <span className="w-2 h-2 rounded-full dot-glow-green"></span> Normal / Aktif
                  </span>
                </div>
              </div>
              <div className="bg-background border border-border p-3 rounded-lg">
                <div className="text-[10px] text-foreground/50 uppercase font-mono tracking-wider mb-1">DEPARTEMEN</div>
                <div className="font-bold text-sm">{booking.userDept || "-"}</div>
              </div>
              <div className="bg-background border border-border p-3 rounded-lg">
                <div className="text-[10px] text-foreground/50 uppercase font-mono tracking-wider mb-1">KONTAK</div>
                <div className="font-bold text-sm">{booking.userPhone || "-"}</div>
              </div>
              <div className="bg-background border border-border p-3 rounded-lg">
                <div className="text-[10px] text-foreground/50 uppercase font-mono tracking-wider mb-1">KEPERLUAN</div>
                <div className="font-bold text-sm">{booking.purpose || "-"}</div>
              </div>
              <div className="bg-background border border-border p-3 rounded-lg">
                <div className="text-[10px] text-foreground/50 uppercase font-mono tracking-wider mb-1">PERIODE</div>
                <div className="font-bold text-sm font-mono tracking-tight">{fmtDate(booking.dateStart)} &ndash; {fmtDate(booking.dateEnd)}</div>
              </div>
            </div>
          </div>

          {/* Alat */}
          <div>
            <h4 className="font-mono text-[10px] text-teal tracking-widest uppercase mb-3">ALAT ({(booking.items || []).length})</h4>
            <div className="bg-background border border-border rounded-lg overflow-hidden flex flex-col">
              {(booking.items || []).length > 0 ? (
                (booking.items || []).map((item, idx) => (
                  <div key={idx} className="p-3 border-b border-border last:border-b-0 text-sm font-bold flex items-center gap-2">
                    {item.name} <span className="text-foreground/40 font-normal">&middot; {item.cat || ""}</span>
                  </div>
                ))
              ) : (
                <div className="p-3 text-sm text-foreground/50">Tidak ada item</div>
              )}
            </div>
          </div>
          
          {/* Kondisi Alat Saat Dikembalikan */}
          {(booking.status === 'returned' || booking.status === 'returned_late') && booking.returnChecklist && (
            <div>
              <h4 className="font-mono text-[10px] text-teal tracking-widest uppercase mb-3">KONDISI ALAT SAAT DIKEMBALIKAN</h4>
              <div className="bg-background border border-border rounded-lg overflow-hidden flex flex-col">
                {(booking.items || []).map((item, idx) => {
                  const cond = booking.returnChecklist[item.name] || 'lengkap';
                  let icon = <Check className="w-4 h-4 text-green-600 dark:text-green-400" />;
                  let textCls = "text-green-700 dark:text-green-400";
                  let text = "Lengkap";
                  
                  if (cond === 'rusak') {
                    icon = <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-yellow-400" />;
                    textCls = "text-amber-700 dark:text-yellow-400";
                    text = "Rusak";
                  } else if (cond === 'hilang') {
                    icon = <X className="w-4 h-4 text-destructive" />;
                    textCls = "text-destructive";
                    text = "Hilang";
                  }

                  return (
                    <div key={idx} className="p-3 border-b border-border last:border-b-0 text-sm font-bold flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.name} <span className="text-foreground/40 font-normal hidden sm:inline">&middot; {item.cat || ""}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${textCls} text-xs uppercase font-mono`}>
                        {icon} {text}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {booking.returnNote && (
                <div className="mt-3 bg-destructive/5 border border-destructive/20 p-3 rounded-lg">
                  <div className="text-[10px] text-destructive/70 uppercase font-mono tracking-wider mb-1">CATATAN PENGEMBALIAN</div>
                  <div className="text-sm">{booking.returnNote}</div>
                </div>
              )}
            </div>
          )}

          {/* External Doc */}
          {booking.userOrigin === 'eksternal' && (
             <div>
                <h4 className="font-mono text-[10px] text-teal tracking-widest uppercase mb-3">DOKUMEN PENDUKUNG (EKSTERNAL)</h4>
                {booking.supportingDocUrl ? (
                   <a href={booking.supportingDocUrl} target="_blank" rel="noreferrer" className="block w-24 h-24 border border-border rounded overflow-hidden hover:border-teal transition-colors">
                     <img src={booking.supportingDocUrl} alt="Dokumen pendukung" className="w-full h-full object-cover" />
                   </a>
                ) : (
                   <div className="text-destructive text-xs flex items-center gap-2">
                     <XCircle className="w-4 h-4" /> Belum ada dokumen diunggah.
                   </div>
                )}
             </div>
          )}



            </>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-background/50 flex flex-wrap gap-3">
          {isReturning ? (
            <>
              <button onClick={handleConfirmReturn} disabled={isUploading} className="flex items-center gap-2 px-5 py-2 bg-teal text-background font-bold text-sm rounded-lg hover:bg-teal-light transition-colors disabled:opacity-50">
                {isUploading ? "Mengunggah..." : "Konfirmasi Pengembalian"}
              </button>
              <button onClick={() => setIsReturning(false)} className="px-5 py-2 border border-border bg-transparent hover:bg-white/5 text-sm font-bold rounded-lg transition-colors">
                Batal
              </button>
            </>
          ) : (
            <>
              {booking.status === 'pending' && (
                <>
                  <button onClick={() => onApprove(booking)} className="flex items-center gap-2 px-5 py-2 bg-teal text-background font-bold text-sm rounded-lg hover:bg-teal-light transition-colors">
                    <Check className="w-4 h-4" /> Setujui
                  </button>
                  <button onClick={() => onReject(booking)} className="flex items-center gap-2 px-5 py-2 bg-destructive text-white font-bold text-sm rounded-lg hover:bg-destructive/90 transition-colors">
                    <X className="w-4 h-4" /> Tolak
                  </button>
                </>
              )}

              {(booking.status === 'pending' || booking.status === 'approved' || booking.status === 'letter_ready' || booking.status === 'picked_up' || booking.status === 'active' || booking.status === 'returned' || booking.status === 'returned_late') && (
                <button onClick={handleGenerateClick} className="flex items-center gap-2 px-5 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border font-bold text-sm rounded-lg transition-colors">
                  <FileText className="w-4 h-4 text-teal" /> Buka Generator Surat (SPA)
                </button>
              )}

              {booking.status === 'approved' && (
                <button onClick={() => onMarkLetterReady && onMarkLetterReady(booking)} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground font-bold text-sm rounded-lg hover:bg-primary/90 transition-colors">
                  Surat & Alat Siap
                </button>
              )}

              {(booking.status === 'letter_ready' || booking.status === 'approved') && (
                <button onClick={() => onMarkPickedUp && onMarkPickedUp(booking)} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                  <Check className="w-4 h-4" /> Telah Diambil
                </button>
              )}

              {(booking.status === 'active' || booking.status === 'picked_up') && (
                <button onClick={() => startReturnProcess('returned')} className="flex items-center gap-2 px-5 py-2 bg-teal text-background font-bold text-sm rounded-lg hover:bg-teal-light transition-colors">
                  Proses Pengembalian
                </button>
              )}
              
              <div className="flex-1"></div>
              <button onClick={onClose} className="px-5 py-2 border border-border bg-transparent hover:bg-white/5 text-sm font-bold rounded-lg transition-colors">
                Tutup
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
