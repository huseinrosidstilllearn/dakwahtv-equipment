import React, { useState } from 'react';
import { X, Search, Plus, Trash2, Calendar, User, Phone, MapPin, Hash, Briefcase, FileText, Check } from 'lucide-react';
import { supabase } from '../supabase';
import { useToast } from '../context/ToastContext';
import { sortCategories } from '../utils/categories';

export default function ManualBookingModal({ isOpen, onClose, inventory, currentUser }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', nim: '', dept: '', origin: '', purpose: '', dateStart: '', dateEnd: '', initialStatus: 'approved'
  });
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAddItem = (item) => {
    const isReady = !item.status || item.status === 'ready';
    if (!isReady) {
      toast.warning("Alat sedang tidak tersedia (Maintenance / Dipinjam)!", "Alat Tidak Tersedia");
      return;
    }

    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      toast.warning("Alat ini sudah ada di daftar pilihan!", "Sudah Dipilih");
      return;
    }
    setCart([...cart, item]);
    toast.success(`${item.name} ditambahkan ke booking!`);
  };

  const handleRemoveItem = (key) => setCart(cart.filter(c => c.id !== key));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return toast.warning("Pilih minimal 1 alat untuk dipinjam!", "Keranjang Kosong");
    
    setIsSubmitting(true);
    try {
      const bid = crypto.randomUUID();
      
      const bookingData = {
        id: bid,
        uid: currentUser?.id || 'manual_admin',
        user_name: formData.name,
        user_phone: formData.phone,
        user_nim: formData.nim || '',
        dept: formData.dept || '',
        origin: formData.origin || 'internal',
        purpose: formData.purpose || 'Kegiatan Produksi Dakwah TV',
        date_start: formData.dateStart,
        date_end: formData.dateEnd,
        status: formData.initialStatus || 'approved',
        created_at: new Date().toISOString()
      };

      const { error: bErr } = await supabase.from('bookings').insert([bookingData]);
      if (bErr) throw bErr;

      const itemsToInsert = cart.map(item => ({
        booking_id: bid,
        inventory_id: item.id
      }));
      
      const { error: biErr } = await supabase.from('booking_items').insert(itemsToInsert);
      if (biErr) throw biErr;

      // Also log the activity
      await supabase.from('activity_logs').insert([{
        action: `Admin membuat booking manual (${formData.name})`, email: currentUser?.email || 'Admin', timestamp: new Date().toISOString() }]);

      toast.success("Booking manual berhasil ditambahkan!", "Booking Sukses");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan booking manual: " + err.message, "Gagal Menyimpan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInventory = inventory.filter(i => 
    (i.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (i.cat || '').toLowerCase().includes(search.toLowerCase())
  );

  const groupedInventory = filteredInventory.reduce((acc, item) => {
    const cat = item.cat || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const sortedCats = sortCategories(Object.keys(groupedInventory));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card border border-border w-full max-w-7xl w-[95vw] lg:w-[90vw] h-[95vh] lg:h-[85vh] max-h-[95vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl animate-in zoom-in-95">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-border bg-muted/30">
          <h2 className="text-xl font-bold font-heading flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" /> Tambah Booking Manual
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-muted text-foreground/50 hover:text-foreground rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-foreground/10 hover:[&::-webkit-scrollbar-thumb]:bg-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full">
          
          {/* Left: Form (30%) */}
          <div className="w-full lg:w-[30%] lg:flex-shrink-0 space-y-4">
            <h3 className="font-bold border-b border-border pb-2 text-primary">Informasi Peminjam</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground/70 flex items-center gap-1"><User className="w-3 h-3"/> Nama Lengkap</label>
                <input required type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="Fulan bin Fulan" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground/70 flex items-center gap-1"><Hash className="w-3 h-3"/> NIM / NIC Dakwah TV</label>
                <input required type="text" value={formData.nim} onChange={e=>setFormData({...formData, nim: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none" placeholder="12345678" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground/70 flex items-center gap-1"><Phone className="w-3 h-3"/> No WA</label>
                <input required type="text" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none" placeholder="6281234..." />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground/70 flex items-center gap-1"><Briefcase className="w-3 h-3"/> Departemen</label>
                <input required type="text" value={formData.dept} onChange={e=>setFormData({...formData, dept: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none" placeholder="Misal: Creative Media" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-foreground/70 flex items-center gap-1"><MapPin className="w-3 h-3"/> Asal / Divisi</label>
                <select required value={formData.origin} onChange={e=>setFormData({...formData, origin: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none cursor-pointer">
                  <option value="" disabled>Pilih Asal/Divisi...</option>
                  <option value="Internal Dakwah TV">Internal Dakwah TV</option>
                  <option value="Eksternal">Eksternal</option>
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-foreground/70 flex items-center gap-1"><FileText className="w-3 h-3"/> Keperluan</label>
                <textarea required value={formData.purpose} onChange={e=>setFormData({...formData, purpose: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none min-h-[60px]" placeholder="Misal: Syuting Liputan Kampus" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground/70 flex items-center gap-1"><Calendar className="w-3 h-3"/> Tgl Ambil</label>
                <input required type="date" value={formData.dateStart} onChange={e=>setFormData({...formData, dateStart: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground/70 flex items-center gap-1"><Calendar className="w-3 h-3"/> Tgl Kembali</label>
                <input required type="date" value={formData.dateEnd} onChange={e=>setFormData({...formData, dateEnd: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-foreground/70">Status Awal</label>
                <select value={formData.initialStatus} onChange={e=>setFormData({...formData, initialStatus: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none">
                  <option value="pending">Menunggu Approval (Pending)</option>
                  <option value="approved">Disetujui (Menunggu Diambil)</option>
                  <option value="active">Sedang Dipinjam (Active)</option>
                  <option value="returned">Selesai (Returned)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Right: Items */}
          <div className="flex-1 flex flex-col border-t lg:border-t-0 lg:border-l border-border pt-6 lg:pt-0 lg:pl-6 space-y-4">
            <h3 className="font-bold border-b border-border pb-2 text-primary">Pilih Alat</h3>
            
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)} className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-3 py-2 text-sm focus:border-primary outline-none" placeholder="Cari alat..." />
            </div>

            {/* Inventory Grid */}
            <div className="flex-1 border border-border rounded-xl overflow-y-auto min-h-[300px] max-h-full bg-background p-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-foreground/10 hover:[&::-webkit-scrollbar-thumb]:bg-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full space-y-6">
              {sortedCats.length === 0 ? (
                <div className="flex justify-center items-center h-32 text-foreground/50 italic text-sm">Alat tidak ditemukan</div>
              ) : (
                sortedCats.map(cat => (
                  <div key={cat} className="space-y-3">
                    <h4 className="font-bold text-foreground/80 text-sm uppercase tracking-wider border-b border-border/50 pb-1">{cat}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {groupedInventory[cat]
                        .sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: 'base' }))
                        .map(item => {
                          const rawStok = parseInt(item.qty);
                          const stok = isNaN(rawStok) ? 1 : rawStok;
                          const isReady = !item.status || item.status === 'ready';
                          const avail = isReady ? stok : 0;
                          const isAvail = avail > 0;
                          return (
                            <div 
                              key={item.id} 
                              className={`bg-card border ${isAvail ? 'border-border' : 'border-destructive/30 opacity-60'} rounded-xl overflow-hidden shadow-sm flex flex-col`}
                            >
                              {/* Image Container */}
                              <div className="aspect-[4/3] bg-muted relative overflow-hidden group">
                                <img 
                                  src={item.img || ''}
                                  alt={item.name}
                                  onError={(e) => { e.target.src = 'https://placehold.co/400x300/1a1a1a/666666?text=No+Image'; }}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                                
                                <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
                                  <div className={`px-2 py-1 rounded text-[10px] font-bold shadow-sm backdrop-blur-md border ${
                                    isAvail ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-destructive/20 text-destructive-foreground border-destructive/30'
                                  }`}>
                                    Stok: {avail}
                                  </div>
                                </div>
                              </div>

                              {/* Content */}
                              <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                                <h3 className="font-bold text-xs line-clamp-2 leading-tight text-foreground">{item.name}</h3>
                                <button 
                                  onClick={() => handleAddItem(item)}
                                  disabled={!isAvail}
                                  className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all border ${
                                    isAvail 
                                      ? 'bg-primary/20 hover:bg-primary text-primary hover:text-primary-foreground border-primary/30 hover:border-primary' 
                                      : 'bg-muted text-foreground/40 border-border cursor-not-allowed'
                                  }`}
                                >
                                  <Plus className="w-3 h-3" /> Tambah
                                </button>
                              </div>
                            </div>
                          );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart */}
            <h3 className="font-bold border-b border-border pb-2 text-primary pt-2">Daftar Pinjaman ({cart.length})</h3>
            <div className="flex-1 border border-border rounded-xl overflow-y-auto min-h-[150px] max-h-[200px] bg-background p-2 space-y-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-foreground/10 hover:[&::-webkit-scrollbar-thumb]:bg-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full">
              {cart.length === 0 ? (
                <div className="h-full flex items-center justify-center text-foreground/40 text-xs italic">Belum ada alat</div>
              ) : (
                cart.map(c => (
                  <div key={c.id} className="flex justify-between items-center bg-muted/30 p-2 rounded-lg border border-border/50">
                    <span className="text-xs font-bold truncate flex-1 pr-2">{c.name}</span>
                    <button type="button" onClick={() => handleRemoveItem(c.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg shrink-0 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-muted/30 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-bold text-foreground/70 hover:bg-muted border border-transparent hover:border-border transition-all">
            Batal
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !formData.name || !formData.dateStart || !formData.dateEnd || cart.length === 0}
            className="px-5 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isSubmitting ? "Menyimpan..." : <><Check className="w-4 h-4" /> Simpan Booking</>}
          </button>
        </div>

      </div>
    </div>
  );
}
