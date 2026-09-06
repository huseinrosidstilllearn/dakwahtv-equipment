import { normalizeBooking, fmtDate } from '../utils/normalize';
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useToast } from '../context/ToastContext';
import AuthModal from '../components/AuthModal';
import CartModal from '../components/CartModal';
import CalendarModal from '../components/CalendarModal';
import Navbar from '../components/Navbar';
import { Search, Filter, CalendarDays, AlertTriangle, CheckCircle2, AlertCircle, ShoppingCart, Plus, Calendar, Check, Minus, Trash2, Calendar as CalendarIcon, LogIn, LogOut, Info } from 'lucide-react';
import { sendWhatsAppMessage, sanitizeWaTemplate, DEFAULT_WA_TEMPLATES } from '../utils/whatsapp';
import { sortCategories } from '../utils/categories';
import { getSavedTheme, applyTheme } from '../utils/theme';

const STATUS_LABEL = { ready: "Ready", attention: "Maintenance", unavailable: "Not Ready" };
const STATUS_COLOR = {
  ready: 'text-emerald-700 dark:text-green-400',
  attention: 'text-amber-700 dark:text-yellow-400',
  unavailable: 'text-rose-700 dark:text-red-400',
};
const STATUS_DOT = {
  ready: 'dot-glow-green',
  attention: 'dot-glow-yellow',
  unavailable: 'dot-glow-red',
};
const STATUS_BOX = {
  attention: 'bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-yellow-400',
  unavailable: 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-400',
};

function itemKey(it) {
  return ((it.cat || '') + "|" + (it.group || '') + "|" + (it.name || '')).replace(/[.#$/\[\]]/g, "_");
}

export default function Katalog() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [theme, setTheme] = useState(getSavedTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  
  // Auth State
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserStatus, setCurrentUserStatus] = useState('active');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); 
  const [authError, setAuthError] = useState('');
  const [allBookings, setAllBookings] = useState([]);
  const [bookingsByItemRaw, setBookingsByItemRaw] = useState({});
  
  // Supabase listeners
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const [
          { data: directBks },
          { data: cfgAvail }
        ] = await Promise.all([
          supabase.from('bookings').select('*, booking_items(inventory_id, inventory(*))').neq('status', 'rejected'),
          supabase.from('config').select('value').eq('key', 'publicAvailability').maybeSingle()
        ]);

        const biRaw = {};

        // 1. Load from publicAvailability cache (ensures 100% data access for public & guest visitors)
        if (cfgAvail?.value && typeof cfgAvail.value === 'object') {
          Object.entries(cfgAvail.value).forEach(([itemId, arr]) => {
            if (!biRaw[itemId]) biRaw[itemId] = {};
            if (Array.isArray(arr)) {
              arr.forEach(entry => {
                biRaw[itemId][entry.bookingId] = {
                  dateStart: entry.dateStart,
                  dateEnd: entry.dateEnd,
                  status: entry.status,
                  userName: entry.userName,
                  dept: entry.dept,
                  itemName: entry.itemName
                };
              });
            }
          });
        }

        // 2. Merge with live bookings if returned
        if (directBks && directBks.length > 0) {
          setAllBookings(directBks);
          directBks.forEach(b => {
            if (['rejected', 'expired', 'returned', 'cancelled'].includes(b.status)) return;
            const dStart = b.date_start ? b.date_start.split('T')[0] : (b.dateStart || '');
            const dEnd = b.date_end ? b.date_end.split('T')[0] : (b.dateEnd || '');
            if (!dStart || !dEnd) return;

            if (b.booking_items) {
              b.booking_items.forEach(bi => {
                const k = bi.inventory_id;
                if (!k) return;
                if (!biRaw[k]) biRaw[k] = {};
                biRaw[k][b.id] = {
                  dateStart: dStart,
                  dateEnd: dEnd,
                  status: b.status,
                  userName: b.user_name || b.userName,
                  dept: b.dept,
                  itemName: bi.inventory?.name
                };
              });
            }
          });
        }

        setBookingsByItemRaw(biRaw);
      } catch (err) {
        console.error("Katalog fetchBookings error:", err);
      }
    };
    fetchBookings();

    const sub = supabase.channel('public:katalog_availability_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, fetchBookings)
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, []);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentUser(session?.user || null);
      setCurrentUserStatus('active');
    };
    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user || null);
      setCurrentUserStatus('active');
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Cart State
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictWarn, setConflictWarn] = useState(null);
  
  // Calendar State
  const [isCalOpen, setIsCalOpen] = useState(false);
  const [calItemKey, setCalItemKey] = useState(null);
  const [calItemName, setCalItemName] = useState('');
  
  // Announcement State
  const [announcements, setAnnouncements] = useState([]);

  // New Modals State
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({ alat: '', masalah: '' });

  // Apply theme on mount and change
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('dtv-theme', theme);
  }, [theme]);

  // URL Parameter System
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const itemParam = params.get('item');
    if (itemParam) setSearchQuery(itemParam);
    const loginParam = params.get('login');
    if (loginParam === 'true') setIsAuthOpen(true);
  }, []);

  // Inventory fetch
  useEffect(() => {
    const fetchItems = async () => {
      const { data } = await supabase.from('inventory').select('*');
      if (data) setItems(data.map(it => ({ ...it, status: it.status || 'ready' })));
    };
    fetchItems();
    const sub = supabase.channel('public:inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => fetchItems())
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  useEffect(() => {
    const fetchAnn = async () => {
      const { data } = await supabase.from('config').select('value').eq('key', 'announcement').maybeSingle();
      if (data && data.value?.enabled && data.value?.text) {
        setAnnouncements(data.value.text.split('\n').filter(l => l.trim()));
      } else {
        setAnnouncements([]);
      }
    };
    fetchAnn();
    const sub = supabase.channel('public:config:announcement')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config', filter: `key=eq.announcement` }, () => fetchAnn())
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  useEffect(() => {
    let isMaint = false;
    let isAdmin = false;
    let authChecked = false;

    const enforce = () => {
      if (isMaint && authChecked && !isAdmin) {
        window.location.href = '/maintenance.html';
      }
    };

    const fetchMaint = async () => {
      const { data } = await supabase.from('config').select('value').eq('key', 'maintenanceMode').maybeSingle();
      isMaint = data?.value === true;
      enforce();
    };
    fetchMaint();
    
    const subMaint = supabase.channel('public:config:maintenanceMode')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config', filter: `key=eq.maintenanceMode` }, () => fetchMaint())
      .subscribe();

    const checkAdmin = async (user) => {
      if (user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
        isAdmin = (data?.role === 'admin');
      } else {
        isAdmin = false;
      }
      authChecked = true;
      enforce();
    };

    supabase.auth.getSession().then(({ data: { session } }) => checkAdmin(session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      checkAdmin(session?.user);
    });

    return () => {
      supabase.removeChannel(subMaint);
      subscription.unsubscribe();
    };
  }, []);

  const addToCart = (item) => {
    setCart(prev => {
      const isExist = prev.some(cartItem => itemKey(cartItem) === itemKey(item));
      if (isExist) {
        toast.warning(`${item.name} sudah ada di keranjang!`);
        return prev;
      }
      toast.success(`${item.name} ditambahkan ke keranjang!`);
      return [...prev, item];
    });
  };

  const removeFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const openCalendar = (item) => {
    setCalItemKey(item.id);
    setCalItemName(item.name);
    setIsCalOpen(true);
  };

  const handleLogout = () => {
    supabase.auth.signOut().catch(err => console.error(err));
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    const email = e.target.email?.value;
    const password = e.target.password?.value;
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const name = e.target.name?.value;
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { data: { displayName: name } }
        });
        if (error) throw error;
      }
      setIsAuthOpen(false);
    } catch (err) {
      setAuthError("Email/Password Salah");
    }
  };

  const submitBooking = async (e) => {
    e.preventDefault();
    if (!currentUser) return toast.warning("Harap login terlebih dahulu untuk mengajukan peminjaman.");
    if (currentUserStatus === 'suspended') {
      return toast.error("Akun Anda sedang ditangguhkan (Suspended). Anda tidak dapat melakukan peminjaman. Silakan hubungi Admin.");
    }
    setIsSubmitting(true);
    try {
      const form = e.target;
      const bid = crypto.randomUUID();
      
      let docUrl = '';
      const docFile = form.doc?.files?.[0];
      if (docFile) {
        try {
          const uploadData = new FormData();
          uploadData.append('file', docFile);
          const r2Res = await fetch('https://equipment-photo-uploader.dakwahtvteknis.workers.dev', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer DakwahTV_Aman_2026'
            },
            body: uploadData
          });
          const r2Data = await r2Res.json();
          if (r2Data.success) {
            docUrl = r2Data.url;
          }
        } catch (upErr) {
          console.error("Gagal upload dokumen peminjaman:", upErr);
        }
      }

      const bookingData = {
        id: bid,
        uid: currentUser.id,
        user_name: form.name.value,
        user_phone: form.phone.value,
        user_nim: form.nim ? form.nim.value : '',
        dept: form.dept ? form.dept.value : '',
        origin: form.origin ? form.origin.value : 'internal',
        purpose: form.purpose ? form.purpose.value : '',
        date_start: form.start.value,
        date_end: form.end.value,
        doc_url: docUrl,
        status: 'pending',
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

      const { data: waData } = await supabase.from('config').select('value').eq('key', 'adminWaNumbers').maybeSingle();
      let adminWaList = [];
      if (waData?.value) {
        const val = waData.value;
        if (Array.isArray(val)) {
          adminWaList = val.map(v => v.replace(/[^0-9]/g, '')).filter(Boolean);
        } else if (typeof val === 'string') {
          adminWaList = [val.replace(/[^0-9]/g, '')].filter(Boolean);
        }
      }

      const { data: tplData } = await supabase.from('config').select('value').eq('key', 'waTemplates').maybeSingle();
      const waTpls = tplData?.value || {};

      if (adminWaList.length > 0) {
        let rawMessage = sanitizeWaTemplate(waTpls.adminNewBooking, 'adminNewBooking');

        let message = rawMessage;
        message = message.replace(/\{nama\}/g, form.name.value);
        message = message.replace(/\{id\}/g, bid);
        message = message.replace(/\{program\}/g, form.dept.value || '-');
        message = message.replace(/\{tgl_pinjam\}/g, form.start.value.split('-').reverse().join('-'));
        message = message.replace(/\{tgl_kembali\}/g, form.end.value.split('-').reverse().join('-'));
        message = message.replace(/\{link_surat\}/g, `https://dakwahtvequipment.pages.dev/surat/${bid}?auto=1&format=pdf`);

        sendWhatsAppMessage(adminWaList.join(','), message);
      }

      const userPhoneRaw = form.phone.value;
      if (userPhoneRaw) {
        const userPhone = userPhoneRaw.replace(/[^0-9]/g, '');
        let rawUserMessage = sanitizeWaTemplate(waTpls.userPending, 'userPending');

        let userMessage = rawUserMessage;
        userMessage = userMessage.replace(/\{nama\}/g, form.name.value);
        userMessage = userMessage.replace(/\{id\}/g, bid);
        userMessage = userMessage.replace(/\{program\}/g, form.dept.value || '-');
        userMessage = userMessage.replace(/\{tgl_pinjam\}/g, form.start.value.split('-').reverse().join('-'));
        userMessage = userMessage.replace(/\{tgl_kembali\}/g, form.end.value.split('-').reverse().join('-'));
        userMessage = userMessage.replace(/\{link_surat\}/g, `https://dakwahtvequipment.pages.dev/surat/${bid}?auto=1&format=pdf`);

        sendWhatsAppMessage(userPhone, userMessage);
      }

      toast.success(`Booking berhasil diajukan dengan ID: ${bid}\nSistem telah mengirim notifikasi otomatis ke Admin.`, "Booking Berhasil");
      setIsCartOpen(false);
      setCart([]);
    } catch (err) {
      toast.error("Gagal booking: " + err.message, "Gagal Booking");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitIssue = async (e) => {
    e.preventDefault();
    if (!currentUser) return toast.warning("Harap login terlebih dahulu.");
    try {
      await supabase.from('maintenance_logs').insert([{
        item_name: issueForm.alat,
        description: issueForm.masalah,
        reported_by: currentUser.email,
        timestamp: new Date().toISOString(),
        status: 'open'
      }]);
      toast.success("Laporan berhasil dikirim ke tim teknis!", "Laporan Terkirim");
      setIsIssueModalOpen(false);
      setIssueForm({ alat: '', masalah: '' });
    } catch (err) {
      toast.error("Gagal mengirim laporan: " + err.message, "Gagal Melapor");
    }
  };

  const checkDateConflicts = (startDate, endDate) => {
    if (!startDate || !endDate || cart.length === 0) return null;
    const toMid = (val) => {
      if (!val) return 0;
      if (typeof val === 'string') {
        const clean = val.split('T')[0];
        if (clean.includes('-')) {
          const parts = clean.split('-').map(Number);
          return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
        }
      }
      const dt = new Date(val);
      return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
    };

    const startMs = toMid(startDate);
    const endMs = toMid(endDate);
    const conflictingItems = [];

    cart.forEach(item => {
      const itemBookings = bookingsByItemRaw[item.id] || bookingsByItemRaw[itemKey(item)];
      if (!itemBookings) return;
      Object.values(itemBookings).forEach(b => {
        if (b.status === 'rejected' || b.status === 'expired' || b.status === 'returned' || b.status === 'returned_late' || b.status === 'cancelled') return;
        if (!b.dateStart || !b.dateEnd) return;
        const bStart = toMid(b.dateStart);
        const bEnd = toMid(b.dateEnd);
        if (startMs <= bEnd && endMs >= bStart) {
          if (!conflictingItems.includes(item.name)) {
            conflictingItems.push(item.name);
          }
        }
      });
    });
    return conflictingItems.length > 0 ? conflictingItems : null;
  };

  const filteredItems = items.filter(d => {
    const matchFilter = filter === 'all' ? true : d.status === filter;
    const matchCat = catFilter === 'all' ? true : d.cat === catFilter;
    const matchSearch = !searchQuery || (d.name + " " + (d.group || "") + " " + d.cat).toLowerCase().includes(searchQuery.toLowerCase());
    return matchFilter && matchCat && matchSearch;
  });

  const cats = sortCategories([...new Set(filteredItems.map(d => d.cat))]);
  const allAvailableCats = sortCategories([...new Set(items.map(d => d.cat))].filter(Boolean));

  // Stats
  const readyCount = items.filter(d => d.status === 'ready' || !d.status).length;
  const maintCount = items.filter(d => d.status === 'attention').length;
  const notReadyCount = items.filter(d => d.status === 'unavailable').length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const borrowedCount = allBookings.filter(b => {
    if (b.status === 'active' || b.status === 'picked_up') return true;
    if (b.status === 'approved') {
      const start = new Date(b.dateStart); start.setHours(0, 0, 0, 0);
      const end = new Date(b.dateEnd); end.setHours(0, 0, 0, 0);
      if (today >= start && today <= end) return true;
    }
    return false;
  }).reduce((acc, b) => {
    return acc + (Array.isArray(b.booking_items) ? b.booking_items.length : 0);
  }, 0);

  return (
    <div className="min-h-screen bg-background text-foreground pt-20 pb-20 selection:bg-primary selection:text-primary-foreground">
      <Navbar 
        theme={theme} 
        setTheme={setTheme} 
        cartCount={cart.length} 
        openCart={() => setIsCartOpen(true)} 
        openIssueModal={() => setIsIssueModalOpen(true)}
        openHistoryModal={() => setIsHistoryModalOpen(true)}
      />
      
      {/* Announcement Banner */}
      {announcements.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4 space-y-2">
          {announcements.map((line, i) => (
            <div key={i} className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 p-3 rounded-xl font-mono text-xs md:text-sm shadow-sm">
              <span className="bg-yellow-500 text-yellow-900 font-bold text-[10px] px-2 py-1 rounded flex items-center gap-1 uppercase tracking-wider shrink-0">
                <AlertCircle className="w-3 h-3" /> Studio
              </span>
              <span className="font-medium text-foreground">{line}</span>
            </div>
          ))}
        </div>
      )}

      <header className="max-w-7xl mx-auto px-4 md:px-8 pt-8 pb-6 flex flex-col items-center text-center">
        <img src="/logo.png" className="w-full max-w-[180px] mb-6 drop-shadow-md" alt="Dakwah TV" />
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-3 uppercase">
          KATALOG <span className="text-primary">ALAT</span>
        </h1>
        <p className="text-xs md:text-sm font-mono text-foreground/50 tracking-widest uppercase mb-6">
          Katalog Alat Produksi • Rev. 2026.07
        </p>

        {/* Stats Bar */}
        <div className="flex items-center gap-3 md:gap-6 flex-wrap justify-center bg-card/80 border border-border px-6 py-3 rounded-full shadow-sm font-mono text-xs font-semibold">
          <div className="flex items-center gap-2 group cursor-default">
            <div className="w-2 h-2 rounded-full dot-glow-primary"></div>
            <span className="text-foreground/80 tracking-widest drop-shadow-[0_0_8px_rgba(38,166,149,0.5)]">SEMUA ALAT</span>
            <span className="font-black text-foreground ml-1 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{items.length}</span>
          </div>
          <div className="w-px h-4 bg-border/50 hidden md:block"></div>
          
          <div className="flex items-center gap-2 group cursor-default">
            <div className="w-2 h-2 rounded-full dot-glow-green"></div>
            <span className="text-emerald-700 dark:text-green-400 font-bold tracking-widest">READY</span>
            <span className="font-black text-emerald-700 dark:text-green-400 ml-1">{readyCount}</span>
          </div>
          <div className="w-px h-4 bg-border/50 hidden md:block"></div>
          
          <div className="flex items-center gap-2 group cursor-default">
            <div className="w-2 h-2 rounded-full dot-glow-yellow"></div>
            <span className="text-amber-700 dark:text-yellow-400 font-bold tracking-widest">MAINTENANCE</span>
            <span className="font-black text-amber-700 dark:text-yellow-400 ml-1">{maintCount}</span>
          </div>
          <div className="w-px h-4 bg-border/50 hidden md:block"></div>

          <div className="flex items-center gap-2 group cursor-default">
            <div className="w-2 h-2 rounded-full dot-glow-red"></div>
            <span className="text-rose-700 dark:text-red-400 font-bold tracking-widest">NOT READY</span>
            <span className="font-black text-rose-700 dark:text-red-400 ml-1">{notReadyCount}</span>
          </div>
          <div className="w-px h-4 bg-border/50 hidden md:block"></div>

          <div className="flex items-center gap-2 group cursor-default">
            <div className="w-2 h-2 rounded-full dot-glow-blue"></div>
            <span className="text-sky-700 dark:text-blue-400 font-bold tracking-widest">DIPINJAM</span>
            <span className="font-black text-sky-700 dark:text-blue-400 ml-1">{borrowedCount}</span>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mb-8 space-y-4">
        <div className="flex gap-3 h-12">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40 w-5 h-5 group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Cari alat berdasarkan nama..."
              className="w-full h-full pl-12 pr-4 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 md:px-6 rounded-xl text-sm font-bold tracking-wide transition-all ${
              showFilters ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card border border-border text-foreground hover:bg-accent'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">FILTER</span>
          </button>
        </div>

        {showFilters && (
          <div className="space-y-4 bg-card/50 border border-border p-4 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex gap-2 w-full overflow-x-auto pb-2 scrollbar-none">
              <button onClick={() => setFilter('all')} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'all' ? 'bg-foreground text-background' : 'bg-background border border-border text-foreground/80 hover:bg-accent'}`}>
                Semua Status
              </button>
              <button onClick={() => setFilter('ready')} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filter === 'ready' ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-background border border-border text-foreground/80 hover:bg-accent'}`}>
                <CheckCircle2 className="w-4 h-4" /> Ready
              </button>
              <button onClick={() => setFilter('attention')} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filter === 'attention' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' : 'bg-background border border-border text-foreground/80 hover:bg-accent'}`}>
                <AlertTriangle className="w-4 h-4" /> Maintenance
              </button>
              <button onClick={() => setFilter('unavailable')} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filter === 'unavailable' ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-background border border-border text-foreground/80 hover:bg-accent'}`}>
                <AlertCircle className="w-4 h-4" /> Not Ready
              </button>
            </div>
            
            <div className="flex items-center gap-2 w-full overflow-x-auto pt-4 border-t border-border pb-1 scrollbar-none">
              <span className="text-xs font-mono text-foreground/50 tracking-wider font-semibold shrink-0 mr-2">KATEGORI:</span>
              <button onClick={() => setCatFilter('all')} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${catFilter === 'all' ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-accent'}`}>
                Semua
              </button>
              {allAvailableCats.map(c => (
                <button key={c} onClick={() => setCatFilter(c)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${catFilter === c ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-accent'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Catalog Grid */}
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {cats.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-foreground/40">
            <Search className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">Alat tidak ditemukan.</p>
          </div>
        )}

        {cats.map((cat, ci) => {
          const catItems = filteredItems
            .filter(d => d.cat === cat)
            .sort((a, b) => (a.old_key || a.name || "").localeCompare(b.old_key || b.name || "", undefined, { numeric: true, sensitivity: 'base' }));
          return (
            <div key={cat} className="mb-14">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-2xl md:text-3xl font-display text-teal tracking-wider">{String(ci + 1).padStart(2, '0')}</span>
                <h2 className="text-xl md:text-2xl font-display text-foreground tracking-widest uppercase">{cat}</h2>
                <div className="flex-1 h-px bg-teal/30 mx-2"></div>
                <span className="text-[10px] md:text-xs font-mono text-foreground/50">{catItems.length} item</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
                {catItems.map(it => {
                  const k = itemKey(it);
                  const notReadyNow = it.status !== "ready";
                  const statusKey = it.status || 'ready';

                  return (
                    <div key={k} className="group relative flex flex-col bg-card rounded-xl overflow-hidden border border-border hover:border-teal/50 hover:shadow-glow transition-all duration-300 shadow-sm">
                      {/* Thumbnail */}
                      <div className="h-[110px] md:h-[130px] relative overflow-hidden flex items-center justify-center p-3 bg-muted/10">
                        {it.img ? (
                          <img src={it.img} alt={it.name} loading="lazy" className="w-full h-full object-contain drop-shadow-lg group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <span className="text-3xl font-black text-foreground/10">?</span>
                        )}
                        {/* Calendar button top-right */}
                        <button
                          onClick={() => openCalendar(it)}
                          className="absolute top-2 right-2 p-1.5 bg-background/80 hover:bg-card text-foreground/60 hover:text-primary rounded-lg transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm shadow"
                          title="Lihat Kalender"
                        >
                          <CalendarDays className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Content */}
                      <div className="p-3 flex-1 flex flex-col">
                          <span className="text-[9px] font-mono text-foreground/50 uppercase tracking-widest mb-0.5">
                            {it.group || it.cat}
                          </span>
                          <h3 className="font-bold text-xs md:text-sm leading-tight text-foreground mb-1 flex-1">{it.name}</h3>

                          {(it.notes || it.keterangan || it.desc) ? (
                            <div className="text-[9px] text-yellow-600/90 dark:text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20 leading-tight line-clamp-2 mb-2 mt-0.5" title={it.notes || it.keterangan || it.desc}>
                              <span className="font-bold mr-1">Kondisi:</span>{it.notes || it.keterangan || it.desc}
                            </div>
                          ) : (
                            <div className="mb-2 flex-1"></div>
                          )}

                          {/* Status */}
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className={`w-2 h-2 rounded-full ${STATUS_DOT[statusKey]}`}></div>
                          <span className={`text-[9px] font-bold tracking-widest uppercase ${STATUS_COLOR[statusKey]}`}>
                            {STATUS_LABEL[statusKey]}
                          </span>
                        </div>

                        {/* Not Ready Box */}
                        {notReadyNow && (
                          <div className={`mb-2 border rounded p-1.5 text-[9px] leading-tight ${STATUS_BOX[statusKey] || STATUS_BOX.unavailable}`}>
                            {statusKey === 'attention' ? <><span className="font-bold">⚠ Lagi maintenance</span> — tetap bisa di-booking buat tanggal ke depan, cek dulu kalender.</> : <><span className="font-bold">✕ Lagi not ready</span>. Alat tidak tersedia saat ini.</>}
                          </div>
                        )}

                        {/* Add to Cart Button */}
                        <button
                          onClick={() => addToCart(it)}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-primary/20 hover:bg-primary text-primary hover:text-primary-foreground rounded-lg text-[10px] font-bold tracking-wider transition-all border border-primary/30 hover:border-primary"
                        >
                          <Plus className="w-3 h-3" />
                          Tambah ke Keranjang
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} mode={authMode} setMode={setAuthMode} onSubmit={handleAuthSubmit} errorMsg={authError} />
      <CartModal 
        isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cart={cart} removeFromCart={removeFromCart} submitBooking={submitBooking} currentUser={currentUser} openAuthModal={() => { setIsCartOpen(false); setAuthMode('login'); setIsAuthOpen(true); }} isSubmitting={isSubmitting} conflictWarn={conflictWarn} setConflictWarn={setConflictWarn} checkDateConflicts={checkDateConflicts}
      />
      <CalendarModal 
        isOpen={isCalOpen} onClose={() => setIsCalOpen(false)} itemKey={calItemKey} itemName={calItemName} 
        bookedRanges={
          (() => {
            const raw = bookingsByItemRaw[calItemKey] || Object.values(bookingsByItemRaw).find(bMap => {
              return Object.values(bMap).some(b => b.itemName === calItemName);
            }) || {};
            return Object.values(raw).filter(b => b.status !== 'rejected' && b.status !== 'expired' && b.status !== 'returned' && b.status !== 'cancelled');
          })()
        }
      />

      {/* Issue Modal */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setIsIssueModalOpen(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-border bg-muted/30">
              <h3 className="font-bold text-lg">Laporkan Masalah Alat</h3>
              <button className="text-foreground/50 hover:text-foreground" onClick={() => setIsIssueModalOpen(false)}>✕</button>
            </div>
            <div className="p-6">
              {!currentUser ? (
                <div className="text-center py-6">
                  <p className="mb-4 text-foreground/70">Silakan login terlebih dahulu untuk melapor.</p>
                  <button className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90" onClick={() => { setIsIssueModalOpen(false); setAuthMode('login'); setIsAuthOpen(true); }}>Login Sekarang</button>
                </div>
              ) : (
                <form onSubmit={submitIssue} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground/80">Nama Alat yang Bermasalah</label>
                    <input type="text" required className="w-full bg-background border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm" value={issueForm.alat} onChange={e => setIssueForm({...issueForm, alat: e.target.value})} placeholder="Contoh: Sony A7III Unit 2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground/80">Deskripsi Masalah</label>
                    <textarea required className="w-full bg-background border border-border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm min-h-[100px]" value={issueForm.masalah} onChange={e => setIssueForm({...issueForm, masalah: e.target.value})} placeholder="Contoh: Lensa macet, baterai tidak mau charge..." />
                  </div>
                  <button type="submit" className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-colors mt-2">Kirim Laporan</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setIsHistoryModalOpen(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-border bg-muted/30 shrink-0">
              <h3 className="font-bold text-lg">Riwayat Booking Saya</h3>
              <button className="text-foreground/50 hover:text-foreground" onClick={() => setIsHistoryModalOpen(false)}>✕</button>
            </div>
            <div className="p-6 overflow-y-auto">
              {!currentUser ? (
                <div className="text-center py-6">Silakan login.</div>
              ) : (
                <div className="space-y-4">
                  {allBookings.filter(b => (b.uid === currentUser.id || b.uid === currentUser.uid)).length === 0 ? (
                    <div className="text-center py-10 text-foreground/50 bg-muted/20 rounded-xl border border-dashed border-border">Belum ada riwayat booking.</div>
                  ) : (
                    allBookings.filter(b => (b.uid === currentUser.id || b.uid === currentUser.uid)).sort((a,b) => b.timestamp - a.timestamp).map(b => (
                      <div key={b.id} className="bg-background border border-border p-5 rounded-xl shadow-sm hover:border-primary/30 transition-colors">
                        <div className="flex flex-wrap gap-2 justify-between items-center mb-3">
                          <strong className="font-mono text-primary">{b.id}</strong>
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-white ${
                            b.status === 'approved' ? 'bg-green-500' :
                            b.status === 'rejected' ? 'bg-destructive' :
                            b.status === 'returned' ? 'bg-secondary' : 'bg-yellow-500'
                          }`}>
                            {b.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-foreground/70 mb-4 bg-muted/20 p-3 rounded-lg border border-border/50">
                          <div>
                            <span className="block text-xs font-semibold text-foreground/50 mb-1">Jadwal</span>
                            {b.dateStart} <br/> s/d {b.dateEnd}
                          </div>
                          <div>
                            <span className="block text-xs font-semibold text-foreground/50 mb-1">Tujuan</span>
                            {b.purpose}
                          </div>
                        </div>
                        <div className="text-sm">
                          <strong className="block text-xs font-semibold text-foreground/50 mb-2">Item Dipinjam:</strong>
                          <ul className="space-y-1 pl-4 list-disc marker:text-primary/50">
                            {(b.booking_items || []).map((bi, idx) => {
                              const it = items.find(i => i.id === bi.inventory_id || itemKey(i) === bi.inventory_id) || { name: bi.inventory_id };
                              return (
                                <li key={idx} className="font-medium">{it.name}</li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
