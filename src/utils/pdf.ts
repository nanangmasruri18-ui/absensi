import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student, Attendance, Holiday } from '../types';

/**
 * Generates and downloads a beautifully formatted Monthly Attendance PDF Report
 * Paper size: F4 / Folio Landscape (13 x 8.5 inches = 330.2 mm x 215.9 mm)
 */
export function generateMonthlyPDF({
  school,
  className,
  homeroomTeacherName,
  homeroomTeacherNip,
  monthName,
  monthIndex, // 0-indexed
  year,
  daysInMonth,
  students,
  attendanceData,
  holidays
}: {
  school: { name: string; address: string; npsn: string };
  className: string;
  homeroomTeacherName: string;
  homeroomTeacherNip?: string;
  monthName: string;
  monthIndex: number;
  year: number;
  daysInMonth: number;
  students: Student[];
  attendanceData: Record<string, Record<string, string>>;
  holidays: Holiday[];
}) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [215.9, 330.2] // 13 x 8.5 inches landscape (330.2 mm width x 215.9 mm height)
  });

  const pageWidth = 330.2;
  const pageHeight = 215.9;
  const marginX = 10;
  const printableWidth = pageWidth - (marginX * 2); // 310.2 mm

  // Title Headers
  doc.setTextColor(15, 23, 42); // slate-900 sharp dark text
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('LAPORAN ABSENSI SISWA BULANAN', pageWidth / 2, 13, { align: 'center' });
  
  doc.setFontSize(13.5);
  doc.text(school.name.toUpperCase(), pageWidth / 2, 19.5, { align: 'center' });
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`NPSN: ${school.npsn}  |  Alamat: ${school.address}`, pageWidth / 2, 24.5, { align: 'center' });
  
  // Decorative double header line
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(1.2);
  doc.line(marginX, 27.5, pageWidth - marginX, 27.5);
  doc.setLineWidth(0.4);
  doc.line(marginX, 28.5, pageWidth - marginX, 28.5);

  // Metadata block left
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Kelas / Rombel : ${className}`, marginX, 35);
  doc.text(`Wali Kelas        : ${homeroomTeacherName || '-'}`, marginX, 40.5);

  // Metadata block right
  const monthLabel = `Bulan: ${monthName.toUpperCase()}`;
  const yearLabel = `Tahun Pelajaran: ${year}/${year + 1}`;
  doc.text(monthLabel, pageWidth - marginX, 35, { align: 'right' });
  doc.text(yearLabel, pageWidth - marginX, 40.5, { align: 'right' });

  // Columns: No, NISN, Nama, L/P, [1..daysInMonth], H, S, I, A
  const headers: string[] = ['No', 'NISN', 'Nama Siswa', 'L/P'];
  for (let d = 1; d <= daysInMonth; d++) {
    headers.push(String(d));
  }
  headers.push('H', 'S', 'I', 'A');

  // Rows preparation
  const bodyData: any[] = [];
  students.forEach((student, index) => {
    const row: any[] = [
      index + 1,
      student.nisn,
      student.name,
      student.gender
    ];

    let counts = { H: 0, S: 0, I: 0, A: 0 };
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, '0');
      const monthStr = String(monthIndex + 1).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      
      const status = attendanceData[student.id]?.[dateStr] || '-';
      row.push(status);

      if (status === 'H') counts.H++;
      else if (status === 'S') counts.S++;
      else if (status === 'I') counts.I++;
      else if (status === 'A') counts.A++;
    }

    // Add H, S, I, A summary
    row.push(counts.H, counts.S, counts.I, counts.A);
    bodyData.push(row);
  });

  // Calculate dynamic column stylings for 310.2mm printable width
  const fixedSumColWidth = 6.5;
  const fixedNonDateWidth = 8 + 22 + 62 + 7 + (4 * fixedSumColWidth); // 125mm total fixed
  const dayColWidth = Math.floor(((printableWidth - fixedNonDateWidth) / daysInMonth) * 100) / 100; // ~5.97mm for 31 days

  const columnStyles: any = {
    0: { cellWidth: 8, halign: 'center' }, // No
    1: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }, // NISN
    2: { cellWidth: 62, fontStyle: 'bold' }, // Nama Siswa
    3: { cellWidth: 7, halign: 'center' }, // L/P
  };

  const startIndex = 4;
  const endIndex = startIndex + daysInMonth;
  
  // Date cells width
  for (let i = startIndex; i < endIndex; i++) {
    columnStyles[i] = { cellWidth: dayColWidth, halign: 'center' };
  }
  // H S I A cells width
  for (let i = endIndex; i < endIndex + 4; i++) {
    columnStyles[i] = { cellWidth: fixedSumColWidth, halign: 'center', fontStyle: 'bold' };
  }

  // Draw table with jsPDF AutoTable
  autoTable(doc, {
    startY: 44,
    margin: { left: marginX, right: marginX, top: 15, bottom: 15 },
    head: [headers],
    body: bodyData,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.0,
      overflow: 'linebreak', // clean text wrapping if needed, preventing overlap
      lineColor: [30, 41, 59], // sharp slate-800 borders
      lineWidth: 0.3, // thicker, crisp grid lines
      textColor: [15, 23, 42], // pure dark readable text
      font: 'Helvetica'
    },
    headStyles: {
      fillColor: [30, 58, 138], // rich deep blue header background
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      lineColor: [15, 23, 42],
      lineWidth: 0.4
    },
    columnStyles: columnStyles,
    didParseCell: (data) => {
      // Highlight weekends, holidays, or specific statuses
      if (data.section === 'body' && data.column.index >= startIndex && data.column.index < endIndex) {
        const dayNumber = data.column.index - startIndex + 1;
        const dayStr = String(dayNumber).padStart(2, '0');
        const monthStr = String(monthIndex + 1).padStart(2, '0');
        const dateStr = `${year}-${monthStr}-${dayStr}`;

        // Sunday check
        const dObj = new Date(dateStr);
        const isSun = dObj.getDay() === 0;

        // Holiday check
        const isHol = holidays.some((h) => h.date === dateStr);

        const val = data.cell.text[0];

        if (isSun) {
          data.cell.styles.fillColor = [254, 226, 226]; // light red
          data.cell.styles.textColor = [185, 28, 28]; // bold dark red
          data.cell.styles.fontStyle = 'bold';
          if (val === '-' || !val) {
            data.cell.text = ['M']; // 'M' for Minggu
          }
        } else if (isHol) {
          data.cell.styles.fillColor = [254, 243, 199]; // light yellow (holiday)
          data.cell.styles.textColor = [180, 83, 9]; // dark amber
          data.cell.styles.fontStyle = 'bold';
          if (val === '-' || !val) {
            data.cell.text = ['L']; // 'L' for Libur
          }
        } else {
          // Status styling
          data.cell.styles.fontStyle = 'bold';
          if (val === 'H') {
            data.cell.styles.textColor = [4, 120, 87]; // bold emerald green
          } else if (val === 'S') {
            data.cell.styles.textColor = [29, 78, 216]; // bold blue
            data.cell.styles.fillColor = [239, 246, 255];
          } else if (val === 'I') {
            data.cell.styles.textColor = [217, 119, 6]; // bold amber
            data.cell.styles.fillColor = [254, 243, 199];
          } else if (val === 'A') {
            data.cell.styles.textColor = [220, 38, 38]; // bold red
            data.cell.styles.fillColor = [254, 226, 226];
          }
        }
      }
    }
  });

  // Handle signature block on the LAST page without overlapping table
  const totalPages = doc.getNumberOfPages();
  doc.setPage(totalPages);

  const finalY = (doc as any).lastAutoTable.finalY || 120;
  let signatureY = finalY + 12;

  // If signature block (approx 38mm height) overflows page height, create a new page
  if (signatureY + 38 > pageHeight - 15) {
    doc.addPage();
    signatureY = 25;
  }

  const textX = 245;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('Helvetica', 'normal');
  const dStamp = `Gelora, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  doc.text(dStamp, textX, signatureY);
  doc.text('Guru Kelas / Wali Kelas,', textX, signatureY + 5.5);

  // Signer name and NIP
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10.5);
  const teacherLabel = homeroomTeacherName || '( ............................................... )';
  doc.text(teacherLabel, textX, signatureY + 26);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  const nipLabel = homeroomTeacherNip ? `NIP. ${homeroomTeacherNip}` : 'NIP. ...............................................';
  doc.text(nipLabel, textX, signatureY + 31);

  // Add Page Numbers and Footer to ALL pages
  const finalPageCount = doc.getNumberOfPages();
  for (let i = 1; i <= finalPageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Halaman ${i} dari ${finalPageCount}`, pageWidth - marginX, pageHeight - 6, { align: 'right' });
    doc.text(`Dokumen Resmi Laporan Absensi - ${school.name}`, marginX, pageHeight - 6);
  }

  // Download PDF
  doc.save(`Absensi_Siswa_Bulanan_${className.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`);
}

/**
 * Generates and downloads a Semester Attendance PDF Report
 * Paper size: F4 / Folio Portrait (8.5 x 13 inches = 215.9 mm x 330.2 mm)
 */
export function generateSemesterPDF({
  school,
  className,
  semester,
  academicYear,
  rows,
  homeroomTeacherName,
  homeroomTeacherNip
}: {
  school: { name: string; address: string; npsn: string };
  className: string;
  semester: string;
  academicYear: string;
  rows: Array<{
    no: number;
    nisn: string;
    name: string;
    gender: string;
    hadir: number;
    sakit: number;
    izin: number;
    alfa: number;
    persentase: string;
  }>;
  homeroomTeacherName?: string;
  homeroomTeacherNip?: string;
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [215.9, 330.2] // 13 x 8.5 inches portrait (215.9 mm width x 330.2 mm height)
  });

  const pageWidth = 215.9;
  const pageHeight = 330.2;
  const tableMarginX = 14; // Centered printable width = 215.9 - 28 = 187.9 mm

  doc.setTextColor(15, 23, 42); // slate-900 sharp dark text
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(15.5);
  doc.text('LAPORAN ABSENSI REKAPITULASI SEMESTER', pageWidth / 2, 14, { align: 'center' });
  
  doc.setFontSize(13.5);
  doc.text(school.name.toUpperCase(), pageWidth / 2, 20.5, { align: 'center' });
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`NPSN: ${school.npsn}  |  Alamat: ${school.address}`, pageWidth / 2, 25.5, { align: 'center' });
  
  // Double header line for formal presentation
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(1.2);
  doc.line(tableMarginX, 28.5, pageWidth - tableMarginX, 28.5);
  doc.setLineWidth(0.4);
  doc.line(tableMarginX, 29.5, pageWidth - tableMarginX, 29.5);

  // Metadata
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Kelas Rombel  : ${className}`, tableMarginX, 36);
  doc.text(`Semester       : ${semester}`, tableMarginX, 41.5);
  doc.text(`Tahun Pelajaran : ${academicYear}`, pageWidth - tableMarginX, 36, { align: 'right' });

  const headers = ['No', 'NISN', 'Nama Siswa', 'L/P', 'Hadir', 'Sakit', 'Izin', 'Alfa', 'Persentase'];
  const bodyData = rows.map((r) => [
    r.no,
    r.nisn,
    r.name,
    r.gender,
    r.hadir,
    r.sakit,
    r.izin,
    r.alfa,
    r.persentase
  ]);

  // Total table width: 10 + 25 + 63 + 9 + 14*4 + 22 = 185 mm
  autoTable(doc, {
    startY: 46,
    margin: { left: tableMarginX, right: tableMarginX, top: 15, bottom: 15 },
    head: [headers],
    body: bodyData,
    theme: 'grid',
    styles: {
      fontSize: 9.5,
      cellPadding: 2.2,
      overflow: 'linebreak', // text wraps gracefully without overlapping cells
      lineColor: [30, 41, 59], // sharp slate-800 borders
      lineWidth: 0.35, // thicker, clearer grid lines
      textColor: [15, 23, 42], // sharp black text
      font: 'Helvetica'
    },
    headStyles: {
      fillColor: [30, 58, 138], // rich dark indigo/blue header
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center',
      lineColor: [15, 23, 42],
      lineWidth: 0.4
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 63, fontStyle: 'bold' },
      3: { cellWidth: 9, halign: 'center' },
      4: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 14, halign: 'center' },
      7: { cellWidth: 14, halign: 'center' },
      8: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
    }
  });

  // Handle signature block on the LAST page
  const pageCountSem = doc.getNumberOfPages();
  doc.setPage(pageCountSem);

  const finalYSem = (doc as any).lastAutoTable.finalY || 120;
  let signatureYSem = finalYSem + 14;

  // If signature block overflows current page height, create a new page
  if (signatureYSem + 38 > pageHeight - 15) {
    doc.addPage();
    signatureYSem = 25;
  }

  const textXSem = 138;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('Helvetica', 'normal');
  const dStamp = `Gelora, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  doc.text(dStamp, textXSem, signatureYSem);
  doc.text('Guru Kelas / Wali Kelas,', textXSem, signatureYSem + 5.5);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10.5);
  const teacherLabel = homeroomTeacherName || '( ............................................... )';
  doc.text(teacherLabel, textXSem, signatureYSem + 26);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  const nipLabel = homeroomTeacherNip ? `NIP. ${homeroomTeacherNip}` : 'NIP. ...............................................';
  doc.text(nipLabel, textXSem, signatureYSem + 31);

  // Footer page numbers on ALL pages
  const totalPagesSem = doc.getNumberOfPages();
  for (let i = 1; i <= totalPagesSem; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Halaman ${i} dari ${totalPagesSem}`, pageWidth - tableMarginX, pageHeight - 8, { align: 'right' });
    doc.text(`Dokumen Resmi Laporan Absensi - ${school.name}`, tableMarginX, pageHeight - 8);
  }

  doc.save(`Absensi_Siswa_Semester_${className.replace(/\s+/g, '_')}_Semester_${semester.replace(/\s+/g, '_')}.pdf`);
}


