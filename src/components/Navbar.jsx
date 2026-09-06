import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { AlertCircle, History, ShoppingCart, Moon, Sun, ArrowLeft } from 'lucide-react';
import { applyTheme } from '../utils/theme';

export default function Navbar({ theme, setTheme, cartCount, openCart, openIssueModal, openHistoryModal }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [adminWaNumber, setAdminWaNumber] = useState('');
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
        setAdminWaNumber(val[0].replace(/[^0-9]/g, ''));
      } else if (val && typeof val === 'string') {
        setAdminWaNumber(val.replace(/[^0-9]/g, ''));
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

  const waLink = adminWaNumber 
    ? `https://wa.me/${adminWaNumber}?text=${encodeURIComponent('Halo Admin Dakwah TV, saya ingin melaporkan masalah terkait alat produksi...')}` 
    : '#';

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-background/70 backdrop-blur-xl border-b border-border z-50 flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-4">
        <Link to="/" className="text-foreground/80 hover:text-primary transition-colors flex items-center gap-2 font-semibold">
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Kembali</span>
        </Link>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={openIssueModal} 
            className="flex items-center gap-2 text-xs sm:text-sm font-bold px-3 py-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-all drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" 
            title="Laporkan Masalah"
          >
            <AlertCircle className="w-4 h-4" />
            <span className="hidden md:inline">Lapor Masalah</span>
          </button>

        {currentUser && (
          <button 
            onClick={openHistoryModal} 
            className="flex items-center gap-2 text-xs sm:text-sm font-medium px-3 py-2 rounded-lg text-foreground hover:bg-accent transition-all" 
            title="Riwayat Saya"
          >
            <History className="w-4 h-4" />
            <span className="hidden md:inline">Riwayat Saya</span>
          </button>
        )}

        {cartCount !== undefined && (
          <button 
            onClick={openCart} 
            className={`relative flex items-center gap-2 text-xs sm:text-sm font-medium px-4 py-2 rounded-lg transition-all ${
              cartCount > 0 
                ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:scale-105' 
                : 'text-foreground hover:bg-accent'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">Booking</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground ring-2 ring-background animate-in zoom-in">
                {cartCount}
              </span>
            )}
          </button>
        )}

        <button 
          onClick={toggleTheme} 
          className="p-2 ml-1 rounded-lg text-foreground/80 hover:text-foreground transition-colors"
          title="Ganti Tema"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </nav>
  );
}
