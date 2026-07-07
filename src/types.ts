export type Gender = 'L' | 'P';

export type AttendanceStatus = 'H' | 'S' | 'I' | 'A'; // H: Hadir, S: Sakit, I: Izin, A: Alfa

export interface SchoolProfile {
  name: string;
  address: string;
  npsn: string;
  adminName: string;
}

export interface ClassRombel {
  id: string; // unique ID
  name: string; // e.g. Kelas 1A
  grade: string; // e.g. "1" or "Kelas 1"
  homeroomTeacherId: string; // ID of the Wali Kelas
}

export interface Teacher {
  id: string;
  nip: string;
  name: string;
  gender: Gender;
  username: string;
  passwordHash: string; // simple encrypted/hashed format for security
  assignedClassId: string; // Class ID they teach (one teacher teaches one class in SD)
  role: 'admin' | 'guru';
}

export interface Student {
  id: string;
  nis: string; // Nomor Induk Siswa
  nisn: string; // Nomor Induk Siswa Nasional
  name: string;
  gender: Gender; // L or P
  birthPlace: string;
  birthDate: string; // YYYY-MM-DD
  classId: string; // Class ID
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  description?: string;
}

export interface Attendance {
  id: string; // composite or simple ID: classId-studentId-date
  classId: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  updatedAt: string;
}

export interface UserSession {
  userId: string;
  username: string;
  name: string;
  role: 'admin' | 'guru';
  assignedClassId?: string;
}
