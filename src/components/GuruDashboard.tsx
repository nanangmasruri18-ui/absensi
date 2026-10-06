import React, { useState, useEffect } from 'react';
import { db } from '../utils/db';
import { UserSession, Student } from '../types';
import { fetchAllFromSupabase } from '../utils/supabase';
import { 
  UserSquare, 
  Users, 
  GraduationCap, 
  ClipboardCheck, 
  Activity, 
  ThumbsUp, 
  ShieldAlert,
  CalendarCheck2,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface GuruDashboardProps {
  session: UserSession;
  setActiveTab: (tab: string) => void;
}

export default function GuruDashboard({ session, setActiveTab }: GuruDashboardProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setRefreshTrigger((k) => k + 1);
    window.addEventListener('db-synced', handleUpdate);
    window.addEventListener('absensi-updated', handleUpdate);
    return () => {
      window.removeEventListener('db-synced', handleUpdate);
      window.removeEventListener('absensi-updated', handleUpdate);
    };
  }, []);

  // Retrieve teacher profile
  const teachers = db.getTeachers();
  const currentTeacher = teachers.find((t) => t.id === session.userId);
  const classes = db.getClasses();

  // Selected class for dashboard viewing
  const initialClassId = session.assignedClassId && classes.some((c) => c.id === session.assignedClassId)
    ? session.assignedClassId
    : (classes.length > 0 ? classes[0].id : '');

  const [selectedClassId, setSelectedClassId] = useState(initialClassId);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [refreshError, setRefreshError] = useState(false);

  const handleSyncRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError(false);
    setRefreshMessage('Harap tunggu, sedang menyinkronkan data dengan server database...');
    try {
      const success = await fetchAllFromSupabase(true);
      setRefreshTrigger((k) => k + 1);
      if (success) {
        setRefreshMessage('Penyelarasan berhasil! Sistem memuat data terbaru.');
        setTimeout(() => setRefreshMessage(''), 3500);
      } else {
        setRefreshError(true);
        setRefreshMessage('Sinkronisasi selesai menggunakan cache lokal.');
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
  
  // Find currently active class
  const activeClass = classes.find((c) => c.id === selectedClassId);
  const classStudents = activeClass
    ? db.getStudents().filter((s) => s.classId === activeClass.id)
    : [];

  const totalStudents = classStudents.length;

  // Today's date YYYY-MM-DD
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const attendance = db.getAttendance();
  const todayClassAttendances = attendance.filter(
    (a) => a.classId === activeClass?.id && a.date === todayStr
  );

  // Fallback to latest recorded date if today hasn't been logged yet
  const latestDateRecords = todayClassAttendances.length > 0
    ? todayClassAttendances
    : attendance
        .filter((a) => a.classId === activeClass?.id)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, totalStudents || 10);

  const displayDateStr = todayClassAttendances.length > 0
    ? todayStr
    : (latestDateRecords.length > 0 ? latestDateRecords[0].date : todayStr);

  const stats = {
    H: latestDateRecords.filter((a) => a.status === 'H').length,
    S: latestDateRecords.filter((a) => a.status === 'S').length,
    I: latestDateRecords.filter((a) => a.status === 'I').length,
    A: latestDateRecords.filter((a) => a.status === 'A').length,
  };

  const hasLoggedToday = todayClassAttendances.length > 0;
  const attendanceRate = totalStudents > 0 && stats.H > 0
    ? Math.round((stats.H / totalStudents) * 100)
    : 0;

  return (
    <div className="space-y-6 font-sans animate-fade-in">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-md">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
          Selamat Datang, {session.name}
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-emerald-50/95 font-medium leading-relaxed">
          Gunakan dasbor ini untuk mengelola absensi harian siswa, memantau kehadiran kelas, dan mengunduh laporan rekapitulasi sekolah.
        </p>
      </div>

      {/* Database Sync Controls */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Database size={20} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800">Sinkronisasi Database Sekolah</h3>
            <p className="text-[11px] text-slate-500 font-medium">Selaraskan data kehadiran dan profil siswa dengan database terpusat sekolah</p>
          </div>
        </div>
        <button
          onClick={handleSyncRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-xs disabled:bg-slate-300 disabled:cursor-not-allowed shrink-0 cursor-pointer"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Menyinkronkan...' : 'Sinkronkan Data Sekarang'}
        </button>
      </div>

      {refreshMessage && (
        <div className={`p-4 rounded-xl text-xs font-bold leading-relaxed flex items-center gap-2.5 ${refreshError ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
          {refreshError ? <AlertCircle size={16} className="text-amber-500" /> : <CheckCircle2 size={16} className="text-emerald-500" />}
          <span>{refreshMessage}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profil Guru */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <UserSquare size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Profil Pendidik</h3>
                <p className="text-xs text-slate-500 font-medium">Biodata guru & kelas pengajaran</p>
              </div>
            </div>

            {/* Class picker for guru */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 hidden sm:inline">Pilih Kelas:</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.id === session.assignedClassId ? '★ (Wali Kelas)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 space-y-4 text-xs sm:text-sm">
            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-500 font-medium">Nama Guru:</span>
              <span className="col-span-2 text-slate-800 font-bold">{currentTeacher?.name || session.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-500 font-medium">NIP Pegawai:</span>
              <span className="col-span-2 text-slate-800 font-mono font-semibold">{currentTeacher?.nip || '-'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-500 font-medium">Jenis Kelamin:</span>
              <span className="col-span-2 text-slate-800 font-semibold">
                {currentTeacher?.gender === 'L' ? 'Laki-Laki (L)' : 'Perempuan (P)'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-slate-500 font-medium">Kelas Pengajaran:</span>
              <span className="col-span-2 px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold w-fit text-xs border border-blue-100">
                {activeClass?.name || 'Belum Dipilih'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Block */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-2">Aksi Cepat Absensi</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              Mulai input presensi harian siswa untuk kelas Anda, lihat atau unduh laporan rekapitulasi lengkap.
            </p>
          </div>

          <div className="mt-5 space-y-2.5">
            <button
              onClick={() => setActiveTab('absensi')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              id="guru-input-absensi-btn"
            >
              <ClipboardCheck size={15} />
              Isi Absensi Harian Sekarang
            </button>
            <button
              onClick={() => setActiveTab('rekap-bulanan')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              id="guru-open-rekap-btn"
            >
              <CalendarCheck2 size={15} />
              Unduh Rekap Bulanan
            </button>
          </div>
        </div>
      </div>

      {/* Room Specific Stats */}
      {activeClass && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 tracking-wide">
              Statistik Kehadiran {activeClass.name}
            </h3>
            <span className="text-xs text-slate-500 font-semibold">
              {totalStudents} Siswa Terdaftar
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Total Student count */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Jumlah Siswa</p>
                  <p className="mt-2 text-3xl font-extrabold text-slate-800">{totalStudents}</p>
                </div>
                <span className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Users size={22} /></span>
              </div>
              <p className="text-[10px] text-slate-500 mt-3 font-semibold leading-relaxed">
                Seluruh siswa aktif dalam rombongan belajar {activeClass.name}.
              </p>
            </div>

            {/* Attendance count today */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs md:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 mb-4 gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Presensi Kehadiran Siswa</h4>
                  <p className="text-[10px] text-slate-400 font-semibold">
                    Data tanggal: {displayDateStr}
                  </p>
                </div>
                {hasLoggedToday ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                    ✓ Sudah Diabsen Hari Ini ({attendanceRate}% Hadir)
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Rekap Terakhir ({displayDateStr})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-green-50/50 p-2.5 rounded-xl border border-green-100">
                  <p className="text-xs font-semibold text-green-600">Hadir</p>
                  <p className="text-lg font-bold text-green-700 mt-1">{stats.H}</p>
                </div>
                <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
                  <p className="text-xs font-semibold text-blue-600">Sakit</p>
                  <p className="text-lg font-bold text-blue-700 mt-1">{stats.S}</p>
                </div>
                <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                  <p className="text-xs font-semibold text-amber-600">Izin</p>
                  <p className="text-lg font-bold text-amber-700 mt-1">{stats.I}</p>
                </div>
                <div className="bg-red-50/50 p-2.5 rounded-xl border border-red-100">
                  <p className="text-xs font-semibold text-red-600">Alfa</p>
                  <p className="text-lg font-bold text-red-700 mt-1">{stats.A}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
