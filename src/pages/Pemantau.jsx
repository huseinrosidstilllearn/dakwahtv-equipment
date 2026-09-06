import { normalizeBooking, fmtDate } from '../utils/normalize';
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import Navbar from '../components/Navbar';
import { Search, Filter, CalendarDays, AlertTriangle, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
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
  unavailable: 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-400'
};

function itemKey(it) {
  return (it.cat + "|" + it.group + "|" + it.name).replace(/[.#$/\[\]]/g, "_");
}

export default function Pemantau() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState(getSavedTheme);
  const [announcements, setAnnouncements] = useState([]);
  const [timelineBookings, setTimelineBookings] = useState({});
  const [ganttSelectedCat, setGanttSelectedCat] = useState('all');
  const [ganttMonthOffset, setGanttMonthOffset] = useState(0);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Fetch inventory
  useEffect(() => {
    const fetchInventory = async () => {
      const { data } = await supabase.from('inventory').select('*');
      if (data) {
        setItems(data.map(it => ({ ...it, status: it.status || 'ready' })));
      }
    };
    fetchInventory();
    const channel = supabase.channel('public:inventory').on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, fetchInventory).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Fetch announcements
  useEffect(() => {
    const fetchAnn = async () => {
      const { data } = await supabase.from('config').select('value').eq('key', 'announcement').maybeSingle();
      const val = data?.value;
      if (val && val.enabled && val.text) {
        setAnnouncements(val.text.split('\n').filter(l => l.trim()));
      } else {
        setAnnouncements([]);
      }
    };
    fetchAnn();
    const channel = supabase.channel('public:config_ann').on('postgres_changes', { event: '*', schema: 'public', table: 'config', filter: 'key=eq.announcement' }, fetchAnn).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Maintenance mode check...
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

    const channelMaint = supabase.channel('public:config_maint')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config', filter: 'key=eq.maintenanceMode' }, fetchMaint)
      .subscribe();

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (user && user.role !== 'anonymous') {
        const { data: roleData } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
        isAdmin = (roleData?.role === 'admin');
        authChecked = true;
        enforce();
      } else {
        isAdmin = false;
        authChecked = true;
        enforce();
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      checkAuth();
    });

    return () => { 
      supabase.removeChannel(channelMaint); 
      subscription?.unsubscribe();
    };
  }, []);

  // Fetch bookings for Gantt
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const [
          { data: bksData },
          { data: cfgAvail }
        ] = await Promise.all([
          supabase.from('bookings').select('*, booking_items(inventory(*))'),
          supabase.from('config').select('value').eq('key', 'publicAvailability').maybeSingle()
        ]);

        const formatted = {};

        // 1. From config.publicAvailability (ensures 100% data access for public)
        if (cfgAvail?.value && typeof cfgAvail.value === 'object') {
          Object.entries(cfgAvail.value).forEach(([itemId, arr]) => {
            if (Array.isArray(arr)) {
              arr.forEach(entry => {
                const bId = entry.bookingId || `${itemId}-${entry.dateStart}`;
                if (!formatted[bId]) {
                  formatted[bId] = {
                    id: bId,
                    dateStart: entry.dateStart,
                    dateEnd: entry.dateEnd,
                    status: entry.status,
                    userName: entry.userName,
                    items: []
                  };
                }
                formatted[bId].items.push({ id: itemId, name: entry.itemName });
              });
            }
          });
        }

        // 2. Overlay with direct bookings
        if (bksData && bksData.length > 0) {
          bksData.forEach(raw => {
            const b = normalizeBooking(raw);
            if (!b) return;
            formatted[b.id] = {
              ...b,
              dateStart: b.dateStart,
              dateEnd: b.dateEnd,
              status: b.status,
              items: b.items || []
            };
          });
        }

        setTimelineBookings(formatted);
      } catch (err) {
        console.error("Pemantau fetchBookings error:", err);
      }
    };
    fetchBookings();
    const channel = supabase.channel('public:pemantau_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, fetchBookings)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredItems = items.filter(d => {
    const matchFilter = filter === 'all' || filter === 'gantt' ? true : d.status === filter;
    const matchSearch = !searchQuery || (d.name + " " + (d.group || "") + " " + d.cat).toLowerCase().includes(searchQuery.toLowerCase());
    return matchFilter && matchSearch;
  });

  const cats = sortCategories([...new Set(filteredItems.map(d => d.cat || 'Uncategorized'))]);

  const readyCount = items.filter(d => d.status === 'ready' || !d.status).length;
  const attentionCount = items.filter(d => d.status === 'attention').length;
  const unavailableCount = items.filter(d => d.status === 'unavailable').length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const borrowedCount = Object.values(timelineBookings).filter(b => {
    if (b.status === 'active' || b.status === 'picked_up') return true;
    if (b.status === 'approved') {
      const start = new Date(b.dateStart); start.setHours(0, 0, 0, 0);
      const end = new Date(b.dateEnd); end.setHours(0, 0, 0, 0);
      if (today >= start && today <= end) return true;
    }
    return false;
  }).reduce((acc, b) => {
    return acc + (Array.isArray(b.items) ? b.items.length : Object.values(b.items || {}).length);
  }, 0);

  const renderGanttTimeline = () => {
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + ganttMonthOffset, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

    const headCols = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = ganttMonthOffset === 0 && d === now.getDate();
      headCols.push(
        <th key={d} className={`px-1 py-2 text-[10px] font-mono min-w-[26px] text-center ${isToday ? 'bg-primary text-primary-foreground font-bold' : 'text-foreground/70 font-normal'}`}>
          {d}
        </th>
      );
    }

    const categories = ["all", ...sortCategories([...new Set(items.map(i => i.cat).filter(Boolean))])];
    const filteredItemsGantt = (ganttSelectedCat === "all" ? items : items.filter(i => i.cat === ganttSelectedCat)).sort((a, b) => (a.old_key || a.name || "").localeCompare(b.old_key || b.name || "", undefined, { numeric: true, sensitivity: 'base' }));

    return (
      <div className="bg-card/50 border border-border rounded-2xl p-4 md:p-6 mb-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h3 className="font-bold text-xl flex items-center gap-2 mb-1">
              <Calendar className="w-5 h-5 text-primary" />
              KALENDER KETERSEDIAAN ALAT
            </h3>
            <p className="font-mono text-xs text-foreground/50">Lihat jadwal peminjaman per kategori bulan ini</p>
          </div>

          <div className="flex items-center gap-2 bg-background border border-border p-1 rounded-lg">
            <button onClick={() => setGanttMonthOffset(p => p - 1)} className="px-3 py-1.5 hover:bg-accent rounded-md font-mono text-xs font-semibold transition-colors">‹ Prev</button>
            <span className="font-mono text-sm font-bold text-primary px-4 text-center min-w-[120px]">{monthNames[month]} {year}</span>
            <button onClick={() => setGanttMonthOffset(p => p + 1)} className="px-3 py-1.5 hover:bg-accent rounded-md font-mono text-xs font-semibold transition-colors">Next ›</button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[10px] font-mono mb-6 flex-wrap bg-muted/30 p-3 rounded-lg border border-border/50">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/50"></div> Ready</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-500/50 border border-blue-500"></div> Booking Disetujui</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-500/50 border border-blue-500"></div> Dipinjam</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-yellow-500/50 border border-yellow-500"></div> Maintenance</div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4 mb-4 border-b border-border scrollbar-none">
          {categories.map(c => {
            const isAct = ganttSelectedCat === c;
            const label = c === "all" ? "Semua Kategori" : c;
            const count = c === "all" ? items.length : items.filter(i => i.cat === c).length;
            return (
              <button
                key={c}
                onClick={() => setGanttSelectedCat(c)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-xs font-medium font-mono transition-all ${isAct ? 'bg-primary text-primary-foreground shadow-md' : 'bg-background border border-border text-foreground/70 hover:bg-accent'}`}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto pb-4">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="p-3 text-left font-mono text-xs font-semibold text-foreground/70 sticky left-0 bg-card z-10 min-w-[150px] max-w-[200px] border-r border-border">Nama Alat ({filteredItemsGantt.length})</th>
                {headCols}
              </tr>
            </thead>
            <tbody>
              {filteredItemsGantt.length === 0 ? (
                <tr>
                  <td colSpan={daysInMonth + 1} className="text-center py-10 font-mono text-sm text-foreground/40">Tidak ada alat dalam kategori ini.</td>
                </tr>
              ) : (
                filteredItemsGantt.map((item, idx) => {
                  const k = itemKey(item);
                  const cells = [];
                  for (let d = 1; d <= daysInMonth; d++) {
                    const dateMs = new Date(year, month, d).getTime();
                    let statusCls = "bg-green-500/10";
                    let innerCls = "";

                    if (item.status === "attention") {
                      statusCls = "bg-yellow-500/20";
                      innerCls = "bg-yellow-500";
                    }

                    const toMid = (val) => {
                      if (!val) return 0;
                      if (typeof val === 'string') {
                        const clean = val.split('T')[0];
                        if (clean.includes('-')) {
                          const p = clean.split('-').map(Number);
                          return new Date(p[0], p[1] - 1, p[2]).getTime();
                        }
                      }
                      const dt = new Date(val);
                      return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
                    };

                    const itemBks = Object.values(timelineBookings).filter(b => 
                      (b.items || []).some(i => i.id === item.id || i.name === item.name || i.key === k)
                    );
                    for (const b of itemBks) {
                      const bStart = toMid(b.dateStart || b.date_start);
                      const bEnd = toMid(b.dateEnd || b.date_end);
                      if (dateMs >= bStart && dateMs <= bEnd) {
                        if (["approved", "letter_ready", "disetujui"].includes(b.status)) {
                          statusCls = "bg-teal-500/20";
                          innerCls = "bg-teal-500";
                        } else if (["active", "picked_up", "dipinjam"].includes(b.status)) {
                          statusCls = "bg-blue-500/20";
                          innerCls = "bg-blue-500";
                        } else if (b.status === "pending") {
                          statusCls = "bg-yellow-400/20";
                          innerCls = "bg-yellow-400";
                        }
                      }
                    }

                    cells.push(
                      <td key={d} className={`p-[1px] ${statusCls} border-r border-b border-border/30`} title={item.name}>
                        <div className={`w-full h-6 rounded-sm ${innerCls} opacity-80`}></div>
                      </td>
                    );
                  }

                  return (
                    <tr key={k} className="hover:bg-accent/30 transition-colors group">
                      <td className="p-3 text-xs font-mono font-medium sticky left-0 bg-card group-hover:bg-muted z-10 border-r border-b border-border truncate max-w-[200px]" title={item.name}>
                        {item.name}
                      </td>
                      {cells}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground pt-20 pb-20 selection:bg-primary selection:text-primary-foreground">
      <Navbar theme={theme} setTheme={setTheme} />
      
      <header className="max-w-7xl mx-auto px-4 md:px-8 pt-8 pb-12 flex flex-col items-center text-center">
        <img src="/logo.png" className="w-full max-w-[220px] mb-8 drop-shadow-md" alt="Dakwah TV" />
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-xs font-mono font-semibold">
          <div className="w-2 h-2 rounded-full dot-glow-primary"></div>
          <span>Live Availability</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 uppercase">
          EQUIPMENT <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary to-blue-500">AVAILABILITY</span>
        </h1>
        <p className="text-xs md:text-sm font-mono text-foreground/50 tracking-widest uppercase">
          Katalog Alat Produksi • Status Real-Time
        </p>
      </header>

      {/* Announcement Banner */}
      {announcements.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 mb-8 space-y-2">
          {announcements.map((line, i) => (
            <div key={i} className="flex items-center gap-3 bg-secondary/10 border border-secondary/30 text-secondary p-3 rounded-xl font-mono text-xs md:text-sm shadow-sm">
              <span className="bg-secondary text-secondary-foreground font-bold text-[10px] px-2 py-1 rounded flex items-center gap-1 uppercase tracking-wider">
                <AlertCircle className="w-3 h-3" /> Studio
              </span>
              <span className="font-medium text-foreground">{line}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mb-10">
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
            <span className="font-black text-amber-700 dark:text-yellow-400 ml-1">{attentionCount}</span>
          </div>
          <div className="w-px h-4 bg-border/50 hidden md:block"></div>

          <div className="flex items-center gap-2 group cursor-default">
            <div className="w-2 h-2 rounded-full dot-glow-red"></div>
            <span className="text-rose-700 dark:text-red-400 font-bold tracking-widest">NOT READY</span>
            <span className="font-black text-rose-700 dark:text-red-400 ml-1">{unavailableCount}</span>
          </div>
          <div className="w-px h-4 bg-border/50 hidden md:block"></div>

          <div className="flex items-center gap-2 group cursor-default">
            <div className="w-2 h-2 rounded-full dot-glow-blue"></div>
            <span className="text-sky-700 dark:text-blue-400 font-bold tracking-widest">DIPINJAM</span>
            <span className="font-black text-sky-700 dark:text-blue-400 ml-1">{borrowedCount}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mb-10 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Cari kamera, lensa, audio..."
            className="w-full h-12 pl-12 pr-4 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full overflow-x-auto pb-2 scrollbar-none">
          <button onClick={() => setFilter('all')} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'all' ? 'bg-foreground text-background shadow-md' : 'bg-background border border-border text-foreground/70 hover:bg-accent'}`}>
            Semua Status
          </button>
          <button onClick={() => setFilter('ready')} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filter === 'ready' ? 'bg-green-500/20 text-green-500 border border-green-500/50' : 'bg-background border border-border text-foreground/70 hover:bg-accent'}`}>
            <CheckCircle2 className="w-4 h-4" /> Ready
          </button>
          <button onClick={() => setFilter('attention')} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filter === 'attention' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 'bg-background border border-border text-foreground/70 hover:bg-accent'}`}>
            <AlertTriangle className="w-4 h-4" /> Maintenance
          </button>
          <button onClick={() => setFilter('unavailable')} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filter === 'unavailable' ? 'bg-destructive/20 text-destructive border border-destructive/50' : 'bg-background border border-border text-foreground/70 hover:bg-accent'}`}>
            <AlertCircle className="w-4 h-4" /> Not Ready
          </button>
          <button onClick={() => setFilter('gantt')} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ml-2 ${filter === 'gantt' ? 'bg-secondary text-secondary-foreground shadow-md' : 'bg-background border border-border text-foreground/70 hover:bg-accent'}`}>
            <CalendarDays className="w-4 h-4" /> Kalender Ketersediaan
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {filter === 'gantt' ? (
          renderGanttTimeline()
        ) : (
          <div>
            {cats.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-foreground/40">
                <Search className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">Alat tidak ditemukan.</p>
              </div>
            )}
            
            {cats.map((cat, ci) => {
              const catItems = filteredItems.filter(d => d.cat === cat).sort((a, b) => (a.old_key || a.name || "").localeCompare(b.old_key || b.name || "", undefined, { numeric: true, sensitivity: 'base' }));
              
              if (catItems.length === 0) return null;

              return (
                <div key={cat} className="mb-8 last:mb-0">
                  <div className="flex items-center gap-2 mb-4 sticky top-0 bg-background/95 backdrop-blur z-10 py-2 border-b border-border/50">
                    <span className="text-xl font-display text-teal">{String(ci + 1).padStart(2, '0')}</span>
                    <span className="text-sm font-bold tracking-widest uppercase">{cat}</span>
                    <div className="flex-1"></div>
                    <span className="text-[10px] font-mono text-foreground/50">{catItems.length} item</span>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                    {catItems.map(it => {
                      const k = itemKey(it);
                      const notReadyNow = it.status !== "ready";
                      const statusColor = it.status === 'ready' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : it.status === 'attention' ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]' : 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.8)]';

                      return (
                        <div key={k} className="group relative flex flex-col bg-card rounded-xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-glow border border-border hover:border-teal/50">
                          <div className="h-[120px] md:h-[150px] relative overflow-hidden flex items-center justify-center p-4 bg-muted/20">
                            {it.img ? (
                              <img src={it.img} alt={it.name} loading="lazy" className="w-full h-full object-contain drop-shadow-xl group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                              <span className="text-4xl font-black text-foreground/10">?</span>
                            )}
                          </div>
                          <div className="p-4 flex-1 flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                             <span className="text-[9px] font-mono text-foreground/50 uppercase tracking-widest">{it.group || cat}</span>
                             <span className="text-[10px] font-bold text-yellow-500">x{it.qty || 1}</span>
                            </div>
                            
                            <h3 className="font-bold text-xs md:text-sm leading-tight mb-2 flex-1">{it.name}</h3>
                             {(it.notes || it.keterangan || it.desc) && (
                               <div className="text-[9px] text-yellow-600/90 dark:text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20 leading-tight line-clamp-2 mb-2" title={it.notes || it.keterangan || it.desc}>
                                 <span className="font-bold mr-1">Kondisi:</span>{it.notes || it.keterangan || it.desc}
                               </div>
                             )}
                            
                            <div className="flex items-center gap-1.5 mt-auto mb-2">
                                <div className={`w-2 h-2 rounded-full ${STATUS_DOT[it.status || 'ready']}`}></div>
                                <span className={`text-[9px] font-bold tracking-widest uppercase ${STATUS_COLOR[it.status || 'ready']}`}>
                                  {STATUS_LABEL[it.status || 'ready']}
                                </span>
                              </div>
                              
                              {notReadyNow && (
                                <div className={`mt-3 border rounded p-1.5 text-[9px] leading-tight ${STATUS_BOX[it.status] || STATUS_BOX.unavailable}`}>
                                  {it.status === 'attention' ? <><span className="font-bold">⚠ Lagi maintenance</span> — tetap bisa di-booking, cek kalender.</> : <><span className="font-bold">✕ Lagi not ready</span>. Alat tidak tersedia saat ini.</>}
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
