import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function CalendarModal({ isOpen, onClose, itemKey, itemName, bookedRanges = [] }) {
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    if (isOpen) {
      setViewDate(new Date());
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();
  const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const dayNames = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
  const daysInMonth = new Date(Date.UTC(y, m+1, 0)).getUTCDate();
  const firstDayOfWeek = new Date(y, m, 1).getDay(); // 0=Sun
  const todayStr = new Date().toDateString();

  // Safely normalize bookedRanges to always be an array
  const rawRanges = Array.isArray(bookedRanges) ? bookedRanges : Object.values(bookedRanges || {});
  
  const toMidnight = (val) => {
    if (!val) return 0;
    if (typeof val === 'string') {
      const clean = val.split('T')[0];
      if (clean.includes('-')) {
        const parts = clean.split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
      }
    }
    const d = new Date(val);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };

  const safeRanges = rawRanges.map(r => ({
    ...r,
    startMs: toMidnight(r.dateStart || r.date_start || r.startDate),
    endMs: toMidnight(r.dateEnd || r.date_end || r.endDate),
    status: r.status || ''
  })).filter(r => r.startMs > 0 && r.endMs > 0);

  const handlePrev = () => {
    setViewDate(new Date(y, m - 1, 1));
  };

  const handleNext = () => {
    setViewDate(new Date(y, m + 1, 1));
  };

  const getStatus = (date) => {
    const t = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    let found = null;
    for (const r of safeRanges) {
      if (t >= r.startMs && t <= r.endMs) {
        const st = r.status.toLowerCase();
        if (st === "picked_up" || st === "active") return { type: "dipinjam", info: r };
        if (st === "approved" || st === "letter_ready" || st === "disetujui") {
          found = { type: "booked", info: r };
        } else if (st === "pending" && !found) {
          found = { type: "pending", info: r };
        }
      }
    }
    return found;
  };

  // Build day-of-week headers
  const dowHeaders = dayNames.map((d, i) => (
    <div key={`dow-${i}`} className="text-center py-2 text-[10px] font-mono text-foreground/50 uppercase font-bold tracking-wider">{d}</div>
  ));

  // Build empty cells for days before the 1st
  const emptyCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    emptyCells.push(<div key={`empty-${i}`} className="p-2"></div>);
  }

  // Active bookings in this month for schedule breakdown (sorted chronologically)
  const monthStartMs = new Date(y, m, 1).getTime();
  const monthEndMs = new Date(y, m, daysInMonth, 23, 59, 59).getTime();
  const monthBookings = safeRanges
    .filter(r => r.startMs <= monthEndMs && r.endMs >= monthStartMs)
    .sort((a, b) => a.startMs - b.startMs);

  // Build day cells
  const dayCells = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    const stObj = getStatus(date);
    const status = stObj ? stObj.type : null;
    const isPast = date < new Date(new Date().toDateString());
    const isToday = date.toDateString() === todayStr;
    
    let bgClass = "bg-background hover:bg-accent hover:text-foreground text-foreground/80";
    let borderClass = "border border-border/50";
    let textClass = "";
    
    if (isPast && !status) {
       textClass = "opacity-30";
    }
    
    if (status === "dipinjam") {
       bgClass = "bg-red-500 text-white font-bold shadow-md drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]";
       borderClass = "border-red-500";
    } else if (status === "booked") {
       bgClass = "bg-teal-500 text-white font-bold shadow-md drop-shadow-[0_0_8px_rgba(20,184,166,0.7)]";
       borderClass = "border-teal-500";
    } else if (status === "pending") {
       bgClass = "bg-amber-500/20 text-amber-800 dark:text-yellow-400 font-bold";
       borderClass = "border-amber-500/50";
    }

    if (isToday && !status) {
       borderClass = "border-2 border-foreground";
       textClass = "font-black text-foreground";
    }

    const titleText = stObj?.info?.userName ? `${d} ${monthNames[m]}: ${stObj.info.userName} (${stObj.info.dept || stObj.type})` : undefined;

    dayCells.push(
      <div key={d} className="p-1" title={titleText}>
         <div className={`w-full aspect-square flex items-center justify-center rounded-lg text-sm transition-all cursor-default ${bgClass} ${borderClass} ${textClass}`}>
           {d}
         </div>
      </div>
    );
  }

  const fmtRange = (r) => {
    const s = new Date(r.startMs);
    const e = new Date(r.endMs);
    const sStr = `${s.getDate()} ${monthNames[s.getMonth()].substring(0,3)}`;
    if (r.startMs === r.endMs) return sStr;
    const eStr = `${e.getDate()} ${monthNames[e.getMonth()].substring(0,3)}`;
    return `${sStr} - ${eStr}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in" id="cal-overlay" onClick={(e) => { if (e.target.id === 'cal-overlay') onClose(); }}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]" id="cal-modal">
        
        {/* Header */}
        <div className="p-5 border-b border-border bg-muted/30 flex justify-between items-start shrink-0">
          <div className="pr-4">
            <h2 className="font-bold text-lg leading-tight flex items-start gap-2 mb-1">
               <Calendar className="w-5 h-5 text-primary shrink-0 mt-0.5" />
               <span>{itemName}</span>
            </h2>
            <div className="text-xs font-mono text-foreground/50 uppercase tracking-wider">
               Kalender Ketersediaan Alat
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 -mr-1.5 -mt-1.5 text-foreground/50 hover:text-foreground rounded-lg hover:bg-accent transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
           {/* Navigation */}
           <div className="flex justify-between items-center bg-background border border-border p-1.5 rounded-xl mb-4 shadow-sm">
             <button onClick={handlePrev} className="p-2 hover:bg-accent rounded-lg transition-colors">
               <ChevronLeft className="w-5 h-5" />
             </button>
             <span className="font-bold text-sm text-primary uppercase tracking-wider">
               {monthNames[m]} {y}
             </span>
             <button onClick={handleNext} className="p-2 hover:bg-accent rounded-lg transition-colors">
               <ChevronRight className="w-5 h-5" />
             </button>
           </div>

           {/* Calendar Grid */}
           <div className="bg-muted/10 border border-border rounded-xl p-3 mb-4">
             <div className="grid grid-cols-7 mb-1">
               {dowHeaders}
             </div>
             <div className="grid grid-cols-7">
               {emptyCells}
               {dayCells}
             </div>
           </div>

           {/* Legend */}
           <div className="flex gap-4 items-center justify-center bg-background border border-border p-3 rounded-xl text-[10px] font-mono uppercase tracking-wider font-bold mb-4">
             <div className="flex items-center gap-1.5">
               <div className="w-3 h-3 rounded-sm bg-teal-500 shadow-sm drop-shadow-[0_0_4px_rgba(20,184,166,0.6)]"></div>
               <span className="text-foreground/70">Disetujui</span>
             </div>
             <div className="flex items-center gap-1.5">
               <div className="w-3 h-3 rounded-sm bg-yellow-500/40 border border-yellow-500/60"></div>
               <span className="text-foreground/70">Pending</span>
             </div>
             <div className="flex items-center gap-1.5">
               <div className="w-3 h-3 rounded-sm bg-red-500 shadow-sm drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]"></div>
               <span className="text-red-400 font-bold">Dipinjam</span>
             </div>
           </div>

           {/* Detailed Bookings Schedule for the month */}
           {monthBookings.length > 0 && (
             <div className="bg-muted/20 border border-border rounded-xl p-3 space-y-2">
               <div className="text-[11px] font-mono font-bold text-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
                 <span>📅</span> Jadwal Terisi Bulan Ini:
               </div>
               <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                 {monthBookings.map((mb, idx) => {
                   const isApproved = mb.status === 'approved' || mb.status === 'letter_ready' || mb.status === 'disetujui';
                   const isPickedUp = mb.status === 'picked_up' || mb.status === 'active';
                   const badgeCls = isPickedUp
                     ? "bg-red-500/20 text-red-400 border-red-500/30"
                     : isApproved
                     ? "bg-teal-500/20 text-teal-400 border-teal-500/30"
                     : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
                   const labelStatus = isPickedUp ? "Dipinjam" : isApproved ? "Disetujui" : "Pending";

                   return (
                     <div key={idx} className="flex justify-between items-center text-xs bg-background/60 border border-border/60 p-2 rounded-lg font-mono">
                       <div>
                         <span className="font-bold text-foreground">{fmtRange(mb)}</span>
                         {mb.dept && <span className="text-foreground/50 ml-1.5 text-[11px]">({mb.dept})</span>}
                       </div>
                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeCls}`}>
                         {labelStatus}
                       </span>
                     </div>
                   );
                 })}
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
