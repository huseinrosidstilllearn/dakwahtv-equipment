import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function formatDateIndo(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
}

const imageCache = {};

/**
 * Robust image loader that caches base64 Data URLs for fast subsequent generations.
 */
export async function loadImageBase64(path) {
  if (imageCache[path]) return imageCache[path];
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        imageCache[path] = reader.result;
        resolve(reader.result);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("Notice: could not load image for PDF:", path, err);
    return null;
  }
}

/**
 * Preload all official template images into memory cache
 */
export async function preloadSpaImages() {
  const images = [
    '/surat-assets/images/kop_surat.png',
    '/surat-assets/images/ttd_alfina.png',
    '/surat-assets/images/ttd_dwiryan.jpg',
    '/surat-assets/images/ttd_khoiron.png',
    '/surat-assets/images/ttd_luluk.png',
    '/surat-assets/images/ttd_amanda.png'
  ];
  await Promise.allSettled(images.map(img => loadImageBase64(img)));
}

/**
 * Generate official SPA PDF matching the EXACT visual layout of template_reguler.docx & template_news.docx
 */
export async function generateSpaPdf({ booking, formData, programType = 'reguler' }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const marginX = 15;
  const contentWidth = pageWidth - (marginX * 2); // 180mm
  const isNews = programType === 'news';

  // 1. Load official image assets
  const [
    kopB64,
    ttdLeftB64,
    ttdRightB64,
    ttdCenterB64
  ] = await Promise.all([
    loadImageBase64('/surat-assets/images/kop_surat.png'),
    loadImageBase64(isNews ? '/surat-assets/images/ttd_luluk.png' : '/surat-assets/images/ttd_alfina.png'),
    loadImageBase64(isNews ? '/surat-assets/images/ttd_amanda.png' : '/surat-assets/images/ttd_dwiryan.jpg'),
    loadImageBase64('/surat-assets/images/ttd_khoiron.png')
  ]);

  // 2. Kop Surat Header (exact 2045 x 615 banner extracted from official Word template)
  const kopWidth = contentWidth;
  const kopHeight = kopWidth / (2045 / 615); // ~54.1mm
  let currY = 10;

  if (kopB64) {
    try {
      doc.addImage(kopB64, 'PNG', marginX, currY, kopWidth, kopHeight, undefined, 'FAST');
      currY += kopHeight + 6;
    } catch (e) {
      console.warn("Could not render kop surat image, using text fallback:", e);
      currY += 20;
    }
  } else {
    // Text fallback if image is missing
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 92, 82);
    doc.text('DAKWAH TV SURABAYA', pageWidth / 2, currY + 10, { align: 'center' });
    currY += 25;
  }

  // 3. Title: SURAT PEMINJAMAN ALAT PRODUKSI (Times New Roman bold)
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text('SURAT PEMINJAMAN ALAT PRODUKSI', pageWidth / 2, currY, { align: 'center' });

  // 4. Metadata Block (Program, Episode, Produser, Tanggal Produksi, Tanggal Peminjaman)
  currY += 7;
  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);

  const bNama = booking.userName || booking.name || booking.nama || "-";
  const bNim = booking.userNim || booking.nim || "";
  const bDept = booking.userDept || booking.dept || "-";
  const bStart = booking.dateStart || booking.tglMulai || booking.start || "";
  const bEnd = booking.dateEnd || booking.tglSelesai || booking.end || "";

  const progName = formData?.programName || bDept || "-";
  const episode = formData?.episode || "-";
  const produserStr = formData?.produser || (bNama + (bNim ? ` (NIM: ${bNim})` : ""));
  const tglProdStr = formData?.tglProduksi ? formatDateIndo(formData.tglProduksi) : (bStart ? formatDateIndo(bStart) : "-");
  const tglPinjamStr = bStart
    ? `${formatDateIndo(bStart)}${bEnd && bEnd !== bStart ? ' s/d ' + formatDateIndo(bEnd) : ''}`
    : "-";

  const metaRows = [
    ['Program', `: ${progName}`],
    ['Episode', `: ${episode}`],
    ['Produser', `: ${produserStr}`],
    ['Tanggal Produksi', `: ${tglProdStr}`],
    ['Tanggal Peminjaman', `: ${tglPinjamStr}`]
  ];

  const col1X = marginX + 3;
  const col2X = marginX + 48;

  metaRows.forEach(([lbl, val]) => {
    doc.text(lbl, col1X, currY);
    doc.text(val, col2X, currY);
    currY += 5.2;
  });

  // 5. Equipment Table (2-column layout matching Word template: No. | Nama Alat | Jumlah | No. | Nama Alat | Jumlah)
  const rawItems = booking.items;
  const sourceItems = Array.isArray(rawItems)
    ? rawItems
    : rawItems && typeof rawItems === 'object'
    ? Object.values(rawItems)
    : [];

  const tableRows = [];
  for (let i = 0; i < sourceItems.length; i += 2) {
    const it1 = sourceItems[i];
    const it2 = sourceItems[i + 1];

    const name1 = it1?.name || it1?.item_name || it1?.nama || (typeof it1 === 'string' ? it1 : '') || '-';
    const qty1 = String(it1?.qty || it1?.quantity || 1);

    const name2 = it2 ? (it2?.name || it2?.item_name || it2?.nama || (typeof it2 === 'string' ? it2 : '') || '-') : '';
    const qty2 = it2 ? String(it2?.qty || it2?.quantity || 1) : '';

    tableRows.push([
      String(i + 1),
      name1,
      qty1,
      it2 ? String(i + 2) : '',
      name2,
      qty2
    ]);
  }

  if (tableRows.length === 0) {
    tableRows.push(['1', 'Peralatan Produksi Sesuai SOP', '1', '', '', '']);
  }

  autoTable(doc, {
    startY: currY + 2,
    head: [['No.', 'Nama Alat', 'Jumlah', 'No.', 'Nama Alat', 'Jumlah']],
    body: tableRows,
    theme: 'plain',
    margin: { left: marginX, right: marginX },
    styles: {
      font: 'times',
      fontSize: 9,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 }
    },
    headStyles: {
      font: 'times',
      fontStyle: 'bold',
      fontSize: 9.5,
      halign: 'center',
      fillColor: false,
      lineWidth: 0.2,
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', cellWidth: 62 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 10 },
      4: { halign: 'left', cellWidth: 62 },
      5: { halign: 'center', cellWidth: 18 }
    }
  });

  let finalY = (doc.lastAutoTable?.finalY || 130) + 6;

  // Protect against signatures being pushed beyond bottom margin
  if (finalY > 215) {
    doc.addPage();
    finalY = 25;
  }

  // 6. City and Date (Surabaya, {date})
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const tglTtd = formatDateIndo(bStart || new Date().toISOString());
  doc.text(`Surabaya, ${tglTtd}`, pageWidth - marginX - 10, finalY, { align: 'right' });

  // 7. Signatures Row 1 (Left & Right) + Row 2 (Mengetahui Center)
  const sigY = finalY + 5;
  const colLeftX = marginX + 15;
  const colRightX = pageWidth - marginX - 55;

  if (isNews) {
    // --- NEWS TEMPLATE ---
    // Left: Pimpinan Redaksi (Luluk Ainur Rizqiyah)
    doc.setFont('times', 'normal');
    doc.text('Pimpinan Redaksi,', colLeftX, sigY);

    if (ttdLeftB64) {
      try {
        doc.addImage(ttdLeftB64, 'PNG', colLeftX, sigY + 2, 28, 16, undefined, 'FAST');
      } catch (e) {
        console.warn("Could not add signature image:", e);
      }
    }

    doc.setFont('times', 'bold');
    doc.text('Luluk Ainur Rizqiyah', colLeftX, sigY + 22);
    doc.setFont('times', 'normal');
    doc.text('NIC. 24088', colLeftX, sigY + 26);

    // Right: Eksekutif Produser News (Amanda Ramdita Rida'i)
    doc.text('Eksekutif Produser News,', colRightX, sigY);

    if (ttdRightB64) {
      try {
        doc.addImage(ttdRightB64, 'PNG', colRightX, sigY + 2, 28, 16, undefined, 'FAST');
      } catch (e) {
        console.warn("Could not add signature image:", e);
      }
    }

    doc.setFont('times', 'bold');
    doc.text("Amanda Ramdita Rida'i", colRightX, sigY + 22);
    doc.setFont('times', 'normal');
    doc.text('NIC. 24076', colRightX, sigY + 26);

  } else {
    // --- REGULER TEMPLATE ---
    // Left: Ketua Divisi Produksi (Alfina Sativa Eka Krisna)
    doc.setFont('times', 'normal');
    doc.text('Ketua Divisi Produksi,', colLeftX, sigY);

    if (ttdLeftB64) {
      try {
        doc.addImage(ttdLeftB64, 'PNG', colLeftX, sigY + 2, 28, 16, undefined, 'FAST');
      } catch (e) {
        console.warn("Could not add signature image:", e);
      }
    }

    doc.setFont('times', 'bold');
    doc.text('Alfina Sativa Eka Krisna', colLeftX, sigY + 22);
    doc.setFont('times', 'normal');
    doc.text('NIC. 24070', colLeftX, sigY + 26);

    // Right: Eksekutif Produser Reguler (Dwi Ryan Annas Rahmatullah)
    doc.text('Eksekutif Produser Reguler,', colRightX, sigY);

    if (ttdRightB64) {
      try {
        doc.addImage(ttdRightB64, 'JPEG', colRightX, sigY + 2, 28, 16, undefined, 'FAST');
      } catch (e) {
        console.warn("Could not add signature image:", e);
      }
    }

    doc.setFont('times', 'bold');
    doc.text('Dwi Ryan Annas Rahmatullah', colRightX, sigY + 22);
    doc.setFont('times', 'normal');
    doc.text('NIC. 24069', colRightX, sigY + 26);
  }

  // Center: Mengetahui, Kepala Teknis (Muhammad Khoiron Fakhriyyan)
  const centerSigY = sigY + 32;
  doc.setFont('times', 'normal');
  doc.text('Mengetahui,', pageWidth / 2, centerSigY, { align: 'center' });
  doc.text('Kepala Teknis', pageWidth / 2, centerSigY + 4, { align: 'center' });

  if (ttdCenterB64) {
    try {
      doc.addImage(ttdCenterB64, 'PNG', (pageWidth / 2) - 14, centerSigY + 5, 28, 16, undefined, 'FAST');
    } catch (e) {
      console.warn("Could not add signature image:", e);
    }
  }

  doc.setFont('times', 'bold');
  doc.text('Muhammad Khoiron Fakhriyyan', pageWidth / 2, centerSigY + 25, { align: 'center' });
  doc.setFont('times', 'normal');
  doc.text('NIC. 24014', pageWidth / 2, centerSigY + 29, { align: 'center' });

  return doc.output('blob');
}

/**
 * Optional Gotenberg Conversion:
 * If user provides a Gotenberg URL, this converts a docx Blob into a PDF Blob via Gotenberg API.
 */
export async function convertDocxViaGotenberg(docxBlob, gotenbergUrl) {
  if (!gotenbergUrl) return null;
  const baseUrl = gotenbergUrl.trim().replace(/\/+$/, '');
  const convertEndpoint = `${baseUrl}/forms/libreoffice/convert`;

  const fd = new FormData();
  fd.append('files', docxBlob, 'document.docx');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    const res = await fetch(convertEndpoint, {
      method: 'POST',
      body: fd,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Server Gotenberg (${res.status} ${res.statusText}): ${errText || 'Konversi gagal'}`);
    }

    return await res.blob();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Koneksi ke server Gotenberg timeout (lebih dari 60 detik). Periksa status server Anda.');
    }
    throw err;
  }
}

/**
 * Upload PDF to Cloudflare R2 bucket via the existing Worker
 */
export async function uploadSpaPdfToR2(pdfBlob, filename) {
  const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uploadUrl = `https://equipment-photo-uploader.dakwahtvteknis.workers.dev/spa-pdfs/${cleanName}`;

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer DakwahTV_Aman_2026',
      'Content-Type': 'application/pdf'
    },
    body: pdfBlob
  });

  if (!res.ok) {
    throw new Error(`Gagal upload PDF ke Cloudflare R2: ${res.statusText}`);
  }

  const data = await res.json();
  let finalUrl = data.url;
  if (finalUrl && finalUrl.includes('.r2.dev')) {
    finalUrl = finalUrl.replace(/https:\/\/[^/]+\.r2\.dev/, 'https://spa.dakwahtv.my.id');
  }
  return finalUrl; // Direct public URL from R2 via custom domain
}

/**
 * Trigger download of Blob in browser
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1500);
}

/**
 * Directly renders DOCX template with booking data, converts via Gotenberg,
 * and uploads PDF to Cloudflare R2 (https://spa.dakwahtv.my.id/spa-pdfs/...).
 * Returns the final public R2 URL.
 */
export async function renderAndUploadSpaPdfDirect({ booking, gotenbergUrl, formDataOverride = null }) {
  if (!booking || !gotenbergUrl) return null;

  const deptL = (booking.userDept || booking.dept || "").toLowerCase();
  const programType = (deptL.includes("campus report") || deptL.includes("news")) ? "news" : "reguler";
  const templateName = programType === 'news' ? 'template_news.docx' : 'template_reguler.docx';
  const templatePath = `/surat-assets/${templateName}`;

  const tplRes = await fetch(templatePath);
  if (!tplRes.ok) throw new Error(`Template Word (${templateName}) tidak ditemukan.`);
  const tplBlob = await tplRes.blob();
  const zip = new PizZip(await tplBlob.arrayBuffer());
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  const bNama = booking.userName || booking.name || booking.nama || "-";
  const bNim = booking.userNim || booking.nim || "-";
  const bDept = booking.userDept || booking.dept || "-";
  const bHp = booking.userPhone || booking.phone || booking.hp || "-";
  const bStart = booking.dateStart || booking.tglMulai || booking.start || "";
  const bEnd = booking.dateEnd || booking.tglSelesai || booking.end || "";

  const progName = formDataOverride?.programName || bDept || "Program";
  const episode = formDataOverride?.episode || "-";
  const produser = formDataOverride?.produser || bNama || "-";
  const tglProdFmt = formDataOverride?.tglProduksi 
    ? formatDateIndo(formDataOverride.tglProduksi) 
    : (bStart ? formatDateIndo(bStart) : "-");
  const tglPinjamFmt = bStart ? formatDateIndo(bStart) : "-";

  // Build items pairs for 2-column Word template table
  const itemsData = [];
  const rawItems = booking.items || [];
  const sourceItems = Array.isArray(rawItems) ? rawItems : Object.values(rawItems);

  for (let i = 0; i < sourceItems.length; i += 2) {
    const it1 = sourceItems[i];
    const it2 = sourceItems[i + 1];
    itemsData.push({
      no1: i + 1,
      nama_alat1: it1?.name || it1?.item_name || it1?.nama || '',
      qty1: it1?.qty || it1?.quantity || 1,
      no2: it2 ? i + 2 : '',
      nama_alat2: it2 ? (it2?.name || it2?.item_name || it2?.nama || '') : '',
      qty2: it2 ? (it2?.qty || it2?.quantity || 1) : ''
    });
  }

  doc.render({
    id: booking.id || booking._key || "",
    program: progName,
    episode: episode,
    produser: produser,
    tgl_produksi: tglProdFmt,
    tgl_peminjaman: tglPinjamFmt,
    tgl_mulai: tglPinjamFmt,
    tgl_selesai: bEnd ? formatDateIndo(bEnd) : "-",
    tgl_surat: formatDateIndo(new Date()),
    tanggal: formatDateIndo(new Date()),
    peminjam: bNama,
    nama: bNama,
    nim: bNim,
    dept: bDept,
    hp: bHp,
    tujuan: booking.purpose || booking.keperluan || "-",
    items: itemsData
  });

  const docxBlob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });

  const pdfBlob = await convertDocxViaGotenberg(docxBlob, gotenbergUrl);
  if (!pdfBlob) throw new Error("Gagal mengonversi via Gotenberg");

  const cleanProg = (progName || "Program").replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanDate = (bStart || "booking").replace(/[^a-zA-Z0-9_-]/g, '_');
  const pdfFileName = `SPA_Produksi_${cleanProg}_${cleanDate}.pdf`;

  const r2Url = await uploadSpaPdfToR2(pdfBlob, pdfFileName);
  return r2Url;
}

