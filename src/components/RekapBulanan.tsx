import React, { useState, useEffect } from 'react';
import { db, isSunday, isHoliday } from '../utils/db';
import { Student, ClassRombel, UserSession, Holiday } from '../types';
import { exportMonthlyReportToExcel } from '../utils/excel';
import { generateMonthlyPDF } from '../utils/pdf';
import { 
  FileSpreadsheet, 
  FileDown, 
  Search, 
  ChevronRight, 
  Printer, 
  HelpCircle,
  AlertCircle
} from 'lucide-react';

interface RekapBulananProps {
  session: UserSession;
}

export default function RekapBulanan({ session }: RekapBulananProps) {
  const isAdmin = session.role === 'admin';
  const classes = db.getClasses();
  const holidays = db.getHolidays();
  const school = db.getSchool();

  const defaultClassId = isAdmin 
    ? (classes.length > 0 ? classes[0].id : '')
    : (session.assignedClassId || '');

  // Filter states
  const [selectedClassId, setSelectedClassId] = useState(defaultClassId);
  const [selectedMonth, setSelectedMonth] = useState(5); // June is index 5
  const [selectedYear, setSelectedYear] = useState(2026);
  
  // Data lists
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, Record<string, string>>>({});
  const [daysInMonth, setDaysInMonth] = useState(30);

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const years = [2025, 2026, 2027];

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }

    // Days count in month
    const totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    setDaysInMonth(totalDays);

    // Load class students sorted alphabetically (urut abjad)
    const list = db.getStudents()
      .filter((s) => s.classId === selectedClassId)
      .sort((a, b) => a.name.localeCompare(b.name));
    setStudents(list);

    // Fetch all attendances for chosen month
    const attendanceRecords = db.getAttendance().filter((a) => {
      if (a.classId !== selectedClassId) return false;
      const dateParts = a.date.split('-');
      const recordYear = parseInt(dateParts[0]);
      const recordMonth = parseInt(dateParts[1]); // 1-indexed
      return recordYear === selectedYear && recordMonth === (selectedMonth + 1);
    });

    // Remap to indexed grid: studentId -> {dateStr: status}
    const remapGrid: Record<string, Record<string, string>> = {};
    list.forEach((s) => {
      remapGrid[s.id] = {};
    });

    attendanceRecords.forEach((rec) => {
      if (!remapGrid[rec.studentId]) {
        remapGrid[rec.studentId] = {};
      }
      remapGrid[rec.studentId][rec.date] = rec.status;
    });

    setAttendanceData(remapGrid);

  }, [selectedClassId, selectedMonth, selectedYear]);

  // Helpers to get cell content/colors in screen table
  const getCellMeta = (dayNum: number) => {
    const dayStr = String(dayNum).padStart(2, '0');
    const monthStr = String(selectedMonth + 1).padStart(2, '0');
    const dateStr = `${selectedYear}-${monthStr}-${dayStr}`;

    const isSun = isSunday(dateStr);
    const matchedHol = isHoliday(dateStr, holidays);

    return {
      dateStr,
      isSun,
      holidayName: matchedHol ? matchedHol.name : '',
    };
  };

  // Triggers downloads
  const handleDownloadExcel = () => {
    if (!selectedClassId || students.length === 0) return;
    const targetClass = classes.find(c => c.id === selectedClassId);
    
    exportMonthlyReportToExcel(
      school,
      targetClass?.name || 'Kelas',
      months[selectedMonth],
      selectedYear,
      daysInMonth,
      students,
      attendanceData
    );
  };

  const handleDownloadPDF = () => {
    if (!selectedClassId || students.length === 0) return;
    const targetClass = classes.find(c => c.id === selectedClassId);
    
    // Find teacher name and NIP of this class
    const teachersList = db.getTeachers();
    const classTeacher = teachersList.find(t => t.assignedClassId === selectedClassId)
      || teachersList.find(t => t.id === targetClass?.homeroomTeacherId);

    generateMonthlyPDF({
      school,
      className: targetClass?.name || 'Kelas',
      homeroomTeacherName: classTeacher?.name || '',
      homeroomTeacherNip: classTeacher?.nip || '',
      monthName: months[selectedMonth],
      monthIndex: selectedMonth,
      year: selectedYear,
      daysInMonth,
      students,
      attendanceData,
      holidays
    });
  };

  const getClassNameLabel = () => {
    const found = classes.find((c) => c.id === selectedClassId);
    return found ? found.name : 'Rombel';
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm font-sans animate-fade-in leading-normal">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between border-b border-slate-100 pb-5 gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800">Laporan Rekapitulasi Absensi Bulanan</h2>
          <p className="text-xs text-slate-500 font-semibold font-medium">Rekap absensi siswa bulanan standar Kemendikbud dalam sistem sekolah</p>
        </div>

        {/* Buttons */}
        {selectedClassId && students.length > 0 && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleDownloadExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
              id="rekap-excel-download-btn"
            >
              <FileSpreadsheet size={14} />
              Unduh Excel (.xlsx)
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
              id="rekap-pdf-download-btn"
            >
              <FileDown size={14} />
              Unduh PDF Laporan
            </button>
          </div>
        )}
      </div>

      {/* Filter items */}
      <div className="my-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Rombongan Belajar (Rombel):</label>
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
              value={getClassNameLabel()}
              className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 cursor-not-allowed"
            />
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Bulan Rekap:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
          >
            {months.map((m, index) => (
              <option key={index} value={index}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Tahun:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                Tahun {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Screen Preview Tables */}
      {selectedClassId && students.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
              <Printer size={14} className="text-slate-400" />
              Preview Layar Laporan Kehadiran ({getClassNameLabel()})
            </h4>
            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-100 rounded" /> M = Minggu</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-100 rounded" /> L = Hari Libur</span>
            </div>
          </div>

          <div className="border border-slate-100 rounded-xl overflow-hidden shadow-inner">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed min-w-[1200px]">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-extrabold text-slate-300 uppercase select-none">
                    <th className="py-2.5 px-2 w-10 text-center sticky left-0 bg-slate-900 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">No</th>
                    <th className="py-2.5 px-2 w-28 sticky left-10 bg-slate-900 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">NIS / NISN</th>
                    <th className="py-2.5 px-3 w-52 sticky left-38 bg-slate-900 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">Nama Siswa (Sesuai Abjad)</th>
                    <th className="py-2.5 px-2 w-12 text-center">L/P</th>
                    
                    {/* Days listing columns */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const dayVal = i + 1;
                      const { isSun, holidayName } = getCellMeta(dayVal);
                      return (
                        <th
                          key={i}
                          className={`py-1 text-center font-bold text-[9px] w-6 ${
                            isSun ? 'bg-red-950 text-red-400 font-extrabold' : holidayName ? 'bg-amber-950 text-amber-400 font-extrabold' : ''
                          }`}
                          title={holidayName || `${dayVal} ${months[selectedMonth]}`}
                        >
                          {dayVal}
                        </th>
                      );
                    })}

                    <th className="py-2.5 px-1.5 w-8 text-center text-green-400 bg-slate-900">H</th>
                    <th className="py-2.5 px-1.5 w-8 text-center text-blue-400 bg-slate-900">S</th>
                    <th className="py-2.5 px-1.5 w-8 text-center text-amber-400 bg-slate-900">I</th>
                    <th className="py-2.5 px-1.5 w-8 text-center text-red-400 bg-slate-900">A</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px] font-sans text-slate-700">
                  {students.map((student, idx) => {
                    let hCount = 0;
                    let sCount = 0;
                    let iCount = 0;
                    let aCount = 0;

                    return (
                      <tr key={student.id} className="hover:bg-slate-50 transition duration-100">
                        <td className="py-2 px-2 text-center font-bold text-slate-400 sticky left-0 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.02)]">{idx + 1}</td>
                        <td className="py-2 px-2 font-mono text-slate-800 sticky left-10 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.02)]">{student.nisn}</td>
                        <td className="py-2 px-3 font-bold text-slate-900 sticky left-38 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.02)] truncate">{student.name}</td>
                        <td className="py-2 px-2 text-center font-extrabold text-slate-500">{student.gender}</td>

                        {/* Rendering dynamic status for each day of month */}
                        {Array.from({ length: daysInMonth }).map((_, dIdx) => {
                          const dayVal = dIdx + 1;
                          const { dateStr, isSun, holidayName } = getCellMeta(dayVal);
                          const status = attendanceData[student.id]?.[dateStr] || '-';

                          if (status === 'H') hCount++;
                          else if (status === 'S') sCount++;
                          else if (status === 'I') iCount++;
                          else if (status === 'A') aCount++;

                          return (
                            <td
                              key={dIdx}
                              className={`py-2 text-center font-bold text-[10px] border-r border-slate-100/50 ${
                                isSun 
                                  ? 'bg-red-50 text-red-600' 
                                  : holidayName 
                                    ? 'bg-amber-50 text-amber-600' 
                                    : status === 'H' 
                                      ? 'text-green-600' 
                                      : status === 'S' 
                                        ? 'text-blue-600 font-extrabold' 
                                        : status === 'I' 
                                          ? 'text-amber-500 font-extrabold' 
                                          : status === 'A' 
                                            ? 'text-red-600 font-extrabold bg-red-50/50' 
                                            : 'text-slate-300'
                              }`}
                              title={holidayName || `${dayVal} ${months[selectedMonth]} - Status: ${status === '-' ? 'Belum Diabsen' : status}`}
                            >
                              {isSun ? 'M' : holidayName ? 'L' : status}
                            </td>
                          );
                        })}

                        {/* Counts summaries */}
                        <td className="py-2 px-1 w-8 text-center bg-green-50/30 text-green-700 font-bold">{hCount}</td>
                        <td className="py-2 px-1 w-8 text-center bg-blue-50/30 text-blue-700 font-bold">{sCount}</td>
                        <td className="py-2 px-1 w-8 text-center bg-amber-50/30 text-amber-700 font-bold">{iCount}</td>
                        <td className="py-2 px-1 w-8 text-center bg-red-50/30 text-red-700 font-bold">{aCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="p-3 bg-slate-50 border border-slate-100/80 rounded-xl text-[10px] leading-relaxed text-slate-500 flex gap-1.5 font-medium">
            <HelpCircle size={14} className="shrink-0 text-slate-400 mt-0.5" />
            <div>
              <span className="font-bold">Keterangan Singkatan Rapor:</span> <strong className="text-green-600">H = Hadir</strong> (Melahirkan tatanan disiplin), <strong className="text-blue-600">S = Sakit</strong> (Membawa surat edaran kesehatan), <strong className="text-amber-600">I = Izin</strong> (Permohonan sah keluarga), <strong className="text-red-600">A = Alfa</strong> (Tanpa keterangan valid/mangkir).
            </div>
          </div>
        </div>
      ) : (
        selectedClassId ? (
          <div className="p-8 text-center border border-slate-150 rounded-xl mt-5">
            <p className="text-xs font-semibold text-slate-500">
              Tidak ditemukan data rekam latih / absensi di dalam kelas Rombel ini sepanjang bulan {months[selectedMonth]} {selectedYear}.
            </p>
            <p className="text-[10px] text-slate-400 mt-1 italic">
              Pastikan Anda sudah mengisi absensi di menu "Input Absensi Siswa" pada hari-hari aktif.
            </p>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2 font-semibold">
            <AlertCircle size={14} className="text-amber-600 shrink-0" />
            Silakan tentukan kelas terlebih dahulu untuk memulai rekapitulasi.
          </div>
        )
      )}
    </div>
  );
}
