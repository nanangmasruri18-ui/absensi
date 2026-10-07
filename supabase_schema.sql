-- ====================================================================
-- SKRIP SETUP DATABASE SUPABASE UNTUK APLIKASI ABSENSI SISWA SD
-- ====================================================================
-- Cara Penggunaan:
-- 1. Buka dashboard Supabase Anda: https://supabase.com/dashboard
-- 2. Pilih project Anda
-- 3. Buka menu "SQL Editor" di panel kiri
-- 4. Tempel (paste) seluruh isi file ini, lalu klik tombol "RUN"
-- ====================================================================

-- 1. Tabel Profil Sekolah
create table if not exists public.school (
  id text primary key default 'school-1',
  name text not null default 'SD Negeri Gelora 01',
  address text default 'Jl. Pemuda No. 45, Kel. Gelora, Kec. Tanah Abang, Kota Jakarta Pusat, DKI Jakarta',
  npsn text default '20103456',
  admin_name text default 'Admin Gelora',
  updated_at timestamptz default now()
);

-- 2. Tabel Rombongan Belajar (Rombel / Kelas)
create table if not exists public.classes (
  id text primary key,
  name text not null,
  grade text not null,
  homeroom_teacher_id text default '',
  updated_at timestamptz default now()
);

-- 3. Tabel Guru & Admin
create table if not exists public.teachers (
  id text primary key,
  nip text default '',
  name text not null,
  gender text default 'L',
  username text unique not null,
  password_hash text not null,
  assigned_class_id text default '',
  role text default 'guru',
  updated_at timestamptz default now()
);

-- 4. Tabel Siswa
create table if not exists public.students (
  id text primary key,
  nis text default '',
  nisn text default '',
  name text not null,
  gender text default 'L',
  birth_place text default '',
  birth_date text default '',
  class_id text not null,
  updated_at timestamptz default now()
);

-- 5. Tabel Hari Libur Kalender Pendidikan
create table if not exists public.holidays (
  id text primary key,
  date text not null,
  name text not null,
  updated_at timestamptz default now()
);

-- 6. Tabel Presensi / Absensi Harian Siswa
create table if not exists public.attendance (
  id text primary key,
  class_id text not null,
  student_id text not null,
  date text not null,
  status text not null check (status in ('H', 'S', 'I', 'A')),
  notes text default '',
  updated_at timestamptz default now()
);

-- Indexing untuk pencarian cepat data presensi dan rekapitulasi bulanan
create index if not exists idx_attendance_class_date on public.attendance (class_id, date);
create index if not exists idx_attendance_date on public.attendance (date);
create index if not exists idx_students_class on public.students (class_id);

-- Aktifkan Row Level Security (RLS)
alter table public.school enable row level security;
alter table public.classes enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.holidays enable row level security;
alter table public.attendance enable row level security;

-- Kebijakan Akses Publik (Anonim & Autentikasi) untuk aplikasi sekolah
drop policy if exists "Akses penuh anonim school" on public.school;
create policy "Akses penuh anonim school" on public.school for all using (true) with check (true);

drop policy if exists "Akses penuh anonim classes" on public.classes;
create policy "Akses penuh anonim classes" on public.classes for all using (true) with check (true);

drop policy if exists "Akses penuh anonim teachers" on public.teachers;
create policy "Akses penuh anonim teachers" on public.teachers for all using (true) with check (true);

drop policy if exists "Akses penuh anonim students" on public.students;
create policy "Akses penuh anonim students" on public.students for all using (true) with check (true);

drop policy if exists "Akses penuh anonim holidays" on public.holidays;
create policy "Akses penuh anonim holidays" on public.holidays for all using (true) with check (true);

drop policy if exists "Akses penuh anonim attendance" on public.attendance;
create policy "Akses penuh anonim attendance" on public.attendance for all using (true) with check (true);

-- Aktifkan Supabase Realtime agar perubahan absensi dari browser lain langsung masuk otomatis
do $$
begin
  begin
    alter publication supabase_realtime add table public.attendance;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.students;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.classes;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.teachers;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.holidays;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.school;
  exception when others then null;
  end;
end $$;

-- Data Awal (Seed Data)
insert into public.school (id, name, address, npsn, admin_name)
values (
  'school-1',
  'SD Negeri Gelora 01',
  'Jl. Pemuda No. 45, Kel. Gelora, Kec. Tanah Abang, Kota Jakarta Pusat, DKI Jakarta',
  '20103456',
  'Admin Gelora'
)
on conflict (id) do nothing;

insert into public.classes (id, name, grade, homeroom_teacher_id)
values 
  ('class-1a', 'Kelas 1A', '1', 'teacher-guru1a'),
  ('class-1b', 'Kelas 1B', '1', 'teacher-guru1b'),
  ('class-2a', 'Kelas 2A', '2', 'teacher-guru2a'),
  ('class-2b', 'Kelas 2B', '2', '')
on conflict (id) do nothing;

insert into public.teachers (id, nip, name, gender, username, password_hash, assigned_class_id, role)
values
  ('admin-1', '197901012005011001', 'Admin Gelora', 'L', 'admin', 'YWRtaW4xMjM=', '', 'admin'),
  ('teacher-guru1a', '198503122010121001', 'Budi Santoso, S.Pd.', 'L', 'guru1a', 'cGFzc3dvcmQxYQ==', 'class-1a', 'guru'),
  ('teacher-guru1b', '199008242015042002', 'Siti Rahma, S.Pd.', 'P', 'guru1b', 'cGFzc3dvcmQxYg==', 'class-1b', 'guru'),
  ('teacher-guru2a', '198811052012111003', 'Ahmad Hidayat, S.Pd.', 'L', 'guru2a', 'cGFzc3dvcmQyYQ==', 'class-2a', 'guru')
on conflict (id) do nothing;

insert into public.students (id, nis, nisn, name, gender, birth_place, birth_date, class_id)
values
  ('std-1a-1', '1001', '0123456781', 'Aditya Pratama', 'L', 'Jakarta', '2019-01-10', 'class-1a'),
  ('std-1a-2', '1002', '0123456782', 'Aisyah Putri', 'P', 'Jakarta', '2019-02-14', 'class-1a'),
  ('std-1a-3', '1003', '0123456783', 'Bima Sakti', 'L', 'Bekasi', '2019-03-21', 'class-1a'),
  ('std-1a-4', '1004', '0123456784', 'Citra Lestari', 'P', 'Depok', '2019-04-05', 'class-1a'),
  ('std-1a-5', '1005', '0123456785', 'Dimas Anggara', 'L', 'Tangerang', '2019-05-18', 'class-1a'),
  ('std-1b-1', '1006', '0123456786', 'Farhan Ramadhan', 'L', 'Jakarta', '2019-06-01', 'class-1b'),
  ('std-1b-2', '1007', '0123456787', 'Gita Gutawa', 'P', 'Jakarta', '2019-07-11', 'class-1b'),
  ('std-1b-3', '1008', '0123456788', 'Hafiz Al-Fatih', 'L', 'Bogor', '2019-08-20', 'class-1b'),
  ('std-2a-1', '2001', '0112345671', 'Irfan Hakim', 'L', 'Jakarta', '2018-01-15', 'class-2a'),
  ('std-2a-2', '2002', '0112345672', 'Jessica Mila', 'P', 'Jakarta', '2018-02-28', 'class-2a')
on conflict (id) do nothing;

insert into public.holidays (id, date, name)
values
  ('hol-1', '2026-08-17', 'Hari Kemerdekaan RI'),
  ('hol-2', '2026-10-01', 'Hari Kesaktian Pancasila'),
  ('hol-3', '2026-10-28', 'Hari Sumpah Pemuda'),
  ('hol-4', '2026-11-10', 'Hari Pahlawan'),
  ('hol-5', '2026-12-25', 'Hari Raya Natal')
on conflict (id) do nothing;
