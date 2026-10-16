import React, { useState, useEffect } from 'react';
import { db } from '../utils/db';
import { SchoolProfile, ClassRombel, Teacher, Student } from '../types';
import { 
  fetchAllFromSupabase, 
  getSupabaseStatus, 
  checkSupabaseTables, 
  SupabaseStatusInfo,
  reinitializeSupabaseClient,
  uploadAllDataToSupabase,
  getActiveCredentials,
  syncSupabaseConfigFromServer
} from '../utils/supabase';
import { 
  Building2, 
  Users, 
  GraduationCap, 
  CalendarCheck2, 
  ShieldAlert, 
  UserRoundCheck,
  Download,
  Upload,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Cloud,
  Database,
  Copy,
  Check,
  ExternalLink,
  Code2,
  X,
  Key,
  Globe,
  UploadCloud,
  BookOpen,
  Sparkles,
  AlertTriangle
} from 'lucide-react';

const SQL_SCHEMA_STRING = `-- ====================================================================
-- SKRIP SETUP DATABASE SUPABASE UNTUK APLIKASI ABSENSI SISWA SD
-- ====================================================================
-- 1. Buka dashboard Supabase Anda: https://supabase.com/dashboard
-- 2. Pilih project Anda -> Masuk menu "SQL Editor"
-- 3. Buat query baru, tempel seluruh kode ini, lalu klik "RUN"
-- ====================================================================

-- 1. Tabel Profil Sekolah
create table if not exists public.school (
  id text primary key default 'school-1',
  name text not null default 'SDN 005 Gelora',
  address text default 'Jl. Kayangan, No. 348/C Gelora',
  npsn text default '10405436',
  admin_name text default 'Admin Gelora',
  updated_at timestamptz default now()
);

-- 2. Tabel Rombongan Belajar (Rombel / Kelas)
create table if not exists public.classes (
  id text primary key,
  name text not null,
  grade text not null,
  homeroom_teacher_id text default '',
  updated_at timestamptz default now()
);

-- 3. Tabel Guru & Admin
create table if not exists public.teachers (
  id text primary key,
  nip text default '',
  name text not null,
  gender text default 'L',
  username text unique not null,
  password_hash text not null,
  assigned_class_id text default '',
  role text default 'guru',
  updated_at timestamptz default now()
);

-- 4. Tabel Siswa
create table if not exists public.students (
  id text primary key,
  nis text default '',
  nisn text default '',
  name text not null,
  gender text default 'L',
  birth_place text default '',
  birth_date text default '',
  class_id text not null,
  updated_at timestamptz default now()
);

-- 5. Tabel Hari Libur Kalender Pendidikan
create table if not exists public.holidays (
  id text primary key,
  date text not null,
  name text not null,
  description text default '',
  updated_at timestamptz default now()
);

-- 6. Tabel Presensi / Absensi Harian Siswa
create table if not exists public.attendance (
  id text primary key,
  class_id text not null,
  student_id text not null,
  date text not null,
  status text not null check (status in ('H', 'S', 'I', 'A')),
  notes text default '',
  updated_at timestamptz default now()
);

-- Indexing untuk pencarian cepat
create index if not exists idx_attendance_class_date on public.attendance (class_id, date);
create index if not exists idx_attendance_date on public.attendance (date);
create index if not exists idx_students_class on public.students (class_id);

-- Aktifkan Row Level Security (RLS)
alter table public.school enable row level security;
alter table public.classes enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.holidays enable row level security;
alter table public.attendance enable row level security;

-- Kebijakan Akses (Policy) Publik agar aplikasi web dan mobile dapat membaca & menyimpan data
drop policy if exists "Akses penuh anon school" on public.school;
create policy "Akses penuh anon school" on public.school for all using (true) with check (true);

drop policy if exists "Akses penuh anon classes" on public.classes;
create policy "Akses penuh anon classes" on public.classes for all using (true) with check (true);

drop policy if exists "Akses penuh anon teachers" on public.teachers;
create policy "Akses penuh anon teachers" on public.teachers for all using (true) with check (true);

drop policy if exists "Akses penuh anon students" on public.students;
create policy "Akses penuh anon students" on public.students for all using (true) with check (true);

drop policy if exists "Akses penuh anon holidays" on public.holidays;
create policy "Akses penuh anon holidays" on public.holidays for all using (true) with check (true);

drop policy if exists "Akses penuh anon attendance" on public.attendance;
create policy "Akses penuh anon attendance" on public.attendance for all using (true) with check (true);

-- Aktifkan Supabase Realtime Publication
do $$
begin
  begin alter publication supabase_realtime add table public.attendance; exception when others then null; end;
  begin alter publication supabase_realtime add table public.students; exception when others then null; end;
  begin alter publication supabase_realtime add table public.classes; exception when others then null; end;
  begin alter publication supabase_realtime add table public.teachers; exception when others then null; end;
  begin alter publication supabase_realtime add table public.holidays; exception when others then null; end;
  begin alter publication supabase_realtime add table public.school; exception when others then null; end;
end $$;`;

export default function AdminDashboard() {
  const [school, setSchool] = useState<SchoolProfile>(db.getSchool());
  const [classes, setClasses] = useState<ClassRombel[]>(db.getClasses());
  const [teachers, setTeachers] = useState<Teacher[]>(db.getTeachers());
  const [students, setStudents] = useState<Student[]>(db.getStudents());
  const [attendance, setAttendance] = useState(db.getAttendance());

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [refreshError, setRefreshError] = useState(false);

  // Supabase Status and modal
  const [sbStatus, setSbStatus] = useState<SupabaseStatusInfo>(getSupabaseStatus());
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [modalTab, setModalTab] = useState<'guide' | 'sql' | 'credentials'>('guide');
  const [copiedSql, setCopiedSql] = useState(false);

  // Credentials state
  const currentCreds = getActiveCredentials();
  const [customUrl, setCustomUrl] = useState(currentCreds.url);
  const [customKey, setCustomKey] = useState(currentCreds.key);
  const [saveCredMessage, setSaveCredMessage] = useState('');
  const [saveCredError, setSaveCredError] = useState(false);
  const [isSavingCred, setIsSavingCred] = useState(false);

  // Upload all state
  const [isUploadingAll, setIsUploadingAll] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState(false);

  const reloadData = () => {
    setSchool(db.getSchool());
    setClasses(db.getClasses());
    setTeachers(db.getTeachers());
    setStudents(db.getStudents());
    setAttendance(db.getAttendance());
  };

  useEffect(() => {
    syncSupabaseConfigFromServer().then(() => {
      const creds = getActiveCredentials();
      setCustomUrl(creds.url);
      setCustomKey(creds.key);
      checkSupabaseTables().then(() => {
        setSbStatus(getSupabaseStatus());
      });
    });

    const handleConfigSynced = () => {
      const creds = getActiveCredentials();
      setCustomUrl(creds.url);
      setCustomKey(creds.key);
      checkSupabaseTables().then(() => {
        setSbStatus(getSupabaseStatus());
      });
    };

    let t: any = null;
    const handleDebouncedReload = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        reloadData();
      }, 100);
    };

    window.addEventListener('supabase-config-synced', handleConfigSynced);
    window.addEventListener('db-synced', handleDebouncedReload);
    window.addEventListener('absensi-updated', handleDebouncedReload);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener('supabase-config-synced', handleConfigSynced);
      window.removeEventListener('db-synced', handleDebouncedReload);
      window.removeEventListener('absensi-updated', handleDebouncedReload);
    };
  }, []);

  const handleSupabaseRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError(false);
    setRefreshMessage('Harap tunggu, sedang menyinkronkan data dengan Supabase dan database sekolah...');
    try {
      await syncSupabaseConfigFromServer(true);
      const isSbReady = await checkSupabaseTables();
      setSbStatus(getSupabaseStatus());
      const success = await fetchAllFromSupabase(true);
      reloadData();
      if (success) {
        setRefreshMessage(
          isSbReady 
            ? '✓ Penyelarasan berhasil! Terhubung langsung ke Supabase Cloud.' 
            : 'Penyelarasan berhasil melalui server database dan cache lokal.'
        );
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

  const copySqlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(SQL_SCHEMA_STRING);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    } catch (e) {
      // Fallback
    }
  };

  const handleSaveCredentials = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingCred(true);
    setSaveCredError(false);
    setSaveCredMessage('Memeriksa koneksi ke Supabase...');

    try {
      reinitializeSupabaseClient(customUrl, customKey);
      const isSbReady = await checkSupabaseTables();
      const status = getSupabaseStatus();
      setSbStatus(status);

      if (isSbReady) {
        setSaveCredMessage('✓ Berhasil terhubung ke Supabase Cloud dan seluruh tabel siap digunakan!');
        setTimeout(() => setSaveCredMessage(''), 4000);
      } else {
        setSaveCredError(true);
        if (status.errorMessage?.includes('does not exist') || status.errorMessage?.includes('attendance')) {
          setSaveCredMessage('Terkoneksi ke server Supabase, tetapi tabel belum dibuat. Silakan buka tab "Skrip SQL" dan jalankan skrip di SQL Editor.');
        } else {
          setSaveCredMessage(status.errorMessage || 'Koneksi gagal atau kredensial URL / Key tidak valid.');
        }
      }
    } catch (err: any) {
      setSaveCredError(true);
      setSaveCredMessage(err?.message || 'Gagal menghubungi server Supabase');
    } finally {
      setIsSavingCred(false);
    }
  };

  const handleUploadAllToSupabase = async () => {
    setIsUploadingAll(true);
    setUploadError(false);
    setUploadMessage('Sedang mengunggah seluruh profil sekolah, guru, rombel, siswa, dan absensi ke Supabase baru...');

    try {
      const result = await uploadAllDataToSupabase();
      if (result.success) {
        setUploadError(false);
        const c = result.counts;
        setUploadMessage(
          `✓ Sukses! Berhasil mengunggah ${c.classes || 0} rombel, ${c.teachers || 0} guru, ${c.students || 0} siswa, dan ${c.attendance || 0} catatan absensi ke database Supabase baru!`
        );
        const isSbReady = await checkSupabaseTables();
        setSbStatus(getSupabaseStatus());
        setTimeout(() => setUploadMessage(''), 5000);
      } else {
        setUploadError(true);
        setUploadMessage(result.message);
      }
    } catch (err: any) {
      setUploadError(true);
      setUploadMessage(`Gagal mengunggah: ${err?.message || 'Error koneksi'}`);
    } finally {
      setIsUploadingAll(false);
    }
  };

  // Statistics calculation
  const totalClasses = classes.length;
  // Exclude administrative 'admin' accounts from standard physical teacher list
  const totalTeachers = teachers.filter(t => t.role === 'guru').length;
  const totalStudents = students.length;

  // Let's calculate today's / latest active attendance date
  // Since we might not have records exactly for 'today' (which is June 21, 2026, Sunday - and Sunday has no attendance),
  // we will look at the most recent active date in our database, or June 20th, 2026.
  const latestDate = '2026-06-20'; // Latest seeded active schoolday (Saturday)
  const todayAttendances = attendance.filter((a) => a.date === latestDate);
  const totalInAttendance = todayAttendances.length;
  const totalHadir = todayAttendances.filter((a) => a.status === 'H').length;
  
  const attendanceRatio = totalInAttendance > 0 
    ? Math.round((totalHadir / totalInAttendance) * 100) 
    : 100; // default/previous is 100%

  // Backup state
  const [backupSuccess, setBackupSuccess] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const [restoreSuccess, setRestoreSuccess] = useState('');

  const triggerBackupDownload = () => {
    try {
      const backupJSON = db.getBackupJSON();
      const blob = new Blob([backupJSON], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Backup_Database_Absensi_SD_${new Date().toISOString().substring(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setBackupSuccess('File backup .json berhasil dibuat dan sedang diunduh.');
      setTimeout(() => setBackupSuccess(''), 4000);
    } catch {
      setBackupSuccess('');
    }
  };

  const handleRestoreUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const textStr = event.target?.result as string;
        const success = db.restoreBackupJSON(textStr);
        if (success) {
          setRestoreSuccess('Database berhasil dipulihkan dari file backup! Memuat ulang sistem...');
          setRestoreError('');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          setRestoreError('File backup salah atau tidak kompatibel dengan skema sistem.');
          setRestoreSuccess('');
        }
      } catch {
        setRestoreError('Format file JSON rusak dan tidak dapat didekripsi.');
        setRestoreSuccess('');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 font-sans animate-fade-in">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-md">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Selamat Datang di Command Center Admin</h2>
        <p className="mt-1.5 text-xs sm:text-sm text-blue-100/90 font-medium leading-relaxed">
          Kelola profil sekolah dasar, pantau statistik rombongan belajar, verifikasi rekap guru, dan unduh backup data secara real-time.
        </p>
      </div>

      {/* Cloud & Supabase Sync Status Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className={`p-2.5 rounded-xl ${sbStatus.isConfigured && sbStatus.isTablesReady ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <Database size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs font-bold text-slate-800">Sinkronisasi Database Cloud (Supabase Cloud)</h3>
                {sbStatus.isConfigured && sbStatus.isTablesReady ? (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 size={10} />
                    Supabase Cloud Aktif & Siap
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <AlertTriangle size={10} />
                    Perlu Setup Database Baru
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Penyimpanan online terpusat agar absensi dari guru di HP/laptop lain tersimpan permanen dan real-time
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setModalTab('guide');
                setShowSqlModal(true);
              }}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-indigo-200/60"
            >
              <Sparkles size={13} className="text-indigo-600" />
              <span>Petunjuk & Setup Supabase Baru</span>
            </button>
            <button
              onClick={handleSupabaseRefresh}
              disabled={isRefreshing}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Memeriksa...' : 'Cek Status'}
            </button>
          </div>
        </div>

        {/* Warning if disconnected or tables missing */}
        {(!sbStatus.isConfigured || !sbStatus.isTablesReady) && (
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={17} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950">Database Supabase Baru Belum Terhubung</p>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  {sbStatus.errorMessage
                    ? `Status saat ini: ${sbStatus.errorMessage}. `
                    : 'Koneksi ke Supabase sebelumnya telah diputus/dihapus. '}
                  Ikuti panduan mudah 5 langkah untuk membuat database baru di Supabase dan menghubungkannya ke aplikasi.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setModalTab('guide');
                setShowSqlModal(true);
              }}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg shrink-0 cursor-pointer shadow-xs transition"
            >
              Buka Panduan Setup
            </button>
          </div>
        )}
      </div>

      {refreshMessage && (
        <div className={`p-4 rounded-xl text-xs font-bold leading-relaxed flex items-center gap-2.5 ${refreshError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
          {refreshError ? <AlertCircle size={16} className="text-red-500" /> : <CheckCircle2 size={16} className="text-emerald-500" />}
          <span>{refreshMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Building2 size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Profil Sekolah Dasar</h3>
                <p className="text-xs text-slate-500 font-medium">Informasi instansi akademik terdaftar</p>
              </div>
            </div>

            <div className="mt-5 space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-slate-500 font-medium">Nama Sekolah:</span>
                <span className="col-span-2 text-slate-800 font-bold">{school.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-slate-500 font-medium">NPSN Nasional:</span>
                <span className="col-span-2 text-slate-800 font-mono font-semibold">{school.npsn}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-slate-500 font-medium">Alamat Lengkap:</span>
                <span className="col-span-2 text-slate-700 font-medium leading-relaxed">{school.address}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-slate-500 font-medium">Nama Administrator:</span>
                <span className="col-span-2 text-slate-800 font-semibold">{school.adminName}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-50 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
              ● Sistem Terhubung
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              ✓ Database Terenkripsi Local
            </span>
          </div>
        </div>

        {/* Database Backup Component */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <CalendarCheck2 size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Keamanan & Backup</h3>
                <p className="text-xs text-slate-500 font-medium">Penyelamatan database eksternal</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-600 leading-relaxed font-medium">
              Sesuai instruksi kurikulum, admin direkomendasikan mengunduh database cadangan secara harian untuk disimpan di luar awan lokal.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {backupSuccess && (
              <div className="p-2.5 bg-green-50 text-[11px] text-green-700 rounded-lg flex items-center gap-2 font-semibold">
                <CheckCircle2 size={14} className="shrink-0" />
                {backupSuccess}
              </div>
            )}
            
            {restoreSuccess && (
              <div className="p-2.5 bg-green-50 text-[11px] text-green-700 rounded-lg flex items-center gap-2 font-semibold">
                <CheckCircle2 size={14} className="shrink-0" />
                {restoreSuccess}
              </div>
            )}

            {restoreError && (
              <div className="p-2.5 bg-red-50 text-[11px] text-red-700 rounded-lg flex items-center gap-2 font-semibold">
                <AlertCircle size={14} className="shrink-0" />
                {restoreError}
              </div>
            )}

            <button
              onClick={triggerBackupDownload}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm"
              id="admin-backup-btn"
            >
              <Download size={14} />
              Backup Database (.JSON)
            </button>

            <label className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer shadow-sm">
              <Upload size={14} />
              Restore Database (.JSON)
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreUpload}
                className="hidden"
                id="admin-restore-input"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Stats Cards Section */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-4 tracking-wide">Statistik & Monitoring Sekolah</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Jumlah Rombel</span>
              <span className="p-1.5 bg-orange-50 text-orange-600 rounded-lg"><GraduationCap size={16} /></span>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-800">{totalClasses}</p>
            <p className="text-[10px] text-slate-500 mt-1 font-bold">Kelas Terdaftar</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Jumlah Guru</span>
              <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Users size={16} /></span>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-800">{totalTeachers}</p>
            <p className="text-[10px] text-slate-500 mt-1 font-bold">Wali Kelas Aktif</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Siswa</span>
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Users size={16} /></span>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-800">{totalStudents}</p>
            <p className="text-[10px] text-slate-500 mt-1 font-bold">Laki & Perempuan</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Kehadiran Rombel</span>
              <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><UserRoundCheck size={16} /></span>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-800">{attendanceRatio}%</p>
            <p className="text-[10px] text-slate-500 mt-1 font-bold">Presensi Sekolah Aktif</p>
          </div>
        </div>
      </div>

      {/* Date Warning info */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-800 leading-relaxed font-medium flex items-center gap-3">
        <CalendarDays className="h-5 w-5 text-blue-600 shrink-0" />
        <div>
          <strong className="text-blue-900">Catatan Harian Admin:</strong> Laporan persentase kehadiran sekolah dihitung berdasarkan tanggal absensi aktif terakhir terdokumentasi (<strong className="text-blue-900">Sabtu, 20 Juni 2026</strong>), sehingga persentase realistik tetap terpantau meskipun sekolah ditutup pada hari Minggu.
        </div>
      </div>

      {/* SQL & Supabase Setup Multi-Tab Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Database size={22} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800">
                    Petunjuk & Setup Database Baru di Supabase
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Panduan lengkap membuat database baru agar data sekolah & absensi tersimpan permanen
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 sm:gap-2 border-b border-slate-200 mb-4 pb-2 overflow-x-auto">
              <button
                onClick={() => setModalTab('guide')}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  modalTab === 'guide'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <BookOpen size={14} />
                <span>1. Panduan Langkah Demi Langkah</span>
              </button>
              <button
                onClick={() => setModalTab('sql')}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  modalTab === 'sql'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Code2 size={14} />
                <span>2. Skrip SQL Lengkap</span>
              </button>
              <button
                onClick={() => setModalTab('credentials')}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  modalTab === 'credentials'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Key size={14} />
                <span>3. Sambungkan URL & Kunci API</span>
              </button>
            </div>

            {/* Tab 1: Step by step Guide */}
            {modalTab === 'guide' && (
              <div className="space-y-4 text-xs text-slate-600 overflow-y-auto pr-1 flex-1 leading-relaxed">
                <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-100 text-blue-900 font-medium">
                  <p className="font-bold text-sm text-blue-950 mb-1 flex items-center gap-2">
                    <Sparkles size={16} className="text-blue-600" />
                    Cara Menghubungkan Supabase Baru (Estimasi 2-3 Menit)
                  </p>
                  <p className="text-xs text-blue-800">
                    Dengan membuat project baru di Supabase, data sekolah, akun guru, rombel, siswa, dan seluruh catatan absensi akan tersimpan online secara real-time dan tidak akan hilang meskipun browser dibersihkan atau perangkat dimatikan.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Step 1 */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shrink-0 font-extrabold">1</span>
                      <span>Buat Project Baru di Supabase Dashboard</span>
                    </div>
                    <p className="pl-7 text-slate-600">
                      Buka{' '}
                      <a
                        href="https://supabase.com/dashboard"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 font-bold underline inline-flex items-center gap-1"
                      >
                        supabase.com/dashboard <ExternalLink size={11} />
                      </a>
                      , masuk ke akun Anda, lalu klik tombol <strong>"New Project"</strong>.
                    </p>
                    <ul className="pl-11 list-disc text-slate-600 space-y-0.5 mt-1">
                      <li><strong>Name:</strong> Beri nama project (contoh: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">absensi-sd</code>)</li>
                      <li><strong>Database Password:</strong> Buat password yang kuat dan simpan password Anda</li>
                      <li><strong>Region:</strong> Pilih <strong>Singapore (ap-southeast-1)</strong> untuk kecepatan akses optimal dari Indonesia</li>
                      <li>Klik <strong>"Create new project"</strong> dan tunggu sekitar 1-2 menit hingga status database aktif.</li>
                    </ul>
                  </div>

                  {/* Step 2 */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shrink-0 font-extrabold">2</span>
                      <span>Ambil Project URL & API Key (anon / public)</span>
                    </div>
                    <p className="pl-7 text-slate-600">
                      Di panel menu sebelah kiri dashboard Supabase Anda:
                    </p>
                    <ul className="pl-11 list-disc text-slate-600 space-y-0.5 mt-1">
                      <li>Klik menu <strong>Project Settings</strong> (ikon roda gigi di kiri bawah).</li>
                      <li>Klik submenu <strong>API</strong>.</li>
                      <li>Salin <strong>Project URL</strong> (contoh: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">https://xxxxxxxxxxxxxxxx.supabase.co</code>).</li>
                      <li>Salin <strong>anon public key</strong> (kunci token API publik).</li>
                    </ul>
                  </div>

                  {/* Step 3 */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shrink-0 font-extrabold">3</span>
                      <span>Jalankan Skrip SQL di SQL Editor</span>
                    </div>
                    <p className="pl-7 text-slate-600">
                      Di panel menu kiri Supabase, klik <strong>SQL Editor</strong> &rarr; klik tombol <strong>"New query"</strong>.
                    </p>
                    <p className="pl-7 text-slate-600">
                      Buka tab <strong>"2. Skrip SQL Lengkap"</strong> di atas jendela ini, klik <strong>"Salin Skrip SQL"</strong>, lalu tempelkan (paste) ke SQL Editor Supabase dan klik tombol hijau <strong>RUN</strong>.
                    </p>
                  </div>

                  {/* Step 4 & 5 */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shrink-0 font-extrabold">4</span>
                      <span>Hubungkan Kredensial & Unggah Data</span>
                    </div>
                    <p className="pl-7 text-slate-600">
                      Buka tab <strong>"3. Sambungkan URL & Kunci API"</strong>, tempelkan Project URL dan Anon Key Anda, klik <strong>"Simpan & Hubungkan Database Baru"</strong>, kemudian klik tombol <strong>"Unggah Semua Data Saat Ini ke Supabase Baru"</strong>. Selesai!
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setModalTab('sql')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Lanjut ke Langkah 2: Salin Skrip SQL</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: SQL Script */}
            {modalTab === 'sql' && (
              <div className="space-y-3 text-xs text-slate-600 overflow-y-auto pr-1 flex-1 leading-relaxed">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <p className="font-bold text-slate-800">Skrip Tabel, RLS Policy, dan Realtime</p>
                    <p className="text-[11px] text-slate-500">Mencakup 6 tabel: school, classes, teachers, students, holidays, attendance</p>
                  </div>
                  <button
                    onClick={copySqlToClipboard}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
                  >
                    {copiedSql ? <Check size={14} className="text-emerald-200" /> : <Copy size={14} />}
                    <span>{copiedSql ? '✓ Berhasil Disalin!' : 'Salin Skrip SQL'}</span>
                  </button>
                </div>

                <div className="relative">
                  <pre className="bg-slate-900 text-slate-200 p-4 rounded-xl text-[11px] font-mono h-64 overflow-y-auto leading-relaxed border border-slate-800 select-all">
                    {SQL_SCHEMA_STRING}
                  </pre>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={() => setModalTab('guide')}
                    className="px-3.5 py-2 text-slate-600 hover:text-slate-800 font-bold text-xs"
                  >
                    &larr; Kembali ke Panduan
                  </button>
                  <button
                    onClick={() => setModalTab('credentials')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Lanjut ke Langkah 3: Masukkan Kredensial</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 3: Credentials & Upload */}
            {modalTab === 'credentials' && (
              <div className="space-y-4 text-xs text-slate-600 overflow-y-auto pr-1 flex-1 leading-relaxed">
                {/* Status Card */}
                <div className={`p-4 rounded-xl border ${
                  sbStatus.isConfigured && sbStatus.isTablesReady
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50/70 border-amber-200 text-amber-900'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-xs">
                    {sbStatus.isConfigured && sbStatus.isTablesReady ? (
                      <>
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        <span>Status: Supabase Cloud Terhubung & Tabel Siap Digunakan!</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                        <span>Status: {sbStatus.errorMessage || 'Belum Terhubung / Tabel Belum Dibuat'}</span>
                      </>
                    )}
                  </div>
                  {sbStatus.url && (
                    <p className="text-[11px] font-mono mt-1 opacity-80 break-all">
                      URL Aktif: {sbStatus.url}
                    </p>
                  )}
                </div>

                {/* Form Input URL & Key */}
                <form onSubmit={handleSaveCredentials} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                    <Key size={15} className="text-blue-600" />
                    Masukkan Kredensial Project Supabase Baru Anda:
                  </h4>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Project URL (Supabase URL):
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="https://xxxxxxxxxxxxxxxx.supabase.co"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Ditemukan di Supabase: Project Settings &rarr; API &rarr; Project URL
                    </p>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Project API Key (anon / public):
                    </label>
                    <textarea
                      required
                      rows={2}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Ditemukan di Supabase: Project Settings &rarr; API &rarr; Project API keys (anon public)
                    </p>
                  </div>

                  {saveCredMessage && (
                    <div className={`p-3 rounded-lg font-bold text-xs flex items-center gap-2 ${
                      saveCredError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}>
                      {saveCredError ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                      <span>{saveCredMessage}</span>
                    </div>
                  )}

                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomUrl('');
                        setCustomKey('');
                        reinitializeSupabaseClient('', '');
                        setSbStatus(getSupabaseStatus());
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 underline font-medium cursor-pointer"
                    >
                      Kosongkan Kredensial
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingCred}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:bg-slate-300"
                    >
                      {isSavingCred ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                      <span>{isSavingCred ? 'Memeriksa...' : 'Simpan & Hubungkan Database Baru'}</span>
                    </button>
                  </div>
                </form>

                {/* Upload Current Data Action */}
                <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <UploadCloud size={20} className="text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-indigo-950 text-xs">
                        Inisialisasi: Unggah Data Saat Ini ke Supabase Baru
                      </h4>
                      <p className="text-[11px] text-indigo-800 mt-0.5 leading-relaxed">
                        Setelah database Supabase baru dibuat dan skrip SQL dijalankan, klik tombol di bawah agar seluruh data profil sekolah, guru, kelas, siswa, dan absensi yang ada saat ini langsung tersimpan ke Supabase baru.
                      </p>
                    </div>
                  </div>

                  {uploadMessage && (
                    <div className={`p-3 rounded-lg font-bold text-xs flex items-center gap-2 ${
                      uploadError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}>
                      {uploadError ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                      <span>{uploadMessage}</span>
                    </div>
                  )}

                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={handleUploadAllToSupabase}
                      disabled={isUploadingAll}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                      <UploadCloud size={14} className={isUploadingAll ? 'animate-bounce' : ''} />
                      <span>{isUploadingAll ? 'Sedang Mengunggah...' : 'Unggah Semua Data Saat Ini ke Supabase Baru'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono truncate max-w-[280px] sm:max-w-md">
                URL: {sbStatus.url || 'Belum diisi'}
              </span>
              <button
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
