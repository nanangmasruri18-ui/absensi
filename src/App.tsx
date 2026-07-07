import React, { useState, useEffect, useRef } from 'react';
import { db } from './utils/db';
import { UserSession } from './types';

// Component imports
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import AdminDashboard from './components/AdminDashboard';
import GuruDashboard from './components/GuruDashboard';
import DataKelas from './components/DataKelas';
import DataGuru from './components/DataGuru';
import DataSiswa from './components/DataSiswa';
import HariLibur from './components/HariLibur';
import AbsensiSiswa from './components/AbsensiSiswa';
import RekapBulanan from './components/RekapBulanan';
import RekapSemester from './components/RekapSemester';
import PengaturanAkun from './components/PengaturanAkun';

// Icons
import { Menu, Clock, HelpCircle, ShieldAlert, CheckCircle, Cloud, CloudOff, RefreshCw, AlertCircle, Copy, Check, Database } from 'lucide-react';
import { fetchAllFromSupabase, subscribeToSync, SyncState, pushToSupabase } from './utils/supabase';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  // Real-time time clock state
  const [currentTime, setCurrentTime] = useState(new Date());

  // Supabase Sync States
  const [syncState, setSyncState] = useState<SyncState>({ status: 'syncing' });
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Inactivity auto logout states (10 minutes)
  const [isLoggedOutForInactivity, setIsLoggedOutForInactivity] = useState(false);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const INACTIVITY_LIMIT_MS = 10 * 60 * 1000; // 10 minutes

  // Bootstrap data from Supabase
  useEffect(() => {
    fetchAllFromSupabase().then(() => {
      setDataLoaded(true);
    });

    const unsubscribe = subscribeToSync((state) => {
      setSyncState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleCopySQL = () => {
    navigator.clipboard.writeText(`create table if not exists absensi_sync (
  key text primary key,
  value jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable row level security (RLS)
alter table absensi_sync enable row level security;

-- Create policy to allow all actions for anon users
create policy "Allow public access"
on absensi_sync for all
using (true)
with check (true);`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Clock runner
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Reset session on page reload/check session persistence (optional, let's keep it in session state)
  const handleLogin = (userSession: UserSession) => {
    setSession(userSession);
    setActiveTab('dashboard');
    setIsLoggedOutForInactivity(false);
    resetInactivityTimer();
  };

  const handleLogout = () => {
    setSession(null);
    clearInactivityTimer();
  };

  // INACTIVITY MONITORING LOGIC
  const resetInactivityTimer = () => {
    if (!session) return;
    
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }

    inactivityTimeoutRef.current = setTimeout(() => {
      // Trigger inactive logout
      setSession(null);
      setIsLoggedOutForInactivity(true);
    }, INACTIVITY_LIMIT_MS);
  };

  const clearInactivityTimer = () => {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
  };

  // Activity listeners to reset timer
  useEffect(() => {
    if (!session) {
      clearInactivityTimer();
      return;
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity);
    });

    // Start timer on login
    resetInactivityTimer();

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
      clearInactivityTimer();
    };
  }, [session]);

  const handleProfileUpdated = (newName: string) => {
    if (session) {
      setSession({
        ...session,
        name: newName,
      });
    }
  };

  // Determine which page content to render
  const renderContent = () => {
    if (!session) return null;

    switch (activeTab) {
      case 'dashboard':
        return session.role === 'admin' 
          ? <AdminDashboard /> 
          : <GuruDashboard session={session} setActiveTab={setActiveTab} />;
      case 'rombel':
        return session.role === 'admin' ? <DataKelas /> : null;
      case 'guru':
        return session.role === 'admin' ? <DataGuru /> : null;
      case 'siswa':
        return session.role === 'admin' ? <DataSiswa /> : null;
      case 'libur':
        return session.role === 'admin' ? <HariLibur /> : null;
      case 'absensi':
        return <AbsensiSiswa session={session} />;
      case 'rekap-bulanan':
        return <RekapBulanan session={session} />;
      case 'rekap-semester':
        return <RekapSemester session={session} />;
      case 'pengaturan':
        return <PengaturanAkun session={session} onProfileUpdated={handleProfileUpdated} />;
      default:
        return session.role === 'admin' 
          ? <AdminDashboard /> 
          : <GuruDashboard session={session} setActiveTab={setActiveTab} />;
    }
  };

  // Header and layout wrappers
  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans antialiased text-slate-200">
        <div className="relative flex items-center justify-center w-20 h-20 mb-6">
          <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping"></div>
          <div className="relative p-5 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/30">
            <Database size={32} className={syncState.status === 'syncing' ? 'animate-bounce' : ''} />
          </div>
        </div>
        <h1 className="text-base sm:text-lg font-extrabold text-white tracking-wide">
          {syncState.status === 'error' ? 'Koneksi Supabase Tertunda / Offline' : 'Menghubungkan ke Supabase...'}
        </h1>
        
        {syncState.status === 'error' ? (
          <div className="mt-3 max-w-md bg-red-950/40 border border-red-900/50 p-4 rounded-xl text-left text-xs leading-relaxed text-red-200">
            <div className="flex gap-2.5">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-red-300">Penyebab Pending:</span>
                <p className="mt-1 font-mono text-[11px] bg-red-950/20 p-2 rounded break-all">{syncState.errorMessage}</p>
                <p className="mt-2 text-slate-300 text-[11px]">
                  Hal ini terjadi karena tabel <code className="text-yellow-300 font-mono text-[11px]">absensi_sync</code> belum dibuat pada database Supabase baru Anda. Aktifkan tabel dengan perintah SQL di bawah.
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowSqlModal(true)}
                className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[10px] text-center transition cursor-pointer"
              >
                Atur Tabel di Supabase
              </button>
              <button
                onClick={() => setDataLoaded(true)}
                className="flex-1 py-1.5 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-lg text-[10px] text-center transition cursor-pointer"
              >
                Gunakan Offline & Reset
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 mt-2 font-medium max-w-xs leading-normal">
            Menyelaraskan konfigurasi sekolah dan data presensi dengan database Supabase Anda...
          </p>
        )}
        
        {showSqlModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in text-slate-800">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 text-left animate-slide-up">
              <h3 className="text-sm font-extrabold text-slate-900">Konfigurasi SQL Tabel Supabase</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Silakan buka menu <strong>SQL Editor</strong> di dashboard Supabase Anda, buat query baru, kemudian salin dan jalankan (Run) perintah berikut:
              </p>
              
              <div className="mt-4 relative">
                <pre className="p-4 bg-slate-950 text-emerald-400 text-[10px] font-mono rounded-xl overflow-x-auto max-h-56 leading-relaxed">
{`create table if not exists absensi_sync (
  key text primary key,
  value jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Mengaktifkan Row Level Security
alter table absensi_sync enable row level security;

-- Membuat akses publik tanpa login token
create policy "Allow public access"
on absensi_sync for all
using (true)
with check (true);`}
                </pre>
                <button
                  type="button"
                  onClick={handleCopySQL}
                  className="absolute right-3 top-3 p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
              
              <div className="mt-5 flex justify-end gap-2 text-xs font-bold">
                <button
                  onClick={() => setShowSqlModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    setShowSqlModal(false);
                    setDataLoaded(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition cursor-pointer shadow-sm shadow-blue-200"
                >
                  Lanjutkan Offline
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!session) {
    return (
      <div className="relative font-sans antialiased text-slate-800">
        {isLoggedOutForInactivity && (
          <div className="fixed inset-x-0 top-0 z-50 bg-amber-600 text-white p-3.5 text-center shadow-lg flex items-center justify-center gap-2.5 font-sans animate-fade-in text-xs sm:text-sm">
            <ShieldAlert size={18} className="shrink-0 animate-pulse text-amber-200" />
            <span>Sesi Anda telah berakhir secara otomatis karena terdeteksi tidak ada aktivitas selama 10 menit. Silahkan masuk kembali.</span>
            <button
              onClick={() => setIsLoggedOutForInactivity(false)}
              className="ml-3 px-2 py-0.5 rounded bg-amber-800 text-amber-100 hover:bg-amber-900 text-xs font-semibold cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}
        <Login onLoginSuccess={handleLogin} />
      </div>
    );
  }

  const school = db.getSchool();

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden font-sans antialiased text-slate-800">
      {/* Sidebar navigation */}
      <Sidebar
        session={session}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main Panel Content side */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header container bar */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-sm z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg lg:hidden transition focus:outline-none"
              id="mobile-menu-burger-btn"
            >
              <Menu size={20} />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">{school.name}</h2>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Kurikulum Merdeka Belajar</p>
            </div>
          </div>

          {/* Date Stamp & real-time UTC Clock */}
          <div className="flex items-center gap-3 text-xs font-sans">
            {/* Supabase Status Pill */}
            <div className="flex items-center">
              {syncState.status === 'syncing' && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-bold animate-pulse">
                  <RefreshCw size={12} className="animate-spin text-amber-500" />
                  <span className="hidden sm:inline">Menyimpan ke Supabase...</span>
                </div>
              )}
              {syncState.status === 'synced' && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-emerald-100 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold shadow-sm">
                  <Cloud size={12} className="text-emerald-500" />
                  <span className="hidden sm:inline">Supabase Tersinkron</span>
                </div>
              )}
              {syncState.status === 'error' && (
                <button
                  type="button"
                  onClick={() => setShowSqlModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-red-200 bg-red-50 text-red-700 text-[10px] font-bold hover:bg-red-100 transition cursor-pointer shadow-sm animate-pulse"
                >
                  <CloudOff size={12} className="text-red-500" />
                  <span className="hidden sm:inline">Supabase-Offline (Atur SQL)</span>
                </button>
              )}
            </div>

            <div className="hidden md:flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 font-semibold">
              <Clock size={14} className="text-blue-500" />
              <span>{currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span className="text-slate-300">|</span>
              <span className="font-mono">{currentTime.toLocaleTimeString('id-ID')} WIB</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 block sm:hidden">👤</span>
              <span className="font-bold text-slate-700 hidden sm:block text-xs leading-tight">
                {session.name}
                <span className="block text-[9px] text-slate-400 font-extrabold text-right uppercase tracking-wider">
                  {session.role === 'admin' ? 'Admin' : 'Guru Kelas'}
                </span>
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic page contents loader */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          <div className="max-w-7xl mx-auto pb-12">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
