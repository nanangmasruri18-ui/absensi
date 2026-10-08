import { SchoolProfile, ClassRombel, Teacher, Student, Holiday, Attendance } from '../types';
import { pushToSupabase, pushAttendanceRecords } from './supabase';

// Simple "encryption" helper for password masking in localStorage
export function encryptPassword(password: string): string {
  return btoa(unescape(encodeURIComponent(password)));
}

export function decryptPassword(hash: string): string {
  try {
    return decodeURIComponent(escape(atob(hash)));
  } catch {
    return 'password';
  }
}

// Key names in LocalStorage
const KEYS = {
  SCHOOL: 'absensi_sd_school',
  CLASSES: 'absensi_sd_classes',
  TEACHERS: 'absensi_sd_teachers',
  STUDENTS: 'absensi_sd_students',
  HOLIDAYS: 'absensi_sd_holidays',
  ATTENDANCE: 'absensi_sd_attendance',
};

// Initial/Seed Data
const DEFAULT_SCHOOL: SchoolProfile = {
  name: 'SD Negeri Gelora 01',
  address: 'Jl. Pemuda No. 45, Kel. Gelora, Kec. Tanah Abang, Kota Jakarta Pusat, DKI Jakarta',
  npsn: '20103456',
  adminName: 'Admin Gelora',
};

const DEFAULT_CLASSES: ClassRombel[] = [
  { id: 'class-1a', name: 'Kelas 1A', grade: '1', homeroomTeacherId: 'teacher-guru1a' },
  { id: 'class-1b', name: 'Kelas 1B', grade: '1', homeroomTeacherId: 'teacher-guru1b' },
  { id: 'class-2a', name: 'Kelas 2A', grade: '2', homeroomTeacherId: 'teacher-guru2a' },
  { id: 'class-2b', name: 'Kelas 2B', grade: '2', homeroomTeacherId: '' },
];

const DEFAULT_TEACHERS: Teacher[] = [
  {
    id: 'admin-1',
    nip: '197901012005011001',
    name: 'Admin Gelora',
    gender: 'L',
    username: 'admin',
    passwordHash: encryptPassword('admin123'),
    assignedClassId: '',
    role: 'admin',
  },
  {
    id: 'teacher-guru1a',
    nip: '198503122010121001',
    name: 'Budi Santoso, S.Pd.',
    gender: 'L',
    username: 'guru1a',
    passwordHash: encryptPassword('password1a'),
    assignedClassId: 'class-1a',
    role: 'guru',
  },
  {
    id: 'teacher-guru1b',
    nip: '199008242015042002',
    name: 'Siti Rahma, S.Pd.',
    gender: 'P',
    username: 'guru1b',
    passwordHash: encryptPassword('password1b'),
    assignedClassId: 'class-1b',
    role: 'guru',
  },
  {
    id: 'teacher-guru2a',
    nip: '198211052008011003',
    name: 'Ahmad Dahlan, S.Pd.',
    gender: 'L',
    username: 'guru2a',
    passwordHash: encryptPassword('password2a'),
    assignedClassId: 'class-2a',
    role: 'guru',
  },
];

const DEFAULT_STUDENTS: Student[] = [
  // Class 1A
  { id: 'std-1a-1', nis: '1001', nisn: '0015482310', name: 'Ahmad Rafli', gender: 'L', birthPlace: 'Jakarta', birthDate: '2019-03-12', classId: 'class-1a' },
  { id: 'std-1a-2', nis: '1002', nisn: '0015482311', name: 'Bunga Citra Lestari', gender: 'P', birthPlace: 'Bandung', birthDate: '2019-07-22', classId: 'class-1a' },
  { id: 'std-1a-3', nis: '1003', nisn: '0015482312', name: 'Chandra Wijaya', gender: 'L', birthPlace: 'Bogor', birthDate: '2019-01-05', classId: 'class-1a' },
  { id: 'std-1a-4', nis: '1004', nisn: '0015482313', name: 'Dian Sastrowardoyo', gender: 'P', birthPlace: 'Surabaya', birthDate: '2019-11-18', classId: 'class-1a' },
  { id: 'std-1a-5', nis: '1005', nisn: '0015482314', name: 'Eko Prasetyo', gender: 'L', birthPlace: 'Solo', birthDate: '2019-05-30', classId: 'class-1a' },
  { id: 'std-1a-6', nis: '1006', nisn: '0015482315', name: 'Farah Diva', gender: 'P', birthPlace: 'Yogyakarta', birthDate: '2019-08-14', classId: 'class-1a' },
  { id: 'std-1a-7', nis: '1007', nisn: '0015482316', name: 'Gilang Ramadhan', gender: 'L', birthPlace: 'Semarang', birthDate: '2019-02-28', classId: 'class-1a' },
  { id: 'std-1a-8', nis: '1008', nisn: '0015482317', name: 'Hesti Purwadinata', gender: 'P', birthPlace: 'Medan', birthDate: '2019-04-16', classId: 'class-1a' },
  { id: 'std-1a-9', nis: '1009', nisn: '0015482318', name: 'Irwan Syah', gender: 'L', birthPlace: 'Palembang', birthDate: '2019-09-03', classId: 'class-1a' },
  { id: 'std-1a-10', nis: '1010', nisn: '0015482319', name: 'Jelita Sejuba', gender: 'P', birthPlace: 'Denpasar', birthDate: '2019-10-10', classId: 'class-1a' },

  // Class 1B
  { id: 'std-1b-1', nis: '2001', nisn: '0025482320', name: 'Kurnia Setiawan', gender: 'L', birthPlace: 'Jakarta', birthDate: '2019-04-12', classId: 'class-1b' },
  { id: 'std-1b-2', nis: '2002', nisn: '0025482321', name: 'Larasati Putri', gender: 'P', birthPlace: 'Depok', birthDate: '2019-05-15', classId: 'class-1b' },
  { id: 'std-1b-3', nis: '2003', nisn: '0025482322', name: 'Mochammad Akbar', gender: 'L', birthPlace: 'Bogor', birthDate: '2019-06-20', classId: 'class-1b' },
  { id: 'std-1b-4', nis: '2004', nisn: '0025482323', name: 'Nabila Syakieb', gender: 'P', birthPlace: 'Bandung', birthDate: '2019-07-25', classId: 'class-1b' },
  { id: 'std-1b-5', nis: '2005', nisn: '0025482324', name: 'Okto Maniani', gender: 'L', birthPlace: 'Jayapura', birthDate: '2019-10-05', classId: 'class-1b' },

  // Class 2A
  { id: 'std-2a-1', nis: '3001', nisn: '0035482330', name: 'Pratama Arhan', gender: 'L', birthPlace: 'Blora', birthDate: '2018-12-21', classId: 'class-2a' },
  { id: 'std-2a-2', nis: '3002', nisn: '0035482331', name: 'Rara Istiati', gender: 'P', birthPlace: 'Balikpapan', birthDate: '2018-09-11', classId: 'class-2a' },
  { id: 'std-2a-3', nis: '3003', nisn: '0035482332', name: 'Saddil Ramdani', gender: 'L', birthPlace: 'Kendari', birthDate: '2018-01-02', classId: 'class-2a' },
];

const DEFAULT_HOLIDAYS: Holiday[] = [
  { id: 'hol-1', date: '2026-06-01', name: 'Hari Lahir Pancasila', description: 'Libur Nasional memperingati lahirnya Pancasila' },
  { id: 'hol-2', date: '2026-06-17', name: 'Tahun Baru Islam 1448 H', description: 'Peringatan Hijriah baru 1 Muharram' },
  { id: 'hol-3', date: '2026-08-17', name: 'Hari Kemerdekaan RI', description: 'HUT Kemerdekaan Republik Indonesia ke-81' },
  { id: 'hol-4', date: '2026-05-01', name: 'Hari Buruh Internasional', description: 'Libur Hari Buruh sedunia' },
  { id: 'hol-5', date: '2026-10-01', name: 'Hari Kesaktian Pancasila', description: 'Peringatan Kesaktian Pancasila' },
  { id: 'hol-6', date: '2026-10-28', name: 'Hari Sumpah Pemuda', description: 'Peringatan Hari Sumpah Pemuda' },
  { id: 'hol-7', date: '2026-11-10', name: 'Hari Pahlawan', description: 'Peringatan Hari Pahlawan Nasional' },
  { id: 'hol-8', date: '2026-12-25', name: 'Hari Raya Natal', description: 'Libur Nasional Hari Raya Natal' },
];

// Seed complete attendance data for TA 2026/2027 (Juli - Oktober 2026 & Juni)
export const generateSampleAttendances = (): Attendance[] => {
  const result: Attendance[] = [];

  const holidaysSet = new Set([
    '2026-06-01', '2026-06-17', '2026-08-17', '2026-10-01'
  ]);

  // Active days for June 2026
  const activeDaysJune = [
    '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06',
    '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13',
    '2026-06-15', '2026-06-16', '2026-06-18', '2026-06-19', '2026-06-20'
  ];

  // Active days from July 1, 2026 to October 6, 2026 (today)
  const activeDaysJulyToOct: string[] = [];
  const start = new Date('2026-07-01');
  const end = new Date('2026-10-06');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay(); // 0 is Sunday
    const dStr = d.toISOString().slice(0, 10);
    if (dayOfWeek !== 0 && !holidaysSet.has(dStr)) {
      activeDaysJulyToOct.push(dStr);
    }
  }

  const allActiveDays = [...activeDaysJune, ...activeDaysJulyToOct];

  // Deterministic pseudo-random helper for consistent data
  const pseudoRand = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
  };

  for (const date of allActiveDays) {
    for (const student of DEFAULT_STUDENTS) {
      const rand = pseudoRand(student.id + '-' + date);
      let status: 'H' | 'S' | 'I' | 'A' = 'H';
      let notes = '';

      if (rand < 0.04) {
        status = 'S';
        notes = 'Demam / flu';
      } else if (rand < 0.07) {
        status = 'I';
        notes = 'Izin keluarga';
      } else if (rand < 0.09) {
        status = 'A';
        notes = 'Tanpa keterangan';
      }

      result.push({
        id: `${student.classId}-${student.id}-${date}`,
        classId: student.classId,
        studentId: student.id,
        date,
        status,
        notes,
        updatedAt: '2026-10-06T12:00:00.000Z',
      });
    }
  }

  return result;
};

// Database class initializer
class LocalDB {
  constructor() {
    this.init();
  }

  private init() {
    if (!localStorage.getItem(KEYS.SCHOOL)) {
      localStorage.setItem(KEYS.SCHOOL, JSON.stringify(DEFAULT_SCHOOL));
    }
    if (!localStorage.getItem(KEYS.CLASSES)) {
      localStorage.setItem(KEYS.CLASSES, JSON.stringify(DEFAULT_CLASSES));
    }
    if (!localStorage.getItem(KEYS.TEACHERS)) {
      localStorage.setItem(KEYS.TEACHERS, JSON.stringify(DEFAULT_TEACHERS));
    }
    if (!localStorage.getItem(KEYS.STUDENTS)) {
      localStorage.setItem(KEYS.STUDENTS, JSON.stringify(DEFAULT_STUDENTS));
    }
    if (!localStorage.getItem(KEYS.HOLIDAYS)) {
      localStorage.setItem(KEYS.HOLIDAYS, JSON.stringify(DEFAULT_HOLIDAYS));
    }
    const currentAtt = localStorage.getItem(KEYS.ATTENDANCE);
    let attLen = 0;
    try {
      if (currentAtt) attLen = JSON.parse(currentAtt).length;
    } catch {}
    if (!currentAtt || attLen < 300) {
      // Ensure complete July-October records are restored
      const fullAttendances = generateSampleAttendances();
      localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(fullAttendances));
    }
  }

  // SCHOOL PROFILE
  getSchool(): SchoolProfile {
    return JSON.parse(localStorage.getItem(KEYS.SCHOOL) || '{}');
  }

  saveSchool(school: SchoolProfile) {
    const stampedSchool: SchoolProfile = {
      ...school,
      updatedAt: school.updatedAt || new Date().toISOString(),
    };
    localStorage.setItem(KEYS.SCHOOL, JSON.stringify(stampedSchool));
    pushToSupabase(KEYS.SCHOOL, stampedSchool);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('db-synced', { detail: { entity: 'school' } }));
    }
  }

  // CLASSES
  getClasses(): ClassRombel[] {
    return JSON.parse(localStorage.getItem(KEYS.CLASSES) || '[]');
  }

  saveClasses(classes: ClassRombel[]) {
    const nowIso = new Date().toISOString();
    const stamped = classes.map((c) => ({
      ...c,
      updatedAt: c.updatedAt || nowIso,
    }));
    localStorage.setItem(KEYS.CLASSES, JSON.stringify(stamped));
    pushToSupabase(KEYS.CLASSES, stamped);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('db-synced', { detail: { entity: 'classes' } }));
    }
  }

  // TEACHERS
  getTeachers(): Teacher[] {
    return JSON.parse(localStorage.getItem(KEYS.TEACHERS) || '[]');
  }

  saveTeachers(teachers: Teacher[]) {
    const nowIso = new Date().toISOString();
    const stamped = teachers.map((t) => ({
      ...t,
      updatedAt: t.updatedAt || nowIso,
    }));
    localStorage.setItem(KEYS.TEACHERS, JSON.stringify(stamped));
    pushToSupabase(KEYS.TEACHERS, stamped);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('db-synced', { detail: { entity: 'teachers' } }));
    }
  }

  // STUDENTS
  getStudents(): Student[] {
    return JSON.parse(localStorage.getItem(KEYS.STUDENTS) || '[]');
  }

  saveStudents(students: Student[]) {
    const nowIso = new Date().toISOString();
    const stamped = students.map((s) => ({
      ...s,
      updatedAt: s.updatedAt || nowIso,
    }));
    localStorage.setItem(KEYS.STUDENTS, JSON.stringify(stamped));
    pushToSupabase(KEYS.STUDENTS, stamped);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('db-synced', { detail: { entity: 'students' } }));
    }
  }

  // HOLIDAYS
  getHolidays(): Holiday[] {
    return JSON.parse(localStorage.getItem(KEYS.HOLIDAYS) || '[]');
  }

  saveHolidays(holidays: Holiday[]) {
    const nowIso = new Date().toISOString();
    const stamped = holidays.map((h) => ({
      ...h,
      updatedAt: h.updatedAt || nowIso,
    }));
    localStorage.setItem(KEYS.HOLIDAYS, JSON.stringify(stamped));
    pushToSupabase(KEYS.HOLIDAYS, stamped);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('db-synced', { detail: { entity: 'holidays' } }));
    }
  }

  // ATTENDANCE
  getAttendance(): Attendance[] {
    try {
      const raw = localStorage.getItem(KEYS.ATTENDANCE);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveAttendance(attendances: Attendance[]) {
    try {
      const nowIso = new Date().toISOString();
      const stamped = attendances.map((a) => ({
        ...a,
        updatedAt: a.updatedAt || nowIso,
      }));
      localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(stamped));
      pushToSupabase(KEYS.ATTENDANCE, stamped);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('absensi-updated', { detail: { count: stamped.length } }));
      }
    } catch (err) {
      console.error('Error saving attendance:', err);
    }
  }

  saveAttendanceForClassDate(classId: string, date: string, records: Attendance[]) {
    try {
      const nowIso = new Date().toISOString();
      const stampedRecords = records.map((r) => ({
        ...r,
        updatedAt: r.updatedAt || nowIso,
      }));

      const all = this.getAttendance();
      const filtered = all.filter((a) => !(a.classId === classId && a.date === date));
      const updated = [...filtered, ...stampedRecords].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.classId !== b.classId) return a.classId.localeCompare(b.classId);
        return (a.studentId || '').localeCompare(b.studentId || '');
      });
      
      // Update local storage
      localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(updated));

      // Fast direct push of specific updated records to Supabase & backend
      pushAttendanceRecords(stampedRecords);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('absensi-updated', { detail: { count: updated.length } }));
      }

      return true;
    } catch (err) {
      console.error('Error saving attendance for class date:', err);
      return false;
    }
  }

  // HELPER: Reset Database with default data
  resetDatabase() {
    localStorage.setItem(KEYS.SCHOOL, JSON.stringify(DEFAULT_SCHOOL));
    localStorage.setItem(KEYS.CLASSES, JSON.stringify(DEFAULT_CLASSES));
    localStorage.setItem(KEYS.TEACHERS, JSON.stringify(DEFAULT_TEACHERS));
    localStorage.setItem(KEYS.STUDENTS, JSON.stringify(DEFAULT_STUDENTS));
    localStorage.setItem(KEYS.HOLIDAYS, JSON.stringify(DEFAULT_HOLIDAYS));
    localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(generateSampleAttendances()));
  }

  // BACKUP DATABASE: returns JSON string
  getBackupJSON(): string {
    const data = {
      school: this.getSchool(),
      classes: this.getClasses(),
      teachers: this.getTeachers(),
      students: this.getStudents(),
      holidays: this.getHolidays(),
      attendance: this.getAttendance(),
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }

  // RESTORE DATABASE: parses JSON string and updates storage
  restoreBackupJSON(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      if (data.school && data.classes && data.teachers && data.students && data.holidays && data.attendance) {
        localStorage.setItem(KEYS.SCHOOL, JSON.stringify(data.school));
        localStorage.setItem(KEYS.CLASSES, JSON.stringify(data.classes));
        localStorage.setItem(KEYS.TEACHERS, JSON.stringify(data.teachers));
        localStorage.setItem(KEYS.STUDENTS, JSON.stringify(data.students));
        localStorage.setItem(KEYS.HOLIDAYS, JSON.stringify(data.holidays));
        localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(data.attendance));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

export const db = new LocalDB();

// DATE CONVERSION HELPERS
export function getDayNameID(dateStr: string): string {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const d = new Date(dateStr);
  return days[d.getDay()];
}

export function isSunday(dateStr: string): boolean {
  const d = new Date(dateStr);
  return d.getDay() === 0;
}

export function isHoliday(dateStr: string, holidays: Holiday[]): Holiday | undefined {
  return holidays.find((h) => h.date === dateStr);
}
