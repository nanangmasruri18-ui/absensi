import React, { useState } from 'react';
import { db, encryptPassword } from '../utils/db';
import { UserSession } from '../types';
import { fetchAllFromSupabase } from '../utils/supabase';
import { 
  School, 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  ShieldCheck, 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (session: UserSession) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [refreshError, setRefreshError] = useState(false);

  const handleSupabaseRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError(false);
    setRefreshMessage('Sedang mengunduh data terbaru dari database Supabase Anda...');
    try {
      const success = await fetchAllFromSupabase();
      if (success) {
        setRefreshMessage('Sinkronisasi Berhasil! Memuat ulang data sistem...');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setRefreshError(true);
        setRefreshMessage('Sinkronisasi Gagal. Harap cek koneksi internet atau konfigurasikan tabel Supabase Anda.');
        setTimeout(() => setRefreshMessage(''), 6000);
      }
    } catch (err) {
      setRefreshError(true);
      setRefreshMessage('Terjadi kesalahan saat menyelaraskan dengan Supabase.');
      setTimeout(() => setRefreshMessage(''), 4000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Small artificial delay for premium login feel
      setTimeout(() => {
        const teachers = db.getTeachers();
        const encrypted = encryptPassword(password);
        
        // Find matching credentials
        const matched = teachers.find(
          (t) => t.username === username.trim() && t.passwordHash === encrypted
        );

        if (matched) {
          // Success
          onLoginSuccess({
            userId: matched.id,
            username: matched.username,
            name: matched.name,
            role: matched.role,
            assignedClassId: matched.assignedClassId,
          });
        } else {
          setError('Username atau password yang Anda masukkan salah.');
        }
        setLoading(false);
      }, 500);
    } catch {
      setError('Terjadi kesalahan sistem saat mencoba masuk.');
      setLoading(false);
    }
  };

  const school = db.getSchool();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200 text-white transform hover:rotate-12 transition">
            <School size={40} id="login-school-logo" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-800 tracking-tight">
          Sistem Absensi Siswa
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          {school.name || 'SD Negeri Gelora'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl border border-slate-100 sm:rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700">
                Nama Pengguna (Username)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={18} />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Masukkan username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Kata Sandi (Password)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Masukkan password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  id="toggle-password-btn"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3.5 border border-red-100">
                <p className="text-xs font-semibold text-red-600">{error}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition cursor-pointer disabled:opacity-50"
                id="login-submit-btn"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Memproses...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn size={18} />
                    Masuk ke Sistem
                  </span>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-6 space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 flex items-start gap-2.5 text-xs text-slate-600">
              <ShieldCheck className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-700">Masuk Akun Bawaan Sekolah:</p>
                <div className="mt-1 space-y-0.5">
                  <p>🔑 <strong className="text-slate-800">Admin:</strong> admin / admin123</p>
                  <p>🔑 <strong className="text-slate-800">Guru 1A:</strong> guru1a / password1a</p>
                </div>
              </div>
            </div>

            {/* Supabase Sync Button for Login Page */}
            <div className="rounded-lg bg-blue-50/50 p-3.5 border border-blue-100/60 text-xs">
              <div className="flex items-start gap-2.5 text-blue-800">
                <Database className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-slate-800">Sinkronisasi Database Supabase</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 leading-normal font-medium">
                    Sinkronkan dan unduh data profil sekolah, guru, serta kehadiran siswa dari database Supabase sebelum Anda masuk.
                  </p>
                  <button
                    type="button"
                    onClick={handleSupabaseRefresh}
                    disabled={isRefreshing}
                    className="mt-3 w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-[11px] flex items-center justify-center gap-2 transition disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm shadow-blue-100 cursor-pointer"
                  >
                    <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                    {isRefreshing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
                  </button>
                </div>
              </div>
            </div>

            {refreshMessage && (
              <div className={`p-3 rounded-lg text-xs font-bold leading-relaxed flex items-center gap-2 ${refreshError ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                {refreshError ? <AlertCircle size={14} className="text-red-500 shrink-0" /> : <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                <span className="text-[11px] font-semibold">{refreshMessage}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
