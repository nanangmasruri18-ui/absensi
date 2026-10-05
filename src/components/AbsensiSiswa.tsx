import React, { useState, useEffect, useMemo } from 'react';
import { db, getDayNameID, isSunday, isHoliday } from '../utils/db';
import { Student, ClassRombel, Attendance, UserSession, AttendanceStatus } from '../types';
import { 
  ClipboardCheck, 
  Calendar, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Save, 
  Clock,
  Sparkles,
  Info,
  CalendarDays
} from 'lucide-react';

interface AbsensiSiswaProps {
  session: UserSession;
}

export default function AbsensiSiswa({ session }: AbsensiSiswaProps) {
  const isAdmin = session.role === 'admin';
  const classes = db.getClasses();
  const holidays = db.getHolidays();

  // Helper to format today's date string YYYY-MM-DD
  const getTodayStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Find preferred default class:
  // If user is a teacher with an assigned class, pick it.
  // Otherwise, pick the first class available.
  const preferredClassId = useMemo(() => {
    if (session.assignedClassId && classes.some((c) => c.id === session.assignedClassId)) {
      return session.assignedClassId;
    }
    return classes.length > 0 ? classes[0].id : '';
  }, [classes, session.assignedClassId]);

  // States
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [selectedClassId, setSelectedClassId] = useState(preferredClassId);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  
  // Local state grid of studentId -> status ('H' | 'S' | 'I' | 'A')
  const [attendanceGrid, setAttendanceGrid] = useState<Record<string, AttendanceStatus>>({});
  
  const [lockReason, setLockReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Update selected class if preferred changes and current is invalid
  useEffect(() => {
    if (!selectedClassId && preferredClassId) {
      setSelectedClassId(preferredClassId);
    }
  }, [preferredClassId, selectedClassId]);

  // Helper to format date safely
  const getFormattedDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Load students of selected Class and existing attendances
  useEffect(() => {
    if (!selectedClassId) {
      setClassStudents([]);
      setAttendanceGrid({});
      return;
    }

    // Fetch students of this class and SORT alphabetically (urut abjad)
    const list = db.getStudents()
      .filter((s) => s.classId === selectedClassId)
      .sort((a, b) => a.name.localeCompare(b.name));

    setClassStudents(list);

    // Check calendar notice rule: Sunday or Holiday (Warn but KEEP interactive)
    if (selectedDate && !isNaN(new Date(selectedDate).getTime())) {
      const isSun = isSunday(selectedDate);
      const holidaysList = db.getHolidays();
      const matchedHol = isHoliday(selectedDate, holidaysList);

      if (isSun) {
        setLockReason('Hari Minggu terdeteksi. Sistem menandai ini sebagai hari libur harian, namun pengisian dan penyimpanan absensi tetap diizinkan untuk keperluan kegiatan / susulan.');
      } else if (matchedHol) {
        setLockReason(`Libur akademik terdaftar: "${matchedHol.name}". Pengisian dan penyimpanan absensi tetap diizinkan.`);
      } else {
        setLockReason('');
      }
    } else {
      setLockReason('');
    }

    // Now load already saved attendance for that class and date
    const savedList = db.getAttendance().filter((a) => a.classId === selectedClassId && a.date === selectedDate);
    
    const initialGrid: Record<string, AttendanceStatus> = {};
    list.forEach((s) => {
      const match = savedList.find((a) => a.studentId === s.id);
      initialGrid[s.id] = match ? match.status : 'H'; // Default to 'H' (Hadir) for ease of input
    });

    setAttendanceGrid(initialGrid);
    setSaveSuccess(false);
    setSaveError('');
  }, [selectedDate, selectedClassId]);

  // Bulk set all students to H
  const setAllHadir = () => {
    const updated: Record<string, AttendanceStatus> = {};
    classStudents.forEach((s) => {
      updated[s.id] = 'H';
    });
    setAttendanceGrid(updated);
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceGrid((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  // Calculate live summary stats for this day
  const summaryStats = useMemo(() => {
    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let alfa = 0;

    classStudents.forEach((s) => {
      const status = attendanceGrid[s.id] || 'H';
      if (status === 'H') hadir++;
      else if (status === 'S') sakit++;
      else if (status === 'I') izin++;
      else if (status === 'A') alfa++;
    });

    const total = classStudents.length;
    const hadirPct = total > 0 ? Math.round((hadir / total) * 100) : 0;

    return { total, hadir, sakit, izin, alfa, hadirPct };
  }, [classStudents, attendanceGrid]);

  const saveAbsensi = () => {
    if (!selectedClassId) {
      setSaveError('Silakan pilih rombongan belajar (kelas) terlebih dahulu.');
      return;
    }
    if (classStudents.length === 0) {
      setSaveError('Tidak ada siswa di rombel ini untuk disimpan.');
      return;
    }

    setIsSaving(true);
    setSaveError('');

    try {
      // Map grid back to active array records
      const newRecords: Attendance[] = classStudents.map((s) => ({
        id: `${selectedClassId}-${s.id}-${selectedDate}`,
        classId: selectedClassId,
        studentId: s.id,
        date: selectedDate,
        status: attendanceGrid[s.id] || 'H',
        updatedAt: new Date().toISOString(),
      }));

      // Use dedicated helper that safely updates localStorage and backend
      const success = db.saveAttendanceForClassDate(selectedClassId, selectedDate, newRecords);

      if (success) {
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
        }, 4000);
      } else {
        setSaveError('Gagal menyimpan data absensi. Silakan coba lagi.');
      }
    } catch (err: any) {
      console.error('Save attendance error:', err);
      setSaveError('Terjadi kesalahan sistem saat menyimpan presensi.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm font-sans leading-normal animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">Lembar Input Absensi Harian Siswa</h2>
              <p className="text-xs text-slate-500 font-medium">
                Pilih rombel dan tanggal, lengkapi status kehadiran siswa, lalu simpan ke database sekolah
              </p>
            </div>
          </div>
        </div>

        {/* Quick today button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDate(getTodayStr())}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            <Clock size={13} className="text-blue-500" />
            Hari Ini
          </button>
        </div>
      </div>

      {/* Date & class pickers row */}
      <div className="my-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Calendar size={14} className="text-blue-500" />
            Pilih Tanggal Presensi:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Users size={14} className="text-blue-500" />
              Pilih Rombongan Belajar (Rombel):
            </span>
            {session.assignedClassId && (
              <span className="text-[10px] text-blue-600 font-bold">
                {session.role === 'guru' ? 'Wali Kelas Aktif' : ''}
              </span>
            )}
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
          >
            <option value="">-- Pilih Kelas --</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.id === session.assignedClassId ? '★ (Kelas Anda)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Current status notes */}
        <div className="bg-slate-50 border border-slate-200/60 p-2.5 px-3.5 rounded-lg text-[10px] sm:text-xs">
          <div className="grid grid-cols-2 gap-x-2">
            <span className="text-slate-500 font-medium">Hari:</span>
            <span className="font-bold text-slate-800">{getDayNameID(selectedDate)}</span>
            <span className="text-slate-500 font-medium">Total Siswa:</span>
            <span className="font-bold text-slate-800">{classStudents.length} Siswa</span>
          </div>
        </div>
      </div>

      {/* Warning alert banner for holiday/weekend */}
      {lockReason && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 flex items-start gap-3 my-4 font-medium leading-relaxed">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="text-amber-900">Informasi Tanggal Terpilih:</strong>
            <p className="mt-1 text-amber-700 font-semibold">{lockReason}</p>
          </div>
        </div>
      )}

      {/* If no class selected */}
      {!selectedClassId && (
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 text-center my-6">
          <Info className="h-8 w-8 text-blue-500 mx-auto mb-2" />
          <h3 className="font-bold text-sm text-slate-800">Rombel Belum Dipilih</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Silakan pilih rombongan belajar di menu dropdown di atas untuk memuat daftar siswa dan mengisi absensi.
          </p>
        </div>
      )}

      {/* Main interactive grid list */}
      {selectedClassId && classStudents.length > 0 && (
        <div className="mt-6 space-y-4">
          {/* Summary counters and quick set */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">
                {selectedClass?.name} — {getDayNameID(selectedDate)}, {getFormattedDate(selectedDate)}
              </span>
            </div>

            {/* Quick summary badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-extrabold">
                H: {summaryStats.hadir} ({summaryStats.hadirPct}%)
              </span>
              <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-bold">
                S: {summaryStats.sakit}
              </span>
              <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-bold">
                I: {summaryStats.izin}
              </span>
              <span className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-bold">
                A: {summaryStats.alfa}
              </span>

              <button
                type="button"
                onClick={setAllHadir}
                className="ml-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1"
                id="absensi-set-all-hadir-btn"
              >
                <Sparkles size={13} />
                Set Semua Hadir (H)
              </button>
            </div>
          </div>

          {/* Interactive table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4 w-32">NIS / NISN</th>
                    <th className="py-3 px-4">Nama Lengkap Siswa</th>
                    <th className="py-3 px-4 w-16 text-center">L/P</th>
                    <th className="py-3 px-4 text-center w-72">Status Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-sans">
                  {classStudents.map((student, index) => {
                    const currentStatus = attendanceGrid[student.id] || 'H';
                    return (
                      <tr 
                        key={student.id} 
                        className={`transition duration-100 ${
                          currentStatus === 'H' 
                            ? 'hover:bg-slate-50/70' 
                            : currentStatus === 'S'
                            ? 'bg-blue-50/20 hover:bg-blue-50/40'
                            : currentStatus === 'I'
                            ? 'bg-amber-50/20 hover:bg-amber-50/40'
                            : 'bg-red-50/20 hover:bg-red-50/40'
                        }`}
                      >
                        <td className="py-3 px-4 text-center font-semibold text-slate-500">{index + 1}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{student.nis} / {student.nisn}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{student.name}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-500">{student.gender}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                            {/* HADIR */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.id, 'H')}
                              title="Hadir"
                              className={`flex-1 flex items-center justify-center py-1.5 px-2 rounded-lg border text-xs font-extrabold transition cursor-pointer select-none ${
                                currentStatus === 'H'
                                  ? 'bg-green-600 text-white border-green-600 shadow-sm'
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                              }`}
                            >
                              H
                            </button>

                            {/* SAKIT */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.id, 'S')}
                              title="Sakit"
                              className={`flex-1 flex items-center justify-center py-1.5 px-2 rounded-lg border text-xs font-extrabold transition cursor-pointer select-none ${
                                currentStatus === 'S'
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                              }`}
                            >
                              S
                            </button>

                            {/* IZIN */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.id, 'I')}
                              title="Izin"
                              className={`flex-1 flex items-center justify-center py-1.5 px-2 rounded-lg border text-xs font-extrabold transition cursor-pointer select-none ${
                                currentStatus === 'I'
                                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                              }`}
                            >
                              I
                            </button>

                            {/* ALFA */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.id, 'A')}
                              title="Alfa / Tanpa Keterangan"
                              className={`flex-1 flex items-center justify-center py-1.5 px-2 rounded-lg border text-xs font-extrabold transition cursor-pointer select-none ${
                                currentStatus === 'A'
                                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                              }`}
                            >
                              A
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action and feedback footer */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs rounded-xl flex items-center gap-2 animate-bounce">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  Presensi {selectedClass?.name} ({getDayNameID(selectedDate)}, {getFormattedDate(selectedDate)}) berhasil disimpan ke database!
                </div>
              )}
              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 font-bold text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500 shrink-0" />
                  {saveError}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={saveAbsensi}
              disabled={isSaving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-500/20 cursor-pointer disabled:bg-blue-300 disabled:cursor-not-allowed shrink-0"
              id="absensi-save-btn"
            >
              <Save size={16} />
              {isSaving ? 'Menyimpan Presensi...' : 'Simpan Presensi Kelas'}
            </button>
          </div>
        </div>
      )}

      {selectedClassId && classStudents.length === 0 && (
        <div className="p-8 text-center border border-slate-100 rounded-xl mt-5 bg-slate-50/50">
          <p className="text-xs font-bold text-slate-600">
            Tidak ditemukan data siswa terdaftar di dalam Rombel "{selectedClass?.name || 'ini'}".
          </p>
          <p className="text-[11px] text-slate-400 mt-1 leading-normal">
            Silakan tambahkan data murid terlebih dahulu lewat menu "Data Siswa" / "Import Roster Excel".
          </p>
        </div>
      )}
    </div>
  );
}
