import { normalizeBooking, fmtDate } from '../utils/normalize';
import { useNavigate, Link } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useToast } from '../context/ToastContext';
import AuthModal from '../components/AuthModal';
import { ArrowLeft, Moon, Sun, History, UserCircle, Shield, Bell, CheckCircle2, AlertTriangle, AlertCircle, Calendar, CalendarDays, KeyRound, ArrowRightLeft, LogOut, Menu, X, Mail, BookOpen } from 'lucide-react';
import { ShinyButton } from '../components/ui/shiny-button';
import { getSavedTheme, applyTheme } from '../utils/theme';

const STATUS_MAP = {
  pending: { label: 'Menunggu Approval', class: 'bg-amber-500/15 text-amber-800 dark:text-yellow-400 border-amber-500/30' },
  approved: { label: 'Disetujui', class: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/40' },
  letter_ready: { label: 'Surat Siap', class: 'bg-primary/15 text-primary border-primary/40' },
  picked_up: { label: 'Diambil', class: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40' },
  active: { label: 'Sedang Dipinjam', class: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/40' },
  rejected: { label: 'Ditolak', class: 'bg-destructive/15 text-destructive border-destructive/40' },
  cancelled: { label: 'Dibatalkan', class: 'bg-muted text-foreground/50 border-border' },
  returned: { label: 'Dikembalikan', class: 'bg-muted text-foreground/60 border-border' },
  returned_late: { label: 'Terlambat', class: 'bg-destructive/15 text-destructive border-destructive/40' },
  expired: { label: 'Kedaluwarsa', class: 'bg-muted text-foreground/50 border-border' }
};

const DONE_STATUSES = ['returned', 'returned_late', 'rejected', 'cancelled', 'expired'];
const ACTIVE_STATUSES = ['picked_up', 'active'];
const PENDING_STATUSES = ['pending', 'approved', 'letter_ready'];

export default function Dashboard() {
  const { toast: appToast, confirm } = useToast();
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserStatus, setCurrentUserStatus] = useState('active');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [bookings, setBookings] = useState([]);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(getSavedTheme);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const loginParam = params.get('login');
    if (modeParam === 'login' || loginParam === 'true') {
      setAuthMode('login');
      setIsAuthOpen(true);
    } else if (modeParam === 'register') {
      setAuthMode('register');
      setIsAuthOpen(true);
    }
  }, []);

  const [activeTab, setActiveTab] = useState('history');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Profile forms
  const [profileName, setProfileName] = useState('');
  const [profileNim, setProfileNim] = useState('');
  const [profileDept, setProfileDept] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileOrg, setProfileOrg] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Security forms
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);
  const [resettingPass, setResettingPass] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const showToast = (msg, error = false) => {
    if (error) appToast.error(msg);
    else appToast.success(msg);
  };

  // Safety timeout: guarantee loading state terminates
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  // Maintenance mode check...
  useEffect(() => {
    let isMaint = false;
    let isAdmin = false;

    const enforce = () => {
      if (isMaint && !isAdmin) {
        window.location.href = '/maintenance.html';
      }
    };

    const fetchMaint = async () => {
      try {
        const { data } = await supabase.from('config').select('value').eq('key', 'maintenanceMode').maybeSingle();
        isMaint = data?.value === true;
        enforce();
      } catch (e) {
        console.warn("fetchMaint error:", e);
      }
    };
    fetchMaint();

    const channelMaint = supabase.channel('public:config_maint_dash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config', filter: 'key=eq.maintenanceMode' }, fetchMaint)
      .subscribe();

    return () => { 
      supabase.removeChannel(channelMaint); 
    };
  }, []);

  useEffect(() => {
    let channelStatus;

    const handleAuth = async (user) => {
      try {
        if (user && user.role !== 'anonymous') {
          const dName = user.user_metadata?.name || user.user_metadata?.display_name || user.email?.split('@')[0] || '';
          setCurrentUser({ ...user, displayName: dName });
          setProfileName(dName);
          
          const { data: userProfile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
          if (userProfile) {
            setUserData(userProfile);
            setProfilePhone(userProfile.phone || '');
            setProfileOrg(userProfile.dept || userProfile.origin || '');
            setProfileNim(userProfile.nim || '');
            setProfileDept(userProfile.dept || '');
            if (userProfile.display_name) {
              setProfileName(userProfile.display_name);
            }
          }

          setCurrentUserStatus(userProfile?.status || 'active');
          await fetchMyBookings(user);
        } else {
          setCurrentUser(null);
          setCurrentUserStatus('active');
          setLoading(false);
        }
      } catch (err) {
        console.error("handleAuth error in Dashboard:", err);
        setLoading(false);
      }
    };

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        handleAuth(session?.user);
      } catch (e) {
        console.error("initAuth error:", e);
        setLoading(false);
      }
    };
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      handleAuth(session?.user);
    });

    return () => {
      subscription?.unsubscribe();
      if (channelStatus) supabase.removeChannel(channelStatus);
    };
  }, []);

  const fetchMyBookings = async (user) => {
    try {
      const uEmail = user.email ? user.email.trim().toLowerCase() : '';
      const uName = (user.displayName || user.user_metadata?.name || '').trim().toLowerCase();

      // With Supabase, we can just fetch all bookings for this user using OR conditions
      let query = supabase.from('bookings').select('*, booking_items(inventory(*))');
      
      const { data, error } = await query;
      
      if (error) {
        console.warn("fetchMyBookings query error:", error);
      }
      
      // Apply normalizeBooking so camelCase fields work correctly
      const allBookings = (data || []).map(normalizeBooking).filter(Boolean);
      
      const userBookings = allBookings.filter(b => {
        if (b.uid === user.id) return true;
        
        const bEmail1 = b.userEmail ? b.userEmail.trim().toLowerCase() : '';
        
        if (uEmail && uEmail === bEmail1) return true;
        
        const bName = b.userName ? b.userName.trim().toLowerCase() : '';
        
        if (uName && bName && bName.length >= 3) {
          if (uName.includes(bName) || bName.includes(uName)) return true;
        }
        
        return false;
      });

      // Sort by created_at desc
      userBookings.sort((a, b) => {
        const tA = new Date(a.created_at || a.createdAt || 0).getTime();
        const tB = new Date(b.created_at || b.createdAt || 0).getTime();
        return tB - tA;
      });
      
      setBookings(userBookings);
    } catch (err) {
      console.error("Error fetching bookings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    supabase.auth.signOut().then(() => navigate('/'));
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    const email = e.target.email?.value;
    const password = e.target.password?.value;
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const name = e.target.name?.value;
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { data: { name } }
        });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            display_name: name || email?.split('@')[0], 
            email, 
            phone: '', 
            dept: '',
            role: 'user'
          }, { onConflict: 'id' });
        }
      }
      setIsAuthOpen(false);
    } catch (err) {
      setAuthError("Email/Password Salah");
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await supabase.auth.updateUser({ data: { name: profileName } });
      await supabase.from('profiles').upsert({
        id: currentUser.id,
        display_name: profileName,
        email: currentUser.email,
        phone: profilePhone,
        dept: profileOrg
      }, { onConflict: 'id' });
      showToast('Profil berhasil diperbarui');
    } catch(err) {
      showToast(err.message, true);
    } finally {
      setSavingProfile(false);
    }
  };

  const changeEmail = async (e) => {
    e.preventDefault();
    setChangingEmail(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: currentUser.email, password: emailPassword });
      if (signInError) throw new Error("Password salah");

      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;

      await supabase.from('profiles').update({ email: newEmail }).eq('id', currentUser.id);
      showToast('Email berhasil diubah. Silakan cek email baru Anda untuk konfirmasi.');
      setNewEmail('');
      setEmailPassword('');
    } catch(err) {
      showToast(err.message, true);
    } finally {
      setChangingEmail(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setChangingPass(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: currentUser.email, password: oldPassword });
      if (signInError) throw new Error("Password salah");

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      showToast('Password berhasil diubah');
      setOldPassword('');
      setNewPassword('');
    } catch(err) {
      showToast(err.message, true);
    } finally {
      setChangingPass(false);
    }
  };

  const resetPassword = async () => {
    setResettingPass(true);
    try {
      await supabase.auth.resetPasswordForEmail(currentUser.email);
      showToast('Link reset password telah dikirim ke email Anda');
    } catch(err) {
      showToast(err.message, true);
    } finally {
      setResettingPass(false);
    }
  };

  const cancelBooking = async (bId) => {
    const isConfirmed = await confirm({
      title: "Batalkan Pengajuan",
      message: "Yakin ingin membatalkan pengajuan peminjaman ini?",
      confirmText: "Ya, Batalkan",
      cancelText: "Kembali",
      type: "danger"
    });
    if (!isConfirmed) return;
    try {
      const { error } = await supabase.from('bookings').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', bId);
      if (error) throw error;
      setSelectedBooking(null);
      showToast('Pengajuan peminjaman berhasil dibatalkan');
      
      // Update local state proactively
      setBookings(prev => prev.map(b => b.id === bId ? { ...b, status: 'cancelled', cancelledAt: Date.now() } : b));
    } catch(err) {
      showToast(err.message, true);
    }
  };

  const fmtD = (ms) => {
    if(!ms) return '-';
    if (typeof ms === 'string' && isNaN(ms)) return new Date(ms).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
    return new Date(Number(ms)).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const renderNotifications = () => {
    const NOTIF_RULES = {
      approved:      { icon: <CheckCircle2 className="w-5 h-5" />, cls: 'bg-green-500/10 text-green-500',      text: b => `Booking ${b.itemsLabel} disetujui admin.` },
      letter_ready:  { icon: <CalendarDays className="w-5 h-5" />, cls: 'bg-primary/10 text-primary',      text: b => `Surat peminjaman ${b.itemsLabel} sudah siap diambil.` },
      rejected:      { icon: <AlertCircle className="w-5 h-5" />,    cls: 'bg-destructive/10 text-destructive',  text: b => `Booking ${b.itemsLabel} ditolak. ${b.rejectedReason ? 'Alasan: ' + b.rejectedReason : ''}` },
      returned_late: { icon: <AlertTriangle className="w-5 h-5" />,    cls: 'bg-destructive/10 text-destructive',  text: b => `Pengembalian ${b.itemsLabel} terlambat${b.fineAmount ? ', denda Rp ' + b.fineAmount.toLocaleString('id-ID') : ''}.` },
      returned:      { icon: <CheckCircle2 className="w-5 h-5" />,   cls: 'bg-foreground/10 text-foreground',      text: b => `Alat ${b.itemsLabel} sudah tercatat dikembalikan.` },
      cancelled:     { icon: <AlertCircle className="w-5 h-5" />,    cls: 'bg-yellow-500/10 text-yellow-500', text: b => `Kamu membatalkan pengajuan ${b.itemsLabel}.` }
    };
    
    const items = bookings
      .filter(b => NOTIF_RULES[b.status])
      .map(b => {
        const rule = NOTIF_RULES[b.status];
        const itemsArr = b.items ? (Array.isArray(b.items) ? b.items : Object.values(b.items)) : [];
        const itemsLabel = itemsArr.map(i => i.name).join(', ') || 'alat';
        const ts = b.rejectedAt || b.approvedAt || b.returnedAt || b.cancelledAt || b.createdAt || b.timestamp || 0;
        return { rule, itemsLabel, ts, fineAmount: b.fineAmount, rejectedReason: b.rejectedReason };
      })
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 15);

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-foreground/40">
          <Bell className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-sm">Belum ada notifikasi baru.</p>
        </div>
      );
    }

    return items.map((n, i) => (
      <div key={i} className="flex items-start gap-4 p-4 border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${n.rule.cls}`}>
          {n.rule.icon}
        </div>
        <div>
          <p className="text-sm font-medium">{n.rule.text(n)}</p>
          <p className="text-xs font-mono text-foreground/50 mt-1">{fmtD(n.ts)}</p>
        </div>
      </div>
    ));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <span className="font-mono text-sm text-foreground/50">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background text-foreground pt-20 pb-20 selection:bg-primary selection:text-primary-foreground">
        <header className="max-w-7xl mx-auto px-4 md:px-8 pt-8 pb-12 flex flex-col items-center text-center">
          <img src="/logo.png" className="w-full max-w-[220px] mb-8 drop-shadow-md" alt="Logo" />
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-xs font-mono font-semibold">
            <div className="w-2 h-2 rounded-full dot-glow-primary"></div>
            <span>Area Peminjam</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 uppercase">
            DASHBOARD <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary to-blue-500">PEMINJAM</span>
          </h1>
        </header>
        <div className="text-center max-w-md mx-auto p-6 bg-card border border-border rounded-2xl shadow-lg">
          <p className="text-foreground/70 mb-6">Anda harus login untuk melihat dashboard peminjam alat.</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => setIsAuthOpen(true)} className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all">
              Buka Panel Login
            </button>
            <Link to="/" className="w-full py-3 bg-background text-foreground border border-border font-bold rounded-xl hover:bg-accent transition-all">
              Kembali ke Home
            </Link>
          </div>
        </div>
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} mode={authMode} setMode={setAuthMode} onSubmit={handleAuthSubmit} errorMsg={authError} />
      </div>
    );
  }

  const statPending = bookings.filter(b => PENDING_STATUSES.includes(b.status)).length;
  const statActive = bookings.filter(b => ACTIVE_STATUSES.includes(b.status)).length;
  const statDone = bookings.filter(b => DONE_STATUSES.includes(b.status)).length;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground flex flex-col">
      {currentUserStatus === 'suspended' && (
        <div className="bg-destructive text-destructive-foreground px-4 py-3 text-sm text-center font-bold sticky top-0 z-[100] shadow-md flex items-center justify-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Akun Anda sedang ditangguhkan (Suspended). Anda tidak dapat melakukan peminjaman. Silakan hubungi Admin.
        </div>
      )}
      {/* Mobile/Tablet Rounded Navbar */}
      <div className="md:hidden sticky top-4 z-40 px-4 mb-4">
        <ShinyButton className="w-full !p-3">
          {/* Left: Hamburger */}
          <button onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(true); }} className="p-2 text-white/70 hover:text-white relative z-10 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 cursor-pointer z-10 hover:scale-105 transition-transform" onClick={() => window.location.href='/'}>
             <img src="/logo.png" className="h-6 object-contain drop-shadow-md brightness-0 invert" alt="Logo" />
          </div>
          <div className="flex items-center gap-1 relative z-10">
            <button onClick={toggleTheme} className="p-2 text-white/70 hover:text-white transition-colors">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} className="p-2 text-red-400 hover:text-red-300 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </ShinyButton>
      </div>

      {/* Desktop Header */}
      <header className="hidden md:flex sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border py-4 px-6 md:px-8 justify-between items-center">
        <div className="flex items-center gap-4">
          <img src="/logo.png" className="h-8 md:h-10 object-contain drop-shadow-md" alt="Logo" />
          <h1 className="font-black text-xl tracking-tight uppercase text-primary">Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-foreground/50">Halo, {currentUser.displayName || currentUser.email}</span>
          <Link to="/sop" className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-lg text-sm font-bold transition-all">
            <BookOpen className="w-4 h-4" /> SOP
          </Link>
          <Link to="/katalog" className="flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary hover:bg-secondary hover:text-secondary-foreground rounded-lg text-sm font-bold transition-all">
            <Calendar className="w-4 h-4" /> Katalog
          </Link>
          <button onClick={toggleTheme} className="p-2 text-foreground/70 hover:text-foreground hover:bg-accent rounded-lg transition-colors">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={handleLogout} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-col md:flex-row flex-1 p-4 md:p-8 gap-8 relative max-w-7xl mx-auto w-full">
        
        {/* Nav Tabs - Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-background border-r border-border p-5 transform transition-transform duration-300 ease-in-out overflow-y-auto shadow-2xl
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0 md:w-64 md:bg-transparent md:border-none md:p-0 md:shadow-none md:overflow-visible md:block md:z-0
        `}>
          {/* Mobile Sidebar Header */}
          <div className="flex justify-between items-center md:hidden mb-6">
            <h2 className="font-heading font-black text-xl uppercase tracking-wider">Menu Peminjam</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 bg-muted rounded-full text-foreground/70 hover:text-foreground">
              <X className="w-5 h-5"/>
            </button>
          </div>

          <div className="flex flex-col gap-1.5 md:bg-card md:border md:border-border md:p-3 md:rounded-2xl md:shadow-sm">
            <button onClick={() => { setActiveTab('history'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all whitespace-nowrap md:whitespace-normal ${activeTab === 'history' ? 'bg-primary/10 text-primary border-l-4 border-primary md:border-l-0' : 'text-foreground/70 hover:bg-accent'}`}>
              <History className="w-5 h-5" /> Riwayat Peminjaman
            </button>
            <button onClick={() => { setActiveTab('account'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all whitespace-nowrap md:whitespace-normal ${activeTab === 'account' ? 'bg-primary/10 text-primary border-l-4 border-primary md:border-l-0' : 'text-foreground/70 hover:bg-accent'}`}>
              <UserCircle className="w-5 h-5" /> Pengaturan Akun
            </button>
            <button onClick={() => { setActiveTab('security'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all whitespace-nowrap md:whitespace-normal ${activeTab === 'security' ? 'bg-primary/10 text-primary border-l-4 border-primary md:border-l-0' : 'text-foreground/70 hover:bg-accent'}`}>
              <Shield className="w-5 h-5" /> Keamanan
            </button>
            <button onClick={() => { setActiveTab('notifications'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all whitespace-nowrap md:whitespace-normal ${activeTab === 'notifications' ? 'bg-primary/10 text-primary border-l-4 border-primary md:border-l-0' : 'text-foreground/70 hover:bg-accent'}`}>
              <Bell className="w-5 h-5" /> Notifikasi
            </button>
            
            <div className="my-2 border-t border-border md:hidden"></div>
            <Link to="/katalog" className="md:hidden flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all text-secondary hover:bg-secondary/10">
              <Calendar className="w-5 h-5" /> Katalog Alat
            </Link>
            <Link to="/sop" className="md:hidden flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all text-primary hover:bg-primary/10">
              <BookOpen className="w-5 h-5" /> Panduan SOP
            </Link>
          </div>
        </div>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>
        )}

        {/* Content Area */}
        <div className="flex-1 min-w-0 pb-20">
          {activeTab === 'history' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-3xl font-black tracking-tight mb-2">Riwayat Peminjaman</h2>
              
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
                  <div className="text-3xl font-black text-primary">{bookings.length}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/50 mt-1">Total Pengajuan</div>
                </div>
                <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
                  <div className="text-3xl font-black text-yellow-500">{statPending}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/50 mt-1">Diproses</div>
                </div>
                <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
                  <div className="text-3xl font-black text-green-500">{statActive}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/50 mt-1">Sedang Dipinjam</div>
                </div>
                <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
                  <div className="text-3xl font-black text-foreground">{statDone}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-foreground/50 mt-1">Selesai</div>
                </div>
              </div>

              {/* Table */}
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="p-4 text-xs font-mono text-foreground/50 uppercase tracking-wider">Tanggal</th>
                        <th className="p-4 text-xs font-mono text-foreground/50 uppercase tracking-wider">Alat</th>
                        <th className="p-4 text-xs font-mono text-foreground/50 uppercase tracking-wider">Status</th>
                        <th className="p-4 text-xs font-mono text-foreground/50 uppercase tracking-wider">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {bookings.length === 0 ? (
                          <tr><td colSpan="4" className="text-center p-8 text-foreground/50 font-mono text-sm">Belum ada riwayat peminjaman.</td></tr>
                        ) : (
                          bookings.map(b => {
                            const sMap = STATUS_MAP[b.status?.toLowerCase()] || { label: b.status || 'Tidak Lengkap', class: 'bg-muted text-foreground/50 border-dashed' };
                            const itemsArr = b.items ? (Array.isArray(b.items) ? b.items : Object.values(b.items)) : [];
                            const itemsList = itemsArr.length > 0 ? itemsArr.map(i => i.name).join(', ') : (b.itemReported || b.alat || b.purpose || b.origin || '-');
                            const shortItems = itemsList.length > 35 ? itemsList.substring(0,35) + '...' : itemsList;
                            return (
                              <tr key={b.id || Math.random()} className="hover:bg-accent/30 transition-colors">
                                <td className="p-4 text-sm font-medium">{fmtD(b.createdAt || b.timestamp || b.dateStart || b.startDate)}</td>
                                <td className="p-4 text-sm text-foreground/80">{shortItems || '-'}</td>
                                <td className="p-4">
                                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${sMap.class}`}>
                                    {sMap.label}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <button onClick={() => setSelectedBooking(b)} className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-bold hover:bg-primary/10 hover:text-primary transition-colors">
                                    Detail
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-3xl font-black tracking-tight mb-2">Pengaturan Akun</h2>
              <div className="bg-card border border-border rounded-2xl shadow-sm p-6 max-w-2xl">
                <form onSubmit={saveProfile} className="space-y-5">
                  <div>
                    <label className="block text-xs font-mono text-foreground/50 uppercase tracking-wider mb-2">Nama Lengkap</label>
                    <input type="text" className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-shadow" value={profileName} onChange={e => setProfileName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-foreground/50 uppercase tracking-wider mb-2">Email (Read-only)</label>
                    <input type="email" className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm opacity-60 cursor-not-allowed" value={currentUser.email || ''} disabled />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-foreground/50 uppercase tracking-wider mb-2">No. WhatsApp</label>
                    <input type="text" className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-shadow" value={profilePhone} onChange={e => setProfilePhone(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-foreground/50 uppercase tracking-wider mb-2">Instansi / Organisasi</label>
                    <input type="text" className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-shadow" value={profileOrg} onChange={e => setProfileOrg(e.target.value)} />
                  </div>
                  <div className="pt-2">
                    <button type="submit" disabled={savingProfile} className="w-full sm:w-auto px-8 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
                      {savingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

            {activeTab === 'security' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h2 className="text-3xl font-black tracking-tight mb-2">Keamanan</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 md:grid-cols-2 gap-6">
                  
                  {/* Ubah Email */}
                  <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><Mail className="w-5 h-5 text-blue-500" /> Ubah Email</h3>
                    <form onSubmit={changeEmail} className="space-y-4">
                      <div>
                        <label className="block text-xs font-mono text-foreground/50 uppercase tracking-wider mb-2">Email Baru</label>
                        <input type="email" className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-foreground/50 uppercase tracking-wider mb-2">Konfirmasi Password Saat Ini</label>
                        <input type="password" className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm" value={emailPassword} onChange={e => setEmailPassword(e.target.value)} required minLength="6" />
                      </div>
                      <button type="submit" disabled={changingEmail} className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 mt-2">
                        {changingEmail ? 'Memproses...' : 'Ubah Email'}
                      </button>
                    </form>
                  </div>

                  <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
                  <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" /> Ubah Password</h3>
                  <form onSubmit={changePassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-mono text-foreground/50 uppercase tracking-wider mb-2">Password Lama</label>
                      <input type="password" className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-foreground/50 uppercase tracking-wider mb-2">Password Baru</label>
                      <input type="password" className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength="6" />
                    </div>
                    <button type="submit" disabled={changingPass} className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 mt-2">
                      {changingPass ? 'Memproses...' : 'Ubah Password'}
                    </button>
                  </form>
                </div>
                
                <div className="bg-card border border-border rounded-2xl shadow-sm p-6 h-fit">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-secondary" /> Reset Password</h3>
                  <p className="text-sm text-foreground/70 mb-6 leading-relaxed">Kirim link reset password ke email Anda jika Anda lupa password. Proses ini akan mengirimkan tautan aman ke kotak masuk Anda.</p>
                  <button onClick={resetPassword} disabled={resettingPass} className="w-full py-3 bg-secondary/10 text-secondary font-bold rounded-xl hover:bg-secondary/20 transition-colors disabled:opacity-50">
                    {resettingPass ? 'Mengirim Email...' : 'Kirim Email Reset'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-3xl font-black tracking-tight mb-2">Notifikasi</h2>
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden max-w-3xl">
                {renderNotifications()}
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Booking Detail Modal */}
      {selectedBooking && (() => {
        const b = selectedBooking;
        const sMap = STATUS_MAP[b.status] || { label: b.status, class: 'bg-muted text-foreground' };
        const itemsArr = b.items ? (Array.isArray(b.items) ? b.items : Object.values(b.items)) : [];
        const canCancel = b.status === 'pending';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setSelectedBooking(null)}>
            <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-border bg-muted/30 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg">Detail Booking</h3>
                <button onClick={() => setSelectedBooking(null)} className="text-foreground/50 hover:text-foreground">✕</button>
              </div>
              <div className="p-6 overflow-y-auto space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                  <span className="font-mono text-xs text-foreground/50 uppercase tracking-wider">ID Booking</span>
                  <span className="font-bold font-mono text-primary">{b.id}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                  <span className="font-mono text-xs text-foreground/50 uppercase tracking-wider">Status</span>
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${sMap.class}`}>{sMap.label}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                  <span className="font-mono text-xs text-foreground/50 uppercase tracking-wider">Periode</span>
                  <span className="font-medium text-right">{fmtD(b.dateStart)} <br/> s/d {fmtD(b.dateEnd)}</span>
                </div>
                <div className="flex justify-between items-start py-2 border-b border-border/50 text-sm">
                  <span className="font-mono text-xs text-foreground/50 uppercase tracking-wider shrink-0 mr-4">Tujuan</span>
                  <span className="font-medium text-right">{b.purpose || '-'}</span>
                </div>
                
                <div className="py-2 border-b border-border/50 text-sm">
                  <span className="block font-mono text-xs text-foreground/50 uppercase tracking-wider mb-2">Item Dipinjam</span>
                  <ul className="list-disc list-inside space-y-1 marker:text-primary/50 text-foreground/90 font-medium">
                    {itemsArr.map((i, idx) => <li key={idx}>{i.name}</li>)}
                  </ul>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                  <span className="font-mono text-xs text-foreground/50 uppercase tracking-wider">Tgl Diajukan</span>
                  <span className="font-medium text-foreground/70">{fmtD(b.createdAt || b.timestamp || b.dateStart || b.startDate)}</span>
                </div>

                {b.status === 'rejected' && b.rejectedReason && (
                  <div className="flex justify-between items-start py-2 border-b border-border/50 text-sm text-destructive">
                    <span className="font-mono text-xs uppercase tracking-wider shrink-0 mr-4">Alasan Ditolak</span>
                    <span className="font-bold text-right">{b.rejectedReason}</span>
                  </div>
                )}
                {(b.status === 'returned' || b.status === 'returned_late') && b.returnedAt && (
                  <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                    <span className="font-mono text-xs text-foreground/50 uppercase tracking-wider">Dikembalikan</span>
                    <span className="font-medium">{fmtD(b.returnedAt)}</span>
                  </div>
                )}
                {b.status === 'returned_late' && b.fineAmount && (
                  <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm text-destructive">
                    <span className="font-mono text-xs uppercase tracking-wider">Denda Keterlambatan</span>
                    <span className="font-bold text-right">Rp {(b.fineAmount||0).toLocaleString('id-ID')} ({b.lateDays||0} hari)</span>
                  </div>
                )}

                <div className="pt-4 flex flex-col gap-3">
                  {canCancel && (
                    <button onClick={() => cancelBooking(b.id)} className="w-full py-3 bg-destructive/10 text-destructive border border-destructive/20 font-bold rounded-xl hover:bg-destructive hover:text-destructive-foreground transition-colors">
                      Batalkan Pengajuan
                    </button>
                  )}
                  <button onClick={() => setSelectedBooking(null)} className="w-full py-3 bg-background border border-border text-foreground font-bold rounded-xl hover:bg-accent transition-colors">
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
