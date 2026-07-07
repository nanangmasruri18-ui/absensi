import React, { useState, useEffect } from 'react';
import { db } from '../utils/db';
import { Student, ClassRombel, UserSession } from '../types';
import { exportSemesterReportToExcel } from '../utils/excel';
import { generateSemesterPDF } from '../utils/pdf';
import { 
  FileSpreadsheet, 
  FileDown, 
  Search, 
  BarChart3, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';

interface RekapSemesterProps {
  session: UserSession;
}

export default function RekapSemester({ session }: RekapSemesterProps) {
  const isAdmin = session.role === 'admin';
  const classes = db.getClasses();
  const school = db.getSchool();

  const defaultClassId = isAdmin 
    ? (classes.length > 0 ? classes[0].id : '')
    : (session.assignedClassId || '');

  // Filter states
  const currentMonthNum = new Date().getMonth() + 1; // 1-indexed (Jan is 1, June is 6, Dec is 12)
  const defaultSemester = (currentMonthNum >= 7 && currentMonthNum <= 12) ? 'Ganjil' : 'Genap';

  const currentYearNum = new Date().getFullYear();
  const defaultAcademicYear = currentMonthNum >= 7
    ? `${currentYearNum}/${currentYearNum + 1}`
    : `${currentYearNum - 1}/${currentYearNum}`;

  const [selectedClassId, setSelectedClassId] = useState(defaultClassId);
  const [semester, setSemester] = useState(defaultSemester); // Dynamic default based on month
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear); // Dynamic default based on year
  const [searchTerm, setSearchTerm] = useState('');

  // Loaded data
  const [students, setStudents] = useState<Student[]>([]);
  const [semesterRows, setSemesterRows] = useState<any[]>([]);

  // Statistics summaries
  const [classAveragePercentage, setClassAveragePercentage] = useState(100);

  useEffect(() => {
    if (!selectedClassId) {
      setSemesterRows([]);
      setStudents([]);
      return;
    }

    const classStudentsList = db.getStudents()
      .filter((s) => s.classId === selectedClassId)
      .sort((a, b) => a.name.localeCompare(b.name));
    setStudents(classStudentsList);

    // Filter year from academicYear (e.g. "2025/2026" Ganjil -> July-Dec 2025; Genap -> Jan-June 2026)
    const yearParts = academicYear.split('/');
    const filterYear = semester === 'Ganjil' 
      ? parseInt(yearParts[0], 10) // 2025
      : parseInt(yearParts[1], 10); // 2026

    // Months indexes
    // Ganjil: Jul (6) to Dec (11)
    // Genap: Jan (0) to Jun (5)
    const startMonth = semester === 'Ganjil' ? 7 : 1; // 1-indexed for string checks
    const endMonth = semester === 'Ganjil' ? 12 : 6;

    // Load attendances of class inside that range
    const allAttendances = db.getAttendance().filter((a) => {
      if (a.classId !== selectedClassId) return false;
      const dateParts = a.date.split('-'); // YYYY-MM-DD
      const y = parseInt(dateParts[0], 10);
      const m = parseInt(dateParts[1], 10); // 1-indexed month
      
      return y === filterYear && m >= startMonth && m <= endMonth;
    });

    // Populate rows
    let totalClassPercentageSum = 0;
    let totalActiveRecords = 0;
    const computedGrid = classStudentsList.map((student, idx) => {
      const studentRecords = allAttendances.filter((a) => a.studentId === student.id);
      
      const count = {
        H: studentRecords.filter((r) => r.status === 'H').length,
        S: studentRecords.filter((r) => r.status === 'S').length,
        I: studentRecords.filter((r) => r.status === 'I').length,
        A: studentRecords.filter((r) => r.status === 'A').length,
      };

      const totalActiveSession = count.H + count.S + count.I + count.A;
      totalActiveRecords += totalActiveSession;

      const percentageScore = totalActiveSession > 0
        ? Math.round((count.H / totalActiveSession) * 100)
        : 0; // default 0% if no records yet

      totalClassPercentageSum += percentageScore;

      return {
        no: idx + 1,
        studentId: student.id,
        nisn: student.nisn,
        name: student.name,
        gender: student.gender,
        hadir: count.H,
        sakit: count.S,
        izin: count.I,
        alfa: count.A,
        persentase: `${percentageScore}%`,
        rawPct: percentageScore,
      };
    });

    setSemesterRows(computedGrid);

    // Average attendance
    const avg = (classStudentsList.length > 0 && totalActiveRecords > 0)
      ? Math.round(totalClassPercentageSum / classStudentsList.length)
      : 0;
    setClassAveragePercentage(avg);

  }, [selectedClassId, semester, academicYear]);

  // Handle Downloads
  const handleDownloadExcel = () => {
    if (!selectedClassId || semesterRows.length === 0) return;
    const targetClass = classes.find(c => c.id === selectedClassId);

    exportSemesterReportToExcel(
      school,
      targetClass?.name || 'Kelas',
      semester,
      academicYear,
      students,
      semesterRows
    );
  };

  const handleDownloadPDF = () => {
    if (!selectedClassId || semesterRows.length === 0) return;
    const targetClass = classes.find(c => c.id === selectedClassId);

    // Find teacher name and NIP of this class
    const teachersList = db.getTeachers();
    const classTeacher = teachersList.find(t => t.assignedClassId === selectedClassId)
      || teachersList.find(t => t.id === targetClass?.homeroomTeacherId);

    generateSemesterPDF({
      school,
      className: targetClass?.name || 'Kelas',
      semester,
      academicYear,
      rows: semesterRows,
      homeroomTeacherName: classTeacher?.name || '',
      homeroomTeacherNip: classTeacher?.nip || ''
    });
  };

  const getClassNameText = () => {
    const found = classes.find((c) => c.id === selectedClassId);
    return found ? found.name : 'Kelas';
  };

  // Search filter
  const filteredRows = semesterRows.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      r.name.toLowerCase().includes(term) ||
      r.nisn.toLowerCase().includes(term)
    );
  });

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm font-sans animate-fade-in leading-normal">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between border-b border-slate-100 pb-5 gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800">Laporan Rekapitulasi Absensi Semester</h2>
          <p className="text-xs text-slate-500 font-semibold font-medium">Rekapitulasi persentase semesteran rapor Kurikulum Merdeka siswa</p>
        </div>

        {selectedClassId && semesterRows.length > 0 && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleDownloadExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
              id="rekap-sem-excel-btn"
            >
              <FileSpreadsheet size={14} />
              Unduh Excel (.xlsx)
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
              id="rekap-sem-pdf-btn"
            >
              <FileDown size={14} />
              Unduh PDF Rapor
            </button>
          </div>
        )}
      </div>

      {/* Sifting selections */}
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
              value={getClassNameText()}
              className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 cursor-not-allowed"
            />
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Semester:</label>
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
          >
            <option value="Ganjil">Semester Ganjil (Satu)</option>
            <option value="Genap">Semester Genap (Dua)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Tahun Pelajaran (Tapel):</label>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
          >
            <option value="2025/2026">Tapel 2025/2026</option>
            <option value="2026/2027">Tapel 2026/2027</option>
          </select>
        </div>
      </div>

      {selectedClassId && semesterRows.length > 0 ? (
        <div className="space-y-6">
          {/* Quick Metrics display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Rombongan Belajar</p>
                <p className="mt-1 text-base font-extrabold text-slate-800">{getClassNameText()}</p>
              </div>
              <span className="p-2 bg-blue-100 text-blue-700 rounded-xl font-bold text-xs">{semester.toUpperCase()}</span>
            </div>

            <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tahun Pelajaran</p>
                <p className="mt-1 text-base font-extrabold text-slate-800">{academicYear}</p>
              </div>
              <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-[10px]">{semester === 'Ganjil' ? 'OOS' : 'EVS'}</span>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Rata-Rata Kehadiran</p>
                <p className="mt-1 text-2xl font-black text-blue-900">{classAveragePercentage}%</p>
              </div>
              <span className="p-2 bg-blue-500 text-white rounded-xl"><TrendingUp size={20} /></span>
            </div>
          </div>

          {/* Search bar inside semester */}
          <div className="relative max-w-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari siswa dalam rekap semester..."
              className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
            />
          </div>

          {/* Table display */}
          <div className="border border-slate-100 rounded-xl overflow-hidden mt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4 w-32">NIS / NISN</th>
                    <th className="py-3 px-4">Nama Lengkap Siswa</th>
                    <th className="py-3 px-4 w-20 text-center">L/P</th>
                    <th className="py-3 px-4 text-center text-green-700 bg-green-50/10">Hadir (H)</th>
                    <th className="py-3 px-4 text-center text-blue-700 bg-blue-50/10">Sakit (S)</th>
                    <th className="py-3 px-4 text-center text-amber-700 bg-amber-50/10">Izin (I)</th>
                    <th className="py-3 px-4 text-center text-red-700 bg-red-50/10">Alfa (A)</th>
                    <th className="py-3 px-4 text-center font-extrabold w-36">Persentase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredRows.length > 0 ? (
                    filteredRows.map((row) => (
                      <tr key={row.studentId} className="hover:bg-slate-50/50 transition duration-100">
                        <td className="py-3.5 px-4 text-center font-semibold text-slate-500">{row.no}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">{row.nisn}</td>
                        <td className="py-3.5 px-4 font-extrabold text-slate-900">{row.name}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-500">{row.gender}</td>
                        <td className="py-3.5 px-4 text-center font-semibold text-green-600 bg-green-50/30">{row.hadir}</td>
                        <td className="py-3.5 px-4 text-center font-semibold text-blue-600 bg-blue-50/30">{row.sakit}</td>
                        <td className="py-3.5 px-4 text-center font-semibold text-amber-600 bg-amber-50/30">{row.izin}</td>
                        <td className="py-3.5 px-4 text-center font-semibold text-red-600 bg-red-50/30">{row.alfa}</td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {/* Simple visual progress pill */}
                            <div className="hidden sm:block w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${row.rawPct > 90 ? 'bg-green-500' : row.rawPct > 75 ? 'bg-blue-500' : 'bg-red-500'}`}
                                style={{ width: `${row.rawPct}%` }}
                              />
                            </div>
                            <span className="font-extrabold text-slate-800">{row.persentase}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-10 text-center font-medium text-slate-500">
                        Tidak ditemukan murid yang sesuai kriteria pencarian semester ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        selectedClassId ? (
          <div className="p-8 text-center border border-slate-150 rounded-xl mt-5">
            <p className="text-xs font-semibold text-slate-500">
              Tidak ditemukan data absensi siswa dalam saringan Semester {semester} ({academicYear}) di Kelas {getClassNameText()}.
            </p>
            <p className="text-[10px] text-slate-400 mt-1 italic">
              Silakan isi absensi terlebih dahulu pada hari-hari pengajaran aktif untuk memformulasikan rekapitulasi semester.
            </p>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2 font-semibold">
            <AlertCircle size={14} className="text-amber-600 shrink-0" />
            Kehadiran semester memerlukan kelas rombel aktif untuk ditelaah.
          </div>
        )
      )}
    </div>
  );
}
