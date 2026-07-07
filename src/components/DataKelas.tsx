import React, { useState } from 'react';
import { db } from '../utils/db';
import { ClassRombel, Teacher } from '../types';
import { Plus, Edit, Trash2, GraduationCap, X, AlertCircle, Search } from 'lucide-react';

export default function DataKelas() {
  const [classes, setClasses] = useState<ClassRombel[]>(db.getClasses());
  const [teachers, setTeachers] = useState<Teacher[]>(db.getTeachers().filter((t) => t.role === 'guru'));
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [isOpen, setIsOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState('');
  
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('1');
  const [homeroomTeacherId, setHomeroomTeacherId] = useState('');
  const [error, setError] = useState('');

  // Delete states
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Form triggers
  const openAddModal = () => {
    setIsEdit(false);
    setName('');
    setGrade('1');
    setHomeroomTeacherId('');
    setError('');
    setIsOpen(true);
  };

  const openEditModal = (c: ClassRombel) => {
    setIsEdit(true);
    setEditId(c.id);
    setName(c.name);
    setGrade(c.grade);
    setHomeroomTeacherId(c.homeroomTeacherId);
    setError('');
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  // CRUD actions
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Nama Kelas harus diisi.');
      return;
    }

    // Check duplicate name
    const existing = classes.find(
      (c) => c.name.toLowerCase() === name.trim().toLowerCase() && (!isEdit || c.id !== editId)
    );
    if (existing) {
      setError(`Kelas dengan nama "${name}" sudah ada.`);
      return;
    }

    let updatedClassesList: ClassRombel[] = [];
    const allTeachers = db.getTeachers();

    if (isEdit) {
      // Edit class
      const originalClass = classes.find(c => c.id === editId);
      const originalTeacherId = originalClass?.homeroomTeacherId;

      updatedClassesList = classes.map((c) =>
        c.id === editId ? { ...c, name: name.trim(), grade, homeroomTeacherId } : c
      );

      // Manage teacher assignedClassId
      const updatedTeachers = allTeachers.map((t) => {
        // Remove class from original teacher
        if (originalTeacherId && t.id === originalTeacherId) {
          return { ...t, assignedClassId: '' };
        }
        // Add class to newly selected teacher
        if (homeroomTeacherId && t.id === homeroomTeacherId) {
          return { ...t, assignedClassId: editId };
        }
        return t;
      });
      db.saveTeachers(updatedTeachers);
    } else {
      // Add class
      const newId = `class-${Date.now()}`;
      const newClass: ClassRombel = {
        id: newId,
        name: name.trim(),
        grade,
        homeroomTeacherId,
      };
      
      updatedClassesList = [...classes, newClass];

      // Update teacher if assigned
      if (homeroomTeacherId) {
        const updatedTeachers = allTeachers.map((t) =>
          t.id === homeroomTeacherId ? { ...t, assignedClassId: newId } : t
        );
        db.saveTeachers(updatedTeachers);
      }
    }

    db.saveClasses(updatedClassesList);
    setClasses(updatedClassesList);
    setTeachers(db.getTeachers().filter((t) => t.role === 'guru')); // refresh list
    setIsOpen(false);
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const executeDelete = () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;

    // Remove class assignment from teachers first
    const allTeachers = db.getTeachers();
    const updatedTeachers = allTeachers.map((t) =>
      t.assignedClassId === id ? { ...t, assignedClassId: '' } : t
    );
    db.saveTeachers(updatedTeachers);

    // Remove class assignment from students as well to avoid inconsistency
    const allStudents = db.getStudents();
    const updatedStudents = allStudents.map((s) =>
      s.classId === id ? { ...s, classId: '' } : s
    );
    db.saveStudents(updatedStudents);

    // Now filter out classes
    const updatedClassesList = classes.filter((c) => c.id !== id);
    db.saveClasses(updatedClassesList);
    setClasses(updatedClassesList);
    setTeachers(db.getTeachers().filter((t) => t.role === 'guru')); // refresh teachers

    setDeleteTargetId(null);
  };

  // Helper to map teacher name
  const getTeacherName = (tId: string) => {
    const found = teachers.find((t) => t.id === tId);
    return found ? found.name : 'Belum Ditentukan';
  };

  // Filter lists based on search
  const filteredClasses = classes.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.grade.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getTeacherName(c.homeroomTeacherId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm font-sans leading-normal animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5 gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800">Manajemen Data Rombel / Kelas</h2>
          <p className="text-xs text-slate-500 font-medium">Urus nama rombongan belajar tingkat Sekolah Dasar</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
          id="rombel-add-btn"
        >
          <Plus size={16} />
          Tambah Kelas Baru
        </button>
      </div>

      {/* Roster search bar */}
      <div className="my-5 relative max-w-sm">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search size={16} />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari kelas, tingkat, atau wali kelas..."
          className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
        />
      </div>

      {/* Listing tables */}
      <div className="border border-slate-100 rounded-xl overflow-hidden mt-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Nama Kelas / Rombel</th>
                <th className="py-3 px-4 w-32 text-center">Tingkat Kelas</th>
                <th className="py-3 px-4">Wali Kelas Pengampu</th>
                <th className="py-3 px-4 w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredClasses.length > 0 ? (
                filteredClasses.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition duration-100">
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-500">{index + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 roundedbg bg-slate-100 text-slate-700 font-bold text-[10px]">
                        Grade {item.grade}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">
                      {getTeacherName(item.homeroomTeacherId)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Edit"
                          id={`rombel-edit-btn-${item.id}`}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Hapus"
                          id={`rombel-delete-btn-${item.id}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-10 text-center font-medium text-slate-500">
                    Tidak ditemukan data rombongan belajar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simple Modal Form */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <GraduationCap className="text-blue-500" size={18} />
                {isEdit ? 'Ubah Informasi Rombel' : 'Tambah Rombel Kelas Baru'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
                id="rombel-modal-close-btn"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nama Kelas / Rombel</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kelas 1A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Tingkat Kelas (Grade)</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  <option value="1">Kelas 1</option>
                  <option value="2">Kelas 2</option>
                  <option value="3">Kelas 3</option>
                  <option value="4">Kelas 4</option>
                  <option value="5">Kelas 5</option>
                  <option value="6">Kelas 6</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Wali Kelas Pengampu</label>
                <select
                  value={homeroomTeacherId}
                  onChange={(e) => setHomeroomTeacherId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  <option value="">-- Pilih Guru Kelas --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.assignedClassId && t.assignedClassId !== editId ? '(Sudah Mengampu)' : ''}
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
                  id="rombel-modal-cancel-btn"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                  id="rombel-modal-submit-btn"
                >
                  {isEdit ? 'Simpan Perubahan' : 'Daftarkan Kelas'}
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
              <h3 className="text-sm font-bold text-slate-800">Konfirmasi Hapus Kelas</h3>
            </div>
            
            <p className="mt-4 text-xs text-slate-600 leading-relaxed font-semibold">
              Apakah Anda yakin ingin menghapus kelas <span className="text-slate-900 font-bold">"{classes.find(c => c.id === deleteTargetId)?.name}"</span>?
            </p>
            <p className="mt-1 text-[11px] text-red-500 font-medium">
              Siswa dan Wali Kelas yang terhubung dengan kelas ini akan dilepaskan otomatis. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="px-3.5 py-2 border border-slate-200 rounded-lg text-slate-600 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                id="delete-cancel-btn"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                id="delete-confirm-btn"
              >
                Hapus Kelas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
