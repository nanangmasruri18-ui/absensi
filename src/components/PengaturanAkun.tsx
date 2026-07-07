import React, { useState } from 'react';
import { db, encryptPassword, decryptPassword } from '../utils/db';
import { UserSession, SchoolProfile, Teacher, Gender } from '../types';
import { 
  Settings, 
  Building, 
  User, 
  Lock, 
  CheckCircle2, 
  X, 
  AlertCircle, 
  Eye, 
  EyeOff 
} from 'lucide-react';

interface PengaturanAkunProps {
  session: UserSession;
  onProfileUpdated: (newName: string) => void;
}

export default function PengaturanAkun({ session, onProfileUpdated }: PengaturanAkunProps) {
  const isAdmin = session.role === 'admin';
  const holidays = db.getHolidays();
  
  // Loaded profiles
  const [school, setSchool] = useState<SchoolProfile>(db.getSchool());
  const [teachers, setTeachers] = useState<Teacher[]>(db.getTeachers());
  
  // Find current teacher object
  const currentTeacher = teachers.find((t) => t.id === session.userId);

  // States: profile fields
  const [schoolName, setSchoolName] = useState(school.name);
  const [schoolAddress, setSchoolAddress] = useState(school.address);
  const [schoolNpsn, setSchoolNpsn] = useState(school.npsn);
  const [adminName, setAdminName] = useState(school.adminName);

  // States: teacher profiles
  const [teacherName, setTeacherName] = useState(currentTeacher?.name || '');
  const [teacherNip, setTeacherNip] = useState(currentTeacher?.nip || '');
  const [teacherGender, setTeacherGender] = useState<Gender>(currentTeacher?.gender || 'L');

  // Change password forms states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Messages
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [passError, setPassError] = useState('');

  // SBMTS
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (isAdmin) {
      if (!schoolName.trim() || !schoolAddress.trim() || !schoolNpsn.trim() || !adminName.trim()) {
        setProfileError('Harap isi semua kolom identitas utama sekolah.');
        return;
      }

      const updatedSchool: SchoolProfile = {
        name: schoolName.trim(),
        address: schoolAddress.trim(),
        npsn: schoolNpsn.trim(),
        adminName: adminName.trim(),
      };

      // Save school profile
      db.saveSchool(updatedSchool);
      setSchool(updatedSchool);

      // Also update the 'admin' teacher's name dynamically in the teacher table
      const updatedTeachersList = teachers.map((t) =>
        t.role === 'admin' ? { ...t, name: adminName.trim() } : t
      );
      db.saveTeachers(updatedTeachersList);
      setTeachers(updatedTeachersList);

      onProfileUpdated(adminName.trim());
      setProfileSuccess('Profil sekolah dasar dan nama admin berhasil diperbarui.');
    } else {
      // Guru Profile edits
      if (!teacherName.trim() || !teacherNip.trim()) {
        setProfileError('Nama dan NIP guru pelapor wajib diisi.');
        return;
      }

      if (!/^\d+$/.test(teacherNip.trim())) {
        setProfileError('NIP pegawai wajib diwakili angka saja.');
        return;
      }

      const updatedTeachersList = teachers.map((t) =>
        t.id === session.userId
          ? { ...t, name: teacherName.trim(), nip: teacherNip.trim(), gender: teacherGender }
          : t
      );

      db.saveTeachers(updatedTeachersList);
      setTeachers(updatedTeachersList);

      onProfileUpdated(teacherName.trim());
      setProfileSuccess('Biodata pribadi guru berhasil diperbarui.');
    }

    setTimeout(() => setProfileSuccess(''), 4000);
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPassError('Semua kolom isian sandi wajib dilengkapi.');
      return;
    }

    if (!currentTeacher) {
      setPassError('Gagal memverifikasi session akun pendidik.');
      return;
    }

    // Check old password matches
    const decryptedOld = decryptPassword(currentTeacher.passwordHash);
    if (oldPassword !== decryptedOld) {
      setPassError('Kata sandi lama yang Anda masukkan tidak sesuai.');
      return;
    }

    if (newPassword.length < 5) {
      setPassError('Kata sandi baru minimal terdiri dari 5 karakter demi keamanan.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError('Konfirmasi kata sandi baru tidak pas.');
      return;
    }

    // Encrypt and save back
    const encryptedNew = encryptPassword(newPassword);
    const updatedTeachersList = teachers.map((t) =>
      t.id === session.userId ? { ...t, passwordHash: encryptedNew } : t
    );

    db.saveTeachers(updatedTeachersList);
    setTeachers(updatedTeachersList);

    setPassSuccess('Kata sandi akun Anda berhasil diubah! Kredensial baru siap digunakan.');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');

    setTimeout(() => setPassSuccess(''), 4000);
  };

  return (
    <div className="space-y-6 font-sans animate-fade-in text-slate-700 leading-normal">
      <div className="bg-slate-50 p-4 border border-slate-200/50 rounded-2xl flex items-center gap-3">
        <Settings size={20} className="text-slate-600" />
        <div>
          <h3 className="text-sm font-bold text-slate-800">Manajemen Pengaturan Akun</h3>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Identifikasi Pengguna: {session.role.toUpperCase()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Profile Card Form */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Building className="text-blue-500" size={16} />
            {isAdmin ? 'Ubah Informasi Profil Sekolah' : 'Ubah Identitas Biodata Guru'}
          </h3>

          <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
            {isAdmin ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600">Nama Sekolah</label>
                  <input
                    type="text"
                    required
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600">NPSN Sekolah</label>
                    <input
                      type="text"
                      required
                      value={schoolNpsn}
                      onChange={(e) => setSchoolNpsn(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600">Nama Admin</label>
                    <input
                      type="text"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600">Alamat Lengkap Sekolah</label>
                  <textarea
                    required
                    rows={3}
                    value={schoolAddress}
                    onChange={(e) => setSchoolAddress(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none leading-relaxed"
                  />
                </div>
              </>
            ) : (
              // Regular teacher biodatas
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600">Nama Lengkap Wali Kelas</label>
                  <input
                    type="text"
                    required
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600">Nomor Induk Pegawai (NIP)</label>
                  <input
                    type="text"
                    required
                    value={teacherNip}
                    onChange={(e) => setTeacherNip(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600">Jenis Kelamin</label>
                  <div className="mt-2 flex gap-4">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <input
                        type="radio"
                        name="set-gender-prof"
                        value="L"
                        checked={teacherGender === 'L'}
                        onChange={() => setTeacherGender('L')}
                        className="text-blue-500 focus:ring-blue-550"
                      />
                      Laki-Laki
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <input
                        type="radio"
                        name="set-gender-prof"
                        value="P"
                        checked={teacherGender === 'P'}
                        onChange={() => setTeacherGender('P')}
                        className="text-blue-500 focus:ring-blue-550"
                      />
                      Perempuan
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Error / Success logs */}
            {profileSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 font-bold text-xs flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                {profileSuccess}
              </div>
            )}

            {profileError && (
              <div className="p-3 bg-red-50 border border-red-250 rounded-xl text-red-700 font-bold text-xs flex items-center gap-1.5">
                <AlertCircle size={14} className="text-red-600 shrink-0" />
                {profileError}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                id="profile-save-btn"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>

        {/* Change password credentials card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Lock className="text-indigo-500" size={16} />
            Ubah Kata Sandi Kredensial
          </h3>

          <form onSubmit={handleUpdatePassword} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600">Kata Sandi Saat Ini (Lama)</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  type={showOldPass ? 'text' : 'password'}
                  required
                  placeholder="Ketik password lama"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="block w-full px-3 pr-9 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPass(!showOldPass)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showOldPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600">Kata Sandi Baru</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  placeholder="Sandi baru minimal 5 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="block w-full px-3 pr-9 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600">Konfirmasi Kata Sandi Baru</label>
              <input
                type="password"
                required
                placeholder="Ulang kata sandi baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {passSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 font-bold text-xs flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                {passSuccess}
              </div>
            )}

            {passError && (
              <div className="p-3 bg-red-50 border border-red-250 rounded-xl text-red-700 font-bold text-xs flex items-center gap-1.5">
                <AlertCircle size={14} className="text-red-600 shrink-0" />
                {passError}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                id="password-modify-btn"
              >
                Ganti Kata Sandi
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
