import { normalizeBooking, fmtDate } from '../utils/normalize';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import * as XLSX from 'xlsx';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { 
  Shield, LogOut, Sun, Moon, Calendar, Download, Megaphone, 
  Settings, Phone, CheckCircle2, AlertTriangle, AlertCircle, Search, Plus, X, Check, ArrowRightLeft,
  LayoutDashboard, CalendarCheck, CheckSquare, Camera, PackageSearch, Users, Wrench, FileSearch, BarChart2, History, Menu, Edit, Trash2, MapPin, FileText
} from 'lucide-react';
import { sendWhatsAppMessage, DEFAULT_WA_TEMPLATES, sanitizeWaTemplate } from '../utils/whatsapp';
import { renderAndUploadSpaPdfDirect } from '../utils/spaPdf';
import { sortCategories } from '../utils/categories';
import BookingDetailModal from '../components/BookingDetailModal';
import ManualBookingModal from '../components/ManualBookingModal';
import { ShinyButton } from '../components/ui/shiny-button';
import { useToast } from '../context/ToastContext';
import { getSavedTheme, applyTheme } from '../utils/theme';

const BK_STATUS_LABEL = {
  pending: "Menunggu Approval",
  approved: "Disetujui (Menunggu Diambil)",
  rejected: "Ditolak",
  expired: "Kadaluarsa",
  letter_ready: "Surat & Alat Siap Diambil",
  picked_up: "Sedang Dipinjam",
  active: "Sedang Dipinjam",
  returned: "Selesai Dikembalikan",
  returned_late: "Dikembalikan (Terlambat)"
};

const BK_STATUS_CLASSES = {
  pending: "bg-yellow-500/20 text-yellow-500 border-yellow-500/50",
  approved: "bg-green-500/20 text-green-500 border-green-500/50",
  letter_ready: "bg-primary/20 text-primary border-primary/50",
  active: "bg-blue-500/20 text-blue-500 border-blue-500/50",
  picked_up: "bg-blue-500/20 text-blue-500 border-blue-500/50",
  returned: "bg-foreground/10 text-foreground border-border",
  returned_late: "bg-destructive/20 text-destructive border-destructive/50",
  rejected: "bg-destructive/20 text-destructive border-destructive/50",
  expired: "bg-muted text-foreground/50 border-border"
};



const daysUntil = (dStr) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(dStr);
  end.setHours(0, 0, 0, 0);
  return Math.round((end - today) / (1000 * 60 * 60 * 24));
};

const diffDays = (dEnd) => {
  if (!dEnd) return 0;
  const [y, m, d] = dEnd.split('-').map(Number);
  const end = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end - today) / (1000 * 60 * 60 * 24));
};

export default function Admin() {
  const { toast, confirm } = useToast();
  const [inventory, setInventory] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [serviceLogs, setServiceLogs] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // Audit Log Filter States
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState('all');

  // Service Log States
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('semua');
  const [serviceFormData, setServiceFormData] = useState({
    namaAlat: '', alatId: '', dateIn: '', dateEst: '', status: 'Sedang Dikerjakan (In Repair)', cost: '', teknisi: '', keluhan: '', tindakan: ''
  });
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showManualBookingModal, setShowManualBookingModal] = useState(false);
  
  const [activePanel, setActivePanel] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(getSavedTheme);
  const navigate = useNavigate();

  // Auth States
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Auth Listener
  useEffect(() => {
    const checkUser = async (user) => {
      if (user) {
        try {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
          if (profile && profile.role === 'admin') {
            setCurrentUser(user);
            setAuthError('');
          } else {
            setCurrentUser(null);
            setAuthError(`Akun terdeteksi (${user.email}) bukan akun Admin. Silakan masukkan kredensial akun Admin di bawah.`);
          }
        } catch (e) {
          setCurrentUser(null);
          setAuthError('Gagal memverifikasi hak akses pengguna.');
        }
      } else {
        setCurrentUser(null);
      }
      setIsVerifying(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => { 
      checkUser(session?.user || null); 
    }); 
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { 
      checkUser(session?.user || null); 
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Data
  useEffect(() => {
    if (!currentUser) return;
    
    const fetchAll = async () => {
      try {
        const [
          { data: inv },
          { data: bks },
          { data: usrs },
          { data: acts },
          { data: srvs },
          { data: cfg }
        ] = await Promise.all([
          supabase.from('inventory').select('*'),
          supabase.from('bookings').select('*, booking_items(inventory(*))'),
          supabase.from('profiles').select('*'),
          supabase.from('activity_logs').select('*'),
          supabase.from('maintenance_logs').select('*'),
          supabase.from('config').select('*')
        ]);

        if (inv) setInventory(inv);
        if (bks) {
          const arr = bks.map(normalizeBooking).filter(Boolean);
          arr.sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
          setBookings(arr);
          syncPublicAvailability(arr);
        }

        if (usrs) {
          const cfgMap = {};
          if (cfg) cfg.forEach(c => { cfgMap[c.key] = c.value; });
          const authMeta = cfgMap.userAuthMetadata || {};
          const statusMap = cfgMap.userStatusMap || {};

          const formattedUsers = usrs.map(u => {
            const meta = authMeta[u.id] || authMeta[u.email?.toLowerCase()] || {};
            
            // Check if user has bookings as activity date signal
            const userBookings = bks ? bks.filter(b => b.uid === u.id || (b.user_name && b.user_name.toLowerCase() === (u.display_name || '').toLowerCase())) : [];
            let latestBookingDate = null;
            if (userBookings.length > 0) {
              userBookings.sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
              latestBookingDate = userBookings[0].created_at;
            }

            const lastLoginDate = u.last_login || u.lastLogin || meta.lastSignInAt || latestBookingDate || null;
            const currentStatus = statusMap[u.id] || u.status || 'active';

            return {
              ...u,
              uid: u.id,
              name: u.display_name || u.name || u.email?.split('@')[0] || 'Pengguna',
              lastLogin: lastLoginDate,
              status: currentStatus,
              latestBooking: latestBookingDate
            };
          });

          // Sort users by last login descending (most recent first)
          formattedUsers.sort((a, b) => new Date(b.lastLogin || 0) - new Date(a.lastLogin || 0));
          setUsersList(formattedUsers);
        }
        if (acts) setActivityLogs(acts.sort((a,b) => new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0)));
        if (srvs) setServiceLogs(srvs.sort((a,b) => new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0)));
        if (cfg) {
          const cfgMap = {};
          cfg.forEach(c => { cfgMap[c.key] = c.value; });
          setMaintenanceMode(cfgMap.maintenanceMode === true);
          if (cfgMap.announcement) {
            setAnnounceEnabled(cfgMap.announcement.enabled || false);
            setAnnounceText(cfgMap.announcement.text || '');
          }
          if (cfgMap.adminWaNumbers) {
            setWaNumbers(Array.isArray(cfgMap.adminWaNumbers) ? cfgMap.adminWaNumbers : [cfgMap.adminWaNumbers]);
          }
          if (cfgMap.gotenbergUrl) {
            setGotenbergUrl(String(cfgMap.gotenbergUrl).trim());
          }
          if (cfgMap.waTemplates && typeof cfgMap.waTemplates === 'object') {
            const sanitized = {};
            let hadCorruption = false;
            Object.keys(DEFAULT_WA_TEMPLATES).forEach(k => {
              const val = cfgMap.waTemplates[k];
              if (!val || val.includes('??') || val.includes('\uFFFD') || val.includes('dY')) {
                sanitized[k] = DEFAULT_WA_TEMPLATES[k];
                hadCorruption = true;
              } else {
                sanitized[k] = val;
              }
            });
            setWaTemplates(sanitized);
            if (hadCorruption) {
              supabase.from('config').update({ value: sanitized }).eq('key', 'waTemplates').then(({ error }) => {
                if (!error) console.log("Auto-healed corrupted waTemplates in DB");
              });
            }
          }
        }
      } catch (err) {
        console.error("fetchAll error:", err);
      }
    };
    fetchAll();

    const ch = supabase.channel('public:admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_logs' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, fetchAll)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [currentUser]);

  const handleLogout = async () => {
    if (currentUser) {
      await logActivity("Logout dari Admin Dashboard", currentUser.email);
    }
    supabase.auth.signOut().then(() => navigate('/'));
  };

  const logActivity = async (action, email) => {
    const actor = email || (currentUser ? currentUser.email : 'Admin');
    const newEntry = {
      id: crypto.randomUUID(),
      action,
      email: actor,
      timestamp: new Date().toISOString()
    };
    setActivityLogs(prev => [newEntry, ...prev]);
    try {
      await supabase.from('activity_logs').insert([newEntry]);
    } catch (e) {
      console.error("Failed to log activity:", e);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    const email = e.target.email?.value?.trim();
    const password = e.target.password?.value;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      if (data?.user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
        if (!profile || profile.role !== 'admin') {
          await supabase.auth.signOut();
          setCurrentUser(null);
          setAuthError(`Akun "${email}" bukan admin (role saat ini: ${profile?.role || 'user'}). Silakan gunakan akun yang memiliki hak akses Admin.`);
          return;
        }
        setCurrentUser(data.user);
        setAuthError('');
      }
    } catch (err) {
      setAuthError(err.message === 'Invalid login credentials' ? "Email atau Password Salah" : (err.message || "Email/Password Salah"));
    }
  };

  // Filter States
  const [bookingFilter, setBookingFilter] = useState('pending');
  const [invSearch, setInvSearch] = useState('');
  const [invFilter, setInvFilter] = useState('all');

  // Inventory Add Form States
  const [newCat, setNewCat] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [newImgPath, setNewImgPath] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [editingInv, setEditingInv] = useState(null);

  // New Admin Form States
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  // Announce Modal States
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [announceEnabled, setAnnounceEnabled] = useState(false);
  const [announceText, setAnnounceText] = useState('');

  // WA Modal States
  const [showWaModal, setShowWaModal] = useState(false);
  const [waNumbers, setWaNumbers] = useState([]);
  const [newWaNumber, setNewWaNumber] = useState('');

  // Gotenberg PDF Converter Modal States
  const [showGotenbergModal, setShowGotenbergModal] = useState(false);
  const [gotenbergUrl, setGotenbergUrl] = useState('');

  // WA Templates Modal States
  const [showWaTemplateModal, setShowWaTemplateModal] = useState(false);
  const [waTemplates, setWaTemplates] = useState(DEFAULT_WA_TEMPLATES);

  const parseWaTemplate = (template, booking, key, newStatus, fallbackKey, dynamicDocUrl = null) => {
    const cleanTpl = sanitizeWaTemplate(template, fallbackKey);
    const fmtDMY = (dStr) => dStr ? dStr.split('-').reverse().join('-') : "";
    let msg = cleanTpl;
    msg = msg.replace(/\{nama\}/g, booking.userName || booking.name || "");
    msg = msg.replace(/\{id\}/g, booking.id || key || "");
    msg = msg.replace(/\{program\}/g, booking.userDept || booking.dept || "-");
    msg = msg.replace(/\{tgl_pinjam\}/g, fmtDMY(booking.dateStart));
    msg = msg.replace(/\{tgl_kembali\}/g, fmtDMY(booking.dateEnd));

    const rawDoc = dynamicDocUrl || booking.doc_url || booking.pdf_url;
    const finalLetterLink = (rawDoc && (rawDoc.includes('.pdf') || rawDoc.includes('spa-pdfs') || rawDoc.includes('dakwahtv.my.id') || rawDoc.includes('r2.dev')))
      ? rawDoc.replace(/https:\/\/[^/]+\.r2\.dev/, 'https://spa.dakwahtv.my.id')
      : `https://dakwahtvequipment.pages.dev/surat/${booking.id || key}?auto=1&format=pdf`;
    msg = msg.replace(/\{link_surat\}/g, finalLetterLink);
    return msg;
  };

  const syncPublicAvailability = async (bks) => {
    try {
      const list = bks || bookings;
      const availabilityMap = {};
      const suratBookingsMap = {};

      list.forEach(b => {
        const bId = b.id || b._key;
        if (bId) {
          const itemsArr = b.booking_items ? b.booking_items.map(bi => ({
            id: bi.inventory_id || bi.inventory?.id,
            name: bi.inventory?.name || bi.inventory_id,
            cat: bi.inventory?.cat || '',
            status: bi.inventory?.status || 'ready',
            qty: bi.inventory?.qty || 1
          })) : (b.items || []);

          suratBookingsMap[bId] = {
            id: bId,
            _key: bId,
            uid: b.uid,
            status: b.status,
            userName: b.userName || b.user_name || '',
            user_name: b.userName || b.user_name || '',
            userPhone: b.userPhone || b.user_phone || '',
            user_phone: b.userPhone || b.user_phone || '',
            userNim: b.userNim || b.user_nim || '',
            user_nim: b.userNim || b.user_nim || '',
            dept: b.dept || b.userDept || '',
            userDept: b.dept || b.userDept || '',
            origin: b.origin || b.userOrigin || 'internal',
            userOrigin: b.origin || b.userOrigin || 'internal',
            purpose: b.purpose || '',
            dateStart: b.dateStart || b.date_start || '',
            date_start: b.dateStart || b.date_start || '',
            dateEnd: b.dateEnd || b.date_end || '',
            date_end: b.dateEnd || b.date_end || '',
            suratProgramName: b.suratProgramName || b.dept || b.userDept || '',
            suratEpisode: b.suratEpisode || '',
            suratProduser: b.suratProduser || b.userName || b.user_name || '',
            suratTglProduksi: b.suratTglProduksi || b.dateStart || b.date_start || '',
            doc_url: b.doc_url || '',
            pdf_url: b.pdf_url || b.doc_url || '',
            items: itemsArr,
            booking_items: b.booking_items,
            createdAt: b.createdAt || b.created_at || ''
          };
        }

        if (['rejected', 'expired', 'returned', 'cancelled'].includes(b.status)) return;
        const dStart = b.date_start ? b.date_start.split('T')[0] : (b.dateStart || '');
        const dEnd = b.date_end ? b.date_end.split('T')[0] : (b.dateEnd || '');
        if (!dStart || !dEnd) return;

        const itemsArr = b.booking_items ? b.booking_items.map(bi => ({
          id: bi.inventory_id || bi.inventory?.id,
          name: bi.inventory?.name
        })) : (b.items || []);

        itemsArr.forEach(it => {
          const itemId = it.id;
          if (!itemId) return;
          if (!availabilityMap[itemId]) availabilityMap[itemId] = [];
          availabilityMap[itemId].push({
            bookingId: b.id,
            dateStart: dStart,
            dateEnd: dEnd,
            status: b.status,
            userName: b.userName || b.user_name,
            dept: b.dept || b.userDept,
            itemName: it.name
          });
        });
      });

      await Promise.all([
        supabase.from('config').upsert({
          key: 'publicAvailability',
          value: availabilityMap
        }, { onConflict: 'key' }),
        supabase.from('config').upsert({
          key: 'suratBookings',
          value: suratBookingsMap
        }, { onConflict: 'key' })
      ]);
    } catch (e) {
      console.warn("syncPublicAvailability warning:", e);
    }
  };

  const updateStatus = async (bookingKey, bookingId, newStatus, returnChecklist = null, returnNote = null, proofUrl = null) => {
    const label = BK_STATUS_LABEL[newStatus] || newStatus;
    const identifier = bookingId || bookingKey || "Booking ini";
    const isConfirmed = await confirm({
      title: "Konfirmasi Ubah Status",
      message: `Ubah status booking ${identifier} menjadi "${label}"?`,
      confirmText: "Ya, Ubah Status",
      cancelText: "Batal",
      type: newStatus === 'rejected' ? 'danger' : 'primary'
    });
    if (!isConfirmed) return;

    const payload = { status: newStatus, updated_at: new Date().toISOString() };
    if (returnChecklist) payload.return_checklist = returnChecklist;
    if (returnNote !== null || proofUrl) {
      let noteText = returnNote || '';
      if (proofUrl) noteText = (noteText + '\n[Foto Bukti]: ' + proofUrl).trim();
      payload.return_note = noteText;
    }

    const booking = bookings.find(b => b._key === bookingKey || b.id === bookingKey);

    // 1. Gather all equipment IDs involved in this booking
    let involvedItemIds = [];
    const bItems = Array.isArray(booking?.items) ? booking.items : (booking?.items ? Object.values(booking.items) : []);
    bItems.forEach(bi => {
      if (bi?.id) {
        involvedItemIds.push(bi.id);
      } else if (bi?.name) {
        const found = inventory.find(i => i.name && i.name.toLowerCase() === bi.name.toLowerCase());
        if (found?.id) involvedItemIds.push(found.id);
      }
    });

    if (Array.isArray(booking?.booking_items)) {
      booking.booking_items.forEach(bi => {
        const invId = bi.inventory_id || bi.inventory?.id;
        if (invId && !involvedItemIds.includes(invId)) involvedItemIds.push(invId);
      });
    }

    // ⚡ INSTANT OPTIMISTIC UPDATE on bookings state (0ms Perceived Delay)
    const updatedBookings = bookings.map(b => {
      if (b._key === bookingKey || b.id === bookingKey) {
        return {
          ...b,
          status: newStatus,
          return_checklist: returnChecklist || b.return_checklist,
          returnChecklist: returnChecklist || b.returnChecklist,
          return_note: payload.return_note || b.return_note,
          returnNote: returnNote !== null ? returnNote : b.returnNote,
          returnProofUrl: proofUrl || b.returnProofUrl,
          return_proof_url: proofUrl || b.return_proof_url
        };
      }
      return b;
    });
    setBookings(updatedBookings);
    syncPublicAvailability(updatedBookings);

    // ⚡ AUTOMATION ON INVENTORY STATUS
    // Case A: Equipment is confirmed picked up / borrowed (status -> 'active' or 'picked_up')
    // Automatically change equipment status to 'unavailable' (Not Ready)
    const isBorrowing = newStatus === 'active' || newStatus === 'picked_up';
    const isReturning = newStatus === 'returned' || newStatus === 'returned_late';
    const isCancelledOrRejected = newStatus === 'rejected' || newStatus === 'cancelled';

    if (isBorrowing && involvedItemIds.length > 0) {
      setInventory(prevInv => prevInv.map(it => {
        if (involvedItemIds.includes(it.id)) {
          return { ...it, status: 'unavailable' };
        }
        return it;
      }));
    } else if (isReturning && involvedItemIds.length > 0) {
      const attnIds = [];
      const unavailIds = [];
      const readyIds = [];

      involvedItemIds.forEach(id => {
        const it = inventory.find(i => i.id === id);
        const itName = it ? it.name : id;
        const cond = returnChecklist ? (returnChecklist[itName] || returnChecklist[id]) : 'lengkap';
        if (cond === 'rusak') attnIds.push(id);
        else if (cond === 'hilang') unavailIds.push(id);
        else readyIds.push(id);
      });

      setInventory(prevInv => prevInv.map(it => {
        if (attnIds.includes(it.id)) return { ...it, status: 'attention' };
        if (unavailIds.includes(it.id)) return { ...it, status: 'unavailable' };
        if (readyIds.includes(it.id)) return { ...it, status: 'ready' };
        return it;
      }));
    } else if (isCancelledOrRejected && (booking?.status === 'active' || booking?.status === 'picked_up') && involvedItemIds.length > 0) {
      setInventory(prevInv => prevInv.map(it => {
        if (involvedItemIds.includes(it.id)) {
          return { ...it, status: 'ready' };
        }
        return it;
      }));
    }

    try {
      const { error } = await supabase.from('bookings').update(payload).eq('id', bookingKey);
      if (error) {
        fetchAll();
        throw error;
      }

      // Check direct DB booking_items if local memory had 0 items
      if (involvedItemIds.length === 0) {
        const { data: dbItems } = await supabase.from('booking_items').select('inventory_id').eq('booking_id', bookingKey);
        if (dbItems && dbItems.length > 0) {
          involvedItemIds = dbItems.map(d => d.inventory_id).filter(Boolean);
        }
      }

      // Persist inventory status updates to Supabase
      if (isBorrowing && involvedItemIds.length > 0) {
        await supabase.from('inventory').update({ status: 'unavailable' }).in('id', involvedItemIds);
      } else if (isReturning && involvedItemIds.length > 0) {
        const attnIds = [];
        const unavailIds = [];
        const readyIds = [];

        involvedItemIds.forEach(id => {
          const it = inventory.find(i => i.id === id);
          const itName = it ? it.name : id;
          const cond = returnChecklist ? (returnChecklist[itName] || returnChecklist[id]) : 'lengkap';
          if (cond === 'rusak') attnIds.push(id);
          else if (cond === 'hilang') unavailIds.push(id);
          else readyIds.push(id);
        });

        if (attnIds.length > 0) await supabase.from('inventory').update({ status: 'attention' }).in('id', attnIds);
        if (unavailIds.length > 0) await supabase.from('inventory').update({ status: 'unavailable' }).in('id', unavailIds);
        if (readyIds.length > 0) await supabase.from('inventory').update({ status: 'ready' }).in('id', readyIds);
      } else if (isCancelledOrRejected && (booking?.status === 'active' || booking?.status === 'picked_up') && involvedItemIds.length > 0) {
        await supabase.from('inventory').update({ status: 'ready' }).in('id', involvedItemIds);
      }

      let logDetail = '';
      if (isBorrowing && involvedItemIds.length > 0) {
        logDetail = ` (${involvedItemIds.length} alat otomatis diubah ke Not Ready)`;
      } else if (isReturning && involvedItemIds.length > 0) {
        logDetail = ` (${involvedItemIds.length} alat dikembalikan ke status ready/kondisi perbaikan)`;
      }

      logActivity(`Ubah status booking ${bookingId || bookingKey} -> ${newStatus}${logDetail}`, currentUser?.email);

      const feedbackMsg = isBorrowing
        ? `Status booking ${identifier} diubah menjadi "${label}". ${involvedItemIds.length} alat otomatis diubah ke status "Not Ready".`
        : isReturning
        ? `Status booking ${identifier} diubah menjadi "${label}". Alat telah berhasil dicatat pengembaliannya.`
        : `Status booking ${identifier} berhasil diubah menjadi "${label}".`;

      toast.success(feedbackMsg, "Status Diperbarui");

      let dynamicDocUrl = booking?.doc_url;
      if (newStatus === 'approved' && (!dynamicDocUrl || !dynamicDocUrl.includes('.pdf'))) {
        try {
          const effectiveGotenbergUrl = gotenbergUrl || 'https://gotenberg.dakwahtv.my.id';
          toast.info("Mengonversi berkas surat PDF ke R2...", "Memproses SPA");
          dynamicDocUrl = await renderAndUploadSpaPdfDirect({
            booking,
            gotenbergUrl: effectiveGotenbergUrl
          });
          if (dynamicDocUrl) {
            if (booking) booking.doc_url = dynamicDocUrl;
            await supabase.from('bookings').update({ doc_url: dynamicDocUrl }).eq('id', bookingKey);
          }
        } catch (genErr) {
          console.warn("Auto-generate SPA on approval notice:", genErr);
        }
      }

      if (booking && booking.userPhone) {
        const phone = booking.userPhone.replace(/[^0-9]/g, '');
        let msg = '';
        if (newStatus === 'approved') {
          msg = parseWaTemplate(waTemplates.userApproved, booking, bookingKey, newStatus, 'userApproved', dynamicDocUrl);
        } else if (newStatus === 'rejected') {
          msg = parseWaTemplate(waTemplates.userRejected, booking, bookingKey, newStatus, 'userRejected');
        } else if (newStatus === 'returned' || newStatus === 'returned_late') {
          msg = parseWaTemplate(waTemplates.userReturned, booking, bookingKey, newStatus, 'userReturned');
        }
        
        if (msg) {
          sendWhatsAppMessage(phone, msg).catch(err => console.warn("Background WA send warning:", err));
        }
      }

    } catch (e) {
      toast.error("Gagal update status: " + e.message, "Gagal Memperbarui");
    }
  };

  const deleteBooking = async (key, bookingId) => {
    const isConfirmed = await confirm({
      title: "Hapus Permanen Booking",
      message: `Yakin ingin menghapus permanen booking ${bookingId || key} dari database? Aksi ini tidak dapat dibatalkan!`,
      confirmText: "Ya, Hapus Permanen",
      cancelText: "Batal",
      type: "danger"
    });
    if (!isConfirmed) return;
    
    const targetBooking = bookings.find(b => b._key === key || b.id === key);

    // ⚡ INSTANT OPTIMISTIC REMOVAL
    const afterDel = bookings.filter(b => b._key !== key && b.id !== key);
    setBookings(afterDel);
    syncPublicAvailability(afterDel);

    // If deleted booking was active/borrowed, restore its items to ready
    if (targetBooking && (targetBooking.status === 'active' || targetBooking.status === 'picked_up')) {
      const bItems = Array.isArray(targetBooking.items) ? targetBooking.items : Object.values(targetBooking.items || {});
      const itmIds = bItems.map(i => i.id).filter(Boolean);
      if (itmIds.length > 0) {
        setInventory(prev => prev.map(inv => itmIds.includes(inv.id) ? { ...inv, status: 'ready' } : inv));
        supabase.from('inventory').update({ status: 'ready' }).in('id', itmIds).catch(err => console.warn(err));
      }
    }

    try {
      await supabase.from('booking_items').delete().eq('booking_id', key);
      const { error } = await supabase.from('bookings').delete().eq('id', key);
      if (error) {
        fetchAll();
        throw error;
      }
      logActivity(`Hapus permanen booking ${bookingId || key}`, currentUser?.email);
      toast.success(`Booking ${bookingId || key} berhasil dihapus permanen.`, "Booking Dihapus");
    } catch (e) {
      toast.error("Gagal menghapus: " + e.message, "Gagal Menghapus");
    }
  };

  const handleSendReminder = async (booking, type) => {
    if (!booking.userPhone) return toast.warning("Peminjam tidak mencantumkan nomor WA.", "Nomor WA Kosong");
    const phone = booking.userPhone.replace(/[^0-9]/g, '');
    let template = '';
    let confirmMsg = '';
    let fallbackKey = '';

    if (type === 'pickup') {
      template = waTemplates.reminderPickup;
      fallbackKey = 'reminderPickup';
      confirmMsg = `Kirim pesan WhatsApp pengingat untuk mengambil alat ke ${booking.userName}?`;
    } else if (type === 'return') {
      template = waTemplates.reminderReturn;
      fallbackKey = 'reminderReturn';
      confirmMsg = `Kirim pesan WhatsApp pengingat untuk mengembalikan alat ke ${booking.userName}?`;
    }

    const isConfirmed = await confirm({
      title: "Kirim Pengingat WhatsApp",
      message: confirmMsg,
      confirmText: "Kirim Pengingat",
      cancelText: "Batal",
      type: "primary"
    });
    if (!isConfirmed) return;

    const msg = parseWaTemplate(template, booking, booking._key || booking.id, '', fallbackKey);
    const success = await sendWhatsAppMessage(phone, msg);
    
    if (success) {
      toast.success(`Pengingat berhasil diteruskan ke WhatsApp ${booking.userName}!`, "Pengingat Terkirim");
      logActivity(`Kirim pengingat ${type} ke ${booking.userName}`, currentUser?.email);
    } else {
      toast.error("Gagal mengirim pengingat! Pastikan nomor WA valid dan tidak diblokir adblocker.", "Gagal Mengirim");
    }
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    if (!serviceFormData.namaAlat) return toast.warning("Pilih atau ketik nama alat yang diservis!", "Data Belum Lengkap");
    if (!serviceFormData.dateIn) return toast.warning("Tanggal Masuk Servis harus diisi!", "Data Belum Lengkap");
    try {
      const dateInIso = serviceFormData.dateIn ? new Date(serviceFormData.dateIn).toISOString() : new Date().toISOString();
      const payload = {
        item_name: serviceFormData.namaAlat,
        description: `[Keluhan]: ${serviceFormData.keluhan || '-'} | [Tindakan]: ${serviceFormData.tindakan || '-'} | [Teknisi]: ${serviceFormData.teknisi || '-'} | [Biaya]: ${serviceFormData.cost || '-'} | [Estimasi]: ${serviceFormData.dateEst || '-'}`,
        reported_by: serviceFormData.teknisi || currentUser?.email || 'Admin',
        status: serviceFormData.status,
        timestamp: dateInIso
      };

      if (editingService) {
        const { error } = await supabase.from('maintenance_logs').update(payload).eq('id', editingService.id);
        if (error) throw error;
        setServiceLogs(prev => prev.map(l => l.id === editingService.id ? { ...l, ...payload } : l));
        logActivity(`Edit log servis: ${payload.item_name}`, currentUser?.email);
        toast.success(`Log servis untuk ${payload.item_name} berhasil diperbarui!`, "Servis Diperbarui");
      } else {
        const newId = crypto.randomUUID();
        const insertPayload = { ...payload, id: newId };
        const { error } = await supabase.from('maintenance_logs').insert([insertPayload]);
        if (error) throw error;
        setServiceLogs(prev => [insertPayload, ...prev]);
        logActivity(`Tambah log servis: ${payload.item_name}`, currentUser?.email);
        toast.success(`Log servis baru untuk ${payload.item_name} berhasil disimpan!`, "Servis Disimpan");
      }
      
      const targetAlatId = serviceFormData.alatId || inventory.find(i => i.name?.toLowerCase() === serviceFormData.namaAlat?.toLowerCase())?.id;
      if (payload.status === 'Selesai' && targetAlatId) {
        const { error } = await supabase.from('inventory').update({ status: 'ready' }).eq('id', targetAlatId);
        if (!error) {
          setInventory(prev => prev.map(it => it.id === targetAlatId ? { ...it, status: 'ready' } : it));
          logActivity(`Auto-update status inventaris -> ready: ${payload.item_name}`, currentUser?.email);
        }
      } else if (payload.status?.includes('In Repair') && targetAlatId) {
        const { error } = await supabase.from('inventory').update({ status: 'maintenance' }).eq('id', targetAlatId);
        if (!error) {
          setInventory(prev => prev.map(it => it.id === targetAlatId ? { ...it, status: 'maintenance' } : it));
          logActivity(`Auto-update status inventaris -> maintenance: ${payload.item_name}`, currentUser?.email);
        }
      }

      setShowServiceModal(false);
      setEditingService(null);
      setServiceFormData({ namaAlat: '', alatId: '', dateIn: '', dateEst: '', status: 'Sedang Dikerjakan (In Repair)', cost: '', teknisi: '', keluhan: '', tindakan: '' });
    } catch (err) {
      toast.error("Gagal menyimpan log servis: " + err.message, "Gagal Menyimpan");
    }
  };

  const handleMarkServiceDone = async (log) => {
    const itemName = log.item_name || log.namaAlat || "Alat";
    const isConfirmed = await confirm({
      title: "Selesaikan Servis Alat",
      message: `Tandai servis untuk alat "${itemName}" sebagai Selesai? Status alat di inventaris akan otomatis diset menjadi Ready.`,
      confirmText: "Ya, Selesaikan",
      cancelText: "Batal",
      type: "primary"
    });
    if (!isConfirmed) return;
    try {
      const { error: e1 } = await supabase.from('maintenance_logs').update({ status: 'Selesai' }).eq('id', log.id);
      if (e1) throw e1;
      
      setServiceLogs(prev => prev.map(l => l.id === log.id ? { ...l, status: 'Selesai' } : l));

      const targetId = log.alatId || inventory.find(i => i.name?.toLowerCase() === itemName.toLowerCase())?.id;
      if (targetId) {
        const { error: e2 } = await supabase.from('inventory').update({ status: 'ready' }).eq('id', targetId);
        if (!e2) {
          setInventory(prev => prev.map(it => it.id === targetId ? { ...it, status: 'ready' } : it));
        }
      }
      logActivity(`Servis selesai: ${itemName}`, currentUser?.email);
      toast.success(`Servis alat "${itemName}" telah ditandai Selesai!`, "Servis Selesai");
    } catch (err) {
      toast.error("Gagal update status servis: " + err.message, "Gagal Memperbarui");
    }
  };

  const handleDeleteService = async (id, namaAlat) => {
    const isConfirmed = await confirm({
      title: "Hapus Log Servis",
      message: `Yakin ingin menghapus catatan log servis untuk "${namaAlat}"?`,
      confirmText: "Hapus",
      cancelText: "Batal",
      type: "danger"
    });
    if (!isConfirmed) return;
    try {
      const { error } = await supabase.from('maintenance_logs').delete().eq('id', id);
      if (error) throw error;
      setServiceLogs(prev => prev.filter(l => l.id !== id));
      logActivity(`Hapus log servis: ${namaAlat}`, currentUser?.email);
      toast.success(`Catatan log servis untuk "${namaAlat}" telah dihapus.`, "Log Dihapus");
    } catch (err) {
      toast.error("Gagal menghapus log servis: " + err.message, "Gagal Menghapus");
    }
  };

  const handleEditService = (log) => {
    // Parse composite description: "[Keluhan]: X | [Tindakan]: Y | [Teknisi]: Z | [Biaya]: W | [Estimasi]: E"
    const _d = log.description || '';
    const _k = _d.match(/\[Keluhan\]:\s*(.*?)(?:\s*\|\s*\[|$)/);
    const _t = _d.match(/\[Tindakan\]:\s*(.*?)(?:\s*\|\s*\[|$)/);
    const _n = _d.match(/\[Teknisi\]:\s*(.*?)(?:\s*\|\s*\[|$)/);
    const _b = _d.match(/\[Biaya\]:\s*(.*?)(?:\s*\|\s*\[|$)/);
    const _e = _d.match(/\[Estimasi\]:\s*(.*?)(?:\s*\|\s*\[|$)/);
    
    const itemName = log.item_name || log.namaAlat || '';
    const matchedItem = inventory.find(i => i.name?.toLowerCase() === itemName.toLowerCase());

    setEditingService(log);
    setServiceFormData({
      namaAlat: itemName,
      alatId: log.alatId || matchedItem?.id || '',
      dateIn: log.timestamp ? new Date(log.timestamp).toISOString().split('T')[0] : '',
      dateEst: _e ? _e[1].trim() : '',
      status: log.status || 'Sedang Dikerjakan (In Repair)',
      cost: _b ? _b[1].trim().replace(/[^0-9.]/g, '') : '',
      teknisi: _n ? _n[1].trim() : (log.reported_by || ''),
      keluhan: _k ? _k[1].trim() : _d,
      tindakan: _t ? _t[1].trim() : ''
    });
    setShowServiceModal(true);
  };


  const handleAddInventory = async () => {
    if (!newCat.trim() || !newName.trim() || newQty < 1) {
      toast.warning("Harap isi semua field Tambah Alat dengan benar!", "Data Belum Lengkap");
      return;
    }
    try {
      setIsUploading(true);
      let publicUrl = null;
        if (newImgFile) {
          const fileName = `${Date.now()}_${newImgFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          const workerUrl = import.meta.env.VITE_R2_WORKER_URL;
          
          if (!workerUrl) {
            throw new Error("URL Cloudflare Worker belum di-setting! Hubungi teknisi.");
          }

          const response = await fetch(`${workerUrl}/${fileName}`, {
            method: 'PUT',
            headers: {
              'Authorization': 'Bearer DakwahTV_Aman_2026',
              'Content-Type': newImgFile.type || 'application/octet-stream'
            },
            body: newImgFile
          });

          if (!response.ok) {
            throw new Error(`Gagal upload ke R2: ${response.statusText}`);
          }

          const responseData = await response.json();
          publicUrl = responseData.url;
        }

      const qty = parseInt(newQty, 10);
      const itemsToInsert = [];
      
      for (let i = 1; i <= qty; i++) {
        itemsToInsert.push({
          cat: newCat.trim(),
          name: qty > 1 ? `${newName.trim()} (Unit ${i})` : newName.trim(),
          notes: newDesc.trim() || "", desc: newDesc.trim() || "",
          qty: 1,
          status: "ready",
          ...(publicUrl && { img: publicUrl })
        });
      }
      const { error } = await supabase.from('inventory').insert(itemsToInsert);
      if (error) throw error;
      
      logActivity(`Tambah alat baru: ${newName.trim()} (${qty} unit)`, currentUser?.email);
      toast.success(`Alat ${newName.trim()} (${qty} unit) berhasil ditambahkan!`, "Alat Ditambahkan");
      setNewName('');
      setNewDesc('');
      setNewQty(1);
      setNewImgPath('');
    } catch (e) {
      toast.error("Gagal menambahkan alat: " + e.message, "Gagal Menambahkan");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveInventory = async (itemId, itemName) => {
    const isConfirmed = await confirm({
      title: "Hapus Alat dari Inventaris",
      message: `Yakin ingin menghapus alat "${itemName}" dari inventaris? Tindakan ini akan menghapus unit secara permanen.`,
      confirmText: "Ya, Hapus Alat",
      cancelText: "Batal",
      type: "danger"
    });
    if (!isConfirmed) return;
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', itemId);
      if (error) throw error;
      logActivity(`Hapus alat dari inventaris: ${itemName}`, currentUser?.email);
      toast.success(`Alat "${itemName}" berhasil dihapus dari inventaris.`, "Alat Dihapus");
    } catch (e) {
      toast.error("Gagal menghapus alat: " + e.message, "Gagal Menghapus");
    }
  };
  
  const handleSaveEditInventory = async (e) => {
    e.preventDefault();
    if (!editingInv) return;
    const noteText = (editingInv.keterangan !== undefined ? editingInv.keterangan : (editingInv.notes || editingInv.desc || "")).trim();
    
    // Instant Optimistic Update
    setInventory(prev => prev.map(it => it.id === editingInv.id ? { ...it, name: editingInv.name, cat: editingInv.cat, notes: noteText, desc: noteText, keterangan: noteText } : it));
    setEditingInv(null);

    try {
      const { error } = await supabase.from('inventory').update({
        name: editingInv.name,
        cat: editingInv.cat,
        notes: noteText, 
        desc: noteText,
      }).eq('id', editingInv.id);
      if (error) {
        fetchAll();
        throw error;
      }
      logActivity(`Edit inventaris: ${editingInv.name}`, currentUser?.email);
      toast.success(`Perubahan inventaris ${editingInv.name} berhasil disimpan!`, "Inventaris Diperbarui");
    } catch (err) {
      toast.error("Gagal menyimpan perubahan: " + err.message, "Gagal Memperbarui");
    }
  };

  const handleToggleInventoryStatus = async (itemId, currentStatus) => {
    const statuses = ['ready', 'attention', 'unavailable'];
    const nextStatus = statuses[(statuses.indexOf(currentStatus || 'ready') + 1) % statuses.length];
    
    // ⚡ INSTANT OPTIMISTIC STATUS TOGGLE
    setInventory(prev => prev.map(i => i.id === itemId ? { ...i, status: nextStatus } : i));

    try {
      const { error } = await supabase.from('inventory').update({ status: nextStatus }).eq('id', itemId);
      if (error) {
        fetchAll();
        throw error;
      }
    } catch(e) {
      console.error(e);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    const isConfirmed = await confirm({
      title: "Tambah Admin Baru",
      message: `Yakin ingin menambahkan ${newAdminEmail} sebagai akun admin?`,
      confirmText: "Lanjutkan",
      cancelText: "Batal",
      type: "primary"
    });
    if (!isConfirmed) return;
    try {
       toast.info("Pembuatan admin dapat dilakukan dengan mendaftarkan akun di menu Login lalu mengubah Role di tab Kelola Pengguna.");
       logActivity(`Membuat admin baru: ${newAdminEmail}`, currentUser?.email);
       setNewAdminEmail('');
       setNewAdminPassword('');
    } catch (e) {
       toast.error("Error: " + e.message);
    }
  };

  const handleToggleMaintenance = async () => {
    try {
      const nextVal = !maintenanceMode;
      const { error } = await supabase.from('config').update({ value: nextVal }).eq('key', 'maintenanceMode');
      if (error) throw error;
      logActivity(`Mengubah status Maintenance menjadi ${nextVal ? 'ON' : 'OFF'}`, currentUser?.email);
      toast.success(`Status Maintenance website berhasil diubah menjadi ${nextVal ? 'ON (Aktif)' : 'OFF (Nonaktif)'}.`, "Mode Maintenance");
    } catch (e) {
      toast.error("Gagal mengubah maintenance: " + e.message, "Gagal Memperbarui");
    }
  };

  const saveAnnouncement = async () => {
    try {
      const { error } = await supabase.from('config').update({ value: { enabled: announceEnabled, text: announceText } }).eq('key', 'announcement');
      if (error) throw error;
      logActivity("Update Pengumuman System", currentUser?.email);
      toast.success("Pengumuman berhasil diperbarui dan disiarkan!", "Pengumuman Disimpan");
      setShowAnnounceModal(false);
    } catch (e) {
      toast.error("Gagal update pengumuman: " + e.message, "Gagal Menyimpan");
    }
  };

  const handleAddWaNumber = () => {
    if (!newWaNumber.trim()) return;
    setWaNumbers([...waNumbers, newWaNumber.trim()]);
    setNewWaNumber('');
  };

  const handleRemoveWaNumber = (index) => {
    setWaNumbers(waNumbers.filter((_, i) => i !== index));
  };

  const saveWaNumbers = async () => {
    try {
      const { error } = await supabase.from('config').update({ value: waNumbers }).eq('key', 'adminWaNumbers');
      if (error) throw error;
      logActivity("Update Nomor WA Admin", currentUser?.email);
      toast.success("Daftar nomor WhatsApp Admin berhasil disimpan!", "Nomor WA Disimpan");
      setShowWaModal(false);
    } catch (e) {
      toast.error("Gagal update nomor WA: " + e.message, "Gagal Menyimpan");
    }
  };

  const saveGotenbergUrl = async () => {
    try {
      const trimmed = gotenbergUrl.trim();
      const { error } = await supabase.from('config').upsert({ key: 'gotenbergUrl', value: trimmed }, { onConflict: 'key' });
      if (error) throw error;
      logActivity("Update Gotenberg Server URL", currentUser?.email);
      toast.success("Konfigurasi server Gotenberg berhasil disimpan!", "Gotenberg Disimpan");
      setShowGotenbergModal(false);
    } catch (e) {
      toast.error("Gagal menyimpan Gotenberg URL: " + e.message, "Gagal Menyimpan");
    }
  };

  const handleExportLaporan = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(bookings.map(b => ({
        ID: b.id,
        Nama: b.userName,
        'No. HP': b.userPhone,
        'Unit/Dept': b.userDept,
        Tanggal_Mulai: fmtDate(b.dateStart),
        Tanggal_Selesai: fmtDate(b.dateEnd),
        Status: BK_STATUS_LABEL[b.status] || b.status,
        Barang: (b.items || []).map(i => i.name).join(", ")
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Laporan");
      XLSX.writeFile(wb, "Laporan_Booking.xlsx");
      logActivity("Export Laporan Excel", currentUser?.email);
      toast.success("Laporan peminjaman berhasil di-export ke file Excel!", "Export Berhasil");
    } catch (e) {
      toast.error("Gagal export laporan: " + e.message, "Gagal Export");
    }
  };

  const handleGenerateSurat = async (b, config = {}) => {
    try {
      const deptLower = (b.userDept || "").toLowerCase();
      const isNews = deptLower.includes("campus report") || deptLower.includes("news");
      const templateName = isNews ? 'template_news.docx' : 'template_reguler.docx';
      
      const response = await fetch(`/surat-assets/${templateName}`);
      if (!response.ok) {
         toast.error(`Template surat tidak ditemukan (/surat-assets/${templateName}).`, "Template Hilang");
         return;
      }
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = function(e) {
        const content = e.target.result;
        try {
          const zip = new PizZip(content);
          const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
          
          // Support both old and new field naming conventions
          const bNama = b.userName || b.name || b.nama || "";
          const bNim = b.userNim || b.nim || "";
          const bDept = b.userDept || b.dept || "";
          const bHp = b.userPhone || b.phone || b.hp || "";
          const bTujuan = b.purpose || b.keperluan || b.tujuan || "";
          const bStart = b.dateStart || b.tglMulai || b.start || "";
          const bEnd = b.dateEnd || b.tglSelesai || b.end || "";
          const bItems = Array.isArray(b.items) ? b.items : Object.values(b.items || {});
          const bAlatList = bItems.map((itm, idx) => `${idx + 1}. ${itm.name || itm}`).join("\n");

          doc.setData({
            nama: bNama,
            nim: bNim,
            dept: bDept,
            unit: bDept,
            hp: bHp,
            phone: bHp,
            keperluan: bTujuan,
            tujuan: bTujuan,
            tglMulai: bStart,
            tglSelesai: bEnd,
            tgl_mulai: fmtDate(bStart),
            tgl_selesai: fmtDate(bEnd),
            daftarAlat: bAlatList,
            alat: bAlatList,
            program: config.program || bDept || "",
            episode: config.episode || "",
            produser: config.produser || bNama,
            tgl_produksi: config.tglProduksi ? fmtDate(config.tglProduksi) : fmtDate(bStart),
            kategori: config.kategori || "reguler"
          });
          
          const out = doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
          const url = URL.createObjectURL(out);
          const spaProgram = (config.program || bDept || "").replace(/[\\/:*?"<>|]/g, '').trim();
          const spaEpisode = (config.episode || "").replace(/[\\/:*?"<>|]/g, '').trim();
          const spaTgl = config.tglProduksi ? fmtDate(config.tglProduksi) : fmtDate(bStart);
          const fileName = `SPA Produksi ${spaProgram}${spaEpisode ? ' ' + spaEpisode : ''} ${spaTgl}`.trim();
          const a = document.createElement("a");
          a.href = url;
          a.download = `${fileName}.docx`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          logActivity(`Generate surat peminjaman ${b.id}`, currentUser?.email);
          toast.success("Surat peminjaman berhasil di-generate dan diunduh!", "Surat Siap");
        } catch (err) {
          toast.error("Gagal generate surat: " + err.message, "Gagal Generate");
        }
      };
      reader.readAsArrayBuffer(blob);
    } catch (err) {
      toast.error("Gagal memuat template: " + err.message, "Gagal Memuat");
    }
  };

  const getOriginBadge = (b) => {
    const dept = (b.userDept || b.dept || '').toLowerCase();
    const origin = (b.origin || b.userOrigin || '').toLowerCase();
    let label = 'Internal';
    let classes = 'bg-blue-500/10 text-blue-500 border-blue-500/30';
    if (origin === 'eksternal' || dept.includes('eksternal')) {
      label = 'Eksternal';
      classes = 'bg-muted text-foreground/70 border-border';
    } else if (origin === 'amora' || dept.includes('amora')) {
      label = 'Amora';
      classes = 'bg-primary/10 text-primary border-primary/30';
    } else if (origin === 'savira' || dept.includes('savira')) {
      label = 'Savira';
      classes = 'bg-teal-light/10 text-teal-light border-teal-light/30';
    } else {
      label = 'Internal';
      classes = 'bg-blue-500/10 text-blue-500 border-blue-500/30';
    }
    return <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ml-2 ${classes}`}>{label}</span>;
  };

  const BookingCard = ({ b, showDeadline }) => {
    const items = (b.items || []).map(i => i.name).join(", ");
    let deadlineHtml = null;
    if (showDeadline && b.dateEnd) {
      const days = daysUntil(b.dateEnd);
      const cls = days < 0 ? "text-destructive font-bold" : days <= 2 ? "text-yellow-500 font-bold" : "text-green-500 font-medium";
      const txt = days < 0 ? `Terlambat ${Math.abs(days)} hari` : days === 0 ? "Deadline hari ini" : `${days} hari lagi`;
      deadlineHtml = <div className={`mt-2 text-xs font-mono ${cls}`}>Deadline: {fmtDate(b.dateEnd)} • {txt}</div>;
    }

    const directWaBtn = b.userPhone ? (
      <button 
        className="px-3 py-1.5 rounded-lg border border-green-500 text-green-500 hover:bg-green-500/10 text-xs font-bold transition-colors mt-2 w-full flex justify-center items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          window.open(`https://wa.me/${b.userPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Halo Kak ' + (b.userName || '') + ', mengenai peminjaman alat Dakwah TV ID #' + b.id + '...')}`, '_blank');
        }}
        title={`Chat WA Peminjam (${b.userPhone})`}
      >
        <Phone className="w-3 h-3" /> WA Peminjam
      </button>
    ) : null;

    const bKey = b._key || b.id;

    return (
      <div 
        className="bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col md:flex-row gap-4 justify-between transition-all hover:border-teal/50 hover:shadow-glow cursor-pointer"
        onClick={() => setSelectedBooking(b)}
      >
        <div className="flex-1">
          <div className="font-mono text-[10px] text-foreground/50 mb-1 uppercase tracking-widest">ID: {b.id || b._key}</div>
          <div className="font-bold text-lg md:text-xl mb-1 flex items-center text-foreground">{b.userName || "-"}{getOriginBadge(b)}</div>
          <div className="text-xs text-foreground/70 mb-1 flex items-center gap-2">
            <span>{b.userDept || ""}</span>
            {b.userNim && <span className="font-mono text-foreground/50">• NIM: {b.userNim}</span>}
          </div>
          <div className="text-xs font-mono text-foreground/60 mb-3 flex items-center gap-1">
            📅 {fmtDate(b.dateStart)} — {fmtDate(b.dateEnd)}
          </div>
          <div className="text-sm font-medium p-3 bg-muted/20 rounded-xl border border-border/50">
            <span className="font-bold text-teal-light mr-2">{(b.items || []).length} ALAT:</span> 
            <span className="text-foreground/80">{items}</span>
          </div>
          {deadlineHtml}
        </div>
        <div className="flex flex-col gap-2 min-w-[180px]">
          <div className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border text-center ${BK_STATUS_CLASSES[b.status] || BK_STATUS_CLASSES.pending}`}>
            {BK_STATUS_LABEL[b.status] || b.status}
          </div>
          
          <button 
            className="w-full py-2 bg-teal/10 text-teal border border-teal/20 rounded-lg text-xs font-bold hover:bg-teal hover:text-background transition-colors flex justify-center items-center gap-2 mt-2"
            onClick={(e) => { e.stopPropagation(); setSelectedBooking(b); }}
          >
            Buka Detail Booking
          </button>
          
          {b.status === 'pending' && (
            <>
              <Link 
                to={`/admin/surat/${b.id || b._key}`}
                onClick={(e) => e.stopPropagation()}
                className="w-full py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-xs font-bold transition-colors flex justify-center items-center gap-1.5 shadow-sm mt-1"
                title="Siapkan dan sesuaikan dokumen surat peminjaman alat (SPA) sebelum disetujui"
              >
                <FileText className="w-3.5 h-3.5 text-teal" /> Siapkan Surat (SPA)
              </Link>
              <button 
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex justify-center items-center gap-1.5 shadow-sm mt-1"
                onClick={(e) => { e.stopPropagation(); updateStatus(bKey, b.id || b.userName, 'approved'); }}
                title="Setujui permohonan peminjaman alat ini dan kirim surat langsung via WhatsApp"
              >
                <Check className="w-3.5 h-3.5" /> Setujui Booking
              </button>
              <button 
                className="w-full py-2 bg-destructive/10 hover:bg-destructive text-destructive hover:text-white border border-destructive/20 rounded-lg text-xs font-bold transition-colors flex justify-center items-center gap-1.5 shadow-sm mt-1"
                onClick={(e) => { e.stopPropagation(); updateStatus(bKey, b.id || b.userName, 'rejected'); }}
                title="Tolak booking ini"
              >
                <X className="w-3.5 h-3.5" /> Tolak Booking
              </button>
            </>
          )}

          {(b.status === 'approved' || b.status === 'letter_ready') && (
            <>
              <Link 
                to={`/admin/surat/${b.id || b._key}`}
                onClick={(e) => e.stopPropagation()}
                className="w-full py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-xs font-bold transition-colors flex justify-center items-center gap-1.5 shadow-sm mt-1"
                title="Buka atau unduh dokumen surat peminjaman alat (SPA)"
              >
                <FileText className="w-3.5 h-3.5 text-teal" /> Lihat Surat (SPA)
              </Link>
              <button 
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex justify-center items-center gap-1.5 shadow-sm mt-1"
                onClick={(e) => { e.stopPropagation(); updateStatus(bKey, b.id || b.userName, 'active'); }}
                title="Konfirmasi alat telah diambil oleh peminjam (otomatis ubah status alat ke Not Ready)"
              >
                <Check className="w-3.5 h-3.5" /> Sudah Diambil
              </button>
              <button 
                className="px-3 py-1.5 rounded-lg border border-amber-500 text-amber-700 dark:text-yellow-400 hover:bg-amber-500 hover:text-white text-xs font-bold transition-colors mt-1 w-full flex justify-center items-center gap-2"
                onClick={(e) => { e.stopPropagation(); handleSendReminder(b, 'pickup'); }}
                title="Kirim pengingat mengambil alat"
              >
                <AlertCircle className="w-3 h-3" /> Ingatkan Ambil
              </button>
            </>
          )}

          {(b.status === 'picked_up' || b.status === 'active') && (
            <>
              <button 
                className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-colors flex justify-center items-center gap-1.5 shadow-sm mt-1"
                onClick={(e) => { e.stopPropagation(); setSelectedBooking(b); }}
                title="Buka form pengembalian alat"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" /> Sudah Dikembalikan
              </button>
              <button 
                className="px-3 py-1.5 rounded-lg border border-amber-500 text-amber-700 dark:text-yellow-400 hover:bg-amber-500 hover:text-white text-xs font-bold transition-colors mt-1 w-full flex justify-center items-center gap-2"
                onClick={(e) => { e.stopPropagation(); handleSendReminder(b, 'return'); }}
                title="Kirim pengingat mengembalikan alat"
              >
                <AlertCircle className="w-3.5 h-3.5" /> Ingatkan Kembali
              </button>
            </>
          )}
          
          {directWaBtn}
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    const pendingCount = bookings.filter(b => b.status === 'pending').length;
    const waitingCount = bookings.filter(b => b.status === 'approved' || b.status === 'letter_ready').length;
    const activeBookings = bookings.filter(b => b.status === 'picked_up' || b.status === 'active');
    const activeBookingCount = activeBookings.length;
    const activeCount = activeBookings.reduce((acc, b) => {
      const bItems = Array.isArray(b.items) ? b.items : (b.items ? Object.values(b.items) : []);
      return acc + bItems.length;
    }, 0);
    const itemReadyCount = inventory.filter(i => !i.status || i.status === 'ready').length;
    const notReadyCount = inventory.filter(i => i.status && i.status !== 'ready').length;
    const itemMaintCount = inventory.filter(i => i.status === 'attention').length;
    const itemTotal = inventory.length;
    const totalFinished = bookings.filter(b => b.status === 'returned' || b.status === 'returned_late').length;

    // Only show new/actionable bookings on dashboard
    const recent = bookings.filter(b => !['returned', 'returned_late', 'rejected', 'expired'].includes(b.status)).slice(0, 5);

    return (
      <div className={`space-y-6 ${activePanel === 'dashboard' ? 'block' : 'hidden'}`}>
        {/* Stats Grid */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[110px] bg-card border border-border p-4 rounded-2xl shadow-sm text-center hover:border-yellow-500/50 transition-all group">
             <div className="text-3xl font-black text-yellow-400 group-hover:scale-110 transition-transform">{pendingCount}</div>
             <div className="text-[10px] font-mono text-foreground/50 mt-1.5 uppercase tracking-wider">Pending</div>
          </div>
          <div className="flex-1 min-w-[110px] bg-card border border-border p-4 rounded-2xl shadow-sm text-center hover:border-primary/50 transition-all group">
             <div className="text-3xl font-black text-primary group-hover:scale-110 transition-transform">{waitingCount}</div>
             <div className="text-[10px] font-mono text-foreground/50 mt-1.5 uppercase tracking-wider">Menunggu Ambil</div>
          </div>
          <div className="flex-1 min-w-[110px] bg-card border border-border p-4 rounded-2xl shadow-sm text-center hover:border-blue-500/50 transition-all group">
             <div className="text-3xl font-black text-blue-400 group-hover:scale-110 transition-transform">{activeCount}</div>
             <div className="text-[10px] font-mono text-foreground/50 mt-1.5 uppercase tracking-wider">Dipinjam</div>
          </div>
          <div className="flex-1 min-w-[110px] bg-card border border-border p-4 rounded-2xl shadow-sm text-center hover:border-green-500/50 transition-all group">
             <div className="text-3xl font-black text-green-400 group-hover:scale-110 transition-transform">{itemReadyCount}</div>
             <div className="text-[10px] font-mono text-foreground/50 mt-1.5 uppercase tracking-wider">Alat Ready</div>
          </div>
          <div className="flex-1 min-w-[110px] bg-card border border-border p-4 rounded-2xl shadow-sm text-center hover:border-destructive/50 transition-all group">
             <div className="text-3xl font-black text-destructive group-hover:scale-110 transition-transform">{notReadyCount}</div>
             <div className="text-[10px] font-mono text-foreground/50 mt-1.5 uppercase tracking-wider">Not Ready</div>
          </div>
          <div className="flex-1 min-w-[110px] bg-card border border-border p-4 rounded-2xl shadow-sm text-center hover:border-yellow-500/50 transition-all group">
             <div className="text-3xl font-black text-yellow-500 group-hover:scale-110 transition-transform">{itemMaintCount}</div>
             <div className="text-[10px] font-mono text-foreground/50 mt-1.5 uppercase tracking-wider">Maintenance</div>
          </div>
          <div className="flex-1 min-w-[110px] bg-card border border-border p-4 rounded-2xl shadow-sm text-center hover:border-teal/50 transition-all group">
             <div className="text-3xl font-black text-foreground group-hover:scale-110 transition-transform">{itemTotal}</div>
             <div className="text-[10px] font-mono text-foreground/50 mt-1.5 uppercase tracking-wider">Total Inventaris</div>
          </div>
          <div className="flex-1 min-w-[110px] bg-card border border-border p-4 rounded-2xl shadow-sm text-center hover:border-teal/50 transition-all group">
             <div className="text-3xl font-black text-foreground group-hover:scale-110 transition-transform">{bookings.length}</div>
             <div className="text-[10px] font-mono text-foreground/50 mt-1.5 uppercase tracking-wider">Total Riwayat</div>
          </div>
        </div>

        {/* Quick Status Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-green-500/5 border border-green-500/20 p-3 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-mono text-foreground/50">Selesai Kembali</div>
              <div className="font-bold text-green-400">{totalFinished} booking</div>
            </div>
          </div>
          <div className="bg-primary/5 border border-primary/20 p-3 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-mono text-foreground/50">Perlu Review</div>
              <div className="font-bold text-primary">{pendingCount} booking</div>
            </div>
          </div>
          <div className={`p-3 rounded-xl flex items-center gap-3 border ${maintenanceMode ? 'bg-destructive/5 border-destructive/20' : 'bg-card border-border'}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${maintenanceMode ? 'bg-destructive/20 text-destructive' : 'bg-muted text-foreground/50'}`}>
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-mono text-foreground/50">Maintenance Mode</div>
              <div className={`font-bold ${maintenanceMode ? 'text-destructive' : 'text-foreground/50'}`}>{maintenanceMode ? 'AKTIF' : 'TIDAK AKTIF'}</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border p-5 sm:p-6 rounded-2xl shadow-sm space-y-6">
            <h3 className="text-xl font-bold uppercase tracking-wide">Booking Terbaru</h3>
            <div className="space-y-4">
              {recent.length > 0 ? recent.map(b => <BookingCard key={b._key || b.id} b={b} />) : <div className="text-center p-8 text-foreground/50 font-mono text-sm border border-border border-dashed rounded-xl">🌟 Tidak ada booking yang perlu direview saat ini.</div>}
            </div>
        </div>
      </div>
    );
  };

  const renderBookings = () => {
    const filtered = bookings.filter(b => bookingFilter === 'all' ? true : b.status === bookingFilter);
    return (
      <div className={`space-y-6 ${activePanel === 'bookings' ? 'block' : 'hidden'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Manajemen Booking</h2>
            <button 
              onClick={() => setShowManualBookingModal(true)}
              className="px-3 py-1.5 bg-primary/10 text-primary font-bold rounded-lg text-xs hover:bg-primary/20 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Manual
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {['pending', 'rejected', 'expired', 'all'].map(f => (
              <button 
                key={f}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${bookingFilter === f ? 'bg-primary/10 text-primary border-primary/50' : 'bg-background text-foreground/70 border-border hover:bg-accent'}`}
                onClick={() => setBookingFilter(f)}
              >
                {f === 'pending' ? 'Menunggu Approval' : f === 'rejected' ? 'Ditolak' : f === 'expired' ? 'Kadaluarsa' : 'Semua'}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {filtered.length > 0 ? filtered.map(b => <BookingCard key={b._key || b.id} b={b} />) : <div className="text-center p-12 text-foreground/50 font-mono text-sm border border-border border-dashed rounded-xl">Tidak ada booking.</div>}
        </div>
      </div>
    );
  };

  const renderWaiting = () => {
    const filtered = bookings.filter(b => b.status === 'approved' || b.status === 'letter_ready');
    return (
      <div className={`space-y-6 ${activePanel === 'waiting' ? 'block' : 'hidden'}`}>
        <h2 className="text-2xl font-bold">Menunggu Pengambilan Alat</h2>
        <div className="space-y-4">
          {filtered.length > 0 ? filtered.map(b => <BookingCard key={b._key || b.id} b={b} showDeadline={true} />) : <div className="text-center p-12 text-foreground/50 font-mono text-sm border border-border border-dashed rounded-xl">Tidak ada booking yang menunggu diambil.</div>}
        </div>
      </div>
    );
  };

  const renderActive = () => {
    const filtered = bookings.filter(b => b.status === 'picked_up' || b.status === 'active');
    return (
      <div className={`space-y-6 ${activePanel === 'active' ? 'block' : 'hidden'}`}>
        <h2 className="text-2xl font-bold">Alat Sedang Dipinjam</h2>
        <div className="space-y-4">
          {filtered.length > 0 ? filtered.map(b => <BookingCard key={b.id} b={b} showDeadline={true} />) : <div className="text-center p-12 text-foreground/50 font-mono text-sm border border-border border-dashed rounded-xl">Tidak ada alat yang sedang dipinjam.</div>}
        </div>
      </div>
    );
  };

  const renderInventory = () => {
    const q = invSearch.trim().toLowerCase();
    const cats = sortCategories([...new Set(inventory.map(d => d.cat || 'Uncategorized'))]);
    let totalShown = 0;
    
    return (
      <div className={`space-y-8 ${activePanel === 'inventory' ? 'block' : 'hidden'}`}>
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-primary" /> Tambah Alat Baru</h3>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-[10px] font-mono text-foreground/50 uppercase mb-2">Kategori</label>
                <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary text-sm" placeholder="Mis. Camera, Audio..." value={newCat} onChange={(e) => setNewCat(e.target.value)} />
              </div>
              <div className="flex-1 w-full">
                <label className="block text-[10px] font-mono text-foreground/50 uppercase mb-2">Nama Alat</label>
                <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary text-sm" placeholder="Mis. Sony A7S III" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="flex-1 w-full">
                <label className="block text-[10px] font-mono text-foreground/50 uppercase mb-2">Keterangan</label>
                <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary text-sm" placeholder="Keterangan / Serial..." value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              </div>
              <div className="w-full md:w-24 shrink-0">
                <label className="block text-[10px] font-mono text-foreground/50 uppercase mb-2">Jumlah</label>
                <input type="number" className="w-full bg-background border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary text-sm" value={newQty} min="1" onChange={(e) => setNewQty(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-[10px] font-mono text-foreground/50 uppercase mb-2">Foto Alat (Opsional)</label>
                <input type="file" accept="image/*" className="w-full bg-background border border-border rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" onChange={(e) => setNewImgFile(e.target.files[0])} />
              </div>
              <button className="w-full md:w-auto px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleAddInventory} disabled={isUploading}>
                {isUploading ? "Mengunggah..." : "Tambahkan"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full flex-1">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input 
              className="w-full h-12 pl-12 pr-4 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm shadow-sm"
              placeholder="Cari nama alat... (mis. Sony, tripod, XLR)" 
              value={invSearch}
              onChange={(e) => setInvSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-none">
             <button onClick={() => setInvFilter('all')} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${invFilter === 'all' ? 'bg-foreground text-background shadow-md' : 'bg-background border border-border text-foreground/70 hover:bg-accent'}`}>Semua</button>
             <button onClick={() => setInvFilter('ready')} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${invFilter === 'ready' ? 'bg-green-500/20 text-green-500 border border-green-500/50' : 'bg-background border border-border text-foreground/70 hover:bg-accent'}`}>Ready</button>
             <button onClick={() => setInvFilter('attention')} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${invFilter === 'attention' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 'bg-background border border-border text-foreground/70 hover:bg-accent'}`}>Maintenance</button>
             <button onClick={() => setInvFilter('unavailable')} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${invFilter === 'unavailable' ? 'bg-destructive/20 text-destructive border border-destructive/50' : 'bg-background border border-border text-foreground/70 hover:bg-accent'}`}>Not Ready</button>
          </div>
        </div>

        <div>
          {cats.map((cat, ci) => {
            const items = inventory.filter(d => (d.cat || 'Uncategorized') === cat).filter(d => {
              const filterStatus = d.status || 'ready';
              const mf = invFilter === "all" || filterStatus === invFilter;
              const ms = !q || ((d.name || "") + " " + (d.group || "") + " " + (d.cat || "")).toLowerCase().includes(q);
              return mf && ms;
            }).sort((a, b) => (a.old_key || a.name || "").localeCompare(b.old_key || b.name || "", undefined, { numeric: true, sensitivity: 'base' }));
            
            if (items.length === 0) return null;
            totalShown += items.length;
            
            return (
              <div key={cat} className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl md:text-3xl font-display text-teal tracking-wider">{String(ci + 1).padStart(2, "0")}</span>
                  <span className="text-xl md:text-2xl font-display text-foreground tracking-widest uppercase">{cat}</span>
                  <div className="flex-1 h-px bg-teal/30 mx-2"></div>
                  <span className="text-[10px] md:text-xs font-mono text-foreground/50">{items.length} item</span>
                </div>
                
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 md:gap-5">
                  {items.map(it => {
                    const statusColor = it.status === 'ready' ? 'dot-glow-green' : it.status === 'attention' ? 'dot-glow-yellow' : 'dot-glow-red';
                    
                    return (
                    <div key={it.id || it.name} className="group relative flex flex-col bg-card rounded-xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-glow border border-border hover:border-teal/50">
                      <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button className="bg-blue-500 text-white rounded-md p-1.5 hover:bg-blue-600 shadow" onClick={() => setEditingInv({ ...it, keterangan: it.notes || it.keterangan || it.desc || "" })} title="Edit Alat">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="bg-destructive text-white rounded-md p-1.5 hover:bg-destructive/80 shadow" onClick={() => handleRemoveInventory(it.id || it.name, it.name)} title="Hapus Alat">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Thumbnail */}
                      <div className="h-[120px] md:h-[150px] relative overflow-hidden flex items-center justify-center p-4 bg-muted/20">
                        {it.img ? <img src={it.img} alt={it.name} className="w-full h-full object-contain drop-shadow-xl group-hover:scale-105 transition-transform duration-500" /> : <span className="text-4xl font-black text-foreground/10">?</span>}
                      </div>
                      
                      {/* Content */}
                      <div className="p-4 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-1">
                           <span className="text-[9px] md:text-[10px] font-mono text-foreground/50 uppercase tracking-widest">{it.group || cat}</span>
                           <span className="text-[10px] md:text-xs font-bold text-yellow-500">x{it.qty || 1}</span>
                        </div>
                        
                        <h3 className="font-bold text-sm md:text-[15px] leading-tight text-foreground mb-2">{it.name}</h3>
                          {(it.notes || it.keterangan || it.desc) ? (
                            <div className="text-[10px] text-yellow-600/90 dark:text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/20 leading-tight line-clamp-2 mb-3 mt-1" title={it.notes || it.keterangan || it.desc}>
                              <span className="font-bold mr-1">Kondisi:</span>{it.notes || it.keterangan || it.desc}
                            </div>
                          ) : (
                            <div className="mb-4"></div>
                          )}
                        
                        <div className="flex-1"></div>

                        {/* Status Toggle & Indicator */}
                        <button className="flex items-center gap-2 mt-auto w-full text-left" onClick={() => handleToggleInventoryStatus(it.id || it.name, it.status)} title="Klik untuk ubah status">
                           <div className={`w-2 h-2 rounded-full ${statusColor}`}></div>
                           <span className="text-[9px] md:text-[10px] font-bold tracking-widest uppercase text-foreground/70 hover:text-foreground transition-colors">{it.status === 'attention' ? 'Maintenance' : it.status === 'unavailable' ? 'Not Ready' : 'Ready'}</span>
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            );
          })}
          {totalShown === 0 && <div className="text-center p-12 text-foreground/50 font-mono text-sm border border-border border-dashed rounded-xl">Tidak ada alat yang cocok.</div>}
        </div>
      </div>
    );
  };

  const renderHistory = () => {
    const finishedBookings = bookings.filter(b => b.status === 'returned' || b.status === 'returned_late' || b.status === 'rejected' || b.status === 'expired')
      .sort((a, b) => new Date(b.dateEnd).getTime() - new Date(a.dateEnd).getTime());
      
    return (
      <div className={`space-y-6 ${activePanel === 'history' ? 'block' : 'hidden'}`}>
        <div className="flex justify-between items-center flex-wrap gap-4">
          <h2 className="text-2xl font-bold font-heading uppercase tracking-wider flex items-center gap-2">
            <History className="w-6 h-6 text-primary" /> Riwayat Inventaris
          </h2>
          <button 
            onClick={() => setShowManualBookingModal(true)}
            className="px-4 py-2 bg-primary/10 text-primary font-bold rounded-xl text-sm hover:bg-primary/20 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Tambah Manual
          </button>
        </div>
        <div className="space-y-4">
          {finishedBookings.length > 0 ? finishedBookings.map(b => (
            <div key={b.id || b._key} className={`bg-card border-l-4 p-5 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-accent/30 transition-colors ${
              b.status === 'returned_late' || b.status === 'rejected' || b.status === 'expired'
              ? 'border-l-destructive border-t-destructive/20 border-r-destructive/20 border-b-destructive/20' 
              : 'border-l-primary border-t-primary/20 border-r-primary/20 border-b-primary/20'}`}>
              <div>
                <div className="text-[10px] font-mono text-foreground/50 mb-1">{b.id || b._key}</div>
                <div className="font-bold text-lg mb-1 flex items-center flex-wrap gap-2">
                  {b.userName} <span className="text-foreground/50 font-normal text-sm font-mono">• {b.userDept || 'Personal'}</span>
                  {getOriginBadge(b)}
                </div>
                <div className="text-xs font-mono text-foreground/70 flex items-center flex-wrap gap-2">
                  <span>{fmtDate(b.dateStart)} – {fmtDate(b.dateEnd)}</span>
                  <span>•</span>
                  <span>{b.status === 'rejected' ? 'Ditolak' : b.status === 'expired' ? 'Kedaluwarsa' : (b.returnNote || "Selesai")}</span>
                  <span>•</span>
                  <span className="text-primary font-bold">{(b.items || []).length} alat</span>
                  {b.status === 'returned_late' && <span className="text-destructive font-bold ml-2">(Terlambat)</span>}
                  {b.status === 'rejected' && <span className="text-destructive font-bold ml-2">(Ditolak)</span>}
                  {b.status === 'expired' && <span className="text-destructive font-bold ml-2">(Kedaluwarsa)</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end mt-3 md:mt-0 shrink-0">
                <button 
                  onClick={() => setSelectedBooking(b)}
                  className="px-3 py-2 bg-secondary/10 text-secondary hover:bg-secondary hover:text-secondary-foreground rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                  title="Detail Booking"
                >
                  <Search className="w-3.5 h-3.5" /> Detail
                </button>
                <button 
                  onClick={() => navigate(`/surat/${b._key || b.id}`)} 
                  className="px-3 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/30 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                  title="Surat SPA"
                >
                  <Download className="w-3.5 h-3.5" /> SPA
                </button>
                <button 
                  onClick={() => deleteBooking(b._key || b.id, b.id)}
                  className="px-3 py-2 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                  title="Hapus Permanen"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus
                </button>
              </div>
            </div>
          )) : (
            <div className="text-center p-12 text-foreground/50 font-mono text-sm border border-border border-dashed rounded-xl">Belum ada riwayat peminjaman yang selesai.</div>
          )}
        </div>
      </div>
    );
  };

  const renderStats = () => {
    // Booking stats
    const statusGroups = [
      { label: 'Pending', count: bookings.filter(b => b.status === 'pending').length, color: '#eab308' },
      { label: 'Disetujui', count: bookings.filter(b => b.status === 'approved' || b.status === 'letter_ready').length, color: '#06b6d4' },
      { label: 'Dipinjam', count: bookings.filter(b => b.status === 'picked_up' || b.status === 'active').length, color: '#3b82f6' },
      { label: 'Selesai', count: bookings.filter(b => b.status === 'returned' || b.status === 'returned_late').length, color: '#22c55e' },
      { label: 'Ditolak/Exp', count: bookings.filter(b => b.status === 'rejected' || b.status === 'expired').length, color: '#ef4444' },
    ];
    const totalBookings = bookings.length;

    // Inventory stats
    const invReady = inventory.filter(i => !i.status || i.status === 'ready').length;
    const invAttn = inventory.filter(i => i.status === 'attention').length;
    const invUnavail = inventory.filter(i => i.status === 'unavailable').length;
    const invTotal = inventory.length;
    const invGroups = [
      { label: 'Ready', count: invReady, color: '#22c55e' },
      { label: 'Maintenance', count: invAttn, color: '#eab308' },
      { label: 'Not Ready', count: invUnavail, color: '#ef4444' },
    ];

    // Top borrowed items
    const itemCount = {};
    bookings.forEach(b => {
      const items = Array.isArray(b.items) ? b.items : Object.values(b.items || {});
      items.forEach(it => {
        const name = it.name || it;
        itemCount[name] = (itemCount[name] || 0) + 1;
      });
    });
    const topItems = Object.entries(itemCount).sort((a,b) => b[1]-a[1]).slice(0, 8);
    const maxCount = topItems.length > 0 ? topItems[0][1] : 1;

    // Donut chart SVG helper
    const DonutChart = ({ data, size = 140 }) => {
      const total = data.reduce((s, d) => s + d.count, 0) || 1;
      let cum = 0;
      const r = 50; const cx = 70; const cy = 70;
      const segments = data.map(d => {
        const pct = d.count / total;
        const start = cum;
        cum += pct;
        const startAngle = start * 2 * Math.PI - Math.PI / 2;
        const endAngle = cum * 2 * Math.PI - Math.PI / 2;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const large = pct > 0.5 ? 1 : 0;
        return { ...d, path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`, pct };
      });
      return (
        <svg width={size} height={size} viewBox="0 0 140 140">
          {segments.filter(s => s.count > 0).map((s, i) => (
            <path key={i} d={s.path} fill={s.color} opacity={0.85} />
          ))}
          <circle cx={cx} cy={cy} r={28} fill="var(--card)" />
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="12" fontWeight="bold" fill="var(--foreground)">{total}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="7" fill="var(--foreground)" opacity="0.5">TOTAL</text>
        </svg>
      );
    };

    return (
      <div className={`space-y-8 ${activePanel === 'stats' ? 'block' : 'hidden'}`}>
        <h2 className="text-2xl font-black font-heading uppercase tracking-tight">Statistik Sistem</h2>

        {/* Row 1: Two donuts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Booking Donut */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-sm uppercase tracking-wider text-foreground/60 mb-4">Status Booking</h3>
            <div className="flex items-center gap-6">
              <DonutChart data={statusGroups} />
              <div className="space-y-2 flex-1">
                {statusGroups.map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <span className="text-xs font-medium text-foreground/70">{s.label}</span>
                    </div>
                    <span className="text-xs font-black" style={{ color: s.color }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Inventory Donut */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-sm uppercase tracking-wider text-foreground/60 mb-4">Kondisi Inventaris ({invTotal} unit)</h3>
            <div className="flex items-center gap-6">
              <DonutChart data={invGroups} size={140} />
              <div className="space-y-2 flex-1">
                {invGroups.map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <span className="text-xs font-medium text-foreground/70">{s.label}</span>
                    </div>
                    <span className="text-xs font-black" style={{ color: s.color }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Top borrowed bar chart */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-sm uppercase tracking-wider text-foreground/60 mb-5">Alat Paling Sering Dipinjam</h3>
          {topItems.length === 0 ? (
            <p className="text-foreground/40 text-sm font-mono text-center py-6">Belum ada data peminjaman.</p>
          ) : (
            <div className="space-y-3">
              {topItems.map(([name, count], i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-foreground/40 w-4 text-right">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-foreground truncate pr-2">{name}</span>
                      <span className="text-xs font-black text-primary flex-shrink-0">{count}×</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(count/maxCount)*100}%`, background: `hsl(${175 - i*15}, 60%, 45%)` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Row 3: Summary table */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="font-bold text-sm uppercase tracking-wider text-foreground/60">Ringkasan Sistem</h3>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {[
                { label: 'Total Booking', value: totalBookings, color: 'text-foreground' },
                { label: 'Booking Selesai', value: bookings.filter(b=>b.status==='returned'||b.status==='returned_late').length, color: 'text-green-500' },
                { label: 'Booking Terlambat', value: bookings.filter(b=>b.status==='returned_late').length, color: 'text-destructive' },
                { label: 'Total Inventaris', value: invTotal, color: 'text-foreground' },
                { label: 'Alat Siap Pakai', value: invReady, color: 'text-green-500' },
                { label: 'Alat Perlu Perhatian', value: invAttn, color: 'text-yellow-500' },
                { label: 'Total Pengguna', value: usersList.length, color: 'text-foreground' },
                { label: 'Log Servis Aktif', value: serviceLogs.filter(l=>l.status?.includes('Sedang')).length, color: 'text-yellow-500' },
                { label: 'Total Log Aktivitas', value: activityLogs.length, color: 'text-foreground' },
              ].map((row, i) => (
                <tr key={row.label} className={`${i % 2 === 0 ? 'bg-muted/10' : ''} border-b border-border/50 last:border-0`}>
                  <td className="px-5 py-3 font-medium text-foreground/70 text-sm">{row.label}</td>
                  <td className={`px-5 py-3 font-black text-right ${row.color}`}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderServiceLog = () => {
    // Stats calculation
    const inRepairCount = serviceLogs.filter(log => log.status?.includes('Sedang')).length;
    const finishedCount = serviceLogs.filter(log => log.status?.includes('Selesai')).length;
    const canceledCount = serviceLogs.filter(log => log.status?.includes('Batal')).length;
    const totalCost = serviceLogs.reduce((acc, log) => acc + (Number(((log.description||'').match(/\[Biaya\]:\s*(.*?)(?:\s*\|\s*\[|$)/)||[])[1]?.replace(/[^0-9]/g,'')||0)||0), 0);

    // Format currency
    const formatRp = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);

    // Filtering & Searching
    let filtered = [...serviceLogs];
    if (serviceFilter !== 'semua') {
      if (serviceFilter === 'sedang') filtered = filtered.filter(l => l.status?.includes('Sedang'));
      else if (serviceFilter === 'selesai') filtered = filtered.filter(l => l.status?.includes('Selesai'));
      else if (serviceFilter === 'batal') filtered = filtered.filter(l => l.status?.includes('Batal'));
    }
    if (serviceSearch.trim()) {
      const qs = serviceSearch.toLowerCase();
      filtered = filtered.filter(l => 
        (l.item_name || '').toLowerCase().includes(qs) || 
        (l.reported_by || '').toLowerCase().includes(qs) || 
        (l.description || '').toLowerCase().includes(qs)
      );
    }

    return (
      <div className={`space-y-6 ${activePanel === 'service' ? 'block' : 'hidden'}`}>
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <h2 className="text-2xl font-black font-heading flex items-center gap-2 uppercase tracking-tight">
             <Wrench className="w-6 h-6 text-primary" /> Log Servis & Perbaikan Alat
           </h2>
           <button 
             className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 transition-all flex items-center gap-2 shadow-md hover:shadow-glow"
             onClick={() => {
               setEditingService(null);
               setServiceFormData({ namaAlat: '', alatId: '', dateIn: '', dateEst: '', status: 'Sedang Dikerjakan (In Repair)', cost: '', teknisi: '', keluhan: '', tindakan: '' });
               setShowServiceModal(true);
             }}
           >
             <Plus className="w-4 h-4" /> Tambah Log Manual
           </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
            <div className="text-[10px] font-mono text-foreground/60 uppercase tracking-wider mb-2 font-bold">Sedang Servis</div>
            <div className="text-3xl font-black text-amber-600 dark:text-yellow-400">{inRepairCount}</div>
          </div>
          <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500"></div>
            <div className="text-[10px] font-mono text-foreground/60 uppercase tracking-wider mb-2 font-bold">Selesai Servis</div>
            <div className="text-3xl font-black text-green-600 dark:text-green-400">{finishedCount}</div>
          </div>
          <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-primary"></div>
            <div className="text-[10px] font-mono text-foreground/60 uppercase tracking-wider mb-2 font-bold">Total Biaya Servis</div>
            <div className="text-3xl font-black text-primary">{formatRp(totalCost)}</div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col xl:flex-row gap-4 shadow-sm items-center">
          <div className="relative w-full xl:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <input 
              type="text" 
              placeholder="Cari nama alat / tempat servis / keluhan..." 
              value={serviceSearch}
              onChange={e => setServiceSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'semua', label: 'SEMUA', count: serviceLogs.length },
              { id: 'sedang', label: 'SEDANG SERVIS', count: inRepairCount },
              { id: 'selesai', label: 'SELESAI', count: finishedCount },
              { id: 'batal', label: 'BATAL', count: canceledCount },
            ].map(f => (
              <button 
                key={f.id}
                onClick={() => setServiceFilter(f.id)}
                className={`px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-2 border transition-colors whitespace-nowrap shrink-0 ${
                  serviceFilter === f.id 
                  ? 'bg-primary border-primary text-primary-foreground shadow-sm' 
                  : 'bg-background border-border text-foreground/70 hover:bg-muted'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${serviceFilter === f.id ? 'bg-primary-foreground' : 'bg-foreground/30'}`}></div>
                {f.label}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ml-0.5 ${serviceFilter === f.id ? 'bg-primary-foreground/20' : 'bg-foreground/10'}`}>{f.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Service Logs List */}
        <div className="space-y-4">
          {filtered.length > 0 ? filtered.map((log) => {
            const isFinished = log.status?.includes('Selesai');
            const isCancel = log.status?.includes('Batal');
            
            return (
              <div key={log.id} className="bg-card border border-border p-5 rounded-2xl flex flex-col xl:flex-row xl:items-start gap-5 shadow-sm hover:border-primary/30 transition-colors">
                <div className="flex-1 space-y-2.5">
                  <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-foreground/60 uppercase tracking-widest bg-muted px-2 py-0.5 rounded border border-border">MNT-{(log.id || "").substring(0, 8).toUpperCase()}</span>
                      <span className="text-[10px] font-mono text-foreground/50">Tgl: {fmtDate(log.timestamp)}</span>
                    </div>
                    {isFinished ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Selesai Servis
                      </span>
                    ) : isCancel ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-foreground/70 border border-border flex items-center gap-1">
                        <X className="w-3 h-3" /> Batal
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-800 dark:text-yellow-400 border border-amber-500/30 flex items-center gap-1">
                        <Wrench className="w-3 h-3" /> Sedang Dikerjakan
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                    <Wrench className="w-5 h-5 text-primary" /> {log.item_name || log.namaAlat}
                  </h3>
                  
                  <div className="text-xs text-foreground/80 flex flex-wrap gap-x-6 gap-y-2 mt-2 font-mono">
                    <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-foreground/50" /> Tanggal Masuk: {fmtDate(log.timestamp)}</div>
                    <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-foreground/50" /> Estimasi Selesai: {(() => { const m = (log.description||'').match(/\[Estimasi\]:\s*(.*?)(?:\s*\|\s*\[|$)/); return m && m[1] !== '-' ? fmtDate(m[1]) : '-'; })()}</div>
                    <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-foreground/50" /> Dilaporkan oleh: {log.reported_by || '-'}</div>
                  </div>
                  <div className="text-xs text-foreground/80 flex flex-wrap gap-x-6 gap-y-2 font-mono">
                    <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-foreground/50" /> Teknisi/Tempat: {(() => { const m = (log.description||'').match(/\[Teknisi\]:\s*(.*?)(?:\s*\|\s*\[|$)/); return m ? m[1].trim() : (log.reported_by || '-'); })()}</div>
                    <div className="flex items-center gap-1.5"><span className="text-foreground/50">Rp</span> Biaya: {(() => { const m = (log.description||'').match(/\[Biaya\]:\s*(.*?)(?:\s*\|\s*\[|$)/); return m && m[1] !== '-' ? 'Rp ' + Number(m[1].replace(/[^0-9]/g, '')).toLocaleString('id-ID') : '-'; })()}</div>
                  </div>
                  
                  <div className="mt-3 text-xs font-mono flex items-start gap-2 bg-muted/20 p-2.5 rounded-xl border border-border/50">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-foreground/60 mb-0.5 font-bold">Kerusakan/Keluhan: </span>
                      <span className="text-foreground">{(() => { const m = (log.description||'').match(/\[Keluhan\]:\s*(.*?)(?:\s*\|\s*\[|$)/); return m ? m[1].trim() : (log.description || '-'); })()}</span>
                    </div>
                  </div>
                  {((() => { const m = (log.description||"").match(/\[Tindakan\]:\s*(.*?)(?:\s*\|\s*\[|$)/); return m ? m[1].trim() : ""; })()) && (
                    <div className="mt-1 text-xs font-mono flex items-start gap-2 bg-muted/20 p-2.5 rounded-xl border border-border/50">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-foreground/60 mb-0.5 font-bold">Tindakan/Catatan: </span>
                        <span className="text-foreground">{(() => { const m = (log.description||"").match(/\[Tindakan\]:\s*(.*?)(?:\s*\|\s*\[|$)/); return m ? m[1].trim() : ""; })()}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-2 shrink-0 w-full xl:w-48 mt-4 xl:mt-0">
                  <button 
                    onClick={() => handleMarkServiceDone(log)}
                    disabled={isFinished || isCancel}
                    className={`px-4 py-2.5 border rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                      isFinished 
                      ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 cursor-not-allowed opacity-80'
                      : isCancel
                      ? 'bg-muted text-foreground/50 border-border cursor-not-allowed opacity-80'
                      : 'bg-green-600 hover:bg-green-700 text-white shadow-sm'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" /> {isFinished ? 'SUDAH SELESAI' : 'SELESAI SERVIS'}
                  </button>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEditService(log)}
                      className="flex-1 px-4 py-2.5 bg-background border border-border text-foreground hover:bg-muted rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit / Update
                    </button>
                    <button 
                      onClick={() => handleDeleteService(log.id, log.item_name || "Alat")} 
                      className="px-4 py-2.5 bg-destructive text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors hover:bg-destructive/90"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="text-center p-12 text-foreground/50 font-mono text-sm border border-border border-dashed rounded-xl">
              Belum ada entri log servis yang cocok.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAuditLog = () => {
    let filtered = activityLogs;
    if (auditFilter === 'service') {
      filtered = filtered.filter(l => (l.action || '').toLowerCase().includes('servis') || (l.action || '').toLowerCase().includes('perbaikan'));
    } else if (auditFilter === 'booking') {
      filtered = filtered.filter(l => (l.action || '').toLowerCase().includes('booking') || (l.action || '').toLowerCase().includes('status') || (l.action || '').toLowerCase().includes('pengingat') || (l.action || '').toLowerCase().includes('surat'));
    } else if (auditFilter === 'inventory') {
      filtered = filtered.filter(l => (l.action || '').toLowerCase().includes('alat') || (l.action || '').toLowerCase().includes('inventaris'));
    } else if (auditFilter === 'user') {
      filtered = filtered.filter(l => (l.action || '').toLowerCase().includes('pengguna') || (l.action || '').toLowerCase().includes('admin') || (l.action || '').toLowerCase().includes('role') || (l.action || '').toLowerCase().includes('logout'));
    }

    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase();
      filtered = filtered.filter(l => (l.action || '').toLowerCase().includes(q) || (l.email || '').toLowerCase().includes(q));
    }

    return (
      <div className={`space-y-6 ${activePanel === 'audit' ? 'block' : 'hidden'}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black font-heading flex items-center gap-2 uppercase tracking-tight text-foreground">
              <FileSearch className="w-6 h-6 text-primary" /> Audit Log Aktivitas Sistem
            </h2>
            <p className="text-xs font-mono text-foreground/60 mt-1">Rekam jejak seluruh tindakan admin, pembaruan status booking, inventaris, dan servis alat</p>
          </div>
          <span className="px-3.5 py-1.5 bg-card border border-border rounded-xl text-xs font-mono font-bold text-foreground/70 shadow-sm">
            Total: {filtered.length} Catatan
          </span>
        </div>

        {/* Search & Action Filters */}
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col xl:flex-row gap-4 shadow-sm items-center">
          <div className="relative w-full xl:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <input 
              type="text" 
              placeholder="Cari aktivitas atau email admin..." 
              value={auditSearch}
              onChange={e => setAuditSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'SEMUA LOG' },
              { id: 'service', label: 'LOG SERVIS' },
              { id: 'booking', label: 'BOOKING & SURAT' },
              { id: 'inventory', label: 'INVENTARIS' },
              { id: 'user', label: 'AKUN & PENGGUNA' }
            ].map(f => (
              <button 
                key={f.id}
                onClick={() => setAuditFilter(f.id)}
                className={`px-3.5 py-2 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${
                  auditFilter === f.id
                    ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                    : 'bg-background border border-border text-foreground/70 hover:bg-muted'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Audit Log Items */}
        <div className="space-y-2.5 w-full">
          {filtered.length > 0 ? filtered.map((log, i) => {
            const isServis = (log.action || '').toLowerCase().includes('servis');
            const isBooking = (log.action || '').toLowerCase().includes('booking') || (log.action || '').toLowerCase().includes('surat');
            const isDel = (log.action || '').toLowerCase().includes('hapus');

            return (
              <div className="p-4 bg-card border border-border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-primary/30 transition-colors shadow-sm" key={log.id || i}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${
                    isServis ? 'bg-amber-500/15 text-amber-700 dark:text-yellow-400 border border-amber-500/30' :
                    isDel ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30' :
                    isBooking ? 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-500/30' :
                    'bg-muted text-foreground/70 border border-border'
                  }`}>
                    {isServis ? <Wrench className="w-4 h-4" /> :
                     isDel ? <Trash2 className="w-4 h-4" /> :
                     isBooking ? <CalendarCheck className="w-4 h-4" /> :
                     <FileSearch className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{log.action || "Log sistem tidak terdefinisi"}</div>
                    <div className="text-[11px] font-mono text-foreground/50 mt-0.5">Pelaksana: <span className="text-foreground/70 font-bold">{log.email || 'Admin'}</span></div>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-foreground/60 shrink-0 self-start md:self-center bg-muted/40 px-2.5 py-1 rounded-md border border-border/50">
                  {log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' WIB' : '-'}
                </div>
              </div>
            );
          }) : (
            <div className="text-center p-12 text-foreground/50 font-mono text-sm border border-border border-dashed rounded-xl">
              Tidak ada riwayat aktivitas yang sesuai pencarian.
            </div>
          )}
        </div>
      </div>
    );
  };

  const fmtLoginTime = (val) => {
    if (!val) return "Belum pernah login";
    try {
      const dt = new Date(val);
      if (isNaN(dt.getTime())) return "-";
      return dt.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/\./g, ':') + " WIB";
    } catch {
      return "-";
    }
  };

  const handleRoleChange = async (uid, newRole) => {
    const isConfirmed = await confirm({
      title: "Ubah Role Pengguna",
      message: `Yakin ingin mengubah hak akses pengguna ini menjadi "${newRole}"?`,
      confirmText: "Ubah Role",
      cancelText: "Batal",
      type: "warning"
    });
    if (!isConfirmed) return;
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', uid);
      if (error) throw error;
      setUsersList(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
      logActivity(`Mengubah role pengguna ${uid} menjadi ${newRole}`, currentUser?.email);
      toast.success(`Hak akses pengguna berhasil diubah menjadi "${newRole}".`, "Role Diperbarui");
    } catch (e) {
      toast.error("Gagal mengubah role: " + e.message, "Gagal Memperbarui");
    }
  };

  const handleStatusChange = async (uid, currentStatus) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    const isConfirmed = await confirm({
      title: newStatus === 'suspended' ? "Tangguhkan (Suspend) Akun" : "Aktifkan Akun Pengguna",
      message: `Yakin ingin mengubah status pengguna ini menjadi "${newStatus}"? Pengguna suspended tidak dapat mengajukan booking.`,
      confirmText: newStatus === 'suspended' ? "Suspend Akun" : "Aktifkan Akun",
      cancelText: "Batal",
      type: newStatus === 'suspended' ? "danger" : "primary"
    });
    if (!isConfirmed) return;
    try {
      // Persist to config table for reliability
      const { data: cfgRow } = await supabase.from('config').select('value').eq('key', 'userStatusMap').maybeSingle();
      const currentMap = cfgRow?.value || {};
      const nextMap = { ...currentMap, [uid]: newStatus };
      await supabase.from('config').upsert({ key: 'userStatusMap', value: nextMap }, { onConflict: 'key' });

      setUsersList(prev => prev.map(u => u.uid === uid ? { ...u, status: newStatus } : u));
      logActivity(`Mengubah status pengguna ${uid} menjadi ${newStatus}`, currentUser?.email);
      toast.success(`Status akun pengguna berhasil diubah menjadi "${newStatus}".`, "Status Akun Diperbarui");
    } catch (e) {
      toast.error("Gagal mengubah status: " + e.message, "Gagal Memperbarui");
    }
  };

  const renderUsers = () => (
    <div className={`space-y-6 ${activePanel === 'admin-manage' ? 'block' : 'hidden'}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Kelola Pengguna</h2>
          <p className="text-sm text-foreground/60">Atur hak akses admin, status peminjam, dan pantau riwayat login terakhir program.</p>
        </div>
      </div>
      
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-muted/30">
                <th className="p-4 font-mono text-xs text-foreground/50 uppercase tracking-wider font-semibold border-b border-border">Pengguna & Program</th>
                <th className="p-4 font-mono text-xs text-foreground/50 uppercase tracking-wider font-semibold border-b border-border">Peran</th>
                <th className="p-4 font-mono text-xs text-foreground/50 uppercase tracking-wider font-semibold border-b border-border">Status</th>
                <th className="p-4 font-mono text-xs text-foreground/50 uppercase tracking-wider font-semibold border-b border-border text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usersList.length === 0 ? (
                <tr><td colSpan="4" className="text-center p-8 text-foreground/50 font-mono text-sm">Belum ada data pengguna yang login.</td></tr>
              ) : (
                usersList.map(u => (
                  <tr key={u.uid} className="hover:bg-accent/30 transition-colors">
                    <td className="p-4">
                      <p className="text-sm font-bold text-foreground">{u.name}</p>
                      <p className="text-xs text-foreground/60 font-mono mt-0.5">{u.email}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-foreground/40 font-mono">Login:</span>
                        <span className={`text-[11px] font-mono ${u.lastLogin ? 'text-primary font-semibold' : 'text-foreground/30'}`}>
                          {fmtLoginTime(u.lastLogin)}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                        u.role === 'admin' ? 'bg-primary/20 text-primary border-primary/50' : 'bg-muted text-foreground/60 border-border'
                      }`}>
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                        u.status === 'suspended' ? 'bg-destructive/20 text-destructive border-destructive/50' : 'bg-green-500/20 text-green-500 border-green-500/50'
                      }`}>
                        {u.status === 'suspended' ? 'Suspended' : 'Aktif'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-center">
                        <button 
                          onClick={() => handleRoleChange(u.uid, u.role === 'admin' ? 'user' : 'admin')}
                          className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-bold hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          Jadikan {u.role === 'admin' ? 'User' : 'Admin'}
                        </button>
                        <button 
                          onClick={() => handleStatusChange(u.uid, u.status)}
                          className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors ${
                            u.status === 'suspended' 
                            ? 'bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500 hover:text-white'
                            : 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground'
                          }`}
                        >
                          {u.status === 'suspended' ? 'Buka Suspend' : 'Suspend'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Hitung Badge
  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const waitingCount = bookings.filter(b => b.status === 'approved' || b.status === 'letter_ready').length;
  const activeBookings = bookings.filter(b => b.status === 'picked_up' || b.status === 'active');
  const activeBookingCount = activeBookings.length;

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <span className="font-mono text-sm text-foreground/50">Memverifikasi Akses...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <div className="flex justify-end p-6">
          <button onClick={() => {
            const nextTheme = theme === 'light' ? 'dark' : 'light';
            setTheme(nextTheme);
            applyTheme(nextTheme);
          }} className="p-2 text-foreground/70 hover:text-foreground hover:bg-accent rounded-lg transition-colors">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-8 animate-in fade-in zoom-in-95">
            <div className="flex flex-col items-center mb-8">
              <img src="/logo.png" alt="Dakwah TV" className="h-12 mb-6 drop-shadow-md" />
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-[10px] font-mono font-bold uppercase">
                <div className="w-2 h-2 rounded-full dot-glow-red"></div>
                Secure Area
              </div>
              <h1 className="text-3xl font-black text-center m-0 uppercase tracking-tighter">DAKWAH TV <span className="text-primary">ADMIN</span></h1>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-mono text-foreground/50 uppercase tracking-wider mb-2">Email Admin</label>
                <input name="email" type="email" required placeholder="admin@dakwahtv.com" className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-mono text-foreground/50 uppercase tracking-wider mb-2">Password</label>
                <input name="password" type="password" required placeholder="••••••••" className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
              </div>
              
              {authError && (
                <div className="bg-destructive/10 text-destructive border border-destructive/20 p-3 rounded-lg text-xs font-mono text-center">
                  {authError}
                </div>
              )}

              <button type="submit" className="w-full py-3.5 bg-primary text-primary-foreground font-black rounded-xl hover:bg-primary/90 transition-all flex justify-center items-center gap-2">
                <Shield className="w-4 h-4" /> LOGIN KE DASHBOARD
              </button>
            </form>
            
            <div className="text-center mt-8">
              <Link to="/" className="text-foreground/50 hover:text-foreground text-xs font-mono transition-colors">&larr; Kembali ke Home</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary selection:text-primary-foreground font-sans">
      {/* Mobile/Tablet Rounded Navbar */}
      <div className="xl:hidden sticky top-4 z-40 px-4 mb-4">
        <ShinyButton className="w-full !p-3">
          {/* Left: Hamburger */}
          <button onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(true); }} className="p-2 text-white/70 hover:text-white relative z-10 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          
          {/* Center: Logo (Absolutely Centered) */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 cursor-pointer z-10 hover:scale-105 transition-transform" onClick={(e) => { e.stopPropagation(); navigate('/'); }}>
             <img src="/logo.png" className="h-6 object-contain drop-shadow-md brightness-0 invert" alt="Logo" />
          </div>
          
          {/* Right: Actions */}
          <div className="flex items-center gap-1 relative z-10">
            <button onClick={(e) => {
              e.stopPropagation();
              const nextTheme = theme === 'light' ? 'dark' : 'light';
              setTheme(nextTheme);
              applyTheme(nextTheme);
            }} className="p-2 text-white/70 hover:text-white transition-colors">
               {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
               <LogOut className="w-4 h-4" />
            </button>
          </div>
        </ShinyButton>
      </div>

      {/* Desktop Header */}
      <header className="hidden xl:flex bg-card border-b border-border py-4 px-8 items-center justify-between gap-4 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <img src="/logo.png" className="h-10 drop-shadow-sm cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/')} alt="Logo" />
          <div>
             <div className="text-[10px] font-mono text-primary font-bold uppercase tracking-wider flex items-center gap-1.5"><div className="w-2 h-2 rounded-full dot-glow-primary"></div> Admin Dashboard</div>
             <h1 className="font-heading font-black text-xl leading-none uppercase tracking-tight">DAKWAH TV <span className="text-primary">ADMIN</span></h1>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/katalog" className="px-3 py-1.5 bg-secondary/10 text-secondary hover:bg-secondary hover:text-secondary-foreground border border-secondary/20 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5">
             <Calendar className="w-3.5 h-3.5" /> Katalog Publik
          </Link>
          <button className="px-3 py-1.5 bg-background text-foreground hover:bg-accent border border-border rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5" onClick={handleExportLaporan}>
            <Download className="w-3.5 h-3.5" /> Export Laporan
          </button>
          <button className="px-3 py-1.5 bg-background text-foreground hover:bg-accent border border-border rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5" onClick={() => setShowAnnounceModal(true)}>
            <Megaphone className="w-3.5 h-3.5" /> Pengumuman
          </button>
          <button className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${maintenanceMode ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-background text-foreground hover:bg-accent border-border'}`} onClick={handleToggleMaintenance}>
            <Settings className="w-3.5 h-3.5" /> Maintenance: {maintenanceMode ? 'ON' : 'OFF'}
          </button>
          <button className="px-3 py-1.5 bg-background text-foreground hover:bg-accent border border-border rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5" onClick={() => setShowWaModal(true)}>
            <Phone className="w-3.5 h-3.5" /> Nomor WA
          </button>
          <button className="px-3 py-1.5 bg-background text-foreground hover:bg-accent border border-border rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5" onClick={() => setShowWaTemplateModal(true)}>
            <Edit className="w-3.5 h-3.5" /> Template WA
          </button>
          <button className="px-3 py-1.5 bg-background text-foreground hover:bg-accent border border-border rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5" onClick={() => setShowGotenbergModal(true)}>
            <FileText className="w-3.5 h-3.5 text-teal" /> Gotenberg PDF
          </button>
          
          <div className="h-6 w-px bg-border mx-1"></div>
          
          <button onClick={() => {
            const nextTheme = theme === 'light' ? 'dark' : 'light';
            setTheme(nextTheme);
            applyTheme(nextTheme);
          }} className="p-2 text-foreground/70 hover:text-foreground hover:bg-accent rounded-lg transition-colors">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={handleLogout} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Keluar">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-col xl:flex-row flex-1 p-4 md:p-8 gap-8 relative">
        
        {/* Nav Tabs - Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-background border-r border-border p-5 transform transition-transform duration-300 ease-in-out overflow-y-auto shadow-2xl
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          xl:relative xl:translate-x-0 xl:w-64 xl:bg-transparent xl:border-none xl:p-0 xl:shadow-none xl:overflow-visible xl:block xl:z-0
        `}>
          {/* Mobile Sidebar Header */}
          <div className="flex justify-between items-center xl:hidden mb-6">
            <h2 className="font-heading font-black text-xl uppercase tracking-wider">Menu Admin</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 bg-muted rounded-full text-foreground/70 hover:text-foreground">
              <X className="w-5 h-5"/>
            </button>
          </div>

          <div className="flex flex-col gap-1.5 xl:bg-card xl:border xl:border-border xl:p-3 xl:rounded-2xl xl:shadow-sm">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'bookings', label: 'Booking', count: pendingCount, highlight: true, icon: CalendarCheck },
            { id: 'waiting', label: 'Disetujui', count: waitingCount, icon: CheckSquare },
            { id: 'active', label: 'Dipinjam', count: activeBookingCount, icon: Camera },
            { id: 'inventory', label: 'Inventaris', icon: PackageSearch },
            { id: 'admin-manage', label: 'Kelola Pengguna', icon: Users },
            { id: 'service', label: 'Log Servis', icon: Wrench },
            { id: 'audit', label: 'Audit Log', icon: FileSearch },
            { id: 'stats', label: 'Statistik', icon: BarChart2 },
            { id: 'history', label: 'Riwayat', icon: History },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activePanel === tab.id;
            return (
              <button 
                key={tab.id}
                onClick={() => setActivePanel(tab.id)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap shrink-0 group ${
                  isActive 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-primary-foreground' : 'text-foreground/50 group-hover:text-foreground/80'}`} />
                  <span>{tab.label}</span>
                </div>
                {tab.count > 0 && (
                   <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                     isActive 
                     ? (tab.highlight ? 'bg-white text-primary' : 'bg-white/20 text-white') 
                     : (tab.highlight ? 'bg-yellow-500 text-yellow-900' : 'bg-muted-foreground/20 text-foreground')
                   }`}>
                     {tab.count}
                   </span>
                )}
              </button>
            )
          })}
          </div>

          {/* Mobile Admin Tools (Visible only in sidebar on mobile) */}
          <div className="xl:hidden mt-8 flex flex-col gap-2 border-t border-border pt-6">
            <h3 className="text-[10px] font-mono font-bold text-foreground/50 mb-2 uppercase tracking-wider px-2">Alat Admin</h3>
            <Link to="/katalog" className="px-4 py-3 bg-secondary/10 text-secondary hover:bg-secondary hover:text-secondary-foreground rounded-xl text-sm font-bold flex items-center gap-3">
               <Calendar className="w-4 h-4" /> Katalog Publik
            </Link>
            <button className="px-4 py-3 bg-muted/50 text-foreground hover:bg-accent rounded-xl text-sm font-bold flex items-center gap-3 text-left transition-colors" onClick={handleExportLaporan}>
              <Download className="w-4 h-4" /> Export Laporan
            </button>
            <button className="px-4 py-3 bg-muted/50 text-foreground hover:bg-accent rounded-xl text-sm font-bold flex items-center gap-3 text-left transition-colors" onClick={() => setShowAnnounceModal(true)}>
              <Megaphone className="w-4 h-4" /> Pengumuman
            </button>
            <button className={`px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 text-left transition-colors ${maintenanceMode ? 'bg-destructive/10 text-destructive border border-destructive/30' : 'bg-muted/50 text-foreground hover:bg-accent'}`} onClick={handleToggleMaintenance}>
              <Settings className="w-4 h-4" /> Maint: {maintenanceMode ? 'ON' : 'OFF'}
            </button>
            <button className="px-4 py-3 bg-muted/50 text-foreground hover:bg-accent rounded-xl text-sm font-bold flex items-center gap-3 text-left transition-colors" onClick={() => setShowWaModal(true)}>
              <Phone className="w-4 h-4" /> Nomor WA
            </button>
            <button className="px-4 py-3 bg-muted/50 text-foreground hover:bg-accent rounded-xl text-sm font-bold flex items-center gap-3 text-left transition-colors" onClick={() => setShowWaTemplateModal(true)}>
              <Edit className="w-4 h-4" /> Template WA
            </button>
            <button className="px-4 py-3 bg-muted/50 text-foreground hover:bg-accent rounded-xl text-sm font-bold flex items-center gap-3 text-left transition-colors" onClick={() => setShowGotenbergModal(true)}>
              <FileText className="w-4 h-4 text-teal" /> Gotenberg PDF
            </button>
          </div>
        </div>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 xl:hidden" onClick={() => setIsSidebarOpen(false)}></div>
        )}

        {/* Panel Content */}
        <div className="flex-1 min-w-0 pb-20">
          {renderDashboard()}
          {renderBookings()}
          {renderWaiting()}
          {renderActive()}
          {renderInventory()}
          {renderUsers()}
          {renderServiceLog()}
          {renderAuditLog()}
          {renderStats()}
          {renderHistory()}
        </div>
      </div>

      {/* Modals */}

      {editingInv && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto" onClick={() => setEditingInv(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 my-8" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleSaveEditInventory}>
              <div className="flex justify-between items-center p-6 border-b border-border">
                <h3 className="font-bold text-xl">Edit Alat: {editingInv.name}</h3>
                <button type="button" className="text-foreground/50 hover:text-foreground" onClick={() => setEditingInv(null)}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-mono text-foreground/50 uppercase mb-2">Nama Alat</label>
                  <input type="text" required value={editingInv.name} onChange={e => setEditingInv({...editingInv, name: e.target.value})} className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary text-sm font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-mono text-foreground/50 uppercase mb-2">Kategori</label>
                  <input type="text" required value={editingInv.cat} onChange={e => setEditingInv({...editingInv, cat: e.target.value})} className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-mono text-foreground/50 uppercase mb-2">Keterangan / Kondisi Alat</label>
                  <textarea value={editingInv.keterangan !== undefined ? editingInv.keterangan : (editingInv.notes || editingInv.desc || "")} onChange={e => setEditingInv({...editingInv, keterangan: e.target.value})} className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary text-sm min-h-[100px]" placeholder="Mis. Lensa baret, kabel longgar, tas rusak..." />
                </div>
              </div>
              <div className="p-6 border-t border-border bg-muted/20 flex gap-3 justify-end rounded-b-2xl">
                <button type="button" onClick={() => setEditingInv(null)} className="px-6 py-2.5 font-bold text-sm text-foreground/70 hover:text-foreground transition-colors">Batal</button>
                <button type="submit" className="px-6 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl text-sm transition-colors shadow-lg">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showServiceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowServiceModal(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 my-8 overflow-hidden" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleSaveService}>
              <div className="p-6 md:p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-black text-foreground flex items-center gap-3 uppercase tracking-tight">
                    <Wrench className="w-6 h-6 text-primary" />
                    {editingService ? 'EDIT LOG SERVIS ALAT' : 'TAMBAH LOG SERVIS ALAT MANUAL'}
                  </h2>
                  <p className="text-foreground/60 font-mono mt-1 text-xs">Pencatatan riwayat perbaikan & biaya servis fisik alat</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-foreground/70 uppercase mb-1.5 font-bold">Pilih Dari Inventaris (Opsional)</label>
                    <select 
                      value={serviceFormData.alatId} 
                      onChange={e => {
                        const selectedId = e.target.value;
                        const found = inventory.find(i => i.id === selectedId);
                        setServiceFormData({
                          ...serviceFormData,
                          alatId: selectedId,
                          namaAlat: found ? found.name : serviceFormData.namaAlat
                        });
                      }} 
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-mono text-sm mb-3"
                    >
                      <option value="">-- Pilih dari daftar alat inventaris --</option>
                      {inventory.map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.cat || 'Alat'}) - Status: {i.status}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-foreground/70 uppercase mb-1.5 font-bold">Nama Alat Fisik <span className="text-destructive">*</span></label>
                    <input 
                      type="text" 
                      required
                      value={serviceFormData.namaAlat} 
                      onChange={e => setServiceFormData({...serviceFormData, namaAlat: e.target.value})} 
                      placeholder="Ketik nama alat (mis: Panasonic AG-AC160)" 
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-mono text-sm" 
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-foreground/70 uppercase mb-1.5 font-bold">Tanggal Masuk Servis <span className="text-destructive">*</span></label>
                      <input 
                        type="date" 
                        required
                        value={serviceFormData.dateIn} 
                        onChange={e => setServiceFormData({...serviceFormData, dateIn: e.target.value})} 
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-mono text-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-foreground/70 uppercase mb-1.5 font-bold">Estimasi / Tgl Selesai</label>
                      <input 
                        type="date" 
                        value={serviceFormData.dateEst} 
                        onChange={e => setServiceFormData({...serviceFormData, dateEst: e.target.value})} 
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-mono text-sm" 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-foreground/70 uppercase mb-1.5 font-bold">Status Servis</label>
                      <select 
                        value={serviceFormData.status} 
                        onChange={e => setServiceFormData({...serviceFormData, status: e.target.value})} 
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-mono text-sm"
                      >
                        <option value="Sedang Dikerjakan (In Repair)">Sedang Dikerjakan (In Repair)</option>
                        <option value="Selesai">Selesai</option>
                        <option value="Batal">Batal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-foreground/70 uppercase mb-1.5 font-bold">Biaya Servis (Rp)</label>
                      <input 
                        type="text" 
                        placeholder="cth: 75000" 
                        value={serviceFormData.cost} 
                        onChange={e => setServiceFormData({...serviceFormData, cost: e.target.value})} 
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-mono text-sm" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-foreground/70 uppercase mb-1.5 font-bold">Tempat / Teknisi Servis</label>
                    <input 
                      type="text" 
                      placeholder="cth: Mas Khoiron / Sony Service Center Surabaya" 
                      value={serviceFormData.teknisi} 
                      onChange={e => setServiceFormData({...serviceFormData, teknisi: e.target.value})} 
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-mono text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-foreground/70 uppercase mb-1.5 font-bold">Keluhan / Kerusakan Fisik</label>
                    <textarea 
                      rows="3" 
                      placeholder="cth: Lensa jamuran & tombol record macet" 
                      value={serviceFormData.keluhan} 
                      onChange={e => setServiceFormData({...serviceFormData, keluhan: e.target.value})} 
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-mono text-sm resize-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-foreground/70 uppercase mb-1.5 font-bold">Tindakan / Sparepart Diganti / Catatan</label>
                    <textarea 
                      rows="3" 
                      placeholder="cth: Ganti pita fleksibel & pembersihan optik" 
                      value={serviceFormData.tindakan} 
                      onChange={e => setServiceFormData({...serviceFormData, tindakan: e.target.value})} 
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-mono text-sm resize-none" 
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 md:p-8 bg-muted/20 border-t border-border flex justify-end gap-3">
                <button type="button" onClick={() => setShowServiceModal(false)} className="px-6 py-3 bg-background border border-border text-foreground/80 hover:bg-muted font-bold rounded-xl text-sm transition-colors">
                  Batal
                </button>
                <button type="submit" className="px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-sm transition-colors shadow-lg shadow-primary/20">
                  Simpan Log Servis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAnnounceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAnnounceModal(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-6">Pengumuman System</h3>
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input type="checkbox" checked={announceEnabled} onChange={e => setAnnounceEnabled(e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
              <span className="font-bold text-sm">Tampilkan Pengumuman di Aplikasi</span>
            </label>
            <textarea 
              value={announceText} 
              onChange={e => setAnnounceText(e.target.value)} 
              placeholder="Ketik teks pengumuman..." 
              className="w-full h-32 p-4 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none mb-6"
            />
            <div className="flex gap-3 justify-end">
              <button className="px-5 py-2.5 font-bold text-sm text-foreground/70 hover:text-foreground transition-colors" onClick={() => setShowAnnounceModal(false)}>Batal</button>
              <button className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 transition-colors" onClick={saveAnnouncement}>Simpan Pengumuman</button>
            </div>
          </div>
        </div>
      )}

      {showWaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowWaModal(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-6">Nomor WhatsApp Admin</h3>
            <div className="space-y-2 mb-6 max-h-[40vh] overflow-y-auto pr-2 scrollbar-none">
              {waNumbers.map((num, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-background border border-border rounded-xl">
                  <span className="font-mono text-sm">{num}</span>
                  <button onClick={() => {
                    const newNums = [...waNumbers];
                    newNums.splice(i, 1);
                    setWaNumbers(newNums);
                  }} className="text-destructive/50 hover:text-destructive transition-colors"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
              {waNumbers.length === 0 && <p className="text-sm text-foreground/50 text-center py-4 border border-dashed border-border rounded-xl">Belum ada nomor WA</p>}
            </div>
            
            <div className="flex gap-2 mb-6">
              <input type="text" value={newWaNumber} onChange={e => setNewWaNumber(e.target.value)} placeholder="08123456789" className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-2 text-sm focus:border-primary outline-none" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newWaNumber) { setWaNumbers([...waNumbers, newWaNumber]); setNewWaNumber(''); } } }} />
              <button onClick={() => { if (newWaNumber) { setWaNumbers([...waNumbers, newWaNumber]); setNewWaNumber(''); } }} className="px-4 py-2 bg-primary/10 text-primary font-bold rounded-xl text-sm hover:bg-primary hover:text-primary-foreground transition-colors"><Plus className="w-5 h-5"/></button>
            </div>
            
            <div className="flex gap-3 justify-end pt-4 border-t border-border">
              <button className="px-5 py-2.5 font-bold text-sm text-foreground/70 hover:text-foreground transition-colors" onClick={() => setShowWaModal(false)}>Batal</button>
              <button className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 transition-colors" onClick={saveWaNumbers}>Simpan Perubahan</button>
            </div>
          </div>
        </div>
      )}

      {showGotenbergModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowGotenbergModal(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-teal/10 text-teal flex items-center justify-center font-bold">
                <FileText className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold">Server Gotenberg (Konversi PDF)</h3>
            </div>
            
            <p className="text-xs text-foreground/70 mb-4 leading-relaxed">
              Microservice API untuk konversi template dokumen (.docx) ke format PDF secara headless.
            </p>

            <div className="p-3 bg-muted/40 border border-border rounded-xl text-xs space-y-1.5 mb-4">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${gotenbergUrl ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                Status: {gotenbergUrl ? 'Custom Server Aktif' : 'Engine Native Vector JS (Default Aktif)'}
              </div>
              <p className="text-foreground/60 text-[11px] leading-normal">
                Jika dikosongkan, sistem menggunakan engine bawaan client-side yang sangat ringan (~30 KB) dan cepat tanpa dependensi server tambahan.
              </p>
            </div>

            <div className="space-y-1.5 mb-6">
              <label className="text-xs font-bold text-foreground/70 uppercase tracking-wider block">Gotenberg Endpoint URL</label>
              <input 
                type="text" 
                value={gotenbergUrl} 
                onChange={e => setGotenbergUrl(e.target.value)} 
                placeholder="cth: https://gotenberg.dakwahtv.id atau http://localhost:3000" 
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:border-teal outline-none font-mono" 
              />
            </div>
            
            <div className="flex gap-3 justify-end pt-4 border-t border-border">
              <button className="px-5 py-2.5 font-bold text-sm text-foreground/70 hover:text-foreground transition-colors" onClick={() => setShowGotenbergModal(false)}>Batal</button>
              <button className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 transition-colors" onClick={saveGotenbergUrl}>Simpan Konfigurasi</button>
            </div>
          </div>
        </div>
      )}

      {showWaTemplateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowWaTemplateModal(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
              <h3 className="font-bold">Template Pesan WhatsApp</h3>
              <button onClick={() => setShowWaTemplateModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              
              <div className="bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 p-4 rounded-xl text-sm mb-4">
                <p className="font-bold mb-1">Panduan Variabel (Gunakan kurung kurawal):</p>
                <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-xs">
                  <div>{'{nama}'} = Nama Peminjam</div>
                  <div>{'{id}'} = ID Booking</div>
                  <div>{'{program}'} = Nama Program</div>
                  <div>{'{tgl_pinjam}'} = Tgl Pinjam</div>
                  <div>{'{tgl_kembali}'} = Tgl Kembali</div>
                  <div>{'{link_surat}'} = Link SPA</div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground/50 uppercase tracking-wider mb-2 block">Pesan untuk Admin (Booking Baru Masuk)</label>
                <textarea 
                  value={waTemplates.adminNewBooking}
                  onChange={e => setWaTemplates({...waTemplates, adminNewBooking: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl p-3 text-sm focus:border-primary outline-none h-32 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground/50 uppercase tracking-wider mb-2 block">Pesan untuk Mahasiswa (Booking Diterima / Menunggu)</label>
                <textarea 
                  value={waTemplates.userPending}
                  onChange={e => setWaTemplates({...waTemplates, userPending: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl p-3 text-sm focus:border-primary outline-none h-24 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground/50 uppercase tracking-wider mb-2 block">Pesan untuk Mahasiswa (Booking Disetujui)</label>
                <textarea 
                  value={waTemplates.userApproved}
                  onChange={e => setWaTemplates({...waTemplates, userApproved: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl p-3 text-sm focus:border-primary outline-none h-32 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground/50 uppercase tracking-wider mb-2 block">Pesan untuk Mahasiswa (Booking Ditolak)</label>
                <textarea 
                  value={waTemplates.userRejected}
                  onChange={e => setWaTemplates({...waTemplates, userRejected: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl p-3 text-sm focus:border-primary outline-none h-24 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground/50 uppercase tracking-wider mb-2 block">Pesan untuk Mahasiswa (Pengembalian Selesai)</label>
                <textarea 
                  value={waTemplates.userReturned}
                  onChange={e => setWaTemplates({...waTemplates, userReturned: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl p-3 text-sm focus:border-primary outline-none h-24 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground/50 uppercase tracking-wider mb-2 block">Pengingat (Ambil Alat)</label>
                <textarea 
                  value={waTemplates.reminderPickup}
                  onChange={e => setWaTemplates({...waTemplates, reminderPickup: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl p-3 text-sm focus:border-primary outline-none h-24 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground/50 uppercase tracking-wider mb-2 block">Pengingat (Kembalikan Alat)</label>
                <textarea 
                  value={waTemplates.reminderReturn}
                  onChange={e => setWaTemplates({...waTemplates, reminderReturn: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl p-3 text-sm focus:border-primary outline-none h-24 resize-none"
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-border flex justify-between items-center bg-muted/20">
              <button 
                type="button"
                onClick={async () => {
                  const isConfirmed = await confirm({
                    title: "Reset Template WhatsApp",
                    message: "Kembalikan semua template pesan WhatsApp ke format default bawaan sistem?",
                    confirmText: "Ya, Reset",
                    cancelText: "Batal",
                    type: "warning"
                  });
                  if (isConfirmed) {
                    setWaTemplates(DEFAULT_WA_TEMPLATES);
                    toast.info("Template WhatsApp telah dikembalikan ke pengaturan awal.");
                  }
                }}
                className="px-4 py-2 text-xs font-mono font-bold text-muted-foreground hover:text-foreground border border-border hover:bg-background rounded-xl transition-colors"
              >
                Reset ke Default
              </button>
              <div className="flex gap-3">
                <button onClick={() => setShowWaTemplateModal(false)} className="px-5 py-2.5 text-sm font-bold hover:bg-white/5 rounded-xl transition-colors">Batal</button>
                <button 
                  onClick={async () => {
                    try {
                      const { error } = await supabase.from('config').update({ value: waTemplates }).eq('key', 'waTemplates');
                      if (error) throw error;
                      toast.success('Template WhatsApp berhasil disimpan!', 'Pengaturan Disimpan');
                      setShowWaTemplateModal(false);
                    } catch(e) { toast.error("Gagal menyimpan: " + e.message, "Gagal Menyimpan"); }
                  }} 
                  className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4"/> Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {selectedBooking && (
        <BookingDetailModal 
          booking={selectedBooking} 
          onClose={() => setSelectedBooking(null)} 
          onApprove={(b) => { updateStatus(b._key || b.id, b.id || b.userName, 'approved'); setSelectedBooking(null); }}
          onReject={(b) => { updateStatus(b._key || b.id, b.id || b.userName, 'rejected'); setSelectedBooking(null); }}
          onGenerateLetter={(b) => { navigate(`/surat/${b._key || b.id}`); setSelectedBooking(null); }}
          onMarkLetterReady={(b) => { updateStatus(b._key || b.id, b.id || b.userName, 'letter_ready'); setSelectedBooking(null); }}
          onMarkPickedUp={(b) => { updateStatus(b._key || b.id, b.id || b.userName, 'active'); setSelectedBooking(null); }}
          onMarkReturned={(b, status, conditions, note, proofUrl) => { updateStatus(b._key || b.id, b.id || b.userName, status, conditions, note, proofUrl); setSelectedBooking(null); }}
        />
      )}

      <ManualBookingModal 
        isOpen={showManualBookingModal}
        onClose={() => setShowManualBookingModal(false)}
        inventory={inventory}
        currentUser={currentUser}
      />
    </div>
  );
}
