import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { HeroSection } from '../components/ui/HeroSection';
import { Package, LineChart, ShieldCheck, LogIn, User, MessageCircle, Moon, Sun, BookOpen } from 'lucide-react';
import { getSavedTheme, applyTheme } from '../utils/theme';

export default function Home() {
  const [theme, setTheme] = useState(getSavedTheme);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user || null;
      setCurrentUser(user && !user?.is_anonymous ? user : null);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;
      setCurrentUser(user && !user?.is_anonymous ? user : null);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Maintenance mode check
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
      if (user && !user?.is_anonymous) {
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

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      
      {/* Theme Toggle Button */}
      <button 
        onClick={toggleTheme}
        className="fixed top-6 right-6 z-50 p-3 rounded-full bg-card/80 border border-border shadow-sm backdrop-blur-md hover:scale-105 hover:bg-card transition-all"
        title="Ganti Tema"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5 text-primary" /> : <Moon className="w-5 h-5 text-primary" />}
      </button>

      <HeroSection 
        title="DAKWAH TV EQUIPMENT"
        subtitle={{
          regular: "Manajemen Alat Produksi ",
          gradient: "Cepat & Terpadu."
        }}
        description="Sistem informasi peminjaman dan pemantauan alat produksi Dakwah TV UINSA. Jelajahi katalog, periksa ketersediaan real-time, dan ajukan peminjaman dengan mudah."
        ctaText="Katalog & Booking"
        ctaHref="/katalog"
        gridOptions={{
          angle: 65,
          cellSize: 50,
          opacity: 0.2,
          lightLineColor: "var(--border)",
          darkLineColor: "var(--border)"
        }}
      />

      <section id="menu-cards" className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Main Cards */}
          <Link to="/katalog" className="group p-6 rounded-2xl bg-card/50 border border-border backdrop-blur-xl hover:bg-card hover:border-primary/50 transition-all shadow-sm hover:shadow-lg">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2 flex items-center justify-between">
              Katalog & Booking
              <span className="opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary">→</span>
            </h3>
            <p className="text-foreground/70 text-sm leading-relaxed">Lihat daftar alat yang tersedia, tambahkan ke keranjang, dan ajukan surat peminjaman secara instan.</p>
          </Link>

          <Link to="/pemantau" className="group p-6 rounded-2xl bg-card/50 border border-border backdrop-blur-xl hover:bg-card hover:border-primary/50 transition-all shadow-sm hover:shadow-lg">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <LineChart className="w-6 h-6 text-secondary" />
            </div>
            <h3 className="text-xl font-bold mb-2 flex items-center justify-between">
              Cek Ketersediaan
              <span className="opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-secondary">→</span>
            </h3>
            <p className="text-foreground/70 text-sm leading-relaxed">Pantau status seluruh alat secara real-time. Ketahui mana yang siap dipakai, sedang dipinjam, atau rusak.</p>
          </Link>

          {/* Admin Tools Card */}
          <Link to="/admin" className="group p-6 rounded-2xl bg-card/50 border border-border backdrop-blur-xl hover:bg-card hover:border-primary/50 transition-all shadow-sm hover:shadow-lg">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="text-xl font-bold mb-2 flex items-center justify-between">
              Dashboard Admin
              <span className="opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-destructive">→</span>
            </h3>
            <p className="text-foreground/70 text-sm leading-relaxed">Area khusus pengurus untuk mengelola inventaris, memberikan persetujuan, dan memantau pengembalian.</p>
          </Link>

          {currentUser ? (
            <Link to="/dashboard" className="group p-6 rounded-2xl bg-primary/5 border border-primary/20 backdrop-blur-xl hover:bg-primary/10 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-6">
                <User className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Halo, {currentUser.displayName || currentUser.email}</h3>
              <p className="text-foreground/70 text-sm leading-relaxed">Anda sudah login. Klik di sini untuk membuka Dashboard Peminjam dan melihat riwayat Anda.</p>
            </Link>
          ) : (
            <Link to="/dashboard?mode=login" className="group p-6 rounded-2xl bg-card/50 border border-border backdrop-blur-xl hover:bg-card hover:border-primary/50 transition-all shadow-sm hover:shadow-lg">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <LogIn className="w-6 h-6 text-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2 flex items-center justify-between">
                Login Peminjam
                <span className="opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary">→</span>
              </h3>
              <p className="text-foreground/70 text-sm leading-relaxed">Masuk atau daftar akun baru untuk menyimpan riwayat peminjaman dan mempercepat proses pengajuan.</p>
            </Link>
          )}

          <Link to="/sop" className="group p-6 rounded-2xl bg-card/50 border border-border backdrop-blur-xl hover:bg-card hover:border-orange-500/50 transition-all shadow-sm hover:shadow-lg">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <BookOpen className="w-6 h-6 text-orange-500" />
            </div>
            <h3 className="text-xl font-bold mb-2 flex items-center justify-between">
              Panduan & SOP
            </h3>
            <p className="text-foreground/70 text-sm leading-relaxed">Baca Syarat & Ketentuan serta Standar Operasional Prosedur (SOP) peminjaman alat produksi.</p>
          </Link>

          <a href="https://wa.me/6285967081183?text=Halo%20Mas%20Faki%2C%20Admin%20Teknis%20Dakwah%20TV.%20Saya%20ingin%20berkonsultasi%20terkait%20alat%20produksi..." target="_blank" rel="noopener noreferrer" className="group p-6 rounded-2xl bg-card/50 border border-border backdrop-blur-xl hover:bg-[#25D366]/5 hover:border-[#25D366]/50 transition-all shadow-sm hover:shadow-[0_0_30px_rgba(37,211,102,0.3)]">
            <div className="w-12 h-12 rounded-full bg-[#25D366]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-6 h-6 text-[#25D366]" />
            </div>
            <h3 className="text-xl font-bold mb-2 flex items-center justify-between text-[#25D366]">
              Tanya Admin Teknis
              <span className="opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all">→</span>
            </h3>
            <p className="text-foreground/70 text-sm leading-relaxed">Hubungi Kru & Teknisi Dakwah TV via WhatsApp untuk konsultasi alat atau laporan kendala teknis.</p>
          </a>

        </div>
        
        <footer className="mt-20 text-center text-sm text-foreground/40 font-mono">
          &copy; 2026 Dakwah TV Teknis.
        </footer>
      </section>
    </div>
  );
}
