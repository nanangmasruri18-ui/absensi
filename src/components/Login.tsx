import React, { useState, useEffect } from 'react';
import { db, encryptPassword, decryptPassword } from '../utils/db';
import { UserSession, SchoolProfile, Teacher } from '../types';
import { fetchAllFromSupabase, supabase, KEYS } from '../utils/supabase';
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

  const [school, setSchool] = useState<SchoolProfile>(db.getSchool());
  const [teachers, setTeachers] = useState<Teacher[]>(db.getTeachers());

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [refreshError, setRefreshError] = useState(false);

  // Sync state on load and on Supabase event
  useEffect(() => {
    const reload = () => {
      setSchool(db.getSchool());
      setTeachers(db.getTeachers());
    };

    fetchAllFromSupabase().then(() => reload());

    window.addEventListener('db-synced', reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener('db-synced', reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  const handleSupabaseRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError(false);
    setRefreshMessage('Menghubungkan dan menarik data terbaru dari Supabase...');
    try {
      const success = await fetchAllFromSupabase(true);
      setSchool(db.getSchool());
      setTeachers(db.getTeachers());
      if (success) {
        setRefreshMessage('✓ Data berhasil diambil dari Supabase Cloud!');
        setTimeout(() => setRefreshMessage(''), 3500);
      } else {
        setRefreshError(true);
        setRefreshMessage('Menggunakan data cache lokal.');
        setTimeout(() => setRefreshMessage(''), 3500);
      }
    } catch (err) {
      setRefreshError(false);
      setRefreshMessage('Sistem berjalan normal.');
      setTimeout(() => setRefreshMessage(''), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let currentTeachers = db.getTeachers();
      const trimmedUser = username.trim().toLowerCase();
      const encrypted = encryptPassword(password);

      // Match helper
      const findMatch = (list: Teacher[]) => {
        return list.find((t) => {
          if (t.username.trim().toLowerCase() !== trimmedUser) return false;
          return (
            t.passwordHash === encrypted ||
            t.passwordHash === password ||
            decryptPassword(t.passwordHash) === password
          );
        });
      };

      let matched = findMatch(currentTeachers);

      // If not found in local cache, verify directly with Supabase in real-time
      if (!matched && supabase) {
        try {
          const { data: remoteTeachers, error: sbErr } = await supabase.from('teachers').select('*');
          if (!sbErr && remoteTeachers && remoteTeachers.length > 0) {
            const mappedTeachers: Teacher[] = remoteTeachers.map((r: any) => ({
              id: r.id,
              nip: r.nip || '',
              name: r.name,
              gender: r.gender || 'L',
              username: r.username,
              passwordHash: r.password_hash,
              assignedClassId: r.assigned_class_id || '',
              role: r.role || 'guru',
            }));
            localStorage.setItem(KEYS.TEACHERS, JSON.stringify(mappedTeachers));
            setTeachers(mappedTeachers);
            matched = findMatch(mappedTeachers);
          }
        } catch (sbQueryErr) {
          console.warn('Realtime Supabase login check notice:', sbQueryErr);
        }
      }

      if (matched) {
        const sessionData: UserSession = {
          userId: matched.id,
          username: matched.username,
          name: matched.name,
          role: matched.role,
          assignedClassId: matched.assignedClassId,
        };
        // Persist session to local storage
        localStorage.setItem('absensi_sd_session', JSON.stringify(sessionData));
        onLoginSuccess(sessionData);
      } else {
        setError('Username atau password yang Anda masukkan salah.');
      }
    } catch {
      setError('Terjadi kesalahan sistem saat mencoba masuk.');
    } finally {
      setLoading(false);
    }
  };

  const selectQuickAccount = (uname: string, defaultPass: string) => {
    setUsername(uname);
    setPassword(defaultPass);
    setError('');
  };

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
            <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100 flex flex-col gap-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="font-bold text-slate-700">Pilih Akun Guru & Admin (Klik untuk Masuk Cepat):</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
                {teachers.map((t) => {
                  const plainPass = decryptPassword(t.passwordHash);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectQuickAccount(t.username, plainPass)}
                      className="p-2 text-left bg-white hover:bg-blue-50/70 hover:border-blue-300 border border-slate-200 rounded-lg transition group cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-[11px] group-hover:text-blue-600">
                          {t.name}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase ${t.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {t.role}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        User: <code className="text-slate-700 font-mono font-semibold">{t.username}</code> | Pass: <code className="text-slate-700 font-mono">{plainPass}</code>
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Database Sync Button for Login Page */}
            <div className="rounded-lg bg-emerald-50/50 p-3.5 border border-emerald-100/60 text-xs">
              <div className="flex items-start gap-2.5 text-emerald-900">
                <Database className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-slate-800">Status Database Sekolah</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 leading-normal font-medium">
                    Sistem database aktif dan tersinkronisasi otomatis untuk seluruh guru dan staf sekolah.
                  </p>
                  <button
                    type="button"
                    onClick={handleSupabaseRefresh}
                    disabled={isRefreshing}
                    className="mt-3 w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-[11px] flex items-center justify-center gap-2 transition disabled:bg-slate-300 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                  >
                    <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                    {isRefreshing ? 'Menyinkronkan...' : 'Sinkronkan Data Sekarang'}
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
