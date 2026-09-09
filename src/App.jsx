import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { supabase } from './supabase';
import { ToastProvider } from './context/ToastContext';
import Home from './pages/Home';
import Katalog from './pages/Katalog';
import Admin from './pages/Admin';
import Surat from './pages/Surat';
import Pemantau from './pages/Pemantau';
import Dashboard from './pages/Dashboard';
import SopTeknis from './pages/SopTeknis';
import { initTheme } from './utils/theme';

function App() {
  useEffect(() => {
    initTheme();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        try {
          const user = session.user;
          // Check if profile exists
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
          if (!profile) {
            // Create default profile safely only if it genuinely does not exist (never overwrite existing role)
            await supabase.from('profiles').insert([{
              id: user.id,
              email: user.email,
              display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
              role: 'user'
            }]).catch(() => {});
          }

          // Record last login timestamp directly into profiles table if column exists (RLS compliant)
          if (profile && 'last_login' in profile) {
            const nowIso = new Date().toISOString();
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
              supabase.from('profiles').update({ last_login: nowIso }).eq('id', user.id).then(() => {}).catch(() => {});
            }
          }
        } catch (e) {
          console.error("Error syncing user:", e);
        }
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <ToastProvider>
      <Router>
        <div className="doodle-bg"></div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/katalog" element={<Katalog />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/surat/:id" element={<Surat />} />
          <Route path="/surat/:id" element={<Surat />} />
          <Route path="/surat" element={<Surat />} />
          <Route path="/pemantau" element={<Pemantau />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/sop" element={<SopTeknis />} />
        </Routes>
      </Router>
    </ToastProvider>
  );
}

export default App;
