import * as XLSX from 'xlsx';
import { Student, Attendance, ClassRombel, Gender } from '../types';

/**
 * Downloads a standardized Excel template for student enrollment
 */
/**
 * Downloads a standardized Excel template for student enrollment with separate NIS and NISN columns
 */
export function downloadStudentTemplate() {
  const headers = [
    ['TEMPLATE DATA SISWA SD'],
    ['Petunjuk Pengisian:'],
    ['1. Kolom NIS diisi Nomor Induk Siswa di sekolah (contoh: 1011).'],
    ['2. Kolom NISN diisi Nomor Induk Siswa Nasional (contoh: 0035482330).'],
    ['3. Kolom Nama Siswa diisi Nama Lengkap Siswa.'],
    ['4. Kolom Jenis Kelamin harus diisi L atau P (L = Laki-laki, P = Perempuan).'],
    ['5. Kolom Kelas harus diisi sesuai Nama Kelas yang terdaftar di sistem. Contoh kelas: Kelas 1A, Kelas 1B, Kelas 2A.'],
    [''], // blank line
    ['NIS', 'NISN', 'Nama Siswa', 'Jenis Kelamin', 'Kelas']
  ];

  const sampleData = [
    ['1011', '0035482330', 'Andi Hermawan', 'L', 'Kelas 1A'],
    ['2011', '0035482331', 'Siti Rahayu', 'P', 'Kelas 1B']
  ];

  const wsData = [...headers, ...sampleData];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set widths
  const wscols = [
    { wch: 14 }, // NIS
    { wch: 16 }, // NISN
    { wch: 30 }, // Nama Siswa
    { wch: 15 }, // Jenis Kelamin
    { wch: 15 }  // Kelas
  ];
  ws['!cols'] = wscols;

  XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');
  XLSX.writeFile(wb, 'Template_Siswa_SD.xlsx');
}

export interface ExcelImportResult {
  valid: boolean;
  errors: string[];
  students: Array<Omit<Student, 'id'>>;
  duplicateInFileCount?: number;
}

/**
 * Reads and validates student records from an uploaded Excel file
 * Supports separate NIS and NISN columns, as well as legacy 4-column format.
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
        const seenInFile = new Set<string>();
        let duplicateInFileCount = 0;

        // Find the header row (typically has columns we specified)
        let headerIndex = -1;
        let nisColIdx = -1;
        let nisnColIdx = -1;
        let nameColIdx = -1;
        let genderColIdx = -1;
        let classColIdx = -1;

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (!r || r.length < 3) continue;

          // Check for headers in this row
          let foundName = false;
          let foundNisOrNisn = false;

          for (let c = 0; c < r.length; c++) {
            const rawHeader = String(r[c] || '').trim().toLowerCase();
            if (rawHeader === 'nis') {
              nisColIdx = c;
              foundNisOrNisn = true;
            } else if (rawHeader.includes('nisn')) {
              nisnColIdx = c;
              foundNisOrNisn = true;
            } else if (rawHeader.includes('nis/nisn') || rawHeader.includes('nis / nisn')) {
              nisColIdx = c;
              nisnColIdx = c;
              foundNisOrNisn = true;
            } else if (rawHeader.includes('nama')) {
              nameColIdx = c;
              foundName = true;
            } else if (rawHeader.includes('jenis kelamin') || rawHeader === 'jk' || rawHeader === 'gender' || rawHeader === 'l/p') {
              genderColIdx = c;
            } else if (rawHeader.includes('kelas') || rawHeader.includes('rombel')) {
              classColIdx = c;
            }
          }

          if (foundName && foundNisOrNisn) {
            headerIndex = i;
            break;
          }
        }

        // Fallback default column mapping if headerIndex found but some indexes weren't matched
        if (headerIndex !== -1) {
          const headerRow = rows[headerIndex];
          if (nameColIdx === -1) {
            // Find column with 'nama'
            nameColIdx = headerRow.findIndex((col: any) => String(col || '').toLowerCase().includes('nama'));
          }
          if (genderColIdx === -1) {
            genderColIdx = headerRow.findIndex((col: any) => {
              const str = String(col || '').toLowerCase();
              return str.includes('kelamin') || str.includes('l/p') || str === 'jk';
            });
          }
          if (classColIdx === -1) {
            classColIdx = headerRow.findIndex((col: any) => {
              const str = String(col || '').toLowerCase();
              return str.includes('kelas') || str.includes('rombel');
            });
          }

          // If NIS and NISN columns are still unresolved:
          if (nisColIdx === -1 && nisnColIdx !== -1) nisColIdx = nisnColIdx;
          if (nisnColIdx === -1 && nisColIdx !== -1) nisnColIdx = nisColIdx;
          if (nisColIdx === -1 && nisnColIdx === -1) {
            nisColIdx = 0;
            nisnColIdx = headerRow.length >= 5 ? 1 : 0;
          }
        }

        if (headerIndex === -1 || nameColIdx === -1) {
          resolve({
            valid: false,
            errors: ['Format file Excel salah. Pastikan baris judul berisi kolom: NIS, NISN, Nama Siswa, Jenis Kelamin, Kelas'],
            students: [],
            duplicateInFileCount: 0
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
          const rawNis = nisColIdx !== -1 ? String(row[nisColIdx] || '').trim() : '';
          const rawNisn = nisnColIdx !== -1 ? String(row[nisnColIdx] || '').trim() : '';
          const name = nameColIdx !== -1 ? String(row[nameColIdx] || '').trim() : '';
          const rawGender = genderColIdx !== -1 ? String(row[genderColIdx] || '').trim().toUpperCase() : '';
          const rawClass = classColIdx !== -1 ? String(row[classColIdx] || '').trim() : '';

          // Validation
          if (!rawNis && !rawNisn) {
            errors.push(`Baris ${rowNum}: Kolom NIS atau NISN harus terisi salah satu.`);
            continue;
          }
          if (!name) {
            errors.push(`Baris ${rowNum}: Nama Siswa kosong.`);
            continue;
          }
          if (rawGender !== 'L' && rawGender !== 'P') {
            errors.push(`Baris ${rowNum}: Jenis Kelamin [${rawGender || 'Kosong'}] harus "L" atau "P".`);
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

          // Check for internal duplicate row within the file
          const effectiveNis = rawNis || rawNisn;
          const effectiveNisn = rawNisn || rawNis;
          const rowKey = `${effectiveNis.toLowerCase()}::${effectiveNisn.toLowerCase()}::${name.toLowerCase()}::${matchedClass.id}`;
          if (seenInFile.has(rowKey)) {
            duplicateInFileCount++;
            continue;
          }
          seenInFile.add(rowKey);

          if (errors.length === 0) {
            students.push({
              nis: rawNis || rawNisn,
              nisn: rawNisn || rawNis,
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
          students,
          duplicateInFileCount
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
 * Exports Blank Monthly Attendance Report (Blangko Kosong) to Excel format:
 * - Kolom tanggal 1..daysInMonth kosong bersih (tanpa strip '-') untuk diisi / ditulis manual
 * - Kolom jumlah H, S, I, A dikosongkan (tanpa angka 0 atau strip)
 * - Tanda tangan kepala sekolah dikosongkan (hanya tanda tangan guru kelas / wali kelas)
 */
export function exportBlankMonthlyReportToExcel(
  school: { name: string; address: string; npsn: string },
  className: string,
  monthName: string,
  year: number,
  daysInMonth: number,
  students: Student[],
  teacherName?: string,
  teacherNip?: string
) {
  const wb = XLSX.utils.book_new();
  
  // Header Dokumen
  const rows: any[] = [
    [`BLANGKO REKAPITULASI ABSENSI SISWA BULANAN - ${monthName.toUpperCase()} ${year}`],
    [school.name.toUpperCase()],
    [`NPSN: ${school.npsn} | Alamat: ${school.address}`],
    [`Kelas / Rombel: ${className}`],
    [], // baris kosong
  ];

  // Baris Header Kolom Tabel: No, NISN, Nama Siswa, L/P, [1..daysInMonth], H, S, I, A
  const headerRow = ['No', 'NISN', 'Nama Lengkap Siswa', 'L/P'];
  for (let d = 1; d <= daysInMonth; d++) {
    headerRow.push(String(d));
  }
  headerRow.push('H', 'S', 'I', 'A');
  rows.push(headerRow);

  // Baris Data Siswa: Kotak tanggal dan jumlah H,S,I,A dikosongkan (string kosong tanpa strip)
  students.forEach((student, index) => {
    const studentRow: any[] = [
      index + 1,
      student.nisn || student.nis || '',
      student.name,
      student.gender
    ];

    // Kolom tanggal 1..daysInMonth: KOSONG BERSIH (tanpa strip '-')
    for (let d = 1; d <= daysInMonth; d++) {
      studentRow.push('');
    }

    // Kolom Rekap H, S, I, A: KOSONG BERSIH (kosongkan juga jumlah A,I,S nya)
    studentRow.push('', '', '', '');
    rows.push(studentRow);
  });

  // Bagian Tanda Tangan: Kepala sekolah dikosongkan saja, hanya Wali/Guru Kelas di sebelah kanan
  rows.push([]);
  rows.push([]);
  const dateStamp = `Gelora, .................................... ${year}`;
  
  const totalCols = headerRow.length;
  const signaturePaddingRow = Array(totalCols).fill('');
  signaturePaddingRow[Math.max(0, totalCols - 6)] = dateStamp;
  rows.push(signaturePaddingRow);

  const signatureRoleRow = Array(totalCols).fill('');
  signatureRoleRow[Math.max(0, totalCols - 6)] = 'Guru Kelas / Wali Kelas,';
  rows.push(signatureRoleRow);

  rows.push(Array(totalCols).fill('')); // Ruang tanda tangan fisik
  rows.push(Array(totalCols).fill(''));
  rows.push(Array(totalCols).fill(''));

  const signatureNameRow = Array(totalCols).fill('');
  signatureNameRow[Math.max(0, totalCols - 6)] = teacherName ? teacherName : '( ............................................... )';
  rows.push(signatureNameRow);

  const signatureNipRow = Array(totalCols).fill('');
  signatureNipRow[Math.max(0, totalCols - 6)] = teacherNip ? `NIP. ${teacherNip}` : 'NIP. ...............................................';
  rows.push(signatureNipRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!showGrid'] = true;

  XLSX.utils.book_append_sheet(wb, ws, 'Blangko Kosong');
  XLSX.writeFile(wb, `Blangko_Kosong_Absensi_${className.replace(/\s+/g, '_')}_Bulanan_${monthName}_${year}.xlsx`);
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

/**
  * Exports student list to Excel format as a downloadable report/backup
  */
export function exportStudentListToExcel(
  students: Student[],
  classes: ClassRombel[],
  filterClassName?: string
) {
  const getClassName = (cId: string) => {
    const found = classes.find((c) => c.id === cId);
    return found ? found.name : '-';
  };

  const rows: any[] = [
    [filterClassName ? `DATA SISWA - ${filterClassName.toUpperCase()}` : 'DATA SELURUH SISWA'],
    [`Tanggal Unduh: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`],
    [],
    ['No', 'NIS', 'NISN', 'Nama Lengkap Siswa', 'L/P', 'Kelas Rombel', 'Tempat Lahir', 'Tanggal Lahir']
  ];

  students.forEach((s, idx) => {
    rows.push([
      idx + 1,
      s.nis,
      s.nisn,
      s.name,
      s.gender,
      getClassName(s.classId),
      s.birthPlace || '-',
      s.birthDate || '-'
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');
  const filename = filterClassName 
    ? `Data_Siswa_${filterClassName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
    : `Data_Siswa_Lengkap_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
