// Vercel Serverless Function entry point for /api/* routes
import type { IncomingMessage, ServerResponse } from 'http';

// Helper to normalize Supabase URL
function getCleanSupabaseUrl() {
  const raw = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  return raw.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

function getSupabaseKey() {
  return process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
}

// In-memory fallback cache for serverless environment
let serverlessCache: any = {
  school: {
    name: 'SD Negeri Gelora 01',
    address: 'Jl. Pemuda No. 45, Kel. Gelora, Kec. Tanah Abang, Kota Jakarta Pusat, DKI Jakarta',
    npsn: '20103456',
    adminName: 'Admin Gelora',
  },
  classes: [
    { id: 'class-1a', name: 'Kelas 1A', grade: '1', homeroomTeacherId: 'teacher-guru1a' },
    { id: 'class-1b', name: 'Kelas 1B', grade: '1', homeroomTeacherId: 'teacher-guru1b' },
    { id: 'class-2a', name: 'Kelas 2A', grade: '2', homeroomTeacherId: 'teacher-guru2a' },
    { id: 'class-2b', name: 'Kelas 2B', grade: '2', homeroomTeacherId: '' },
  ],
  teachers: [
    {
      id: 'admin-1',
      nip: '197901012005011001',
      name: 'Admin Gelora',
      gender: 'L',
      username: 'admin',
      passwordHash: 'YWRtaW4xMjM=',
      assignedClassId: '',
      role: 'admin',
    },
    {
      id: 'teacher-guru1a',
      nip: '198503122010121001',
      name: 'Budi Santoso, S.Pd.',
      gender: 'L',
      username: 'guru1a',
      passwordHash: 'cGFzc3dvcmQxYQ==',
      assignedClassId: 'class-1a',
      role: 'guru',
    },
    {
      id: 'teacher-guru1b',
      nip: '199008242015042002',
      name: 'Siti Rahma, S.Pd.',
      gender: 'P',
      username: 'guru1b',
      passwordHash: 'cGFzc3dvcmQxYg==',
      assignedClassId: 'class-1b',
      role: 'guru',
    },
    {
      id: 'teacher-guru2a',
      nip: '198811052012111003',
      name: 'Ahmad Hidayat, S.Pd.',
      gender: 'L',
      username: 'guru2a',
      passwordHash: 'cGFzc3dvcmQyYQ==',
      assignedClassId: 'class-2a',
      role: 'guru',
    },
  ],
  students: [
    { id: 'std-1a-1', nis: '1001', nisn: '0123456781', name: 'Aditya Pratama', gender: 'L', birthPlace: 'Jakarta', birthDate: '2019-01-10', classId: 'class-1a' },
    { id: 'std-1a-2', nis: '1002', nisn: '0123456782', name: 'Aisyah Putri', gender: 'P', birthPlace: 'Jakarta', birthDate: '2019-02-14', classId: 'class-1a' },
    { id: 'std-1a-3', nis: '1003', nisn: '0123456783', name: 'Bima Sakti', gender: 'L', birthPlace: 'Bekasi', birthDate: '2019-03-21', classId: 'class-1a' },
    { id: 'std-1a-4', nis: '1004', nisn: '0123456784', name: 'Citra Lestari', gender: 'P', birthPlace: 'Depok', birthDate: '2019-04-05', classId: 'class-1a' },
    { id: 'std-1a-5', nis: '1005', nisn: '0123456785', name: 'Dimas Anggara', gender: 'L', birthPlace: 'Tangerang', birthDate: '2019-05-18', classId: 'class-1a' },
    { id: 'std-1b-1', nis: '1006', nisn: '0123456786', name: 'Farhan Ramadhan', gender: 'L', birthPlace: 'Jakarta', birthDate: '2019-06-01', classId: 'class-1b' },
    { id: 'std-1b-2', nis: '1007', nisn: '0123456787', name: 'Gita Gutawa', gender: 'P', birthPlace: 'Jakarta', birthDate: '2019-07-11', classId: 'class-1b' },
    { id: 'std-1b-3', nis: '1008', nisn: '0123456788', name: 'Hafiz Al-Fatih', gender: 'L', birthPlace: 'Bogor', birthDate: '2019-08-20', classId: 'class-1b' },
    { id: 'std-2a-1', nis: '2001', nisn: '0112345671', name: 'Irfan Hakim', gender: 'L', birthPlace: 'Jakarta', birthDate: '2018-01-15', classId: 'class-2a' },
    { id: 'std-2a-2', nis: '2002', nisn: '0112345672', name: 'Jessica Mila', gender: 'P', birthPlace: 'Jakarta', birthDate: '2018-02-28', classId: 'class-2a' },
  ],
  holidays: [
    { id: 'hol-1', date: '2026-08-17', name: 'Hari Kemerdekaan RI' },
    { id: 'hol-2', date: '2026-10-01', name: 'Hari Kesaktian Pancasila' },
    { id: 'hol-3', date: '2026-10-28', name: 'Hari Sumpah Pemuda' },
    { id: 'hol-4', date: '2026-11-10', name: 'Hari Pahlawan' },
    { id: 'hol-5', date: '2026-12-25', name: 'Hari Raya Natal' },
  ],
  attendance: [],
  updatedAt: new Date().toISOString(),
};

async function readBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const url = req.url || '';

  if (url.includes('/api/health')) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({ status: 'ok', platform: 'vercel', time: new Date().toISOString() }));
  }

  if (url.includes('/api/db/version')) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({
      updatedAt: serverlessCache.updatedAt,
      attendanceCount: serverlessCache.attendance ? serverlessCache.attendance.length : 0,
    }));
  }

  if (url.includes('/api/attendance')) {
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (Array.isArray(body)) {
        serverlessCache.attendance = body;
        serverlessCache.updatedAt = new Date().toISOString();
        res.statusCode = 200;
        return res.end(JSON.stringify({ success: true, count: body.length }));
      }
      if (body && body.classId && body.date && Array.isArray(body.records)) {
        const { classId, date, records } = body;
        const others = serverlessCache.attendance.filter(
          (a: any) => !(a.classId === classId && a.date === date)
        );
        serverlessCache.attendance = [...others, ...records];
        serverlessCache.updatedAt = new Date().toISOString();
        res.statusCode = 200;
        return res.end(JSON.stringify({ success: true, count: records.length }));
      }
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Invalid payload' }));
    } else {
      res.statusCode = 200;
      return res.end(JSON.stringify(serverlessCache.attendance || []));
    }
  }

  if (url.includes('/api/db')) {
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (body.school) serverlessCache.school = body.school;
      if (Array.isArray(body.classes)) serverlessCache.classes = body.classes;
      if (Array.isArray(body.teachers)) serverlessCache.teachers = body.teachers;
      if (Array.isArray(body.students)) serverlessCache.students = body.students;
      if (Array.isArray(body.holidays)) serverlessCache.holidays = body.holidays;
      if (Array.isArray(body.attendance)) serverlessCache.attendance = body.attendance;
      serverlessCache.updatedAt = new Date().toISOString();
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, updatedAt: serverlessCache.updatedAt }));
    } else {
      res.statusCode = 200;
      return res.end(JSON.stringify(serverlessCache));
    }
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
}
