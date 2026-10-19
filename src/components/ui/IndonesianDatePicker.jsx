import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAY_NAMES_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/**
 * Format YYYY-MM-DD to Indonesian DD/MM/YYYY
 */
export function formatToIndonesianDate(isoStr) {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length !== 3) return isoStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

/**
 * Parse DD/MM/YYYY to YYYY-MM-DD
 */
export function parseFromIndonesianDate(idStr) {
  if (!idStr) return '';
  const parts = idStr.split('/');
  if (parts.length !== 3) return idStr;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Premium Indonesian Date Picker
 * Replaces native browser date pickers with true DD/MM/YYYY format and Indonesian language calendar.
 */
export default function IndonesianDatePicker({
  value = '',
  onChange,
  minDate = '',
  maxDate = '',
  rangeStart = '',
  rangeEnd = '',
  placeholder = 'DD/MM/YYYY',
  name,
  required = false,
  align = 'left',
  disabled = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse current value for viewing year & month
  const initialDate = useMemo(() => {
    if (value) {
      const [y, m, d] = value.split('-').map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    if (minDate) {
      const [y, m, d] = minDate.split('-').map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    return new Date();
  }, [value, minDate]);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  // Keep view in sync when value changes externally
  useEffect(() => {
    if (value) {
      const [y, m] = value.split('-').map(Number);
      if (y && m) {
        setViewYear(y);
        setViewMonth(m - 1);
      }
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDate = (year, month, day) => {
    const yStr = String(year);
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const isoDate = `${yStr}-${mStr}-${dStr}`;

    if (onChange) {
      onChange(isoDate);
    }
    setIsOpen(false);
  };

  const handleSelectToday = (e) => {
    e.stopPropagation();
    const now = new Date();
    const yStr = String(now.getFullYear());
    const mStr = String(now.getMonth() + 1).padStart(2, '0');
    const dStr = String(now.getDate()).padStart(2, '0');
    const isoDate = `${yStr}-${mStr}-${dStr}`;

    if (minDate && isoDate < minDate) return;
    if (maxDate && isoDate > maxDate) return;

    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    if (onChange) onChange(isoDate);
    setIsOpen(false);
  };

  // Generate calendar days for the current viewMonth
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);

    // Monday-based index (0 = Monday, 6 = Sunday)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days = [];

    // Previous month filler days
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      const yStr = String(y);
      const mStr = String(m + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const iso = `${yStr}-${mStr}-${dStr}`;
      days.push({ day: d, month: m, year: y, iso, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const yStr = String(viewYear);
      const mStr = String(viewMonth + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const iso = `${yStr}-${mStr}-${dStr}`;
      days.push({ day: d, month: viewMonth, year: viewYear, iso, isCurrentMonth: true });
    }

    // Next month filler days to complete rows (up to 42 cells)
    const totalCells = Math.ceil(days.length / 7) * 7;
    let nextMonthDay = 1;
    while (days.length < totalCells) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      const yStr = String(y);
      const mStr = String(m + 1).padStart(2, '0');
      const dStr = String(nextMonthDay).padStart(2, '0');
      const iso = `${yStr}-${mStr}-${dStr}`;
      days.push({ day: nextMonthDay, month: m, year: y, iso, isCurrentMonth: false });
      nextMonthDay++;
    }

    return days;
  }, [viewYear, viewMonth]);

  const todayIso = useMemo(() => {
    const now = new Date();
    const yStr = String(now.getFullYear());
    const mStr = String(now.getMonth() + 1).padStart(2, '0');
    const dStr = String(now.getDate()).padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
  }, []);

  const displayString = useMemo(() => {
    if (!value) return '';
    const parts = value.split('-');
    if (parts.length !== 3) return value;
    const [y, m, d] = parts;
    const mIdx = Number(m) - 1;
    const shortMonth = MONTH_NAMES_ID[mIdx]?.slice(0, 3) || m;
    return `${d}/${m}/${y} (${d} ${shortMonth})`;
  }, [value]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Hidden input storing standard ISO date YYYY-MM-DD for form submissions */}
      {name && <input type="hidden" name={name} value={value ?? ''} required={required} />}

      {/* Input / Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-background border rounded-xl text-left transition-all cursor-pointer select-none text-xs font-semibold ${
          isOpen
            ? 'border-teal ring-2 ring-teal/20 shadow-xs'
            : 'border-border hover:border-foreground/30'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <CalendarIcon className="w-4 h-4 text-teal shrink-0" />
          <span className={`truncate font-mono ${value ? 'text-foreground' : 'text-foreground/40 font-normal'}`}>
            {displayString || placeholder}
          </span>
        </div>

        <span className="text-[10px] font-mono text-teal/80 bg-teal/10 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shrink-0">
          Tgl
        </span>
      </button>

      {/* Floating Indonesian Calendar Picker */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 w-72 sm:w-80 bg-card/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-4 animate-in fade-in zoom-in-95 duration-150 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{ maxWidth: 'calc(100vw - 32px)' }}
        >
          {/* Header Month / Year Navigation */}
          <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-border/80">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-muted text-foreground/70 hover:text-foreground rounded-lg transition-colors cursor-pointer"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 font-bold text-xs text-foreground font-heading">
              <span>{MONTH_NAMES_ID[viewMonth]}</span>
              <span className="font-mono text-teal">{viewYear}</span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-muted text-foreground/70 hover:text-foreground rounded-lg transition-colors cursor-pointer"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days of Week Header (Indonesian: Sen, Sel, Rab, Kam, Jum, Sab, Min) */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
            {DAY_NAMES_ID.map((dayName, idx) => (
              <span
                key={dayName}
                className={`text-[10px] font-mono font-bold uppercase tracking-wider py-1 ${
                  idx >= 5 ? 'text-amber-500/80' : 'text-foreground/50'
                }`}
              >
                {dayName}
              </span>
            ))}
          </div>

          {/* Dates Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((item, idx) => {
              const isSelected = item.iso === value;
              const isToday = item.iso === todayIso;
              const isPast = minDate && item.iso < minDate;
              const isFutureBlocked = maxDate && item.iso > maxDate;
              const isDisabled = !item.isCurrentMonth || isPast || isFutureBlocked;

              const inRange =
                rangeStart &&
                rangeEnd &&
                item.iso > rangeStart &&
                item.iso < rangeEnd;

              return (
                <button
                  key={`${item.iso}-${idx}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelectDate(item.year, item.month, item.day)}
                  className={`h-8 w-full rounded-lg text-xs font-medium font-mono flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-teal text-background font-bold shadow-xs scale-105'
                      : inRange
                      ? 'bg-teal/15 text-teal font-semibold'
                      : isToday
                      ? 'border border-teal text-teal font-bold'
                      : item.isCurrentMonth
                      ? 'text-foreground hover:bg-muted cursor-pointer'
                      : 'text-foreground/20 cursor-not-allowed opacity-30'
                  } ${isDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  {item.day}
                </button>
              );
            })}
          </div>

          {/* Footer Controls: Hari Ini & Format Badge */}
          <div className="mt-3.5 pt-2.5 border-t border-border/80 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleSelectToday}
              className="text-[11px] font-semibold text-teal hover:underline cursor-pointer flex items-center gap-1"
            >
              📅 Hari Ini ({formatToIndonesianDate(todayIso)})
            </button>

            <span className="text-[10px] font-mono text-foreground/40 uppercase">
              Format: HH/BB/TTTT
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
