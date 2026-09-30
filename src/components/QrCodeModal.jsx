import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { X, Printer, Download, QrCode, Tag, Check, Copy } from 'lucide-react';

/**
 * QR Code Label Generator & Print Modal
 * Formats physical equipment asset tags with crisp QR codes for Dakwah TV studio gear.
 */
export default function QrCodeModal({ item, items = [], isOpen, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const printRef = useRef(null);

  // If a single item is passed, wrap into array
  const activeItems = item ? [item] : (items || []);
  const currentItem = activeItems[0] || null;

  useEffect(() => {
    if (!currentItem) return;

    // Deep link or standard asset URI
    const qrPayload = JSON.stringify({
      app: 'dakwahtv-equipment',
      id: currentItem.id,
      name: currentItem.name,
      cat: currentItem.cat || currentItem.kategori || '',
      url: `https://dakwahtvequipment.pages.dev/katalog?item=${currentItem.id}`
    });

    QRCode.toDataURL(qrPayload, {
      width: 320,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error("QR Generation error:", err));
  }, [currentItem]);

  if (!isOpen || !currentItem) return null;

  const assetTagId = `DTV-EQ-${(currentItem.id || '0000').slice(0, 8).toUpperCase()}`;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${currentItem.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${assetTagId}.png`;
    a.click();
  };

  const handleCopyTag = () => {
    navigator.clipboard.writeText(assetTagId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Label QR Code Aset</h3>
              <p className="text-[11px] text-foreground/60">Stiker identitas resmi peralatan produksi</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-xl text-foreground/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col items-center">
          {/* Printable Label Badge Card */}
          <div 
            ref={printRef}
            id="printable-label-badge"
            className="w-full max-w-[320px] bg-white text-slate-900 border-2 border-slate-900 rounded-xl p-4 shadow-md flex flex-col items-center select-none"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {/* Top Brand Banner */}
            <div className="w-full flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
                <span className="text-[11px] font-black tracking-wider uppercase text-slate-900">
                  DAKWAH TV EQUIPMENT
                </span>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white font-mono">
                OFFICIAL ASSET
              </span>
            </div>

            {/* QR Code Graphic */}
            <div className="w-40 h-40 p-2 bg-white rounded-lg flex items-center justify-center border border-slate-200">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
              ) : (
                <div className="text-xs text-slate-400">Membuat QR...</div>
              )}
            </div>

            {/* Asset Info */}
            <div className="w-full text-center mt-3 pt-2 border-t border-slate-200">
              <div className="text-[13px] font-black text-slate-900 leading-snug line-clamp-2">
                {currentItem.name}
              </div>
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mt-0.5">
                {currentItem.cat || currentItem.kategori || 'Inventaris'} &bull; {currentItem.group_name || 'Unit'}
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300">
                <Tag className="w-3 h-3 text-slate-700" />
                <span className="text-[11px] font-mono font-bold text-slate-900 tracking-wider">
                  {assetTagId}
                </span>
              </div>
            </div>

            <div className="w-full text-center mt-3 pt-1 border-t border-slate-200 text-[8px] text-slate-500 font-medium">
              Property of Dakwah TV &bull; Scan untuk info peminjaman
            </div>
          </div>

          {/* Quick Copy Tag */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-foreground/60 font-mono">{assetTagId}</span>
            <button
              type="button"
              onClick={handleCopyTag}
              className="text-[11px] text-teal hover:underline flex items-center gap-1 font-semibold"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Tersalin' : 'Salin ID'}
            </button>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-muted/30 border-t border-border flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!qrDataUrl}
            className="flex-1 px-3 py-2 bg-background hover:bg-muted border border-border rounded-xl text-xs font-bold text-foreground transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-foreground/70" />
            Unduh Gambar QR
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 px-3 py-2 bg-teal hover:bg-teal-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Stiker Label
          </button>
        </div>
      </div>

      {/* Print Specific Styling */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-label-badge, #printable-label-badge * {
            visibility: visible !important;
          }
          #printable-label-badge {
            position: absolute !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 70mm !important;
            border: 2px solid #000 !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
