import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fkdbgmcphqvejborcesc.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_XMeUalHSU1OKdf9raG6-Rw_uCzDhbCF';

// Gunakan sessionStorage agar session TIDAK tersimpan saat browser ditutup.
// User harus login ulang setiap membuka browser baru (session hanya hidup selama tab terbuka).
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: window.sessionStorage,
    persistSession: true,  // tetap persist, tapi ke sessionStorage (hilang saat tab ditutup)
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});
