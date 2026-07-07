import * as XLSX from 'xlsx';
import { Student, Attendance, ClassRombel, Gender } from '../types';

/**
 * Downloads a standardized Excel template for student enrollment
 */
export function downloadStudentTemplate() {
  const headers = [
    ['TEMPLATE DATA SISWA SD'],
    ['Petunjuk Pengisian:'],
    ['1. Kolom NIS/NISN harus diisi angka.'],
    ['2. Kolom Jenis Kelamin harus diisi L atau P (L = Laki-laki, P = Perempuan).'],
    ['3. Kolom Kelas harus diisi sesuai Nama Kelas yang terdaftar di sistem. Contoh kelas: Kelas 1A, Kelas 1B, Kelas 2A'],
    [''], // blank line
    ['NIS/NISN', 'Nama Siswa', 'Jenis Kelamin', 'Kelas']
  ];

  const sampleData = [
    ['1011', 'Andi Hermawan', 'L', 'Kelas 1A'],
    ['2011', 'Siti Rahayu', 'P', 'Kelas 1B']
  ];

  const wsData = [...headers, ...sampleData];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set widths
  const wscols = [
    { wch: 15 },
    { wch: 30 },
    { wch: 15 },
    { wch: 15 }
  ];
  ws['!cols'] = wscols;

  XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');
  XLSX.writeFile(wb, 'Template_Siswa_SD.xlsx');
}

export interface ExcelImportResult {
  valid: boolean;
  errors: string[];
  students: Array<Omit<Student, 'id'>>;
}

/**
 * Reads and validates student records from an uploaded Excel file
 */
export function parseAndValidateStudentExcel(
  file: File,
  registeredClasses: ClassRombel[]
): Promise<ExcelImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to array of arrays
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        const errors: string[] = [];
        const students: Array<Omit<Student, 'id'>> = [];

        // Find the header row (typically has columns we specified)
        let headerIndex = -1;
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (r && r.length >= 4) {
            const matchNis = String(r[0] || '').toLowerCase().includes('nis');
            const matchName = String(r[1] || '').toLowerCase().includes('nama');
            if (matchNis && matchName) {
              headerIndex = i;
              break;
            }
          }
        }

        if (headerIndex === -1) {
          resolve({
            valid: false,
            errors: ['Format file Excel salah. Pastikan baris judul berisi: NIS/NISN, Nama Siswa, Jenis Kelamin, Kelas'],
            students: []
          });
          return;
        }

        // Parse student data rows below the header
        for (let i = headerIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue; // skip empty line
          
          // Check if all columns are empty
          const hasValue = row.some(val => val !== undefined && val !== null && String(val).trim() !== '');
          if (!hasValue) continue;

          const rowNum = i + 1;
          const rawNis = String(row[0] || '').trim();
          const name = String(row[1] || '').trim();
          const rawGender = String(row[2] || '').trim().toUpperCase();
          const rawClass = String(row[3] || '').trim();

          // Validation
          if (!rawNis) {
            errors.push(`Baris ${rowNum}: NIS/NISN kosong.`);
            continue;
          }
          if (!name) {
            errors.push(`Baris ${rowNum}: Nama Siswa kosong.`);
            continue;
          }
          if (rawGender !== 'L' && rawGender !== 'P') {
            errors.push(`Baris ${rowNum}: Jenis Kelamin [${rawGender}] harus "L" atau "P".`);
            continue;
          }

          // Class validation
          const matchedClass = registeredClasses.find(
            (c) => c.name.toLowerCase() === rawClass.toLowerCase()
          );

          if (!matchedClass) {
            errors.push(`Baris ${rowNum}: Kelas "${rawClass}" tidak terdaftar di sistem.`);
            continue;
          }

          if (errors.length === 0) {
            students.push({
              nis: rawNis,
              nisn: rawNis, // Use NIS for both if not separated
              name,
              gender: rawGender as Gender,
              birthPlace: '',
              birthDate: '',
              classId: matchedClass.id
            });
          }
        }

        resolve({
          valid: errors.length === 0,
          errors,
          students
        });
      } catch (err: any) {
        resolve({
          valid: false,
          errors: [`Server Gagal membaca file excel: ${err.message || 'Penyebab tidak diketahui'}`],
          students: []
        });
      }
    };
    reader.onerror = () => {
      resolve({
        valid: false,
        errors: ['Gagal membaca file dari penyimpanan lokal.'],
        students: []
      });
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Exports Monthly Attendance Report to Excel format (.xlsx)
 */
export function exportMonthlyReportToExcel(
  school: { name: string; address: string; npsn: string },
  className: string,
  monthName: string,
  year: number,
  daysInMonth: number,
  students: Student[],
  attendanceData: Record<string, Record<string, string>> // studentId -> {YYYY-MM-DD: status}
) {
  const wb = XLSX.utils.book_new();
  
  // Prepare headers
  const rows: any[] = [
    [`REKAPITULASI ABSENSI SISWA BULANAN - ${monthName.toUpperCase()} ${year}`],
    [school.name],
    [`NPSN: ${school.npsn} | Alamat: ${school.address}`],
    [`Kelas: ${className}`],
    [], // blank row
  ];

  // Table header
  const headerRow = ['No', 'NIS/NISN', 'Nama Siswa', 'L/P'];
  for (let d = 1; d <= daysInMonth; d++) {
    headerRow.push(String(d));
  }
  headerRow.push('H', 'S', 'I', 'A');
  rows.push(headerRow);

  // Fill in student rows
  students.forEach((student, index) => {
    const studentRow: any[] = [
      index + 1,
      student.nisn,
      student.name,
      student.gender
    ];

    let counts = { H: 0, S: 0, I: 0, A: 0 };
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${String(monthName === 'Januari' ? 1 : monthName === 'Februari' ? 2 : monthName === 'Maret' ? 3 : monthName === 'April' ? 4 : monthName === 'Mei' ? 5 : monthName === 'Juni' ? 6 : monthName === 'Juli' ? 7 : monthName === 'Agustus' ? 8 : monthName === 'September' ? 9 : monthName === 'Oktober' ? 10 : monthName === 'November' ? 11 : 12).padStart(2, '0')}-${dayStr}`;
      
      const status = attendanceData[student.id]?.[dateStr] || '-';
      studentRow.push(status);
      
      if (status === 'H') counts.H++;
      else if (status === 'S') counts.S++;
      else if (status === 'I') counts.I++;
      else if (status === 'A') counts.A++;
    }

    studentRow.push(counts.H, counts.S, counts.I, counts.A);
    rows.push(studentRow);
  });

  // Footer for signature
  rows.push([]);
  rows.push([]);
  const dateStamp = `Gelora, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  
  // Arrange signature spaces with padding
  const totalCols = headerRow.length;
  const signaturePaddingRow = Array(totalCols).fill('');
  signaturePaddingRow[totalCols - 5] = dateStamp;
  rows.push(signaturePaddingRow);

  const signatureRoleRow = Array(totalCols).fill('');
  signatureRoleRow[totalCols - 5] = 'Guru Kelas / Wali Kelas,';
  rows.push(signatureRoleRow);

  rows.push(Array(totalCols).fill('')); // space for physical signature
  rows.push(Array(totalCols).fill(''));
  rows.push(Array(totalCols).fill(''));

  const signatureNameRow = Array(totalCols).fill('');
  signatureNameRow[totalCols - 5] = '(...............................................)';
  rows.push(signatureNameRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set grid lines visible
  ws['!showGrid'] = true;

  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Bulanan');
  XLSX.writeFile(wb, `Rekap_Absensi_${className.replace(' ', '_')}_Bulanan_${monthName}_${year}.xlsx`);
}

/**
 * Exports Semester Attendance Report to Excel format
 */
export function exportSemesterReportToExcel(
  school: { name: string; address: string; npsn: string },
  className: string,
  semester: string,
  academicYear: string,
  students: Student[],
  attendanceGrid: Array<{
    no: number;
    nisn: string;
    name: string;
    gender: string;
    hadir: number;
    sakit: number;
    izin: number;
    alfa: number;
    persentase: string;
  }>
) {
  const wb = XLSX.utils.book_new();
  const rows: any[] = [
    [`REKAPITULASI SEMESTERAN ABSENSI SISWA - SEMESTER ${semester}`],
    [school.name],
    [`NPSN: ${school.npsn} | Tahun Pelajaran: ${academicYear}`],
    [`Kelas: ${className}`],
    [], // blank
  ];

  // Header
  rows.push([
    'No',
    'NIS/NISN',
    'Nama Lengkap',
    'L/P',
    'Total Hadir (H)',
    'Total Sakit (S)',
    'Total Izin (I)',
    'Total Alfa (A)',
    'Persentase Kehadiran'
  ]);

  // Data rows
  attendanceGrid.forEach((row) => {
    rows.push([
      row.no,
      row.nisn,
      row.name,
      row.gender,
      row.hadir,
      row.sakit,
      row.izin,
      row.alfa,
      row.persentase
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Semester');
  XLSX.writeFile(wb, `Rekap_Absensi_Semester_${className.replace(' ', '_')}_${semester.replace(' ', '_')}.xlsx`);
}
