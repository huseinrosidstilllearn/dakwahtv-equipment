import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check, Undo2 } from 'lucide-react';

/**
 * Reusable Digital Signature Pad for Touchscreens and Mouse
 * Supports high-DPI displays, stroke undo, and transparent PNG export.
 */
export default function SignaturePad({ onSave, onCancel, title = "Tanda Tangan Digital", subtitle = "Tanda tangani di dalam kotak di bawah ini menggunakan jari atau stylus" }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [history, setHistory] = useState([]);

  // Setup canvas with High DPI scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = '#0f8a77'; // Dakwah TV primary teal
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Save initial blank state
    saveState();
  }, []);

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHistory(prev => [...prev.slice(-10), canvas.toDataURL()]);
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveState();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasDrawn(false);
    setHistory([canvas.toDataURL()]);
  };

  const undo = () => {
    if (history.length <= 1) {
      clearCanvas();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const newHistory = history.slice(0, -1);
    const prevState = newHistory[newHistory.length - 1];

    const img = new Image();
    img.src = prevState;
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
      setHistory(newHistory);
      if (newHistory.length <= 1) setHasDrawn(false);
    };
  };

  const handleSave = () => {
    if (!hasDrawn) {
      alert("Silakan bubuhkan tanda tangan terlebih dahulu.");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Export high-quality transparent PNG
    const dataUrl = canvas.toDataURL('image/png');
    if (onSave) onSave(dataUrl);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">{title}</h4>
          <p className="text-[11px] text-foreground/60">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={undo}
            disabled={history.length <= 1}
            title="Urungkan Coretan"
            className="p-1.5 rounded-lg border border-border hover:bg-muted text-foreground/70 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={clearCanvas}
            title="Bersihkan Tanda Tangan"
            className="p-1.5 rounded-lg border border-border hover:bg-muted text-foreground/70 transition-colors"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="relative w-full h-44 rounded-xl border-2 border-dashed border-teal-500/40 bg-background/80 overflow-hidden touch-none select-none">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-foreground/30 text-xs italic font-medium">
            ✍️ Usap atau tanda tangani di sini
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground/70 hover:bg-muted transition-colors"
          >
            Batal
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasDrawn}
          className="px-4 py-1.5 rounded-lg bg-teal hover:bg-teal-600 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-3.5 h-3.5" />
          Gunakan Tanda Tangan
        </button>
      </div>
    </div>
  );
}
