import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * Premium Custom Dropdown Select
 * Fully styled custom select menu that replaces default OS browser dropdowns.
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Pilih opsi...',
  name,
  icon: DefaultIcon,
  className = '',
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
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

  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const ItemIcon = selectedOption?.icon || DefaultIcon;

  const handleSelect = (val) => {
    if (onChange) onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Hidden input for HTML form compatibility */}
      {name && <input type="hidden" name={name} value={value ?? ''} />}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 bg-background border rounded-xl text-left transition-all cursor-pointer select-none text-xs ${
          isOpen
            ? 'border-teal ring-2 ring-teal/20 shadow-xs'
            : 'border-border hover:border-foreground/30'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {ItemIcon && (
            <ItemIcon className="w-4 h-4 text-teal shrink-0" />
          )}
          <span className={`truncate font-medium ${selectedOption ? 'text-foreground font-semibold' : 'text-foreground/40'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-foreground/50 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-teal' : ''
          }`}
        />
      </button>

      {/* Floating Options Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 bg-card/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-1.5 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-150 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-foreground/15 [&::-webkit-scrollbar-thumb]:rounded-full">
          {options.length === 0 ? (
            <div className="p-3 text-center text-xs text-foreground/50">Tidak ada pilihan</div>
          ) : (
            <div className="space-y-1">
              {options.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                const OptIcon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-teal/15 text-teal font-semibold'
                        : 'text-foreground hover:bg-muted/70 hover:text-foreground'
                    }`}
                  >
                    {OptIcon && (
                      <OptIcon className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-teal' : 'text-foreground/60'}`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold leading-tight flex items-center justify-between gap-2">
                        <span className="truncate">{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-teal shrink-0" />}
                      </div>
                      {(opt.desc || opt.description) && (
                        <p className="text-[11px] text-foreground/50 mt-0.5 font-normal leading-snug line-clamp-2">
                          {opt.desc || opt.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
