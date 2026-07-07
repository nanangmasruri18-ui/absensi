import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student, Attendance, Holiday } from '../types';

/**
 * Generates and downloads a beautifully formatted Monthly Attendance PDF Report (Landscape)
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
    format: 'a4'
  });

  // Title Headers
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN ABSENSI SISWA BULANAN', 148, 14, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(school.name, 148, 20, { align: 'center' });
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`NPSN: ${school.npsn} | Alamat: ${school.address}`, 148, 25, { align: 'center' });
  
  // Decorative line
  doc.setLineWidth(0.5);
  doc.line(15, 28, 282, 28);

  // Metadata block left
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Kelas / Rombel: ${className}`, 15, 34);
  doc.text(`Wali Kelas: ${homeroomTeacherName || '-'}`, 15, 39);

  // Metadata block right
  const monthLabel = `Bulan: ${monthName.toUpperCase()}`;
  const yearLabel = `Tahun Pelajaran: ${year}/${year + 1}`;
  doc.text(monthLabel, 282, 34, { align: 'right' });
  doc.text(yearLabel, 282, 39, { align: 'right' });

  // Columns: No, NISN, Nama, L/P, [1..31], H, S, I, A
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

  // Calculate dynamic column stylings with very narrow date widths
  const columnStyles: any = {
    0: { cellWidth: 7, halign: 'center' }, // No
    1: { cellWidth: 15, halign: 'center' }, // NISN
    2: { cellWidth: 35 }, // Nama Siswa
    3: { cellWidth: 7, halign: 'center' }, // L/P
  };

  // Remaining date columns are 1 to daysInMonth, plus 4 summary cols
  const startIndex = 4;
  const endIndex = startIndex + daysInMonth;
  
  // Date cells width
  for (let i = startIndex; i < endIndex; i++) {
    columnStyles[i] = { cellWidth: 5.4, halign: 'center' };
  }
  // H S I A cells width
  for (let i = endIndex; i < endIndex + 4; i++) {
    columnStyles[i] = { cellWidth: 6, halign: 'center', fontStyle: 'bold' };
  }

  // Draw table with jsPDF AutoTable
  autoTable(doc, {
    startY: 44,
    head: [headers],
    body: bodyData,
    theme: 'grid',
    styles: {
      fontSize: 5.5,
      cellPadding: 0.8,
      overflow: 'ellipsize',
      lineColor: [200, 200, 200],
      textColor: [30, 30, 30]
    },
    headStyles: {
      fillColor: [59, 130, 246], // blue accent
      textColor: [255, 255, 255],
      fontSize: 5.5,
      halign: 'center',
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
          data.cell.styles.textColor = [220, 38, 38];
          if (val === '-' || !val) {
            data.cell.text = ['M']; // 'M' for Minggu
          }
        } else if (isHol) {
          data.cell.styles.fillColor = [254, 243, 199]; // light yellow (holiday)
          data.cell.styles.textColor = [217, 119, 6];
          if (val === '-' || !val) {
            data.cell.text = ['L']; // 'L' for Libur
          }
        } else {
          // Status styling
          if (val === 'H') {
            data.cell.styles.textColor = [16, 185, 129]; // green
          } else if (val === 'S') {
            data.cell.styles.textColor = [59, 130, 246]; // blue
            data.cell.styles.fillColor = [239, 246, 255];
          } else if (val === 'I') {
            data.cell.styles.textColor = [245, 158, 11]; // orange
            data.cell.styles.fillColor = [254, 243, 199];
          } else if (val === 'A') {
            data.cell.styles.textColor = [239, 68, 68]; // red
            data.cell.styles.fillColor = [254, 226, 226];
          }
        }
      }
    }
  });

  // Calculate coordinates for bottom-right signature block
  const finalY = (doc as any).lastAutoTable.finalY || 120;
  const signatureSpaceY = finalY + 12;

  // Sign off right-aligned
  const textX = 230;
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  const dStamp = `Gelora, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  doc.text(dStamp, textX, signatureSpaceY);
  doc.text('Guru Kelas / Wali Kelas,', textX, signatureSpaceY + 5);

  // Leave standard clean space for physics sign
  doc.setFont('Helvetica', 'bold');
  const teacherLabel = homeroomTeacherName || '( ............................................... )';
  doc.text(teacherLabel, textX, signatureSpaceY + 25);
  doc.setFont('Helvetica', 'normal');
  const nipLabel = homeroomTeacherNip ? `NIP. ${homeroomTeacherNip}` : 'NIP. ...............................................';
  doc.text(nipLabel, textX, signatureSpaceY + 29);

  // Preview before download (we can save it)
  doc.save(`Absensi_Siswa_Bulanan_${className.replace(' ', '_')}_${monthName}_${year}.pdf`);
}

/**
 * Generates and downloads a Semester Attendance PDF Report (Portrait)
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
    format: 'a4'
  });

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN ABSENSI REKAPITULASI SEMESTER', 105, 14, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(school.name, 105, 20, { align: 'center' });
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`NPSN: ${school.npsn} | Alamat: ${school.address}`, 105, 25, { align: 'center' });
  
  doc.setLineWidth(0.5);
  doc.line(15, 28, 195, 28);

  // Metadata
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Kelas Rombel: ${className}`, 15, 34);
  doc.text(`Semester: ${semester}`, 15, 39);
  doc.text(`Tahun Pelajaran: ${academicYear}`, 195, 34, { align: 'right' });

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

  autoTable(doc, {
    startY: 44,
    head: [headers],
    body: bodyData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [79, 70, 229], // indigo accent
      textColor: [255, 255, 255],
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 55 },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 15, halign: 'center' },
      7: { cellWidth: 15, halign: 'center' },
      8: { cellWidth: 22, halign: 'center' },
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 120;
  const signatureSpaceY = finalY + 15;

  const textX = 140;
  doc.setFontSize(9);
  const dStamp = `Gelora, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  doc.text(dStamp, textX, signatureSpaceY);
  doc.text('Guru Kelas / Wali Kelas,', textX, signatureSpaceY + 5);

  doc.setFont('Helvetica', 'bold');
  const teacherLabel = homeroomTeacherName || '( ............................................... )';
  doc.text(teacherLabel, textX, signatureSpaceY + 25);
  doc.setFont('Helvetica', 'normal');
  const nipLabel = homeroomTeacherNip ? `NIP. ${homeroomTeacherNip}` : 'NIP. ...............................................';
  doc.text(nipLabel, textX, signatureSpaceY + 29);

  doc.save(`Absensi_Siswa_Semester_${className.replace(' ', '_')}_Semester_${semester.replace(' ', '_')}.pdf`);
}
