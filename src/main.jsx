import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Migrasi satu kali: hapus semua token Supabase lama dari localStorage
// agar user yang sebelumnya auto-login melalui localStorage dipaksa login ulang.
// (Sistem baru menggunakan sessionStorage — hilang saat tab ditutup)
const _migKey = 'dtv-sess-migration-v1';
if (!sessionStorage.getItem(_migKey)) {
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('sb-') && k.includes('auth-token')) {
      localStorage.removeItem(k);
    }
  });
  sessionStorage.setItem(_migKey, '1');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

