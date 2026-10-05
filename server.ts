import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '20mb' }));

// Ensure data directory exists
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial seed data
const encryptPassword = (pwd: string) => Buffer.from(pwd).toString('base64');

const DEFAULT_SCHOOL = {
  name: 'SD Negeri Gelora 01',
  address: 'Jl. Pemuda No. 45, Kel. Gelora, Kec. Tanah Abang, Kota Jakarta Pusat, DKI Jakarta',
  npsn: '20103456',
  adminName: 'Admin Gelora',
};

const DEFAULT_CLASSES = [
  { id: 'class-1a', name: 'Kelas 1A', grade: '1', homeroomTeacherId: 'teacher-guru1a' },
  { id: 'class-1b', name: 'Kelas 1B', grade: '1', homeroomTeacherId: 'teacher-guru1b' },
  { id: 'class-2a', name: 'Kelas 2A', grade: '2', homeroomTeacherId: 'teacher-guru2a' },
  { id: 'class-2b', name: 'Kelas 2B', grade: '2', homeroomTeacherId: '' },
];

const DEFAULT_TEACHERS = [
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

const DEFAULT_STUDENTS = [
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

const DEFAULT_HOLIDAYS = [
  { id: 'hol-1', date: '2026-06-01', name: 'Hari Lahir Pancasila', description: 'Libur Nasional memperingati lahirnya Pancasila' },
  { id: 'hol-2', date: '2026-06-17', name: 'Tahun Baru Islam 1448 H', description: 'Peringatan Hijriah baru 1 Muharram' },
  { id: 'hol-3', date: '2026-08-17', name: 'Hari Kemerdekaan RI', description: 'HUT Kemerdekaan Republik Indonesia' },
  { id: 'hol-4', date: '2026-05-01', name: 'Hari Buruh Internasional', description: 'Libur Hari Buruh sedunia' },
];

const generateInitialAttendance = () => {
  const result: any[] = [];
  const activeDays = [
    '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06',
    '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13',
    '2026-06-15', '2026-06-16', '2026-06-18', '2026-06-19', '2026-06-20'
  ];

  for (const date of activeDays) {
    for (let i = 1; i <= 10; i++) {
      const studentId = `std-1a-${i}`;
      let status: 'H' | 'S' | 'I' | 'A' = 'H';
      const rand = Math.random();
      if (rand < 0.05) status = 'S';
      else if (rand < 0.08) status = 'I';
      else if (rand < 0.11) status = 'A';

      result.push({
        id: `class-1a-${studentId}-${date}`,
        classId: 'class-1a',
        studentId,
        date,
        status,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  for (const date of activeDays.slice(-5)) {
    for (let i = 1; i <= 5; i++) {
      const studentId = `std-1b-${i}`;
      let status: 'H' | 'S' | 'I' | 'A' = 'H';
      const rand = Math.random();
      if (rand < 0.06) status = 'S';
      else if (rand < 0.09) status = 'I';
      else if (rand < 0.12) status = 'A';

      result.push({
        id: `class-1b-${studentId}-${date}`,
        classId: 'class-1b',
        studentId,
        date,
        status,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return result;
};

// Database in-memory cache
let databaseCache = {
  school: DEFAULT_SCHOOL,
  classes: DEFAULT_CLASSES,
  teachers: DEFAULT_TEACHERS,
  students: DEFAULT_STUDENTS,
  holidays: DEFAULT_HOLIDAYS,
  attendance: generateInitialAttendance(),
  updatedAt: new Date().toISOString(),
};

// Load from file if exists
try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      databaseCache = {
        school: parsed.school || DEFAULT_SCHOOL,
        classes: parsed.classes || DEFAULT_CLASSES,
        teachers: parsed.teachers || DEFAULT_TEACHERS,
        students: parsed.students || DEFAULT_STUDENTS,
        holidays: parsed.holidays || DEFAULT_HOLIDAYS,
        attendance: parsed.attendance || generateInitialAttendance(),
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  } else {
    fs.writeFileSync(DB_FILE, JSON.stringify(databaseCache, null, 2), 'utf-8');
  }
} catch (e) {
  console.error('Error initializing database file:', e);
}

function persistDb() {
  try {
    databaseCache.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(databaseCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write database file:', err);
  }
}

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Full database GET
app.get('/api/db', (req, res) => {
  res.json(databaseCache);
});

// Partial or full update
app.post('/api/db', (req, res) => {
  try {
    const { school, classes, teachers, students, holidays, attendance } = req.body;
    if (school) databaseCache.school = school;
    if (Array.isArray(classes)) databaseCache.classes = classes;
    if (Array.isArray(teachers)) databaseCache.teachers = teachers;
    if (Array.isArray(students)) databaseCache.students = students;
    if (Array.isArray(holidays)) databaseCache.holidays = holidays;
    if (Array.isArray(attendance)) databaseCache.attendance = attendance;

    persistDb();
    res.json({ success: true, updatedAt: databaseCache.updatedAt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance dedicated endpoints for rapid saving
app.get('/api/attendance', (req, res) => {
  const { classId, date } = req.query;
  let result = databaseCache.attendance;
  if (classId) {
    result = result.filter((a) => a.classId === classId);
  }
  if (date) {
    result = result.filter((a) => a.date === date);
  }
  res.json(result);
});

app.post('/api/attendance', (req, res) => {
  try {
    const body = req.body;
    // Can be an array of all attendances or new records
    if (Array.isArray(body)) {
      databaseCache.attendance = body;
      persistDb();
      return res.json({ success: true, count: body.length });
    }

    // Or { classId, date, records }
    if (body && body.classId && body.date && Array.isArray(body.records)) {
      const { classId, date, records } = body;
      // Remove previous records for this class & date
      const others = databaseCache.attendance.filter(
        (a) => !(a.classId === classId && a.date === date)
      );
      databaseCache.attendance = [...others, ...records];
      persistDb();
      return res.json({ success: true, count: records.length });
    }

    res.status(400).json({ error: 'Invalid attendance payload' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset database endpoint
app.post('/api/db/reset', (req, res) => {
  databaseCache = {
    school: DEFAULT_SCHOOL,
    classes: DEFAULT_CLASSES,
    teachers: DEFAULT_TEACHERS,
    students: DEFAULT_STUDENTS,
    holidays: DEFAULT_HOLIDAYS,
    attendance: generateInitialAttendance(),
    updatedAt: new Date().toISOString(),
  };
  persistDb();
  res.json({ success: true, message: 'Database reset to default' });
});

// Setup Vite or static serving
async function startServer() {
  const distPath = path.resolve(__dirname, 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (hasDist) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SD Absensi Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
