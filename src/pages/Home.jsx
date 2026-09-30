import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { HeroSection } from '../components/ui/HeroSection';
import { SpotlightCard } from '../components/ui/SpotlightCard';
import { EquipmentMarquee } from '../components/ui/EquipmentMarquee';
import Navbar from '../components/Navbar';
import { 
  Package, LineChart, ShieldCheck, LogIn, User, MessageCircle, 
  BookOpen, ArrowRight, Sparkles, CheckCircle2, Clock, Zap, 
  FileText, Bot, Radio, Video, Camera
} from 'lucide-react';
import { getSavedTheme, applyTheme } from '../utils/theme';

export default function Home() {
  const [theme, setTheme] = useState(getSavedTheme);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminWaNumber, setAdminWaNumber] = useState('');

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

  // Fetch admin WA number for contact card
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
  }, []);

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

  const contactWa = adminWaNumber || '6285967081183';

  return (
    <div className="relative min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground overflow-x-hidden">
      
      {/* Floating Modern Dock Navbar */}
      <Navbar theme={theme} setTheme={setTheme} />

      {/* Hero Section */}
      <HeroSection 
        title="DAKWAH TV EQUIPMENT"
        subtitle={{
          regular: "Manajemen Alat Produksi ",
          gradient: "Cepat & Terpadu."
        }}
        description="Sistem informasi peminjaman dan pemantauan alat produksi Dakwah TV UIN Sunan Ampel Surabaya. Jelajahi katalog lengkap, cek ketersediaan jadwal, dan terbitkan surat peminjaman (SPA) otomatis."
        ctaText="Mulai Booking Sekarang"
        ctaHref="/katalog"
        gridOptions={{
          angle: 65,
          cellSize: 50,
          opacity: 0.2,
          lightLineColor: "var(--border)",
          darkLineColor: "var(--border)"
        }}
      />

      {/* Running Equipment Marquee */}
      <EquipmentMarquee />

      {/* Value Badges / Highlights */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-card/40 border border-border backdrop-blur-md">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">SPA PDF Instan</div>
              <div className="text-[11px] text-foreground/60">Generate otomatis & R2 Cloud</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-card/40 border border-border backdrop-blur-md">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Live Availability</div>
              <div className="text-[11px] text-foreground/60">Sinkron real-time Supabase</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-card/40 border border-border backdrop-blur-md">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Bot Alert Otomatis</div>
              <div className="text-[11px] text-foreground/60">Broadcast WA & Telegram</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-card/40 border border-border backdrop-blur-md">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center flex-shrink-0">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Standar Broadcast</div>
              <div className="text-[11px] text-foreground/60">Alat terawat & siap produksi</div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Showcase Menu */}
      <section id="menu-cards" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-28">
        
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Eksplorasi Fitur
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-foreground">
              Pusat Kontrol & Operasional Alat
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-foreground/60 max-w-md">
            Pilih layanan yang Anda butuhkan untuk mendukung kelancaran produksi siaran dan konten Dakwah TV.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* Bento 1: Featured Large Card (Spans 2 cols on lg) */}
          <Link to="/katalog" className="lg:col-span-2 block">
            <SpotlightCard className="h-full flex flex-col justify-between p-6 sm:p-8 hover:border-primary/60">
              <div>
                <div className="flex items-center justify-between gap-2 mb-6">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" /> 40+ Peralatan Produksi
                  </span>
                  <span className="text-xs font-bold text-foreground/50 flex items-center gap-1 group-hover:text-primary transition-colors">
                    Buka Katalog <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold font-display mb-3 text-foreground group-hover:text-primary transition-colors">
                  Katalog Peralatan & Booking Instan
                </h3>
                <p className="text-foreground/70 text-sm sm:text-base leading-relaxed max-w-2xl mb-6">
                  Pilih kamera cinema Sony FX3, lensa G-Master, wireless mic Rode, lighting Aputure, hingga stabilizer gimbal. Masukkan ke keranjang dan terbitkan formulir peminjaman resmi secara instan.
                </p>

                {/* Equipment category pills */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted/60 border border-border text-foreground/80 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-primary" /> Kamera Sinema
                  </span>
                  <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted/60 border border-border text-foreground/80 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-sky-400" /> Audio & Mic
                  </span>
                  <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted/60 border border-border text-foreground/80 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Lighting Studio
                  </span>
                  <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted/60 border border-border text-foreground/80 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-purple-400" /> Rigging & Gimbal
                  </span>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-border/50 flex items-center justify-between text-xs text-foreground/50">
                <span>Dukungan PDF Surat Peminjaman Alat (SPA) Otomatis</span>
                <span className="font-mono text-primary font-bold">Mulai Booking →</span>
              </div>
            </SpotlightCard>
          </Link>

          {/* Bento 2: Ketersediaan Real-Time (1 col) */}
          <Link to="/pemantau" className="block">
            <SpotlightCard className="h-full flex flex-col justify-between hover:border-secondary/60">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-11 h-11 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
                    <LineChart className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Sync
                  </span>
                </div>

                <h3 className="text-xl font-bold font-display mb-2 text-foreground group-hover:text-secondary transition-colors">
                  Cek Ketersediaan Real-Time
                </h3>
                <p className="text-foreground/70 text-xs sm:text-sm leading-relaxed mb-4">
                  Pantau unit alat yang siap pakai, sedang dipinjam kru lain, atau sedang masa perbaikan. Dilengkapi timeline Gantt bulanan.
                </p>
              </div>

              <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs font-bold text-secondary">
                <span>Buka Timeline Jadwal</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </SpotlightCard>
          </Link>

          {/* Bento 3: SOP & Panduan Peminjaman (1 col) */}
          <Link to="/sop" className="block">
            <SpotlightCard className="h-full flex flex-col justify-between hover:border-orange-500/60">
              <div>
                <div className="w-11 h-11 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-5">
                  <BookOpen className="w-5 h-5" />
                </div>

                <h3 className="text-xl font-bold font-display mb-2 text-foreground group-hover:text-orange-500 transition-colors">
                  Panduan & SOP Teknis
                </h3>
                <p className="text-foreground/70 text-xs sm:text-sm leading-relaxed mb-4">
                  Standar Operasional Prosedur peminjaman, hak & kewajiban kru, tata tertib pengambilan alat, serta ketentuan pengembalian tepat waktu.
                </p>

                <div className="space-y-1.5 text-[11px] text-foreground/60 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-orange-500/10 text-orange-500 font-bold flex items-center justify-center text-[10px]">1</span>
                    <span>Pilih alat di katalog online</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-orange-500/10 text-orange-500 font-bold flex items-center justify-center text-[10px]">2</span>
                    <span>Surat SPA disetujui admin</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-orange-500/10 text-orange-500 font-bold flex items-center justify-center text-[10px]">3</span>
                    <span>Ambil peralatan di studio</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs font-bold text-orange-500">
                <span>Baca Selengkapnya</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </SpotlightCard>
          </Link>

          {/* Bento 4: Dashboard Peminjam / Akun (1 col) */}
          {currentUser ? (
            <Link to="/dashboard" className="block">
              <SpotlightCard className="h-full flex flex-col justify-between hover:border-primary/60 bg-primary/5 border-primary/20">
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-11 h-11 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary">
                      Akun Aktif
                    </span>
                  </div>

                  <h3 className="text-xl font-bold font-display mb-1 text-foreground">
                    Halo, {currentUser.user_metadata?.display_name || currentUser.displayName || currentUser.email?.split('@')[0]}
                  </h3>
                  <p className="text-xs text-foreground/60 font-mono mb-3">{currentUser.email}</p>
                  <p className="text-foreground/70 text-xs sm:text-sm leading-relaxed mb-4">
                    Lihat daftar riwayat peminjaman Anda, unduh ulang surat SPA PDF, dan perbarui profil peminjam.
                  </p>
                </div>

                <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs font-bold text-primary">
                  <span>Buka Dashboard Peminjam</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </SpotlightCard>
            </Link>
          ) : (
            <Link to="/dashboard?mode=login" className="block">
              <SpotlightCard className="h-full flex flex-col justify-between hover:border-primary/60">
                <div>
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                    <LogIn className="w-5 h-5" />
                  </div>

                  <h3 className="text-xl font-bold font-display mb-2 text-foreground group-hover:text-primary transition-colors">
                    Login / Akun Peminjam
                  </h3>
                  <p className="text-foreground/70 text-xs sm:text-sm leading-relaxed mb-4">
                    Masuk atau buat akun baru untuk menyimpan riwayat peminjaman, tracking status persetujuan, dan pengajuan lebih cepat.
                  </p>
                </div>

                <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs font-bold text-primary">
                  <span>Masuk Akun</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </SpotlightCard>
            </Link>
          )}

          {/* Bento 5: Tanya Teknisi via WhatsApp (1 col) */}
          <a 
            href={`https://wa.me/${contactWa}?text=${encodeURIComponent('Halo Mas Faki, Admin Teknis Dakwah TV. Saya ingin berkonsultasi terkait alat produksi...')}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="block"
          >
            <SpotlightCard 
              spotlightColor="rgba(37, 211, 102, 0.15)"
              borderColor="rgba(37, 211, 102, 0.4)"
              className="h-full flex flex-col justify-between hover:border-[#25D366]/60"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-11 h-11 rounded-xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20">
                    Kru Standby
                  </span>
                </div>

                <h3 className="text-xl font-bold font-display mb-2 text-foreground group-hover:text-[#25D366] transition-colors">
                  Tanya Admin Teknis
                </h3>
                <p className="text-foreground/70 text-xs sm:text-sm leading-relaxed mb-4">
                  Konsultasi kebutuhan alat untuk syuting, rekomendasi lensa, lighting, atau laporkan kendala teknis langsung ke teknisi.
                </p>
              </div>

              <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs font-bold text-[#25D366]">
                <span>Hubungi via WhatsApp</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </SpotlightCard>
          </a>

          {/* Bento 6: Dashboard Admin (1 col) */}
          <Link to="/admin" className="block">
            <SpotlightCard className="h-full flex flex-col justify-between hover:border-destructive/60">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-11 h-11 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/20">
                    Otoritas
                  </span>
                </div>

                <h3 className="text-xl font-bold font-display mb-2 text-foreground group-hover:text-destructive transition-colors">
                  Dashboard Admin
                </h3>
                <p className="text-foreground/70 text-xs sm:text-sm leading-relaxed mb-4">
                  Area khusus pengurus Dakwah TV untuk approval booking, pencatatan pengembalian, log servis alat, dan ekspor laporan.
                </p>
              </div>

              <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs font-bold text-destructive">
                <span>Masuk Panel Admin</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </SpotlightCard>
          </Link>

        </div>
        
        {/* Footer info */}
        <footer className="mt-20 pt-8 border-t border-border/40 text-center flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-foreground/50 font-mono">
          <div>
            &copy; 2026 Dakwah TV Equipment &bull; UIN Sunan Ampel Surabaya.
          </div>
          <div className="flex items-center gap-4">
            <Link to="/katalog" className="hover:text-primary transition-colors">Katalog</Link>
            <Link to="/pemantau" className="hover:text-primary transition-colors">Jadwal</Link>
            <Link to="/sop" className="hover:text-primary transition-colors">SOP</Link>
            <Link to="/admin" className="hover:text-primary transition-colors">Admin</Link>
          </div>
        </footer>
      </section>
    </div>
  );
}
