import React, { useState } from 'react';
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
  // Retrieve teacher profile
  const teachers = db.getTeachers();
  const currentTeacher = teachers.find((t) => t.id === session.userId);
  const classes = db.getClasses();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [refreshError, setRefreshError] = useState(false);

  const handleSupabaseRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError(false);
    setRefreshMessage('Harap tunggu, sedang mengunduh data kelas & absensi terbaru dari Supabase...');
    try {
      const success = await fetchAllFromSupabase();
      if (success) {
        setRefreshMessage('Penyelarasan berhasil! Sistem memuat data terbaru dari Supabase...');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setRefreshError(true);
        setRefreshMessage('Gagal menyinkronkan data. Pastikan tabel "absensi_sync" sudah diatur di Supabase Anda.');
        setTimeout(() => setRefreshMessage(''), 5500);
      }
    } catch (err) {
      setRefreshError(true);
      setRefreshMessage('Koneksi terputus atau terjadi kesalahan sistem.');
      setTimeout(() => setRefreshMessage(''), 4000);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Find assigned class
  const assignedClass = classes.find((c) => c.id === currentTeacher?.assignedClassId);
  const classStudents = assignedClass
    ? db.getStudents().filter((s) => s.classId === assignedClass.id)
    : [];

  const totalStudents = classStudents.length;

  // Track attendance records for June 20, 2026 (latest school day) for this class
  const activeDate = '2026-06-20';
  const attendance = db.getAttendance();
  const classAttendances = attendance.filter(
    (a) => a.classId === assignedClass?.id && a.date === activeDate
  );

  const stats = {
    H: classAttendances.filter((a) => a.status === 'H').length,
    S: classAttendances.filter((a) => a.status === 'S').length,
    I: classAttendances.filter((a) => a.status === 'I').length,
    A: classAttendances.filter((a) => a.status === 'A').length,
  };

  const hasLoggedToday = classAttendances.length > 0;
  const attendanceRate = totalStudents > 0 && hasLoggedToday
    ? Math.round((stats.H / totalStudents) * 100)
    : 0;

  return (
    <div className="space-y-6 font-sans animate-fade-in">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-md">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Selamat Datang, Bapak/Ibu Guru</h2>
        <p className="mt-1.5 text-xs sm:text-sm text-emerald-50/95 font-medium leading-relaxed">
          Gunakan dasbor ini untuk mengelola lembar kehadiran harian siswa, memantau absensi siswa hari ini, dan mengunduh laporan rekapitulasi kelas Anda.
        </p>
      </div>

      {/* Supabase Sync Controls */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Database size={20} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800">Sinkronisasi Database Supabase</h3>
            <p className="text-[11px] text-slate-500 font-medium">Ambil, selaraskan, dan unduh data kehadiran serta profil siswa terbaru dari Supabase</p>
          </div>
        </div>
        <button
          onClick={handleSupabaseRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed shrink-0 cursor-pointer"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
        </button>
      </div>

      {refreshMessage && (
        <div className={`p-4 rounded-xl text-xs font-bold leading-relaxed flex items-center gap-2.5 ${refreshError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
          {refreshError ? <AlertCircle size={16} className="text-red-500" /> : <CheckCircle2 size={16} className="text-emerald-500" />}
          <span>{refreshMessage}</span>
        </div>
      )}

      {!assignedClass ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-800 flex items-start gap-4">
          <ShieldAlert className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-sm text-amber-900">Perhatian: Anda belum diampu ke Kelas manapun!</h3>
            <p className="mt-1 text-xs leading-relaxed text-amber-700 font-medium">
              Akun guru Anda belum dihubungkan ke kelas rombongan belajar (Rombel). Harap hubungi Administrator Sekolah untuk menghubungkan akun Anda ke kelas pengajaran di menu <strong className="text-amber-900">Data Guru</strong> agar dapat memulai absensi siswa.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profil Guru */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <UserSquare size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Profil Guru Kelas</h3>
                  <p className="text-xs text-slate-500 font-medium">Biodata pendidik wali kelas aktif</p>
                </div>
              </div>

              <div className="mt-5 space-y-4 text-xs sm:text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-slate-500 font-medium">Nama Guru:</span>
                  <span className="col-span-2 text-slate-800 font-bold">{currentTeacher?.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-slate-500 font-medium">NIP Pegawai:</span>
                  <span className="col-span-2 text-slate-800 font-mono font-semibold">{currentTeacher?.nip}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-slate-500 font-medium">Jenis Kelamin:</span>
                  <span className="col-span-2 text-slate-800 font-semibold">
                    {currentTeacher?.gender === 'L' ? 'Laki-Laki (L)' : 'Perempuan (P)'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-slate-500 font-medium">Kelas yang Diampu:</span>
                  <span className="col-span-2 px-2.5 py-0.5 roundedbg bg-blue-50 text-blue-700 font-bold w-fit text-xs border border-blue-100">
                    {assignedClass.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Block */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-2">Aksi Cepat Absensi</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  Mulai mengisi absen siswa kelas Anda hari ini, edit absen sebelumnya, atau lihat tab laporan rekap bulanan Anda.
                </p>
              </div>

              <div className="mt-5 space-y-2.5">
                <button
                  onClick={() => setActiveTab('absensi')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                  id="guru-input-absensi-btn"
                >
                  <ClipboardCheck size={14} />
                  Isi Absensi Sekarang
                </button>
                <button
                  onClick={() => setActiveTab('rekap-bulanan')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                  id="guru-open-rekap-btn"
                >
                  <CalendarCheck2 size={14} />
                  Unduh Rekap Bulanan
                </button>
              </div>
            </div>
          </div>

          {/* Room Specific Stats */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-4 tracking-wide">Statistik Kehadiran Kelas {assignedClass.name}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Total Student count */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Jumlah Siswa</p>
                    <p className="mt-2 text-3xl font-extrabold text-slate-800">{totalStudents}</p>
                  </div>
                  <span className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Users size={22} /></span>
                </div>
                <p className="text-[10px] text-slate-500 mt-3 font-semibold leading-relaxed">
                  Semua siswa aktif dalam asuhan wali kelas.
                </p>
              </div>

              {/* Attendance count today */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm md:col-span-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700">Presensi Kehadiran Siswa Hari Ini</h4>
                    <p className="text-[10px] text-slate-400 font-semibold">Tercatat pada Sabtu, 20 Juni 2026</p>
                  </div>
                  {hasLoggedToday ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-50 text-green-700 border border-green-200">
                      ✓ Sudah Diabsen ({attendanceRate}% Hadir)
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-50 text-red-700 border border-red-200 animate-pulse">
                      ⚡ Belum Diabsen
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="bg-green-50/50 p-2.5 rounded-xl border border-green-100">
                    <p className="text-xs font-semibold text-green-600">Hadir</p>
                    <p className="text-lg font-bold text-green-700 mt-1">{hasLoggedToday ? stats.H : '-'}</p>
                  </div>
                  <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
                    <p className="text-xs font-semibold text-blue-600">Sakit</p>
                    <p className="text-lg font-bold text-blue-700 mt-1">{hasLoggedToday ? stats.S : '-'}</p>
                  </div>
                  <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                    <p className="text-xs font-semibold text-amber-600">Izin</p>
                    <p className="text-lg font-bold text-amber-700 mt-1">{hasLoggedToday ? stats.I : '-'}</p>
                  </div>
                  <div className="bg-red-50/50 p-2.5 rounded-xl border border-red-100">
                    <p className="text-xs font-semibold text-red-600">Alfa</p>
                    <p className="text-lg font-bold text-red-700 mt-1">{hasLoggedToday ? stats.A : '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
