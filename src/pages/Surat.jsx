import { normalizeBooking, fmtDate } from '../utils/normalize';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Download, 
  Info, 
  AlertTriangle, 
  LogIn, 
  FileText, 
  Calendar, 
  User, 
  Tv, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  RefreshCw, 
  Package, 
  Film,
  ExternalLink,
  Cloud,
  FileCheck,
  Server,
  X
} from 'lucide-react';
import AuthModal from '../components/AuthModal';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { 
  generateSpaPdf, 
  convertDocxViaGotenberg, 
  uploadSpaPdfToR2, 
  renderAndUploadSpaPdfDirect,
  downloadBlob,
  preloadSpaImages 
} from '../utils/spaPdf';
import { sendWhatsAppMessage, DEFAULT_WA_TEMPLATES, sanitizeWaTemplate } from '../utils/whatsapp';

const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function formatDateToIndonesian(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
}

const SURAT_REGULER_PROGRAMS = ["FTV","Muslim Kampus","Musik Kita","Showtime","Life Motion","Streetfood"];
const SURAT_NEWS_PROGRAMS = ["Campus Report"];

export default function Surat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoParam = searchParams.get('auto') === '1' || searchParams.get('download') === '1';
  const formatParam = searchParams.get('format') || 'pdf';
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');

  const [programType, setProgramType] = useState("reguler"); // 'reguler', 'news', 'other'
  const [formData, setFormData] = useState({
    programName: "",
    episode: "",
    produser: "",
    tglProduksi: ""
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isUploadingR2, setIsUploadingR2] = useState(false);
  const [r2PdfUrl, setR2PdfUrl] = useState('');
  const [gotenbergUrl, setGotenbergUrl] = useState('');
  const [showGotenbergModal, setShowGotenbergModal] = useState(false);
  const [gotenbergInputUrl, setGotenbergInputUrl] = useState('');
  const [gotenbergTestStatus, setGotenbergTestStatus] = useState(null);
  const [isTestingGotenberg, setIsTestingGotenberg] = useState(false);
  const [conversionStage, setConversionStage] = useState('');
  const [generationNotice, setGenerationNotice] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const [generationError, setGenerationError] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadedFileName, setDownloadedFileName] = useState('');
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);
  const [showEditDetails, setShowEditDetails] = useState(!autoParam);
  const [showGuide, setShowGuide] = useState(false);
  const [allBookings, setAllBookings] = useState([]);

  const autoTriggerTimeoutRef = useRef(null);

  const initForm = (data) => {
    const deptL = (data.userDept || data.dept || "").toLowerCase();
    const isNews = deptL.includes("campus report") || deptL.includes("news");
    setProgramType(isNews ? "news" : "reguler");
    
    setFormData({
      programName: data.suratProgramName || data.userDept || data.dept || "",
      episode: data.suratEpisode || "",
      produser: data.suratProduser || data.userName || data.name || "",
      tglProduksi: data.suratTglProduksi || data.dateStart || data.tglMulai || ""
    });

    if (data.doc_url && (data.doc_url.includes('.pdf') || data.doc_url.includes('spa-pdfs') || data.doc_url.includes('r2.dev') || data.doc_url.includes('dakwahtv.my.id'))) {
      let u = data.doc_url;
      if (u.includes('.r2.dev')) {
        u = u.replace(/https:\/\/[^/]+\.r2\.dev/, 'https://spa.dakwahtv.my.id');
      }
      setR2PdfUrl(u);
    }
  };

  const fetchBooking = async () => {
    try {
      if (id) {
        // 1. Try direct ID lookup in bookings table
        const { data: dataArr } = await supabase.from('bookings').select('*, booking_items(inventory(*))').eq('id', id);
        if (dataArr && dataArr.length > 0) {
          const bObj = normalizeBooking(dataArr[0]);
          setBooking(bObj);
          initForm(bObj);
          setLoading(false);
          return;
        }

        // 2. Query config table for suratBookings (publicly accessible cache)
        const { data: cfgSurat } = await supabase.from('config').select('value').eq('key', 'suratBookings').maybeSingle();
        if (cfgSurat?.value && typeof cfgSurat.value === 'object') {
          const list = Object.values(cfgSurat.value).map(normalizeBooking).filter(Boolean);
          list.sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));
          setAllBookings(list);

          const found = cfgSurat.value[id] || list.find(b => b.id === id || b._key === id);
          if (found) {
            const bObj = normalizeBooking(found);
            setBooking(bObj);
            initForm(bObj);
            setLoading(false);
            return;
          }
        }

        // 3. Check config table for publicAvailability as a smart fallback
        const { data: cfgAvail } = await supabase.from('config').select('value').eq('key', 'publicAvailability').maybeSingle();
        if (cfgAvail?.value && typeof cfgAvail.value === 'object') {
          const matchedEntries = [];
          Object.entries(cfgAvail.value).forEach(([itemId, arr]) => {
            if (Array.isArray(arr)) {
              arr.forEach(entry => {
                if (entry.bookingId === id) {
                  matchedEntries.push({ ...entry, itemId });
                }
              });
            }
          });

          if (matchedEntries.length > 0) {
            const first = matchedEntries[0];
            const reconstructed = {
              id: id,
              _key: id,
              userName: first.userName,
              user_name: first.userName,
              userDept: first.dept,
              dept: first.dept,
              dateStart: first.dateStart,
              date_start: first.dateStart,
              dateEnd: first.dateEnd,
              date_end: first.dateEnd,
              status: first.status,
              items: matchedEntries.map(m => ({ name: m.itemName || m.itemId, status: 'ready' }))
            };
            const bObj = normalizeBooking(reconstructed);
            setBooking(bObj);
            initForm(bObj);
            setLoading(false);
            return;
          }
        }
      }

      // 4. Query all bookings if direct lookup fails or if no ID specified (works if logged in or admin)
      const { data: allData } = await supabase.from('bookings').select('*, booking_items(inventory(*))');
      if (allData && allData.length > 0) {
        const list = allData.map(normalizeBooking).filter(Boolean);
        list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        setAllBookings(prev => {
          const map = new Map();
          [...list, ...prev].forEach(item => { if (item.id) map.set(item.id, item); });
          return Array.from(map.values());
        });

        if (id) {
          const found = list.find(b => b.id === id || b._key === id);
          if (found) {
            setBooking(found);
            initForm(found);
          }
        }
      }
    } catch (e) {
      console.error("Error fetching booking for Surat:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    const checkRole = async (user) => {
      if (user) {
        try {
          const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
          if (data?.role === 'admin') setIsAdmin(true);
        } catch (e) {
          console.warn("Could not check role:", e);
        }
      } else {
        setIsAdmin(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user || null);
      checkRole(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
      checkRole(session?.user || null);
      if (session?.user) {
        setLoading(true);
        fetchBooking();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchBooking();
  }, [id]);

  useEffect(() => {
    preloadSpaImages();
    supabase.from('config').select('value').eq('key', 'gotenbergUrl').maybeSingle().then(({ data }) => {
      if (data?.value) setGotenbergUrl(String(data.value).trim());
    }).catch(() => {});
  }, []);

  // Automatic download trigger when accessed from WhatsApp link (?auto=1)
  useEffect(() => {
    if (booking && autoParam && !hasAutoTriggered && !isGenerating && !isGeneratingPdf && !downloadSuccess) {
      setHasAutoTriggered(true);
      autoTriggerTimeoutRef.current = setTimeout(() => {
        if (formatParam === 'docx') {
          handleGenerateDocx(true);
        } else {
          handleGeneratePdf(true);
        }
      }, 750);
    }
    return () => {
      if (autoTriggerTimeoutRef.current) clearTimeout(autoTriggerTimeoutRef.current);
    };
  }, [booking, autoParam, hasAutoTriggered, formatParam]);

  const handleSelectBooking = (selectedB) => {
    setBooking(selectedB);
    initForm(selectedB);
    setDownloadSuccess(false);
  };

  const buildItemsData = () => {
    const itemsData = [];
    const rawItems = booking?.items;
    const sourceItems = Array.isArray(rawItems)
      ? rawItems
      : rawItems && typeof rawItems === 'object'
      ? Object.values(rawItems)
      : [];

    for (let i = 0; i < sourceItems.length; i += 2) {
      const item1 = sourceItems[i];
      const item2 = sourceItems[i + 1];

      const name1 = item1?.name || item1?.item_name || item1?.nama || (typeof item1 === 'string' ? item1 : '') || '';
      const qty1 = item1?.qty || item1?.quantity || 1;

      const name2 = item2 ? (item2?.name || item2?.item_name || item2?.nama || (typeof item2 === 'string' ? item2 : '') || '') : '';
      const qty2 = item2 ? (item2?.qty || item2?.quantity || 1) : '';

      itemsData.push({
        no1: i + 1,
        nama_alat1: name1,
        qty1: qty1,
        no2: item2 ? i + 2 : "",
        nama_alat2: name2,
        qty2: qty2
      });
    }
    return itemsData;
  };

  const getBaseFileName = () => {
    const bDept = booking?.userDept || booking?.dept || "Program";
    const bStart = booking?.dateStart || booking?.tglMulai || booking?.start || "";
    const spaProgram = (formData.programName || bDept || "Program").replace(/[\\/:*?"<>|]/g, '').trim();
    const spaEpisode = (formData.episode || "").replace(/[\\/:*?"<>|]/g, '').trim();
    const spaTgl = formData.tglProduksi ? formatDateToIndonesian(formData.tglProduksi) : (bStart ? formatDateToIndonesian(bStart) : "");
    return `SPA Produksi ${spaProgram}${spaEpisode ? ' ' + spaEpisode : ''} ${spaTgl}`.trim();
  };

  const handleTestGotenberg = async (urlToTest) => {
    const target = (urlToTest || gotenbergInputUrl || gotenbergUrl || '').trim().replace(/\/+$/, '');
    if (!target) {
      setGotenbergTestStatus({ success: false, message: 'Harap masukkan URL Gotenberg.' });
      return;
    }
    setIsTestingGotenberg(true);
    setGotenbergTestStatus(null);
    try {
      const res = await fetch(`${target}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      if (data.status === 'up') {
        setGotenbergTestStatus({ 
          success: true, 
          message: `Koneksi berhasil! Status LibreOffice: ${data.details?.libreoffice?.status || 'up'}` 
        });
      } else {
        setGotenbergTestStatus({ success: false, message: `Status Gotenberg: ${JSON.stringify(data)}` });
      }
    } catch (err) {
      setGotenbergTestStatus({ 
        success: false, 
        message: `Gagal terhubung (${err.message}). Pastikan server aktif dan mengizinkan CORS.` 
      });
    } finally {
      setIsTestingGotenberg(false);
    }
  };

  const handleSaveGotenberg = async () => {
    const trimmed = gotenbergInputUrl.trim();
    try {
      await supabase.from('config').upsert({ key: 'gotenbergUrl', value: trimmed }, { onConflict: 'key' });
      setGotenbergUrl(trimmed);
      setShowGotenbergModal(false);
    } catch (err) {
      console.error("Gagal simpan URL Gotenberg:", err);
    }
  };

  const renderOfficialDocxBlob = async () => {
    const templateName = programType === 'news' ? 'template_news.docx' : 'template_reguler.docx';
    const templatePath = `/surat-assets/${templateName}`;
    const tplRes = await fetch(templatePath);
    if (!tplRes.ok) {
      throw new Error(`Template Word (${templateName}) tidak ditemukan di server.`);
    }
    const tplBlob = await tplRes.blob();
    const zip = new PizZip(await tplBlob.arrayBuffer());
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    const bNama = booking.userName || booking.name || booking.nama || "-";
    const bNim = booking.userNim || booking.nim || "-";
    const bDept = booking.userDept || booking.dept || "-";
    const bHp = booking.userPhone || booking.phone || booking.hp || "-";
    const bStart = booking.dateStart || booking.tglMulai || booking.start || "";
    const bEnd = booking.dateEnd || booking.tglSelesai || booking.end || "";
    const tglProdFmt = formData.tglProduksi ? formatDateToIndonesian(formData.tglProduksi) : (bStart ? formatDateToIndonesian(bStart) : "-");
    const tglPinjamFmt = bStart ? formatDateToIndonesian(bStart) : "-";

    doc.render({
      id: booking.id || booking._key || id || "",
      program: formData.programName || bDept || "-",
      episode: formData.episode || "-",
      produser: formData.produser || bNama || "-",
      tgl_produksi: tglProdFmt,
      tgl_peminjaman: tglPinjamFmt,
      tgl_mulai: tglPinjamFmt,
      tgl_selesai: bEnd ? formatDateToIndonesian(bEnd) : "-",
      tgl_surat: formatDateToIndonesian(new Date()),
      tanggal: formatDateToIndonesian(new Date()),
      peminjam: bNama,
      nama: bNama,
      nim: bNim,
      dept: bDept,
      hp: bHp,
      tujuan: booking.purpose || booking.keperluan || "-",
      items: buildItemsData()
    });

    return doc.getZip().generate({ 
      type: "blob", 
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
    });
  };

  const handleGeneratePdf = async (isAuto = false, forceVector = false) => {
    if (!booking) return;
    setIsGeneratingPdf(true);
    setGenerationError('');
    setGenerationNotice(null);
    setConversionStage('1/2 Menyiapkan berkas Word (.docx) dari template resmi...');

    try {
      const baseName = getBaseFileName();
      const pdfFileName = `${baseName}.pdf`;
      const docxFileName = `${baseName}.docx`;

      // 1. STEP 1: Always generate the official Word template first using Docxtemplater
      const renderedDocxBlob = await renderOfficialDocxBlob();

      let pdfBlob = null;

      // 2. STEP 2: Convert the rendered DOCX to PDF
      if (!forceVector && gotenbergUrl) {
        setConversionStage('2/2 Mengonversikan DOCX ke PDF via server Gotenberg...');
        try {
          pdfBlob = await convertDocxViaGotenberg(renderedDocxBlob, gotenbergUrl);
        } catch (gotErr) {
          console.warn("Gotenberg conversion failed:", gotErr);
          // Download DOCX immediately so user is never stranded
          downloadBlob(renderedDocxBlob, docxFileName);
          setDownloadSuccess(true);
          setDownloadedFileName(docxFileName);
          setGenerationNotice({
            type: 'gotenberg_error',
            message: `Server Gotenberg (${gotenbergUrl}) gagal merespons: ${gotErr.message}. Dokumen Word (.docx) resmi telah diunduh otomatis ke perangkat Anda.`
          });
          return;
        }
      } else if (forceVector) {
        setConversionStage('2/2 Membuat PDF via engine vektor visual...');
        pdfBlob = await generateSpaPdf({ booking, formData, programType });
      } else {
        // Gotenberg URL not configured!
        // Download the official rendered DOCX automatically and guide the user.
        downloadBlob(renderedDocxBlob, docxFileName);
        setDownloadSuccess(true);
        setDownloadedFileName(docxFileName);
        setGenerationNotice({
          type: 'gotenberg_unconfigured',
          message: 'Server konversi Gotenberg belum dihubungkan. Dokumen Word (.docx) resmi telah diunduh secara otomatis. Hubungkan Gotenberg untuk konversi PDF 100% presisi langsung dari template Word.'
        });
        return;
      }

      // 3. STEP 3: Trigger PDF download & R2 sync
      downloadBlob(pdfBlob, pdfFileName);
      setDownloadSuccess(true);
      setDownloadedFileName(pdfFileName);

      setIsUploadingR2(true);
      try {
        const r2Url = await uploadSpaPdfToR2(pdfBlob, pdfFileName);
        if (r2Url) {
          setR2PdfUrl(r2Url);
          const bId = booking.id || booking._key;
          if (bId) {
            await supabase.from('bookings').update({ doc_url: r2Url }).eq('id', bId);
            const { data: cfgSurat } = await supabase.from('config').select('value').eq('key', 'suratBookings').maybeSingle();
            if (cfgSurat?.value && typeof cfgSurat.value === 'object') {
              const updated = { ...cfgSurat.value };
              if (updated[bId]) {
                updated[bId].doc_url = r2Url;
                updated[bId].pdf_url = r2Url;
                await supabase.from('config').upsert({ key: 'suratBookings', value: updated }, { onConflict: 'key' });
              }
            }
          }
        }
      } catch (r2Err) {
        console.warn("Background upload to R2 notice:", r2Err);
      } finally {
        setIsUploadingR2(false);
      }

    } catch (err) {
      console.error("PDF Generation error:", err);
      setGenerationError(err.message || "Gagal memproses dokumen surat.");
    } finally {
      setIsGeneratingPdf(false);
      setConversionStage('');
    }
  };

  const handleGenerateDocx = async (isAuto = false) => {
    if (!booking) return;
    setIsGenerating(true);
    setGenerationError('');
    
    try {
      const renderedDocxBlob = await renderOfficialDocxBlob();
      const baseName = getBaseFileName();
      const fullFileName = `${baseName}.docx`;
      downloadBlob(renderedDocxBlob, fullFileName);

      setDownloadSuccess(true);
      setDownloadedFileName(fullFileName);
    } catch (err) {
      console.error(err);
      setGenerationError(err.message || "Terjadi kesalahan saat membuat dokumen Word.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAdminApprove = async () => {
    if (!booking) return;
    const bId = booking.id || booking._key;
    const isConfirmed = window.confirm(`Setujui booking #${bId} dan kirim surat PDF resmi ke WhatsApp peminjam?`);
    if (!isConfirmed) return;

    setIsApproving(true);
    setConversionStage("Mengonversi berkas surat PDF ke R2...");

    try {
      let finalPdfUrl = r2PdfUrl;
      const effectiveGotenberg = gotenbergUrl || 'https://gotenberg.dakwahtv.my.id';

      // Ensure PDF is generated and uploaded to Cloudflare R2
      if (!finalPdfUrl || !finalPdfUrl.includes('.pdf')) {
        finalPdfUrl = await renderAndUploadSpaPdfDirect({
          booking,
          gotenbergUrl: effectiveGotenberg,
          formDataOverride: formData
        });
        if (finalPdfUrl) {
          setR2PdfUrl(finalPdfUrl);
        }
      }

      // Update Supabase bookings table
      const updatePayload = {
        status: 'approved',
        updated_at: new Date().toISOString()
      };
      if (finalPdfUrl) updatePayload.doc_url = finalPdfUrl;
      if (formData.programName) updatePayload.suratProgramName = formData.programName;
      if (formData.episode) updatePayload.suratEpisode = formData.episode;
      if (formData.produser) updatePayload.suratProduser = formData.produser;
      if (formData.tglProduksi) updatePayload.suratTglProduksi = formData.tglProduksi;

      const { error } = await supabase.from('bookings').update(updatePayload).eq('id', bId);
      if (error) throw error;

      // Update config/suratBookings cache
      try {
        const { data: cfgSurat } = await supabase.from('config').select('value').eq('key', 'suratBookings').maybeSingle();
        if (cfgSurat?.value && typeof cfgSurat.value === 'object') {
          const updated = { ...cfgSurat.value };
          if (updated[bId]) {
            updated[bId].status = 'approved';
            if (finalPdfUrl) {
              updated[bId].doc_url = finalPdfUrl;
              updated[bId].pdf_url = finalPdfUrl;
            }
            await supabase.from('config').upsert({ key: 'suratBookings', value: updated }, { onConflict: 'key' });
          }
        }
      } catch (cErr) {
        console.warn("Update cache warning:", cErr);
      }

      // Update local booking state
      setBooking(prev => ({
        ...prev,
        status: 'approved',
        doc_url: finalPdfUrl || prev?.doc_url
      }));

      // Send WhatsApp Notification with official letter link
      const targetPhone = (booking.userPhone || booking.phone || "").replace(/[^0-9]/g, '');
      if (targetPhone) {
        try {
          const { data: cfgWa } = await supabase.from('config').select('value').eq('key', 'waTemplates').maybeSingle();
          const tpls = (cfgWa?.value && typeof cfgWa.value === 'object') ? cfgWa.value : DEFAULT_WA_TEMPLATES;
          const cleanTpl = sanitizeWaTemplate(tpls.userApproved, 'userApproved');
          const fmtDMY = (dStr) => dStr ? dStr.split('-').reverse().join('-') : "";
          let msg = cleanTpl;
          msg = msg.replace(/\{nama\}/g, booking.userName || booking.name || "");
          msg = msg.replace(/\{id\}/g, bId || "");
          msg = msg.replace(/\{program\}/g, formData.programName || booking.userDept || booking.dept || "-");
          msg = msg.replace(/\{tgl_pinjam\}/g, fmtDMY(booking.dateStart));
          msg = msg.replace(/\{tgl_kembali\}/g, fmtDMY(booking.dateEnd));
          msg = msg.replace(/\{link_surat\}/g, finalPdfUrl || `https://dakwahtvequipment.pages.dev/surat/${bId}?auto=1&format=pdf`);

          await sendWhatsAppMessage(targetPhone, msg);
        } catch (waErr) {
          console.warn("WA notification failed:", waErr);
        }
      }

      alert("Booking berhasil disetujui! Surat PDF telah terbit di R2 dan terkirim otomatis ke WhatsApp peminjam.");
    } catch (err) {
      console.error("handleAdminApprove error:", err);
      alert("Gagal menyetujui booking: " + err.message);
    } finally {
      setIsApproving(false);
      setConversionStage('');
    }
  };

  const getSourceItems = () => {
    if (!booking) return [];
    const rawItems = booking.items;
    return Array.isArray(rawItems)
      ? rawItems
      : rawItems && typeof rawItems === 'object'
      ? Object.values(rawItems)
      : [];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-mono text-foreground/50">Memuat data booking...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-lg w-full shadow-xl">
          <h3 className="font-bold text-xl mb-2 text-foreground">
            {id ? 'Booking Tidak Ditemukan' : 'Pilih Booking untuk Buat Surat'}
          </h3>
          <p className="text-sm text-foreground/60 mb-6">
            {id 
              ? `Data booking dengan ID "${id}" tidak ditemukan di sistem publik atau sesi login Anda telah berakhir.`
              : 'Pilih salah satu riwayat peminjaman di bawah ini untuk membuat Surat Peminjaman Alat (SPA):'}
          </p>
          
          {allBookings.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto mb-6 pr-1 text-left">
              {allBookings.map(b => (
                <button
                  key={b._key || b.id}
                  onClick={() => handleSelectBooking(b)}
                  className="w-full p-3 rounded-xl border border-border hover:border-teal/50 hover:bg-teal/5 transition-all text-left flex justify-between items-center group"
                >
                  <div>
                    <div className="font-bold text-sm text-foreground">{b.userName || b.name || "Peminjam"}</div>
                    <div className="text-xs text-foreground/50 font-mono">{b.userDept || b.dept || "-"} • {formatDateToIndonesian(b.dateStart)}</div>
                  </div>
                  <span className="text-xs font-bold text-teal opacity-0 group-hover:opacity-100 transition-opacity">Pilih &rarr;</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-6 p-4 rounded-xl bg-muted/40 border border-border text-sm text-foreground/70">
              <p className="mb-3">
                {currentUser 
                  ? 'Belum ada data booking aktif yang tersedia untuk dibuatkan surat.'
                  : 'Jika Anda peminjam, silakan login dengan akun Anda agar dapat mengakses dan membuat surat.'}
              </p>
              {!currentUser && (
                <button
                  onClick={() => setIsAuthOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal text-background font-bold rounded-xl hover:bg-teal-light transition-all text-xs"
                >
                  <LogIn className="w-4 h-4" /> Login Akun Peminjam
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <button onClick={() => navigate(-1)} className="px-5 py-2.5 bg-muted hover:bg-muted/80 rounded-xl text-sm font-bold transition-colors">
              &larr; Kembali
            </button>
            <Link to="/dashboard" className="px-5 py-2.5 bg-background border border-border hover:bg-accent rounded-xl text-sm font-bold transition-colors">
              Ke Dashboard
            </Link>
          </div>
        </div>

        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          mode={authMode}
          setMode={setAuthMode}
          onSubmit={async (e) => {
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
                const { error } = await supabase.auth.signUp({
                  email,
                  password,
                  options: { data: { name } }
                });
                if (error) throw error;
              }
              setIsAuthOpen(false);
              fetchBooking();
            } catch (err) {
              setAuthError(err.message || 'Login gagal');
            }
          }}
          errorMsg={authError}
        />
      </div>
    );
  }

  const attachedItems = getSourceItems();
  const totalItemUnits = attachedItems.reduce((acc, it) => acc + (Number(it?.qty || it?.quantity || 1) || 1), 0);

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground">
      
      {/* Top Navigation Bar */}
      <div className="flex justify-between items-center p-4 lg:px-8 border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 border border-border hover:bg-muted rounded-xl transition-colors flex items-center gap-2 text-sm font-bold text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Kembali</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base sm:text-lg font-bold uppercase tracking-wider">
                Surat Peminjaman Alat
              </h2>
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded text-[11px] font-mono font-bold flex items-center gap-1">
                PDF Resmi (R2)
              </span>
              <span className="bg-teal/10 border border-teal/20 text-teal px-2 py-0.5 rounded text-[11px] font-mono font-bold">
                .docx
              </span>
            </div>
            <p className="text-[11px] text-foreground/50 hidden sm:block">Dakwah TV Equipment Management</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setGotenbergInputUrl(gotenbergUrl || '');
              setGotenbergTestStatus(null);
              setShowGotenbergModal(true);
            }}
            className="px-2.5 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Konfigurasi Server Konversi Gotenberg"
          >
            <span className={`w-2 h-2 rounded-full ${gotenbergUrl ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
            <span className="hidden md:inline">Gotenberg:</span>
            <span className={gotenbergUrl ? 'text-emerald-500' : 'text-amber-500'}>
              {gotenbergUrl ? 'Aktif' : 'Belum Diatur'}
            </span>
          </button>
          <div className="bg-muted border border-border px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold text-foreground/80">
            ID: <span className="text-teal">{booking.id || booking._key}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-4 lg:p-8 flex justify-center items-start">
        <div className="w-full max-w-3xl space-y-6">

          {/* Progress Banner */}
          {(isGenerating || isGeneratingPdf) && (
            <div className="p-4 rounded-2xl bg-teal/10 border border-teal/30 text-teal flex items-center gap-3 animate-pulse shadow-md">
              <div className="w-5 h-5 border-2 border-teal border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
              <div className="text-sm">
                <div className="font-bold">
                  {conversionStage || (formatParam === 'docx' ? 'Menyiapkan berkas Word (.docx)...' : 'Menyiapkan Surat Peminjaman Alat...')}
                </div>
                <div className="text-xs text-foreground/70">
                  {gotenbergUrl
                    ? 'Merender template Word resmi lalu mengonversikan via Gotenberg (100% presisi)...'
                    : 'Membuat dokumen resmi Dakwah TV...'}
                </div>
              </div>
            </div>
          )}

          {/* Download Success Banner */}
          {downloadSuccess && (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-foreground shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 text-base">Surat Berhasil Diunduh!</div>
                  <div className="text-xs text-foreground/70 mt-0.5">
                    File <strong className="font-mono text-foreground">{downloadedFileName}</strong> telah terunduh ke perangkat Anda.
                  </div>
                  {r2PdfUrl && (
                    <div className="text-[11px] text-teal mt-1 flex items-center gap-1.5 font-medium">
                      <Cloud className="w-3.5 h-3.5" /> Tersimpan aman di Cloudflare R2
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {r2PdfUrl && (
                  <a
                    href={r2PdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-border"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-teal" /> Buka di R2
                  </a>
                )}
                <button
                  onClick={() => handleGeneratePdf(false)}
                  disabled={isGeneratingPdf}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Unduh PDF
                </button>
                <button
                  onClick={() => handleGenerateDocx(false)}
                  disabled={isGenerating}
                  className="px-3 py-2 bg-teal/20 hover:bg-teal/30 text-teal text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-teal/30"
                >
                  <Download className="w-3.5 h-3.5" /> Unduh Word
                </button>
              </div>
            </div>
          )}

          {/* Generation Error Alert */}
          {generationError && (
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <div>
                <div className="font-bold">Gagal Membuat Surat</div>
                <div className="text-xs opacity-90">{generationError}</div>
              </div>
            </div>
          )}

          {/* Generation Notice Banner (e.g. Gotenberg unconfigured or offline) */}
          {generationNotice && (
            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-foreground shadow-lg space-y-3 animate-in fade-in-50">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Info className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-amber-700 dark:text-amber-300 text-sm">
                    Dokumen Word (.docx) Resmi Telah Diunduh!
                  </div>
                  <div className="text-xs text-foreground/80 mt-1 leading-relaxed">
                    {generationNotice.message}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-500/20">
                <button
                  type="button"
                  onClick={() => {
                    setGotenbergInputUrl(gotenbergUrl || '');
                    setGotenbergTestStatus(null);
                    setShowGotenbergModal(true);
                  }}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Server className="w-3.5 h-3.5" /> Hubungkan Server Gotenberg
                </button>
                <button
                  type="button"
                  onClick={() => handleGeneratePdf(false, true)}
                  disabled={isGeneratingPdf}
                  className="px-3.5 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-border cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-teal" /> Unduh Versi PDF Alternatif (Engine Vektor)
                </button>
              </div>
            </div>
          )}

          {/* Admin Review & Approval Banner */}
          {(isAdmin || window.location.pathname.includes('/admin/surat')) && booking.status === 'pending' && (
            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-foreground shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in-50">
              <div>
                <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400 text-sm">
                  <AlertCircle className="w-4 h-4" /> Mode Review & Persiapan Surat Admin (Status: PENDING)
                </div>
                <p className="text-xs text-foreground/70 mt-1">
                  Sesuaikan nama program, produser, atau tanggal produksi di form bawah bila perlu. Klik <strong>Setujui & Kirim ke WA</strong> untuk otomatis memproses PDF resmi ke R2 dan mengirim link surat ke peminjam.
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
                <button
                  type="button"
                  onClick={handleAdminApprove}
                  disabled={isApproving || isGeneratingPdf}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isApproving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Memproses Persetujuan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Setujui Booking & Kirim WA
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Admin Approved Notice */}
          {(isAdmin || window.location.pathname.includes('/admin/surat')) && (booking.status === 'approved' || booking.status === 'disetujui') && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-foreground flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Booking ini <strong>TELAH DISETUJUI</strong>. Dokumen surat PDF resmi telah aktif di Cloudflare R2.</span>
              </div>
              <Link 
                to="/admin" 
                className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-lg border border-border transition-colors whitespace-nowrap"
              >
                &larr; Ke Panel Admin
              </Link>
            </div>
          )}

          {/* HERO ACTION CARD */}
          <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-teal/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal/10 border border-teal/20 text-teal text-xs font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3.5 h-3.5" /> Template {programType === 'news' ? 'Produksi News' : 'Produksi Reguler'}
                </div>
                <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  {formData.programName || booking.userDept || booking.dept || 'Surat Peminjaman Alat'}
                </h1>
                <p className="text-xs md:text-sm text-foreground/60 mt-1">
                  Surat resmi permohonan peminjaman peralatan operasional Dakwah TV
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                  booking.status === 'disetujui' 
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                    : booking.status === 'pending'
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    : 'bg-muted text-foreground/70 border border-border'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-current"></span>
                  <span className="uppercase">{booking.status || 'Pending'}</span>
                </div>
              </div>
            </div>

            {/* Prominent Hero Action Area: PDF (Primary) + Word (.docx) */}
            <div className="my-6 space-y-3">
              {/* Primary: Unduh PDF */}
              <button
                onClick={() => handleGeneratePdf(false)}
                disabled={isGeneratingPdf || isGenerating}
                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal hover:from-emerald-500 hover:to-teal-light text-white font-display font-bold text-base md:text-lg rounded-2xl shadow-xl shadow-teal/20 active:scale-[0.99] transition-all flex items-center justify-between gap-3 disabled:opacity-50 group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                    {isGeneratingPdf ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <FileCheck className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="text-left min-w-0">
                    <div className="font-bold flex items-center gap-2">
                      <span className="truncate">{isGeneratingPdf ? (conversionStage || "Memproses Dokumen PDF...") : "Unduh Surat PDF (.pdf)"}</span>
                      {!isGeneratingPdf && (
                        <span className="hidden sm:inline-block text-[10px] bg-white/20 px-2.5 py-0.5 rounded-full font-mono font-semibold uppercase tracking-wider whitespace-nowrap flex-shrink-0">
                          {gotenbergUrl ? "100% Presisi DOCX" : "Konversi Otomatis"}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/80 font-normal truncate">
                      {gotenbergUrl 
                        ? (isGeneratingPdf ? "Dikonversi langsung oleh LibreOffice via server Gotenberg..." : "Dikonversi langsung dari berkas Word resmi melalui Gotenberg")
                        : "Render otomatis template resmi • Langsung terbuka di HP"}
                    </div>
                  </div>
                </div>
                <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform flex-shrink-0" />
              </button>

              {/* Secondary Actions Grid: Word (.docx) & Cloudflare R2 Direct View */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Secondary Button: Unduh Word */}
                <button
                  onClick={() => handleGenerateDocx(false)}
                  disabled={isGenerating || isGeneratingPdf}
                  className="py-3 px-4 bg-muted hover:bg-muted/80 text-foreground border border-border font-bold text-xs md:text-sm rounded-xl transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin"></div>
                      <span>Membuat Dokumen (.docx)...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 text-teal" />
                      <span>Unduh Format Word (.docx)</span>
                    </>
                  )}
                </button>

                {/* Cloudflare R2 Link or Status */}
                {r2PdfUrl ? (
                  <a
                    href={r2PdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-4 bg-teal/10 hover:bg-teal/20 text-teal border border-teal/20 font-bold text-xs md:text-sm rounded-xl transition-all flex items-center justify-center gap-2 group"
                  >
                    <Cloud className="w-4 h-4 text-teal group-hover:scale-110 transition-transform" />
                    <span>Lihat di Cloudflare R2</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </a>
                ) : (
                  <div className="py-3 px-4 bg-muted/40 border border-dashed border-border text-foreground/60 text-xs rounded-xl flex items-center justify-center gap-2">
                    <Cloud className="w-4 h-4 text-teal/60" />
                    <span>Cloudflare R2 Auto-Sync Siap</span>
                  </div>
                )}
              </div>

              {/* Cloudflare R2 & Gotenberg status pills */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Cloud className="w-3 h-3" />
                  Cloudflare R2 Terhubung
                </span>
                {gotenbergUrl ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    <Sparkles className="w-3 h-3" />
                    Gotenberg Aktif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-foreground/60 border border-border">
                    <Sparkles className="w-3 h-3 text-teal" />
                    Engine PDF: Native Vector (Cepat & Ringan)
                  </span>
                )}
              </div>
            </div>

            {/* Mobile WhatsApp In-App Browser Guidance Banner */}
            <div className="p-4 rounded-2xl bg-muted/50 border border-border text-xs leading-relaxed space-y-1.5">
              <div className="font-bold flex items-center gap-2 text-foreground">
                <Info className="w-4 h-4 text-teal" />
                <span>Tips Membuka Lewat WhatsApp di HP:</span>
              </div>
              <p className="text-foreground/70">
                Dokumen PDF dapat dibuka langsung di perangkat HP. Jika unduhan tidak otomatis berjalan karena batasan browser bawaan WhatsApp:
              </p>
              <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                <span className="bg-background border border-border px-2.5 py-1 rounded-md text-foreground/90">
                  1. Ketuk ikon titik tiga (<strong>⋮</strong>) di pojok kanan atas WhatsApp
                </span>
                <span className="bg-background border border-border px-2.5 py-1 rounded-md text-teal font-bold">
                  2. Pilih "Buka di Chrome" / "Buka di Browser Luar"
                </span>
              </div>
            </div>

          </div>

          {/* BOOKING SUMMARY METADATA CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-foreground/50 text-xs mb-1.5">
                <Tv className="w-4 h-4 text-teal" />
                <span>Program</span>
              </div>
              <div className="font-bold text-sm text-foreground truncate">
                {formData.programName || booking.dept || '-'}
              </div>
              <div className="text-[11px] text-foreground/50 mt-0.5">
                {formData.episode ? `Episode: ${formData.episode}` : 'Semua Episode'}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-foreground/50 text-xs mb-1.5">
                <User className="w-4 h-4 text-teal" />
                <span>Produser / PJ</span>
              </div>
              <div className="font-bold text-sm text-foreground truncate">
                {formData.produser || booking.userName || '-'}
              </div>
              <div className="text-[11px] text-foreground/50 mt-0.5">
                {booking.userNim ? `NIM: ${booking.userNim}` : (booking.userDept || 'Tim Produksi')}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-foreground/50 text-xs mb-1.5">
                <Film className="w-4 h-4 text-teal" />
                <span>Tgl Produksi</span>
              </div>
              <div className="font-bold text-sm text-foreground">
                {formData.tglProduksi ? formatDateToIndonesian(formData.tglProduksi) : formatDateToIndonesian(booking.dateStart)}
              </div>
              <div className="text-[11px] text-foreground/50 mt-0.5">Jadwal Syuting</div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-foreground/50 text-xs mb-1.5">
                <Calendar className="w-4 h-4 text-teal" />
                <span>Masa Pinjam</span>
              </div>
              <div className="font-bold text-sm text-foreground">
                {formatDateToIndonesian(booking.dateStart)}
              </div>
              <div className="text-[11px] text-foreground/50 mt-0.5">
                s/d {formatDateToIndonesian(booking.dateEnd)}
              </div>
            </div>
          </div>

          {/* ATTACHED EQUIPMENT PREVIEW CARD */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-teal" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-foreground">
                  Daftar Alat Terlampir
                </h3>
              </div>
              <span className="text-xs bg-teal/10 border border-teal/20 text-teal px-2.5 py-1 rounded-full font-mono font-bold">
                {attachedItems.length} Alat • {totalItemUnits} Unit
              </span>
            </div>

            {attachedItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {attachedItems.map((it, idx) => {
                  const itName = it?.name || it?.item_name || it?.nama || (typeof it === 'string' ? it : '') || 'Item';
                  const itCat = it?.cat || it?.category || '';
                  const itQty = it?.qty || it?.quantity || 1;

                  return (
                    <div 
                      key={it.id || idx}
                      className="p-3 rounded-xl bg-muted/30 border border-border/80 flex items-center justify-between gap-3 text-xs hover:border-teal/30 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-card border border-border text-foreground/60 flex items-center justify-center font-mono font-bold flex-shrink-0 text-[11px]">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-foreground truncate">{itName}</div>
                          {itCat && (
                            <div className="text-[10px] text-foreground/50 uppercase tracking-wider mt-0.5">{itCat}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="bg-teal/10 text-teal border border-teal/20 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
                          {itQty} unit
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-muted/20 border border-border text-center text-xs text-foreground/60 font-mono">
                Belum ada rincian alat yang terdaftar di booking ini.
              </div>
            )}
          </div>

          {/* EDIT DETAILS ACCORDION */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden transition-all">
            <button
              onClick={() => setShowEditDetails(!showEditDetails)}
              className="w-full p-4 md:px-6 flex justify-between items-center hover:bg-muted/30 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  ✏️ Sesuaikan Detail Surat (Opsional)
                </span>
                <span className="text-xs text-foreground/50 hidden sm:inline">
                  — Ubah nama program, produser, atau ganti template Word
                </span>
              </div>
              {showEditDetails ? (
                <ChevronUp className="w-5 h-5 text-foreground/50" />
              ) : (
                <ChevronDown className="w-5 h-5 text-foreground/50" />
              )}
            </button>

            {showEditDetails && (
              <div className="p-6 border-t border-border bg-muted/10 space-y-6">
                
                {/* Template Picker */}
                <div>
                  <label className="text-xs font-mono text-foreground/60 uppercase tracking-wider mb-2.5 block">
                    Pilih Kategori / Template
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    <button 
                      onClick={() => setProgramType('reguler')}
                      className={`flex-1 py-2.5 px-4 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                        programType === 'reguler' 
                          ? 'border-teal bg-teal/15 text-teal shadow-sm' 
                          : 'border-border text-foreground/70 hover:border-foreground/30 bg-card'
                      }`}
                    >
                      Produksi Reguler
                    </button>
                    <button 
                      onClick={() => setProgramType('news')}
                      className={`flex-1 py-2.5 px-4 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                        programType === 'news' 
                          ? 'border-teal bg-teal/15 text-teal shadow-sm' 
                          : 'border-border text-foreground/70 hover:border-foreground/30 bg-card'
                      }`}
                    >
                      Produksi News
                    </button>
                    <button 
                      onClick={() => setProgramType('other')}
                      className={`flex-1 py-2.5 px-4 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                        programType === 'other' 
                          ? 'border-destructive bg-destructive/15 text-destructive shadow-sm' 
                          : 'border-border text-foreground/70 hover:border-foreground/30 bg-card'
                      }`}
                    >
                      Kategori Lainnya
                    </button>
                  </div>
                </div>

                {programType === 'other' ? (
                  <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-center">
                    <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
                    <h4 className="font-bold text-sm mb-1 text-foreground">Pengajuan Non-Reguler / Non-News</h4>
                    <p className="text-xs text-foreground/70 max-w-md mx-auto leading-relaxed">
                      Pengajuan surat peminjaman untuk divisi, live streaming khusus, atau acara custom dilakukan secara manual. Silakan hubungi <strong>Sekretaris Dakwah TV</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-mono text-foreground/60 mb-1.5 block">Nama Program</label>
                        <input 
                          type="text" 
                          className="w-full bg-[#f8fafc] dark:bg-[#0c171d] border border-border rounded-xl p-3 text-sm text-foreground focus:border-teal focus:ring-1 focus:ring-teal outline-none transition-colors"
                          value={formData.programName} 
                          onChange={e => setFormData({...formData, programName: e.target.value})} 
                          placeholder="cth: Muslim Kampus"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-foreground/60 mb-1.5 block">Episode</label>
                        <input 
                          type="text" 
                          className="w-full bg-[#f8fafc] dark:bg-[#0c171d] border border-border rounded-xl p-3 text-sm text-foreground focus:border-teal focus:ring-1 focus:ring-teal outline-none transition-colors"
                          value={formData.episode} 
                          onChange={e => setFormData({...formData, episode: e.target.value})} 
                          placeholder="cth: Episode 03 / Liputan Khusus"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-foreground/60 mb-1.5 block">Produser / PJ</label>
                        <input 
                          type="text" 
                          className="w-full bg-[#f8fafc] dark:bg-[#0c171d] border border-border rounded-xl p-3 text-sm text-foreground focus:border-teal focus:ring-1 focus:ring-teal outline-none transition-colors"
                          value={formData.produser} 
                          onChange={e => setFormData({...formData, produser: e.target.value})} 
                          placeholder="Nama penanggung jawab"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-foreground/60 mb-1.5 block">Tanggal Produksi</label>
                        <input 
                          type="date" 
                          className="w-full bg-[#f8fafc] dark:bg-[#0c171d] border border-border rounded-xl p-3 text-sm text-foreground focus:border-teal focus:ring-1 focus:ring-teal outline-none transition-colors"
                          value={formData.tglProduksi} 
                          onChange={e => setFormData({...formData, tglProduksi: e.target.value})} 
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        onClick={() => handleGeneratePdf(false)}
                        disabled={isGeneratingPdf || isGenerating}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
                      >
                        {isGeneratingPdf ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <FileCheck className="w-4 h-4" />
                        )}
                        <span>Perbarui & Unduh PDF (.pdf)</span>
                      </button>

                      <button
                        onClick={() => handleGenerateDocx(false)}
                        disabled={isGenerating || isGeneratingPdf}
                        className="px-5 py-2.5 bg-muted hover:bg-muted/80 text-foreground border border-border font-bold text-xs rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        {isGenerating ? (
                          <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Download className="w-4 h-4 text-teal" />
                        )}
                        <span>Unduh Format Word (.docx)</span>
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* TEMPLATE GUIDE COLLAPSIBLE */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <button 
              onClick={() => setShowGuide(!showGuide)}
              className="w-full flex justify-between items-center text-left text-xs font-bold text-foreground/70 hover:text-foreground cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4 text-teal" />
                Panduan Template Microsoft Word (Docxtemplater)
              </span>
              {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showGuide && (
              <div className="mt-4 pt-4 border-t border-border text-xs text-foreground/70 space-y-3">
                <p className="leading-relaxed">
                  Surat dibuat menggunakan template Microsoft Word yang dapat Anda ubah kapan saja. Edit file <strong>template_reguler.docx</strong> atau <strong>template_news.docx</strong> di folder <code>public/surat-assets/</code>.
                </p>
                <div className="bg-muted/40 border border-border rounded-xl p-3 text-[11px] font-mono overflow-x-auto">
                  <div className="font-bold text-foreground mb-1 font-sans">Variabel Tersedia:</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li><span className="text-teal">{'{program}'}</span> : Nama Program</li>
                    <li><span className="text-teal">{'{episode}'}</span> : Episode</li>
                    <li><span className="text-teal">{'{produser}'}</span> : Produser / PJ</li>
                    <li><span className="text-teal">{'{tgl_produksi}'}</span> : Tanggal Produksi</li>
                    <li><span className="text-teal">{'{tgl_peminjaman}'}</span> : Tanggal Peminjaman Alat</li>
                    <li><span className="text-teal">{'{nama}'}</span> : Nama Peminjam</li>
                    <li><span className="text-teal">{'{hp}'}</span> : Nomor WhatsApp Peminjam</li>
                  </ul>
                  <div className="font-bold text-foreground mt-2 mb-1 font-sans">Untuk Daftar Alat (Tabel 2 Kolom):</div>
                  <div className="pl-2">
                    <span className="text-teal">{'{#items}'}</span><br />
                    <span>  Kolom Kiri: {'{no1}'} | {'{nama_alat1}'} | {'{qty1}'}</span><br />
                    <span>  Kolom Kanan: {'{no2}'} | {'{nama_alat2}'} | {'{qty2}'}</span><br />
                    <span className="text-teal">{'{/items}'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        mode={authMode}
        setMode={setAuthMode}
        onSubmit={async (e) => {
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
              const { error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { name } }
              });
              if (error) throw error;
            }
            setIsAuthOpen(false);
            fetchBooking();
          } catch (err) {
            setAuthError(err.message || 'Login gagal');
          }
        }}
        errorMsg={authError}
      />

      {showGotenbergModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowGotenbergModal(false)}>
          <div className="bg-card border border-border rounded-3xl w-full max-w-md p-6 md:p-7 shadow-2xl animate-in zoom-in-95 relative" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal/10 text-teal flex items-center justify-center font-bold">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Server Gotenberg</h3>
                  <p className="text-[11px] text-foreground/50">Mesin Konversi DOCX ke PDF 100% Presisi</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowGotenbergModal(false)} 
                className="p-1.5 hover:bg-muted rounded-xl text-foreground/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-foreground/70 mb-4 leading-relaxed">
              Sistem akan merender data ke template Word (.docx) resmi, lalu mengirimkannya ke Gotenberg untuk dikonversi menjadi PDF tanpa deviasi tata letak.
            </p>

            <div className="p-3 bg-muted/40 border border-border rounded-2xl text-xs space-y-1.5 mb-4">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${gotenbergUrl ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                Status Saat Ini: {gotenbergUrl ? 'Server Kustom Aktif' : 'Belum Dihubungkan'}
              </div>
              {gotenbergUrl && (
                <div className="text-[11px] font-mono text-teal truncate">
                  {gotenbergUrl}
                </div>
              )}
            </div>

            <div className="space-y-1.5 mb-4">
              <label className="text-xs font-bold text-foreground/70 uppercase tracking-wider block">
                Gotenberg Endpoint URL
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={gotenbergInputUrl} 
                  onChange={e => {
                    setGotenbergInputUrl(e.target.value);
                    setGotenbergTestStatus(null);
                  }} 
                  placeholder="https://gotenberg.dakwahtv.com atau http://localhost:3000" 
                  className="flex-1 bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs font-mono focus:border-teal outline-none" 
                />
                <button
                  type="button"
                  onClick={() => handleTestGotenberg(gotenbergInputUrl)}
                  disabled={isTestingGotenberg || !gotenbergInputUrl.trim()}
                  className="px-3.5 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                >
                  {isTestingGotenberg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-teal" />}
                  Test
                </button>
              </div>
            </div>

            {gotenbergTestStatus && (
              <div className={`p-3 rounded-2xl text-xs mb-4 flex items-center gap-2.5 ${
                gotenbergTestStatus.success 
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                  : 'bg-destructive/10 border border-destructive/30 text-destructive'
              }`}>
                {gotenbergTestStatus.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                <div className="leading-tight">{gotenbergTestStatus.message}</div>
              </div>
            )}

            <div className="p-3 bg-muted/40 border border-border rounded-2xl text-[11px] text-foreground/60 space-y-1.5 mb-5">
              <div className="font-bold text-foreground/80">Perintah Docker di Server Dakwah TV:</div>
              <code className="block p-2 bg-background border border-border rounded-xl font-mono text-[10px] text-teal select-all overflow-x-auto">
                docker run -d --name gotenberg -p 3000:3000 --restart always gotenberg/gotenberg:8
              </code>
            </div>

            <div className="flex gap-2.5 justify-end pt-3 border-t border-border">
              <button 
                type="button" 
                className="px-4 py-2 font-bold text-xs text-foreground/70 hover:text-foreground transition-colors cursor-pointer" 
                onClick={() => setShowGotenbergModal(false)}
              >
                Tutup
              </button>
              <button 
                type="button" 
                className="px-5 py-2.5 bg-teal hover:bg-teal-light text-background font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer" 
                onClick={handleSaveGotenberg}
              >
                Simpan Konfigurasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
