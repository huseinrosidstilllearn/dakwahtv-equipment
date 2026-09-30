import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { 
  AlertCircle, History, ShoppingCart, Moon, Sun, Menu, X, 
  Home, Package, CalendarCheck, BookOpen, ShieldCheck, User 
} from 'lucide-react';
import { applyTheme } from '../utils/theme';

export default function Navbar({ 
  theme, 
  setTheme, 
  cartCount, 
  openCart, 
  openIssueModal, 
  openHistoryModal 
}) {
  const [currentUser, setCurrentUser] = useState(null);
  const [adminWaNumber, setAdminWaNumber] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user || null);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch admin WA number from Supabase
  useEffect(() => {
    const fetchWa = async () => {
      const { data } = await supabase.from('config').select('value').eq('key', 'adminWaNumbers').maybeSingle();
      const val = data?.value;
      if (val && Array.isArray(val) && val.length > 0) {
        const personal = val.find(v => !String(v).includes('@g.us')) || val[0];
        setAdminWaNumber(String(personal).replace(/[^0-9]/g, ''));
      } else if (val && typeof val === 'string') {
        if (!val.includes('@g.us')) {
          setAdminWaNumber(val.replace(/[^0-9]/g, ''));
        }
      }
    };
    fetchWa();
    
    const channel = supabase.channel('navbar_config')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config', filter: 'key=eq.adminWaNumbers' }, fetchWa)
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  }, []);

  const toggleTheme = () => {
    const newT = theme === 'light' ? 'dark' : 'light';
    setTheme(newT);
    applyTheme(newT);
  };

  const navLinks = [
    { label: 'Beranda', href: '/', icon: Home },
    { label: 'Katalog', href: '/katalog', icon: Package },
    { label: 'Ketersediaan', href: '/pemantau', icon: CalendarCheck },
    { label: 'SOP', href: '/sop', icon: BookOpen },
    { label: 'Admin', href: '/admin', icon: ShieldCheck },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="fixed top-2.5 sm:top-4 left-2.5 right-2.5 sm:left-1/2 sm:-translate-x-1/2 sm:w-[94%] max-w-6xl z-50">
      <nav className="rounded-2xl bg-card/85 dark:bg-[#0c171d]/90 backdrop-blur-xl border border-border/80 shadow-2xl shadow-primary/5 px-3 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between transition-all">
        
        {/* Brand identity: Clean logo without redundant wrapping text */}
        <Link to="/" className="flex items-center group shrink-0" title="Beranda Dakwah TV">
          <div className="relative flex items-center">
            <div className="absolute inset-0 bg-primary/20 blur-md rounded-full group-hover:scale-125 transition-transform" />
            <img 
              src="/logo-hero.png" 
              alt="Dakwah TV" 
              className="relative z-10 h-6.5 sm:h-7.5 md:h-8 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden lg:flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                to={link.href}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  active
                    ? 'text-primary bg-background shadow-sm border border-primary/20'
                    : 'text-foreground/70 hover:text-foreground hover:bg-background/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-primary' : 'text-foreground/50'}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right Action Icons & Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          
          {/* Issue report button */}
          {openIssueModal ? (
            <button 
              onClick={openIssueModal} 
              className="h-8 sm:h-9 px-2 sm:px-2.5 flex items-center gap-1.5 text-xs font-bold rounded-xl text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all drop-shadow-[0_0_8px_rgba(239,68,68,0.35)] cursor-pointer" 
              title="Laporkan Kendala Alat"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">Lapor Alat</span>
            </button>
          ) : adminWaNumber ? (
            <a 
              href={`https://wa.me/${adminWaNumber}?text=${encodeURIComponent('Halo Admin Dakwah TV, saya ingin berkonsultasi/melaporkan alat produksi...')}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="hidden sm:flex h-9 px-2.5 items-center gap-1.5 text-xs font-bold rounded-xl text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all"
              title="Hubungi Admin Teknis"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Tanya Kru</span>
            </a>
          ) : null}

          {/* User History or Dashboard link */}
          {openHistoryModal ? (
            <button 
              onClick={openHistoryModal} 
              className="h-8 w-8 sm:h-9 sm:w-auto sm:px-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-xl text-foreground/80 hover:text-foreground hover:bg-muted/70 transition-all cursor-pointer" 
              title="Riwayat Booking Saya"
            >
              <History className="w-4 h-4 text-foreground/60" />
              <span className="hidden md:inline">Riwayat</span>
            </button>
          ) : currentUser ? (
            <Link 
              to="/dashboard"
              className="h-8 w-8 sm:h-9 sm:w-auto sm:px-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-xl text-foreground/80 hover:text-foreground hover:bg-muted/70 transition-all" 
              title="Dashboard Akun"
            >
              <User className="w-4 h-4 text-foreground/60" />
              <span className="hidden md:inline">Akun</span>
            </Link>
          ) : null}

          {/* Booking Cart Button */}
          {cartCount !== undefined && (
            <button 
              onClick={openCart} 
              className={`relative h-8 sm:h-9 px-2.5 sm:px-3.5 flex items-center gap-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                cartCount > 0 
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 hover:scale-105 active:scale-95' 
                  : 'text-foreground/80 hover:text-foreground hover:bg-muted/70'
              }`}
              title="Keranjang Booking"
            >
              <ShoppingCart className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Booking</span>
              {cartCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-black text-destructive-foreground ring-2 ring-card animate-in zoom-in">
                  {cartCount}
                </span>
              )}
            </button>
          )}

          {/* Theme Toggle Button */}
          <button 
            onClick={toggleTheme} 
            className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-xl text-foreground/70 hover:text-foreground hover:bg-muted/70 transition-all cursor-pointer"
            title="Ganti Tema"
            aria-label="Ganti Tema"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-xl text-foreground/70 hover:text-foreground hover:bg-muted/70 transition-all cursor-pointer"
            aria-label="Buka Menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

        </div>
      </nav>

      {/* Mobile Menu Dropdown Card */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-2 p-3 rounded-2xl bg-card/95 dark:bg-[#0c171d]/95 backdrop-blur-2xl border border-border/80 shadow-2xl animate-in fade-in slide-in-from-top-3">
          <div className="grid grid-cols-2 gap-1.5 mb-2.5">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold transition-all ${
                    active 
                      ? 'bg-primary text-primary-foreground font-bold shadow-sm' 
                      : 'text-foreground/80 hover:bg-muted'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Quick Mobile Action Shortcuts */}
          <div className="grid grid-cols-2 gap-1.5 mb-2.5 pt-2 border-t border-border/40">
            {openIssueModal && (
              <button
                onClick={() => { setMobileMenuOpen(false); openIssueModal(); }}
                className="flex items-center gap-2 p-2 rounded-xl text-[11px] font-semibold text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all text-left"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Lapor Alat</span>
              </button>
            )}
            {openHistoryModal && (
              <button
                onClick={() => { setMobileMenuOpen(false); openHistoryModal(); }}
                className="flex items-center gap-2 p-2 rounded-xl text-[11px] font-semibold text-foreground/80 bg-muted/40 hover:bg-muted border border-border/40 transition-all text-left"
              >
                <History className="w-3.5 h-3.5 shrink-0 text-foreground/60" />
                <span>Riwayat Saya</span>
              </button>
            )}
            {adminWaNumber && (
              <a
                href={`https://wa.me/${adminWaNumber}?text=${encodeURIComponent('Halo Admin Teknis Dakwah TV, saya ingin berkonsultasi seputar alat produksi...')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 p-2 rounded-xl text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>WhatsApp Admin</span>
              </a>
            )}
          </div>

          <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-foreground/60 px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sistem Online
            </span>
            <Link 
              to="/dashboard" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-primary font-bold hover:underline"
            >
              {currentUser ? 'Dashboard Peminjam →' : 'Masuk Akun →'}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
