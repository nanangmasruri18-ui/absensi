import React, { useState } from 'react';
import { db, encryptPassword, decryptPassword } from '../utils/db';
import { Teacher, ClassRombel, Gender } from '../types';
import { Plus, Edit, Trash2, UsersRound, X, AlertCircle, Eye, EyeOff, Search } from 'lucide-react';

export default function DataGuru() {
  const [teachers, setTeachers] = useState<Teacher[]>(db.getTeachers());
  const [classes, setClasses] = useState<ClassRombel[]>(db.getClasses());
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [isOpen, setIsOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState('');

  const [nip, setNip] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('L');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [assignedClassId, setAssignedClassId] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Delete state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Triggers
  const openAddModal = () => {
    setIsEdit(false);
    setNip('');
    setName('');
    setGender('L');
    setUsername('');
    setPassword('');
    setAssignedClassId('');
    setError('');
    setShowPassword(false);
    setIsOpen(true);
  };

  const openEditModal = (t: Teacher) => {
    setIsEdit(true);
    setEditId(t.id);
    setNip(t.nip);
    setName(t.name);
    setGender(t.gender);
    setUsername(t.username);
    setPassword(decryptPassword(t.passwordHash)); // decrypt for editing ease
    setAssignedClassId(t.assignedClassId);
    setError('');
    setShowPassword(false);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  // Submit CRUD
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Field checks
    if (!nip.trim() || !name.trim() || !username.trim() || !password.trim()) {
      setError('Semua kolom formulir wajib diisi.');
      return;
    }

    if (!/^\d+$/.test(nip.trim())) {
      setError('NIP pegawai harus berupa rangkaian angka saja.');
      return;
    }

    // Duplicate checks for NIP and Username
    const dupNip = teachers.find(
      (t) => t.nip.trim() === nip.trim() && (!isEdit || t.id !== editId)
    );
    if (dupNip) {
      setError(`NIP "${nip}" sudah terdaftar pada guru lain (${dupNip.name}).`);
      return;
    }

    const dupUser = teachers.find(
      (t) => t.username.trim().toLowerCase() === username.trim().toLowerCase() && (!isEdit || t.id !== editId)
    );
    if (dupUser) {
      setError(`Username "${username}" sudah digunakan.`);
      return;
    }

    let updatedTeachersList: Teacher[] = [];
    const allClasses = db.getClasses();

    if (isEdit) {
      // Edit Teacher
      const originalTeacher = teachers.find(t => t.id === editId);
      const originalClassId = originalTeacher?.assignedClassId;

      const newHash = encryptPassword(password);
      updatedTeachersList = teachers.map((t) =>
        t.id === editId
          ? { ...t, nip: nip.trim(), name: name.trim(), gender, username: username.trim(), passwordHash: newHash, assignedClassId, role: t.role }
          : t
      );

      // Manage relational assigned class homeroomTeacherId reference
      const updatedClasses = allClasses.map((c) => {
        // Remove homeroom flag from previous class
        if (originalClassId && c.id === originalClassId) {
          return { ...c, homeroomTeacherId: '' };
        }
        // Force homeroom flag to newly assigned class
        if (assignedClassId && c.id === assignedClassId) {
          return { ...c, homeroomTeacherId: editId };
        }
        return c;
      });
      db.saveClasses(updatedClasses);

    } else {
      // Create Teacher ID
      const newId = `teacher-${Date.now()}`;
      const newTeacher: Teacher = {
        id: newId,
        nip: nip.trim(),
        name: name.trim(),
        gender,
        username: username.trim(),
        passwordHash: encryptPassword(password),
        assignedClassId,
        role: 'guru', // registered via Admin dashboard is always regular guru
      };

      updatedTeachersList = [...teachers, newTeacher];

      // Update class homeroom reference if assigned
      if (assignedClassId) {
        const updatedClasses = allClasses.map((c) =>
          c.id === assignedClassId ? { ...c, homeroomTeacherId: newId } : c
        );
        db.saveClasses(updatedClasses);
      }
    }

    db.saveTeachers(updatedTeachersList);
    setTeachers(updatedTeachersList);
    setClasses(db.getClasses()); // refresh classes list
    setIsOpen(false);
  };

  const handleDelete = (id: string) => {
    // Cannot delete administrative admins
    const target = teachers.find((t) => t.id === id);
    if (target?.role === 'admin') {
      return;
    }
    setDeleteTargetId(id);
  };

  const executeDelete = () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;

    // Clear class referential pointers
    const allClasses = db.getClasses();
    const updatedClasses = allClasses.map((c) =>
      c.homeroomTeacherId === id ? { ...c, homeroomTeacherId: '' } : c
    );
    db.saveClasses(updatedClasses);

    const updatedTeachersList = teachers.filter((t) => t.id !== id);
    db.saveTeachers(updatedTeachersList);
    setTeachers(updatedTeachersList);
    setClasses(db.getClasses()); // refresh classes

    setDeleteTargetId(null);
  };

  const getClassNameFromId = (cId: string) => {
    const found = classes.find((c) => c.id === cId);
    return found ? found.name : 'Tidak Mengampu';
  };

  // Filter listings
  const filteredTeachers = teachers.filter((t) => {
    const term = searchTerm.toLowerCase();
    return (
      t.name.toLowerCase().includes(term) ||
      t.nip.toLowerCase().includes(term) ||
      t.username.toLowerCase().includes(term) ||
      getClassNameFromId(t.assignedClassId).toLowerCase().includes(term)
    );
  });

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm font-sans animate-fade-in leading-normal">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5 gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800">Manajemen Data Pendidik / Guru</h2>
          <p className="text-xs text-slate-500 font-medium">Urus kredensial akun dan kelas wali pengampu guru</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
          id="guru-add-btn"
        >
          <Plus size={16} />
          Registrasi Guru Baru
        </button>
      </div>

      <div className="my-5 relative max-w-sm">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search size={16} />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari guru berdasarkan nama, NIP, kelas..."
          className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
        />
      </div>

      <div className="border border-slate-100 rounded-xl overflow-hidden mt-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">NIP</th>
                <th className="py-3 px-4">Nama Lengkap Guru</th>
                <th className="py-3 px-4 w-20 text-center">L/P</th>
                <th className="py-3 px-4">Username Akun</th>
                <th className="py-3 px-4">Mengajar Rombel</th>
                <th className="py-3 px-4 w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredTeachers.map((t, index) => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition duration-100">
                  <td className="py-3.5 px-4 text-center font-semibold text-slate-500">{index + 1}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-800">{t.nip}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {t.name}
                    {t.role === 'admin' && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200 uppercase">
                        Super Admin
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-slate-600">{t.gender}</td>
                  <td className="py-3.5 px-4 font-medium text-slate-600">{t.username}</td>
                  <td className="py-3.5 px-4">
                    {t.role === 'admin' ? (
                      <span className="text-slate-400 font-medium">Bebas Tugas (Semua Kelas)</span>
                    ) : (
                      <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                        t.assignedClassId ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {getClassNameFromId(t.assignedClassId)}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEditModal(t)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit"
                        id={`guru-edit-btn-${t.id}`}
                      >
                        <Edit size={14} />
                      </button>
                      {t.role !== 'admin' && (
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Hapus"
                          id={`guru-delete-btn-${t.id}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <UsersRound className="text-blue-500" size={18} />
                {isEdit ? 'Ubah Informasi Guru' : 'Registrasikan Akun Guru Baru'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
                id="guru-modal-close-btn"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nomor Induk Pegawai (NIP)</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 198211052008011003"
                  value={nip}
                  onChange={(e) => setNip(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Nama Lengkap Beserta Gelar</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Siti Amalia, S.Pd."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Jenis Kelamin</label>
                <div className="mt-2 flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                    <input
                      type="radio"
                      name="gender"
                      value="L"
                      checked={gender === 'L'}
                      onChange={() => setGender('L')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    Laki-Laki (L)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                    <input
                      type="radio"
                      name="gender"
                      value="P"
                      checked={gender === 'P'}
                      onChange={() => setGender('P')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    Perempuan (P)
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Username Akun</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: sitiamalia"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Password Akun</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Masukkan password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full px-3 pr-9 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Wali Rombel Kelas yang Diampu</label>
                <select
                  value={assignedClassId}
                  onChange={(e) => setAssignedClassId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  <option value="">-- Tidak Mengampu Kelas --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.homeroomTeacherId && c.homeroomTeacherId !== editId ? '(Sudah Ada Wali)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="p-2.5 bg-red-50 text-[11px] text-red-600 rounded-lg border border-red-100 flex items-center gap-1.5 font-semibold">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3.5 py-2 border border-slate-200 rounded-lg text-slate-600 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                  id="guru-modal-cancel-btn"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                  id="guru-modal-submit-btn"
                >
                  {isEdit ? 'Simpan Akun' : 'Daftarkan Guru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Delete Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 animate-slide-up">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                <AlertCircle size={20} className="text-red-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Konfirmasi Hapus Guru</h3>
            </div>
            
            <p className="mt-4 text-xs text-slate-600 leading-relaxed font-semibold">
              Apakah Anda yakin ingin menghapus guru <span className="text-slate-900 font-bold">"{teachers.find(t => t.id === deleteTargetId)?.name}"</span>?
            </p>
            <p className="mt-1 text-[11px] text-red-500 font-medium font-semibold">
              Akses login untuk guru ini akan segera dicabut, dan penugasan Wali Rombel di kelas terkait akan otomatis dilepaskan.
            </p>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="px-3.5 py-2 border border-slate-200 rounded-lg text-slate-600 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                id="delete-guru-cancel-btn"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                id="delete-guru-confirm-btn"
              >
                Hapus Akun
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
