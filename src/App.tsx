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
import { Menu, Clock, ShieldAlert, CheckCircle, RefreshCw, Database } from 'lucide-react';
import { fetchAllFromSupabase, subscribeToSync, SyncState } from './utils/supabase';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [rekapParams, setRekapParams] = useState<{ classId?: string; month?: number; year?: number }>({});
  
  // Real-time clock state
  const [currentTime, setCurrentTime] = useState(new Date());

  // Database Sync States
  const [syncState, setSyncState] = useState<SyncState>({ status: 'synced' });
  
  // Inactivity auto logout states (10 minutes)
  const [isLoggedOutForInactivity, setIsLoggedOutForInactivity] = useState(false);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const INACTIVITY_LIMIT_MS = 10 * 60 * 1000; // 10 minutes

  // Bootstrap data from backend in background
  useEffect(() => {
    fetchAllFromSupabase();

    const unsubscribe = subscribeToSync((state) => {
      setSyncState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Clock runner
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
        return (
          <AbsensiSiswa 
            session={session} 
            onNavigateToRekap={(classId, month, year) => {
              setRekapParams({ classId, month, year });
              setActiveTab('rekap-bulanan');
            }} 
          />
        );
      case 'rekap-bulanan':
        return (
          <RekapBulanan 
            session={session} 
            initialClassId={rekapParams.classId}
            initialMonth={rekapParams.month}
            initialYear={rekapParams.year}
          />
        );
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
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-xs z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg lg:hidden transition focus:outline-none cursor-pointer"
              id="mobile-menu-burger-btn"
            >
              <Menu size={20} />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">{school.name}</h2>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Kurikulum Merdeka Belajar</p>
            </div>
          </div>

          {/* Date Stamp & real-time clock */}
          <div className="flex items-center gap-3 text-xs font-sans">
            {/* Database Status Pill */}
            <div className="flex items-center">
              {syncState.status === 'syncing' ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-bold animate-pulse">
                  <RefreshCw size={12} className="animate-spin text-blue-500" />
                  <span className="hidden sm:inline">Menyimpan data...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold shadow-xs">
                  <CheckCircle size={12} className="text-emerald-500" />
                  <span className="hidden sm:inline">Database Tersinkronisasi</span>
                </div>
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
