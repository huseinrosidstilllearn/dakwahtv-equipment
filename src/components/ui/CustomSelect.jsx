import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Pilih opsi...',
  name,
  disabled = false,
  className = '',
  menuClassName = '',
  icon: Icon = null,
  required = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicked outside or on Escape
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

  // Normalize options: array of { value, label, icon, badge, description } or strings
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: opt.value,
        label: opt.label || opt.value,
        icon: opt.icon,
        badge: opt.badge,
        description: opt.description
      };
    }
    return { value: opt, label: opt };
  });

  const selectedOption = normalizedOptions.find((opt) => String(opt.value) === String(value));

  const handleSelect = (optValue) => {
    if (onChange) {
      onChange(optValue);
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Hidden input for standard form submission compatibility */}
      {name && <input type="hidden" name={name} value={value ?? ''} required={required} />}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full bg-muted/40 hover:bg-muted/60 border ${
          isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-border'
        } rounded-xl px-3.5 py-2.5 text-xs transition-all font-medium flex items-center justify-between gap-2 text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-foreground/50 shrink-0" />}
          {selectedOption ? (
            <span className="text-foreground font-semibold truncate">{selectedOption.label}</span>
          ) : (
            <span className="text-foreground/40 truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-foreground/50 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-primary' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 top-full mt-1.5 z-50 bg-card/95 dark:bg-[#0c171d]/98 border border-border/80 shadow-2xl backdrop-blur-xl rounded-xl p-1.5 max-h-60 overflow-y-auto space-y-1 animate-in fade-in zoom-in-95 ${menuClassName}`}
        >
          {normalizedOptions.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            const OptIcon = opt.icon;
            return (
              <div
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-primary/15 text-primary font-bold shadow-xs'
                    : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {OptIcon && <OptIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-primary' : 'text-foreground/40'}`} />}
                  <div>
                    <span className="block truncate">{opt.label}</span>
                    {opt.description && (
                      <span className="block text-[10px] text-foreground/50 font-normal leading-tight">
                        {opt.description}
                      </span>
                    )}
                  </div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
