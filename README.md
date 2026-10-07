# 📚 Aplikasi Absensi Siswa Sekolah Dasar (SD)

Sistem Absensi Siswa SD berbasis Web modern dengan Hak Akses Admin dan Guru, Rekapitulasi Presensi Bulanan & Semester standar Kemendikbud, Ekspor/Impor Excel (.xlsx), Cetak Laporan PDF resmi, serta Sinkronisasi Multi-Browser & Multi-Device menggunakan **Supabase** dan **Vercel**.

---

## 🚀 Panduan Integrasi: GitHub, Vercel & Supabase

### 1. 🗄️ Menghubungkan & Menyiapkan Supabase (Database Cloud)

Aplikasi ini telah siap terhubung langsung dengan Supabase (`@supabase/supabase-js`) secara real-time. Agar seluruh browser dan perangkat dapat menyimpan dan membaca absensi yang sama:

1. Buka [Supabase Dashboard](https://supabase.com/dashboard) dan pilih project Anda.
2. Buka menu **SQL Editor** pada panel kiri.
3. Buka file `supabase_schema.sql` di repositori ini, salin seluruh isinya.
4. Tempel (*paste*) ke dalam **SQL Editor** Supabase, lalu klik tombol **RUN**.
5. Selesai! Seluruh tabel (`school`, `classes`, `teachers`, `students`, `holidays`, `attendance`) dan kebijakan akses (*RLS*) serta *Realtime* langsung aktif.

#### Variabel Lingkungan (*Environment Variables*) Supabase:
Di Supabase Dashboard -> **Project Settings** -> **API**:
- `VITE_SUPABASE_URL`: URL Project Supabase Anda (misal: `https://xxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`: Kunci anon/public API key Anda

---

### 2. ⚡ Deploy ke Vercel

Aplikasi ini sudah dilengkapi dengan konfigurasi `vercel.json` dan serverless functions di `api/`:

1. Hubungkan repositori GitHub Anda ke akun [Vercel](https://vercel.com).
2. Buat project baru dan pilih repositori ini.
3. Pada bagian **Environment Variables** di Vercel, tambahkan:
   - `VITE_SUPABASE_URL` = `https://rdsptjslgnjyzizmioru.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `(kunci anonim Supabase Anda)`
4. Klik **Deploy**.
5. Aplikasi akan langsung aktif di domain Vercel Anda dan tersinkronisasi antar-browser secara otomatis!

---

### 3. 💻 Menjalankan di Lokal / Pengembangan

```bash
# 1. Install dependensi
npm install

# 2. Jalankan server pengembangan (Port 3000)
npm run dev

# 3. Build untuk produksi
npm run build
```

---

## 🔑 Akun Demo Bawaan

| Peran | Username | Password | Keterangan |
| :--- | :--- | :--- | :--- |
| **Admin Sekolah** | `admin` | `admin123` | Akses penuh seluruh data & pengaturan |
| **Wali Kelas 1A** | `guru1a` | `password1a` | Guru Budi Santoso, S.Pd. (Kelas 1A) |
| **Wali Kelas 1B** | `guru1b` | `password1b` | Guru Siti Rahma, S.Pd. (Kelas 1B) |
| **Wali Kelas 2A** | `guru2a` | `password2a` | Guru Ahmad Hidayat, S.Pd. (Kelas 2A) |
