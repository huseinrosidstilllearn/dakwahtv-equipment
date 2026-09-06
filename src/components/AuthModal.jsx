import React from 'react';
import { LogIn, UserPlus, X } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, mode, setMode, onSubmit, errorMsg }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in" id="auth-overlay" onClick={(e) => { if (e.target.id === 'auth-overlay') onClose(); }}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95" id="auth-modal">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-black text-primary tracking-tight uppercase flex items-center gap-2 mb-1">
                {mode === 'login' ? <LogIn className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
                {mode === 'login' ? 'Login Peminjam' : 'Daftar Peminjam'}
              </h2>
              <p className="text-xs font-mono text-foreground/50 leading-relaxed">
                {mode === 'login' 
                  ? 'Masuk ke akun Anda untuk melihat histori & status peminjaman.' 
                  : 'Buat akun baru untuk mulai mengajukan peminjaman alat.'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 -mr-2 -mt-2 text-foreground/50 hover:text-foreground rounded-lg hover:bg-accent transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex gap-2 p-1 bg-muted/50 rounded-xl mb-6">
            <button 
              type="button" 
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${mode === 'login' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/60 hover:text-foreground'}`}
            >
              <LogIn className="w-4 h-4" /> Login
            </button>
            <button 
              type="button" 
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${mode === 'signup' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/60 hover:text-foreground'}`}
            >
              <UserPlus className="w-4 h-4" /> Daftar Akun
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-[10px] font-mono text-foreground/50 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
                <input name="name" type="text" placeholder="Masukkan nama lengkap Anda" required className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all" />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-mono text-foreground/50 uppercase tracking-wider mb-1.5">Alamat Email</label>
              <input name="email" type="email" placeholder="nama@email.com" required className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all" />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-foreground/50 uppercase tracking-wider mb-1.5">Password</label>
              <input name="password" type="password" placeholder="Minimal 6 karakter" required minLength="6" className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all" />
            </div>

            {errorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs font-mono text-center">
                {errorMsg}
              </div>
            )}

            <div className="pt-2">
              <button type="submit" className="w-full py-3.5 bg-primary text-primary-foreground font-black rounded-xl hover:bg-primary/90 transition-all flex justify-center items-center gap-2">
                {mode === 'login' ? 'Masuk ke Akun Peminjam' : 'Daftar Akun Sekarang'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
