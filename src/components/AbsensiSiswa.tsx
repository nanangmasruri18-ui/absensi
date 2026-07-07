import React, { useState, useEffect } from 'react';
import { db, getDayNameID, isSunday, isHoliday } from '../utils/db';
import { Student, ClassRombel, Attendance, UserSession, AttendanceStatus } from '../types';
import { 
  ClipboardCheck, 
  Calendar, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Save, 
  UserSquare 
} from 'lucide-react';

interface AbsensiSiswaProps {
  session: UserSession;
}

export default function AbsensiSiswa({ session }: AbsensiSiswaProps) {
  const isAdmin = session.role === 'admin';
  const classes = db.getClasses();
  const holidays = db.getHolidays();

  // If teacher, find class. If admin, pick first available class
  const defaultClassId = isAdmin 
    ? (classes.length > 0 ? classes[0].id : '')
    : (session.assignedClassId || '');

  // States
  // Prefill active date as current date dynamically
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [selectedClassId, setSelectedClassId] = useState(defaultClassId);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  
  // Local state grid of studentId -> status ('H' | 'S' | 'I' | 'A')
  const [attendanceGrid, setAttendanceGrid] = useState<Record<string, AttendanceStatus>>({});
  
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

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
      return;
    }

    // Fetch students of this class and SORT alphabetically (urut abjad)
    const list = db.getStudents()
      .filter((s) => s.classId === selectedClassId)
      .sort((a, b) => a.name.localeCompare(b.name));

    setClassStudents(list);

    // Check calendar lock rule: Sunday or Holiday (Warn but keep interactive)
    if (selectedDate && !isNaN(new Date(selectedDate).getTime())) {
      const isSun = isSunday(selectedDate);
      const holidaysList = db.getHolidays();
      const matchedHol = isHoliday(selectedDate, holidaysList);

      if (isSun) {
        setIsLocked(false);
        setLockReason('Hari Minggu terdeteksi. Sistem menandai ini sebagai hari libur harian, namun pengisian tetap diaktifkan untuk kenyamanan Anda.');
      } else if (matchedHol) {
        setIsLocked(false);
        setLockReason(`Libur akademik terdaftar: "${matchedHol.name}". Pengisian tetap diaktifkan untuk kenyamanan Anda.`);
      } else {
        setIsLocked(false);
        setLockReason('');
      }
    } else {
      setIsLocked(false);
      setLockReason('');
    }

    // Now load already saved attendance for that class and date
    const savedList = db.getAttendance().filter((a) => a.classId === selectedClassId && a.date === selectedDate);
    
    const initialGrid: Record<string, AttendanceStatus> = {};
    // Load existing
    list.forEach((s) => {
      const match = savedList.find((a) => a.studentId === s.id);
      initialGrid[s.id] = match ? match.status : 'H'; // Default to 'H' (Hadir) for ease of input
    });

    setAttendanceGrid(initialGrid);
    setSaveSuccess(false);

  }, [selectedDate, selectedClassId]);

  // Bulk set all students to H
  const setAllHadir = () => {
    if (isLocked) return;
    const updated = { ...attendanceGrid };
    classStudents.forEach((s) => {
      updated[s.id] = 'H';
    });
    setAttendanceGrid(updated);
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    if (isLocked) return;
    setAttendanceGrid((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const saveAbsensi = () => {
    if (isLocked) return;
    const allAttendance = db.getAttendance();
    const otherAttendance = allAttendance.filter(
      (a) => !(a.classId === selectedClassId && a.date === selectedDate)
    );

    // Map grid back to active array records
    const newRecords: Attendance[] = classStudents.map((s) => ({
      id: `${selectedClassId}-${s.id}-${selectedDate}`,
      classId: selectedClassId,
      studentId: s.id,
      date: selectedDate,
      status: attendanceGrid[s.id] || 'H',
      updatedAt: new Date().toISOString(),
    }));

    db.saveAttendance([...otherAttendance, ...newRecords]);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  // Helper labels
  const getSelectedClassLabel = () => {
    const found = classes.find((c) => c.id === selectedClassId);
    return found ? found.name : 'Belum Ditentukan';
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm font-sans leading-normal animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5 gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800">Lembar Input Absensi Harian Siswa</h2>
          <p className="text-xs text-slate-500 font-semibold font-medium">Isi kehadiran harian siswa, simpan presensi ke database sekolah</p>
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
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Users size={14} className="text-blue-500" />
            Pilih Rombongan Belajar:
          </label>
          {isAdmin ? (
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
            >
              <option value="">-- Pilih Kelas --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              disabled
              value={getSelectedClassLabel()}
              className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 cursor-not-allowed"
            />
          )}
        </div>

        {/* Current status notes */}
        <div className="bg-slate-50 border border-slate-200/60 p-2 px-3.5 rounded-lg text-[10px] sm:text-xs">
          <div className="grid grid-cols-2 gap-x-2">
            <span className="text-slate-500 font-medium">Hari Terpilih:</span>
            <span className="font-bold text-slate-800">{getDayNameID(selectedDate)}</span>
            <span className="text-slate-500 font-medium">Total Rombel:</span>
            <span className="font-bold text-slate-800">{classStudents.length} Siswa</span>
          </div>
        </div>
      </div>

      {/* Warning alert banner */}
      {lockReason ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 flex items-start gap-3 my-5 font-medium leading-relaxed">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="text-amber-900">Informasi Libur / Akhir Pekan</strong>
            <p className="mt-1 text-amber-700 font-semibold">{lockReason}</p>
            <p className="mt-1 text-[10px] text-amber-600/90 leading-normal">
              Tombol "Set Semua Siswa Hadir" dan pengisian presensi di bawah tetap diaktifkan sepenuhnya agar Anda dapat melakukan koreksi atau input susulan jika diperlukan.
            </p>
          </div>
        </div>
      ) : (
        !selectedClassId && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 flex items-start gap-3 my-5 font-semibold">
            <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold">Kelas Belum Dipilih:</span> Silakan pilih kelas rombel di atas terlebih dahulu untuk memunculkan biodata siswa.
            </div>
          </div>
        )
      )}

      {/* Main interactive grid list */}
      {selectedClassId && classStudents.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/50">
            <span className="text-[11px] sm:text-xs font-bold text-slate-700">Tanggal Absen: {getDayNameID(selectedDate)}, {getFormattedDate(selectedDate)}</span>
            <button
              onClick={setAllHadir}
              className="px-3.5 py-1.5 bg-blue-50/80 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10px] sm:text-xs font-bold transition cursor-pointer"
              id="absensi-set-all-hadir-btn"
            >
              Set Semua Siswa Hadir (H)
            </button>
          </div>

          <div className="border border-slate-100 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4 w-32">NIS / NISN</th>
                    <th className="py-3 px-4">Nama Lengkap Siswa</th>
                    <th className="py-3 px-4 w-20 text-center">L/P</th>
                    <th className="py-3 px-4 text-center w-72">Status Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-sans">
                  {classStudents.map((student, index) => {
                    const currentStatus = attendanceGrid[student.id] || 'H';
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/50 transition duration-100">
                        <td className="py-3 px-4 text-center font-semibold text-slate-500">{index + 1}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{student.nis} / {student.nisn}</td>
                        <td className="py-3 px-4 font-extrabold text-slate-900">{student.name}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-500">{student.gender}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                            {/* HADIR */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.id, 'H')}
                              className={`flex-1 flex items-center justify-center py-1.5 px-2 rounded-lg border text-[10px] sm:text-xs font-extrabold transition cursor-pointer select-none ${
                                currentStatus === 'H'
                                  ? 'bg-green-50 text-green-700 border-green-300 shadow-sm shadow-green-100'
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                              }`}
                            >
                              H
                            </button>

                            {/* SAKIT */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.id, 'S')}
                              className={`flex-1 flex items-center justify-center py-1.5 px-2 rounded-lg border text-[10px] sm:text-xs font-extrabold transition cursor-pointer select-none ${
                                currentStatus === 'S'
                                  ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm shadow-blue-100'
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                              }`}
                            >
                              S
                            </button>

                            {/* IZIN */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.id, 'I')}
                              className={`flex-1 flex items-center justify-center py-1.5 px-2 rounded-lg border text-[10px] sm:text-xs font-extrabold transition cursor-pointer select-none ${
                                currentStatus === 'I'
                                  ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm shadow-amber-100'
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                              }`}
                            >
                              I
                            </button>

                            {/* ALFA */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.id, 'A')}
                              className={`flex-1 flex items-center justify-center py-1.5 px-2 rounded-lg border text-[10px] sm:text-xs font-extrabold transition cursor-pointer select-none ${
                                currentStatus === 'A'
                                  ? 'bg-red-50 text-red-700 border-red-300 shadow-sm shadow-red-100'
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
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

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div>
              {saveSuccess && (
                <span className="p-2.5 bg-green-50 border border-green-100 text-green-700 font-bold text-xs rounded-lg flex items-center gap-1.5 animate-bounce">
                  <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                  Presensi berhasil disimpan ke database!
                </span>
              )}
            </div>

            <button
              onClick={saveAbsensi}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer text-center shrink-0"
              id="absensi-save-btn"
            >
              <Save size={16} />
              Simpan Presensi Kelas
            </button>
          </div>
        </div>
      )}

      {selectedClassId && classStudents.length === 0 && (
        <div className="p-8 text-center border border-slate-100 rounded-xl mt-5">
          <p className="text-xs font-semibold text-slate-500">
            Tidak ditemukan data siswa terdaftar di dalam Rombel Kelas ini.
          </p>
          <p className="text-[10px] text-slate-400 mt-1 leading-normal italic">
            Silakan tambahkan data murid terlebih dahulu lewat menu "Data Siswa" / "Import Roster Excel".
          </p>
        </div>
      )}
    </div>
  );
}
