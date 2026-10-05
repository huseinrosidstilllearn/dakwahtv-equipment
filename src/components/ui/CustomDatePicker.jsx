import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock, Check } from 'lucide-react';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
];

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// Format a Date object to YYYY-MM-DD
export function formatDateISO(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format YYYY-MM-DD to Indonesian human string e.g. "Sen, 5 Okt 2026"
export function formatDateHuman(isoStr) {
  if (!isoStr) return '';
  const parts = String(isoStr).split('T')[0].split('-');
  if (parts.length !== 3) return isoStr;
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, monthIdx, day);
  if (isNaN(d.getTime())) return isoStr;
  const dayName = DAY_NAMES[d.getDay()];
  const monthName = MONTH_SHORT[monthIdx] || '';
  return `${dayName}, ${day} ${monthName} ${year}`;
}

export default function CustomDatePicker({
  value,
  onChange,
  name,
  placeholder = 'Pilih tanggal...',
  minDate,
  maxDate,
  allowPast = false,
  rangeStart,
  rangeEnd,
  required = false,
  disabled = false,
  className = '',
  align = 'left' // 'left' | 'right'
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Parse initial view year and month from value or today
  const getInitialView = () => {
    if (value) {
      const parts = String(value).split('T')[0].split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      }
    }
    return new Date();
  };

  const [viewDate, setViewDate] = useState(getInitialView);
  const containerRef = useRef(null);

  // Sync view when value changes or when opened
  useEffect(() => {
    if (isOpen && value) {
      const parts = String(value).split('T')[0].split('-');
      if (parts.length === 3) {
        setViewDate(new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1));
      }
    }
  }, [isOpen, value]);

  // Click outside and Escape key handler
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(year, month + 1, 1));
  };

  // Convert string YYYY-MM-DD to midnight timestamp for safe comparisons
  const toMidnightTimestamp = (dateInput) => {
    if (!dateInput) return 0;
    if (typeof dateInput === 'string') {
      const parts = dateInput.split('T')[0].split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
      }
    }
    const d = new Date(dateInput);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };

  const todayTs = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
  const minTs = minDate ? toMidnightTimestamp(minDate) : (allowPast ? 0 : todayTs);
  const maxTs = maxDate ? toMidnightTimestamp(maxDate) : Infinity;

  const currentValTs = value ? toMidnightTimestamp(value) : 0;
  const rangeStartTs = rangeStart ? toMidnightTimestamp(rangeStart) : 0;
  const rangeEndTs = rangeEnd ? toMidnightTimestamp(rangeEnd) : 0;

  // Calendar matrix calculation
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun

  const handleDaySelect = (dayNum) => {
    const selected = new Date(year, month, dayNum);
    const isoStr = formatDateISO(selected);
    if (onChange) onChange(isoStr);
    setIsOpen(false);
  };

  const handleQuickSelect = (daysToAdd) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    const isoStr = formatDateISO(d);
    if (onChange) onChange(isoStr);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) onChange('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Hidden input for HTML form submission compatibility */}
      {name && <input type="hidden" name={name} value={value || ''} required={required} />}

      {/* Input Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full bg-muted/40 hover:bg-muted/60 border ${
          isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-border'
        } rounded-xl px-3 py-2 text-xs transition-all font-medium flex items-center justify-between gap-2 cursor-pointer text-left disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <CalendarIcon className={`w-3.5 h-3.5 shrink-0 ${value ? 'text-primary' : 'text-foreground/40'}`} />
          {value ? (
            <span className="text-foreground font-semibold truncate">{formatDateHuman(value)}</span>
          ) : (
            <span className="text-foreground/40 truncate text-[11px] sm:text-xs">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              onClick={handleClear}
              className="p-1 hover:bg-muted text-foreground/40 hover:text-foreground rounded-md transition-colors"
              title="Hapus tanggal"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <span className="text-[10px] text-foreground/30 font-mono">📅</span>
        </div>
      </button>

      {/* Floating Modern Calendar Dropdown */}
      {isOpen && (
        <div
          className={`absolute top-full mt-2 z-50 bg-card/98 dark:bg-[#0c171d]/98 border border-border/80 shadow-2xl backdrop-blur-2xl rounded-2xl p-3.5 w-[290px] sm:w-[310px] animate-in fade-in zoom-in-95 ${
            align === 'right' ? 'right-0' : 'left-0 sm:left-auto'
          }`}
          style={{ maxWidth: 'calc(100vw - 32px)' }}
        >
          {/* Quick Selection Pills */}
          <div className="flex items-center gap-1.5 pb-2.5 mb-2.5 border-b border-border/50 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => handleQuickSelect(0)}
              className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all shrink-0 cursor-pointer"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelect(1)}
              className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg bg-muted text-foreground/70 hover:bg-muted/80 hover:text-foreground transition-all shrink-0 cursor-pointer"
            >
              Besok
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelect(2)}
              className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg bg-muted text-foreground/70 hover:bg-muted/80 hover:text-foreground transition-all shrink-0 cursor-pointer"
            >
              +2 Hari
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelect(3)}
              className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg bg-muted text-foreground/70 hover:bg-muted/80 hover:text-foreground transition-all shrink-0 cursor-pointer"
            >
              +3 Hari
            </button>
          </div>

          {/* Month / Year Navigator */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-muted rounded-lg text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
              title="Bulan sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-bold text-xs sm:text-sm text-foreground tracking-wide font-mono uppercase">
              {MONTH_NAMES[month]} {year}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-muted rounded-lg text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
              title="Bulan berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 mb-1 text-center">
            {DAY_NAMES.map((d, i) => (
              <div
                key={d}
                className={`py-1 text-[9px] font-mono font-bold uppercase tracking-wider ${
                  i === 0 ? 'text-destructive/70' : 'text-foreground/40'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty prefix slots */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="p-1" />
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateObj = new Date(year, month, day);
              const dayTs = dateObj.getTime();
              const isPast = dayTs < todayTs && !allowPast;
              const isBelowMin = minTs > 0 && dayTs < minTs;
              const isAboveMax = maxTs < Infinity && dayTs > maxTs;
              const isDisabled = isPast || isBelowMin || isAboveMax;

              const isToday = dayTs === todayTs;
              const isSelected = currentValTs > 0 && dayTs === currentValTs;
              const isInRange = rangeStartTs > 0 && rangeEndTs > 0 && dayTs >= rangeStartTs && dayTs <= rangeEndTs;

              let cellStyle = 'text-foreground/80 hover:bg-muted hover:text-foreground';
              if (isSelected) {
                cellStyle = 'bg-primary text-primary-foreground font-black shadow-md shadow-primary/30';
              } else if (isInRange) {
                cellStyle = 'bg-primary/20 text-primary font-bold';
              } else if (isToday) {
                cellStyle = 'border border-primary/50 text-primary font-bold bg-primary/5';
              }

              if (isDisabled) {
                cellStyle = 'opacity-20 cursor-not-allowed text-foreground/40';
              }

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => !isDisabled && handleDaySelect(day)}
                  className={`aspect-square w-full rounded-lg text-xs font-mono flex items-center justify-center transition-all cursor-pointer ${cellStyle}`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer Summary */}
          <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-foreground/60 font-mono">
            <span>{value ? `🗓️ ${formatDateHuman(value)}` : 'Pilih satu tanggal'}</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-primary hover:underline font-bold cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
