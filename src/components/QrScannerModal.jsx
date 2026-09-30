import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, Package, Upload } from 'lucide-react';
import { useToast } from '../context/ToastContext';

/**
 * QR Code Scanner Modal using html5-qrcode
 * Fast Camera Check-In / Check-Out for Dakwah TV Equipment
 */
export default function QrScannerModal({ isOpen, onClose, inventory = [], bookings = [], onStatusUpdate, onMarkPickedUp, onMarkReturned }) {
  const { toast } = useToast();
  const [scannerStarted, setScannerStarted] = useState(false);
  const [scannedResult, setScannedResult] = useState(null);
  const [matchedItem, setMatchedItem] = useState(null);
  const [matchedBooking, setMatchedBooking] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);

  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);

  // Play subtle feedback beep using Web Audio API
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // AudioContext blocked or unsupported
    }
  };

  // Start Camera
  const startCamera = async (cameraId = null) => {
    setCameraError(null);
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }

      const html5QrCode = new Html5Qrcode("qr-camera-stream");
      html5QrCodeRef.current = html5QrCode;

      // Enumerate available cameras
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        const backCam = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];
        const camToUse = cameraId || backCam.id;
        setSelectedCameraId(camToUse);

        await html5QrCode.start(
          camToUse,
          {
            fps: 15,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {
            // Ignore scan parse frame misses
          }
        );
        setScannerStarted(true);
      } else {
        setCameraError("Tidak ada kamera yang terdeteksi di perangkat Anda.");
      }
    } catch (err) {
      console.warn("Camera start error:", err);
      setCameraError(err.message || "Gagal mengakses kamera. Pastikan izin kamera telah diberikan.");
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.warn("Camera stop error:", err);
      }
      setScannerStarted(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setScannedResult(null);
      setMatchedItem(null);
      setMatchedBooking(null);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const handleScanSuccess = (decodedText) => {
    playBeep();
    setScannedResult(decodedText);
    stopCamera();

    // Parse decodedText
    let targetId = null;
    try {
      const parsed = JSON.parse(decodedText);
      targetId = parsed.id || null;
    } catch {
      // Check if URL with ?item=
      const matchUrl = decodedText.match(/[?&]item=([^&#]+)/);
      if (matchUrl) {
        targetId = matchUrl[1];
      } else if (decodedText.startsWith('DTV-EQ-')) {
        targetId = decodedText.replace('DTV-EQ-', '');
      } else {
        targetId = decodedText.trim();
      }
    }

    // Match with inventory
    const foundItem = inventory.find(i => 
      i.id === targetId || 
      i.old_key === targetId || 
      (i.id && targetId && i.id.toLowerCase().startsWith(targetId.toLowerCase()))
    );

    setMatchedItem(foundItem || null);

    // If item found, find active booking containing this item
    if (foundItem) {
      const activeBk = bookings.find(b => {
        if (!['pending', 'approved', 'letter_ready', 'picked_up', 'active'].includes(b.status)) return false;
        const bItems = Array.isArray(b.items) ? b.items : Object.values(b.items || {});
        return bItems.some(bi => bi.id === foundItem.id || bi.name === foundItem.name);
      });
      setMatchedBooking(activeBk || null);
      toast.success(`Alat terdeteksi: ${foundItem.name}`, "Scan Berhasil");
    } else {
      toast.error(`Kode QR tidak cocok dengan alat inventaris (ID: ${targetId || decodedText})`, "Alat Tidak Ditemukan");
    }
  };

  // File upload scan fallback
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5QrCode = new Html5Qrcode("qr-camera-stream");
      const result = await html5QrCode.scanFile(file, true);
      handleScanSuccess(result);
    } catch (err) {
      toast.error("Tidak dapat membaca QR code dari gambar tersebut.", "Gagal Scan Foto");
    }
  };

  const handleResumeScan = () => {
    setScannedResult(null);
    setMatchedItem(null);
    setMatchedBooking(null);
    startCamera(selectedCameraId);
  };

  const handleQuickPickup = () => {
    if (!matchedBooking) return;
    if (onMarkPickedUp) {
      onMarkPickedUp(matchedBooking);
      onClose();
    }
  };

  const handleQuickReturn = () => {
    if (!matchedBooking) return;
    if (onMarkReturned) {
      onMarkReturned(matchedBooking);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal flex items-center justify-center font-bold">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Pemindai QR Code Alat</h3>
              <p className="text-[11px] text-foreground/60">Check-In / Check-Out kilat via kamera HP</p>
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
        <div className="p-5 overflow-y-auto custom-scroll flex flex-col gap-4">
          {!scannedResult ? (
            <>
              {/* Camera Viewport */}
              <div className="relative w-full aspect-square max-h-[320px] bg-black rounded-2xl overflow-hidden border border-border flex items-center justify-center">
                <div id="qr-camera-stream" className="w-full h-full object-cover"></div>

                {cameraError && (
                  <div className="absolute inset-0 bg-background/95 p-6 flex flex-col items-center justify-center text-center gap-3">
                    <AlertTriangle className="w-10 h-10 text-amber-500" />
                    <div className="text-sm font-bold text-foreground">Akses Kamera Terkendala</div>
                    <div className="text-xs text-foreground/60 max-w-xs">{cameraError}</div>
                    <button
                      type="button"
                      onClick={() => startCamera(selectedCameraId)}
                      className="px-4 py-2 bg-teal hover:bg-teal-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Coba Lagi
                    </button>
                  </div>
                )}
              </div>

              {/* Camera Switcher & File Upload */}
              <div className="flex items-center justify-between gap-2 pt-1">
                {cameras.length > 1 && (
                  <select
                    value={selectedCameraId || ''}
                    onChange={(e) => startCamera(e.target.value)}
                    className="text-xs bg-muted border border-border rounded-xl px-3 py-2 text-foreground font-medium focus:outline-none"
                  >
                    {cameras.map(cam => (
                      <option key={cam.id} value={cam.id}>
                        📷 {cam.label || `Kamera ${cam.id.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Scan dari Galeri
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Scanned Result Card */
            <div className="space-y-4">
              {matchedItem ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">
                          ALAT BERHASIL DIKENALI
                        </div>
                        <h4 className="text-base font-black text-foreground">{matchedItem.name}</h4>
                        <div className="text-xs text-foreground/60">{matchedItem.cat} &bull; {matchedItem.group_name || 'Unit'}</div>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      matchedItem.status === 'ready' 
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                        : matchedItem.status === 'maintenance'
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        : 'bg-teal/20 text-teal'
                    }`}>
                      {matchedItem.status}
                    </span>
                  </div>

                  {/* Associated Booking Context */}
                  {matchedBooking ? (
                    <div className="mt-4 pt-3 border-t border-emerald-500/20 bg-background/60 rounded-xl p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between font-bold text-foreground">
                        <span className="flex items-center gap-1.5 text-teal">
                          <Package className="w-4 h-4" /> Booking Terkait
                        </span>
                        <span className="font-mono text-[11px] opacity-75">#{matchedBooking.id}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-foreground/50 block">Peminjam:</span>
                          <span className="font-bold text-foreground">{matchedBooking.userName}</span>
                        </div>
                        <div>
                          <span className="text-foreground/50 block">Program:</span>
                          <span className="font-bold text-foreground">{matchedBooking.userDept || '-'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-foreground/50 block">Status Booking:</span>
                          <span className="font-bold uppercase text-teal">{matchedBooking.status}</span>
                        </div>
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="pt-2 flex flex-col gap-2">
                        {['approved', 'letter_ready'].includes(matchedBooking.status) && (
                          <button
                            type="button"
                            onClick={handleQuickPickup}
                            className="w-full py-2 bg-teal hover:bg-teal-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            Check-Out: Tandai Sudah Diambil (Picked Up)
                          </button>
                        )}

                        {['picked_up', 'active'].includes(matchedBooking.status) && (
                          <button
                            type="button"
                            onClick={handleQuickReturn}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Check-In: Proses Pengembalian Alat
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-foreground/60 italic bg-background/40 p-2.5 rounded-xl">
                      ℹ️ Alat ini saat ini tidak terkait dengan jadwal booking aktif manapun (Status: {matchedItem.status}).
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center space-y-2">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                  <h4 className="text-sm font-bold text-foreground">Alat Tidak Ditemukan</h4>
                  <p className="text-xs text-foreground/60">
                    Kode QR tidak terdaftar dalam database inventaris.
                  </p>
                  <div className="text-[10px] font-mono bg-background p-2 rounded border border-border break-all">
                    {scannedResult}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleResumeScan}
                className="w-full py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-border"
              >
                <Camera className="w-4 h-4" />
                Scan Alat Lainnya
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
