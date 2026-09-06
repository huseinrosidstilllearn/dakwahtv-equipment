import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X, HelpCircle } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', title = '', duration = 4000) => {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newToast = { id, message: String(message || ''), type, title, duration };

    setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5 toasts

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  const toast = {
    success: (msg, title = 'Berhasil') => showToast(msg, 'success', title),
    error: (msg, title = 'Terjadi Kesalahan') => showToast(msg, 'error', title),
    warning: (msg, title = 'Perhatian') => showToast(msg, 'warning', title),
    info: (msg, title = 'Informasi') => showToast(msg, 'info', title),
  };

  // Modern replacement for window.confirm
  const confirm = useCallback(({
    title = 'Konfirmasi Aksi',
    message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
    confirmText = 'Lanjutkan',
    cancelText = 'Batal',
    type = 'primary' // 'primary' | 'danger' | 'warning'
  }) => {
    return new Promise((resolve) => {
      setConfirmState({
        title,
        message,
        confirmText,
        cancelText,
        type,
        resolve: (val) => {
          setConfirmState(null);
          resolve(val);
        }
      });
    });
  }, []);

  // Intercept window.alert so even legacy or unrefactored calls use our custom Toast!
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg) => {
      const str = String(msg || '');
      if (str.toLowerCase().includes('berhasil') || str.toLowerCase().includes('sukses')) {
        toast.success(str);
      } else if (str.toLowerCase().includes('gagal') || str.toLowerCase().includes('error') || str.toLowerCase().includes('salah')) {
        toast.error(str);
      } else if (str.toLowerCase().includes('perhatian') || str.toLowerCase().includes('peringatan') || str.toLowerCase().includes('tidak tersedia')) {
        toast.warning(str);
      } else {
        toast.info(str);
      }
    };
    window.toast = toast;
    window.customConfirm = confirm;

    return () => {
      window.alert = originalAlert;
    };
  }, [showToast, confirm]);

  return (
    <ToastContext.Provider value={{ toast, showToast, confirm }}>
      {children}

      {/* TOAST NOTIFICATION CONTAINER (Top-Right) */}
      <div className="fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((t) => {
            const isSuccess = t.type === 'success';
            const isError = t.type === 'error';
            const isWarning = t.type === 'warning';

            const borderCls = isSuccess
              ? 'border-teal-600/30 dark:border-teal-500/40 shadow-[0_10px_25px_rgba(20,184,166,0.12),0_4px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_30px_rgba(20,184,166,0.25)]'
              : isError
              ? 'border-red-600/30 dark:border-red-500/40 shadow-[0_10px_25px_rgba(239,68,68,0.12),0_4px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_30px_rgba(239,68,68,0.25)]'
              : isWarning
              ? 'border-amber-600/30 dark:border-yellow-500/40 shadow-[0_10px_25px_rgba(245,158,11,0.12),0_4px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_30px_rgba(234,179,8,0.25)]'
              : 'border-blue-600/30 dark:border-blue-500/40 shadow-[0_10px_25px_rgba(59,130,246,0.12),0_4px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_30px_rgba(59,130,246,0.25)]';

            const iconBadgeCls = isSuccess
              ? 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-500/30'
              : isError
              ? 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30'
              : isWarning
              ? 'bg-amber-500/15 text-amber-800 dark:text-yellow-400 border border-amber-500/30'
              : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30';

            const barCls = isSuccess
              ? 'bg-teal-600 dark:bg-teal-500'
              : isError
              ? 'bg-red-600 dark:bg-red-500'
              : isWarning
              ? 'bg-amber-500 dark:bg-yellow-500'
              : 'bg-blue-600 dark:bg-blue-500';

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                className={`pointer-events-auto relative overflow-hidden bg-white dark:bg-[#0e1a20] border ${borderCls} rounded-2xl p-4 shadow-xl flex items-start gap-3 select-none`}
              >
                {/* Status Icon Badge */}
                <div className={`p-1.5 rounded-xl shrink-0 flex items-center justify-center ${iconBadgeCls}`}>
                  {isSuccess && <CheckCircle2 className="w-4 h-4" />}
                  {isError && <AlertCircle className="w-4 h-4" />}
                  {isWarning && <AlertTriangle className="w-4 h-4" />}
                  {!isSuccess && !isError && !isWarning && <Info className="w-4 h-4" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-2">
                  {t.title && (
                    <div className="text-xs font-bold text-slate-900 dark:text-white mb-0.5 tracking-tight">
                      {t.title}
                    </div>
                  )}
                  <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed break-words whitespace-pre-line font-medium">
                    {t.message}
                  </div>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => removeToast(t.id)}
                  className="shrink-0 p-1 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Progress bar timer */}
                {t.duration > 0 && (
                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: t.duration / 1000, ease: 'linear' }}
                    className={`absolute bottom-0 left-0 h-[3px] ${barCls} opacity-80`}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* CONFIRMATION DIALOG MODAL */}
      <AnimatePresence>
        {confirmState && (
          <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-[#0c171d] text-slate-900 dark:text-[#f0f8ff] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with Icon */}
              <div className="p-5 border-b border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#12222b] flex items-center gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    confirmState.type === 'danger'
                      ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                      : 'bg-teal/15 text-teal border border-teal/30'
                  }`}
                >
                  {confirmState.type === 'danger' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <HelpCircle className="w-5 h-5 text-teal" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white leading-snug">
                    {confirmState.title}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-teal/80 uppercase tracking-wider font-semibold">
                    Dakwah TV Equipment
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 bg-white dark:bg-[#0c171d]">
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-normal">
                  {confirmState.message}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#12222b] flex justify-end items-center gap-3">
                <button
                  type="button"
                  onClick={() => confirmState.resolve(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-200 hover:bg-slate-300 dark:bg-[#182c37] dark:hover:bg-[#1f3846] border border-slate-300 dark:border-white/10 rounded-xl transition-all cursor-pointer"
                >
                  {confirmState.cancelText}
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => confirmState.resolve(true)}
                  className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer ${
                    confirmState.type === 'danger'
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/25'
                      : 'bg-teal hover:bg-teal-light text-white shadow-teal/25'
                  }`}
                >
                  {confirmState.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Safe fallback if called outside provider
    return {
      toast: window.toast || {
        success: (m) => console.log('Toast:', m),
        error: (m) => console.error('Toast error:', m),
        warning: (m) => console.warn('Toast warning:', m),
        info: (m) => console.info('Toast info:', m),
      },
      confirm: window.customConfirm || ((opts) => Promise.resolve(window.confirm(opts?.message || ''))),
    };
  }
  return context;
}
