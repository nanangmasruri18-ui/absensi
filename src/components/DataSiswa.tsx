import React, { useState, useEffect } from 'react';
import { db } from '../utils/db';
import { Student, ClassRombel, Gender } from '../types';
import { 
  downloadStudentTemplate, 
  parseAndValidateStudentExcel,
  exportStudentListToExcel 
} from '../utils/excel';
import { 
  Plus, 
  Edit, 
  Trash2, 
  CircleUser, 
  X, 
  AlertCircle, 
  AlertTriangle,
  Search, 
  FileSpreadsheet, 
  Upload, 
  Download, 
  CheckCircle2, 
  ListRestart,
  ShieldAlert
} from 'lucide-react';

export default function DataSiswa() {
  const [students, setStudents] = useState<Student[]>(db.getStudents());
  const [classes, setClasses] = useState<ClassRombel[]>(db.getClasses());
  
  useEffect(() => {
    const handleSync = () => {
      setStudents(db.getStudents());
      setClasses(db.getClasses());
    };
    window.addEventListener('db-synced', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('db-synced', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('');
  
  // Manual modal
  const [isOpen, setIsOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState('');

  // Delete individual state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Delete All states
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [deleteAllScope, setDeleteAllScope] = useState<'all' | 'class'>('all');
  const [confirmText, setConfirmText] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [nis, setNis] = useState('');
  const [nisn, setNisn] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('L');
  const [birthPlace, setBirthPlace] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [classId, setClassId] = useState('');
  const [error, setError] = useState('');

  // Bulk Excel import states
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<Array<Omit<Student, 'id'>>>([]);
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  // Triggers
  const openAddModal = () => {
    setIsEdit(false);
    setNis('');
    setNisn('');
    setName('');
    setGender('L');
    setBirthPlace('');
    setBirthDate('');
    if (classes.length > 0) setClassId(classes[0].id);
    else setClassId('');
    setError('');
    setIsOpen(true);
  };

  const openEditModal = (s: Student) => {
    setIsEdit(true);
    setEditId(s.id);
    setNis(s.nis);
    setNisn(s.nisn);
    setName(s.name);
    setGender(s.gender);
    setBirthPlace(s.birthPlace);
    setBirthDate(s.birthDate);
    setClassId(s.classId);
    setError('');
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  // Manual submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!nis.trim() || !nisn.trim() || !name.trim() || !classId) {
      setError('Harap lengkapi semua data siswa.');
      return;
    }

    if (!/^\d+$/.test(nis.trim()) || !/^\d+$/.test(nisn.trim())) {
      setError('NIS dan NISN wajib berupa rangkaian angka.');
      return;
    }

    // Check duplicate NIS/NISN
    const dupStudent = students.find(
      (s) => (s.nis === nis.trim() || s.nisn === nisn.trim()) && (!isEdit || s.id !== editId)
    );
    if (dupStudent) {
      setError(`Siswa dengan NIS/NISN tersebut sudah terdaftar (${dupStudent.name}).`);
      return;
    }

    let updatedList: Student[] = [];
    if (isEdit) {
      updatedList = students.map((s) =>
        s.id === editId
          ? { ...s, nis: nis.trim(), nisn: nisn.trim(), name: name.trim(), gender, classId }
          : s
      );
    } else {
      const newStudent: Student = {
        id: `std-${Date.now()}`,
        nis: nis.trim(),
        nisn: nisn.trim(),
        name: name.trim(),
        gender,
        birthPlace: '',
        birthDate: '',
        classId
      };
      updatedList = [...students, newStudent];
    }

    db.saveStudents(updatedList);
    setStudents(updatedList);
    setIsOpen(false);
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const executeDelete = () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;

    db.deleteStudent(id);
    setStudents(db.getStudents());

    // Clean associated attendances
    const attendances = db.getAttendance().filter((a) => a.studentId !== id);
    db.saveAttendance(attendances);

    setDeleteTargetId(null);
  };

  const openDeleteAllModal = () => {
    setConfirmText('');
    if (classFilter) {
      setDeleteAllScope('class');
    } else {
      setDeleteAllScope('all');
    }
    setIsDeleteAllOpen(true);
  };

  const executeDeleteAll = async () => {
    if (confirmText.trim().toUpperCase() !== 'HAPUS') return;

    setIsDeletingAll(true);
    try {
      const targetClassId = deleteAllScope === 'class' && classFilter ? classFilter : undefined;
      const targetClassName = targetClassId ? getClassName(targetClassId) : 'seluruh kelas';
      
      const res = db.deleteAllStudents(targetClassId);
      setStudents(db.getStudents());
      setIsDeleteAllOpen(false);
      setConfirmText('');

      setToastMessage({
        text: `✓ Berhasil menghapus ${res.deletedCount} data siswa (${targetClassName}). Database lokal & cloud telah diselaraskan.`,
        type: 'success'
      });
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err) {
      console.error('Error deleting all students:', err);
      setToastMessage({
        text: 'Terjadi kesalahan saat menghapus data siswa.',
        type: 'error'
      });
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleExportBackup = () => {
    const filterClassName = deleteAllScope === 'class' && classFilter ? getClassName(classFilter) : undefined;
    const targetList = deleteAllScope === 'class' && classFilter 
      ? students.filter(s => s.classId === classFilter) 
      : students;
    exportStudentListToExcel(targetList, classes, filterClassName);
  };

  // EXCEL BULK IMPLEMENTATION
  const handleExcelDrop = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportErrors([]);
    setImportPreview([]);

    const result = await parseAndValidateStudentExcel(file, classes);
    if (result.valid) {
      setImportPreview(result.students);
    } else {
      setImportErrors(result.errors);
    }
  };

  const saveBulkImport = () => {
    if (importPreview.length === 0) return;

    // Map previews to list with unique keys
    const newStudents: Student[] = importPreview.map((item, index) => {
      // Small randomized key addition
      const uniqueSeed = Date.now() + index;
      return {
        ...item,
        id: `std-bulk-${uniqueSeed}`
      };
    });

    const mergeList = [...students, ...newStudents];
    db.saveStudents(mergeList);
    setStudents(mergeList);
    
    setImportSuccessMsg(`Sukses mengimpor ${newStudents.length} siswa secara massal!`);
    setImportPreview([]);
    setImportFile(null);

    setTimeout(() => {
      setImportSuccessMsg('');
      setIsImportOpen(false);
    }, 2500);
  };

  const cancelImport = () => {
    setImportFile(null);
    setImportErrors([]);
    setImportPreview([]);
    setIsImportOpen(false);
  };

  const getClassName = (cId: string) => {
    const found = classes.find((c) => c.id === cId);
    return found ? found.name : 'Kelas Hilang';
  };

  // Filtering list
  const filteredStudents = students.filter((s) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      s.name.toLowerCase().includes(term) ||
      s.nis.toLowerCase().includes(term) ||
      s.nisn.toLowerCase().includes(term) ||
      (s.birthPlace || '').toLowerCase().includes(term);

    const matchClass = classFilter === '' || s.classId === classFilter;

    return matchSearch && matchClass;
  });

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm font-sans leading-normal animate-fade-in">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between border-b border-slate-100 pb-5 gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800">Manajemen Biometrik / Data Siswa</h2>
          <p className="text-xs text-slate-500 font-medium font-semibold">Kelola daftar akademis siswa secara manual atau melalui format Excel massal</p>
        </div>
        
        {/* Bulk tools layout */}
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={downloadStudentTemplate}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            id="siswa-download-template-btn"
          >
            <Download size={14} />
            Template Excel
          </button>
          
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            id="siswa-import-excel-btn"
          >
            <FileSpreadsheet size={14} />
            Import Roster Excel
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            id="siswa-add-btn"
          >
            <Plus size={14} />
            Daftar Siswa Manual
          </button>

          <button
            onClick={openDeleteAllModal}
            disabled={students.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            id="siswa-delete-all-btn"
            title={students.length === 0 ? "Belum ada data siswa" : "Hapus seluruh data siswa sekaligus"}
          >
            <Trash2 size={14} className="text-rose-600" />
            Hapus Semua
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className={`mt-4 p-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 animate-fade-in ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-red-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setToastMessage(null)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filters block */}
      <div className="my-5 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 items-center w-full sm:w-auto flex-1">
          <div className="relative w-full sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari NIS, NISN, atau Nama Siswa..."
              className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
            />
          </div>

          <div className="w-full sm:max-w-[200px]">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
            >
              <option value="">-- Semua Kelas Rombel --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Counter and quick info */}
        <div className="flex items-center gap-2 text-xs font-semibold self-end sm:self-center shrink-0">
          <span className="px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg">
            Total: <strong className="text-slate-900">{students.length}</strong> Siswa
          </span>
          {classFilter && (
            <span className="px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
              {getClassName(classFilter)}: <strong>{filteredStudents.length}</strong> Siswa
            </span>
          )}
        </div>
      </div>

      {/* Data tables */}
      <div className="border border-slate-100 rounded-xl overflow-hidden mt-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4 w-32">NIS / NISN</th>
                <th className="py-3 px-4">Nama Lengkap Siswa</th>
                <th className="py-3 px-4 w-20 text-center">L/P</th>
                <th className="py-3 px-4 w-32">Kelas Rombel</th>
                <th className="py-3 px-4 w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((s, index) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition duration-100">
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-500">{index + 1}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-800">{s.nis} / {s.nisn}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{s.name}</td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-600">{s.gender}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-0.5 roundedbg bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-100">
                        {getClassName(s.classId)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(s)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Edit"
                          id={`siswa-edit-btn-${s.id}`}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Hapus"
                          id={`siswa-delete-btn-${s.id}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-10 text-center font-medium text-slate-500">
                    Tidak ditemukan data siswa sesuai saringan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Entry Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <CircleUser className="text-blue-500" size={18} />
                {isEdit ? 'Ubah Informasi Siswa' : 'Daftarkan Siswa Baru'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
                id="siswa-modal-close-btn"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">NIS Siswa</label>
                  <input
                    type="text"
                    required
                    placeholder="NIS angka"
                    value={nis}
                    onChange={(e) => setNis(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">NISN Siswa</label>
                  <input
                    type="text"
                    required
                    placeholder="NISN angka"
                    value={nisn}
                    onChange={(e) => setNisn(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Muhammad Reyhan"
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
                      name="gender-siswa"
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
                      name="gender-siswa"
                      value="P"
                      checked={gender === 'P'}
                      onChange={() => setGender('P')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    Perempuan (P)
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Kelas Rombongan Belajar (Rombel)</label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
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
                  id="siswa-modal-cancel-btn"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                  id="siswa-modal-submit-btn"
                >
                  {isEdit ? 'Simpan Perubahan' : 'Masukkan Rombel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXCEL IMPORT WORKFLOW SHEET */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-500" size={18} />
                Pengolahan Import Siswa Massal
              </h3>
              <button
                onClick={cancelImport}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
                id="siswa-excel-modal-close-btn"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Silahkan unggah file absensi mentah siswa format .xlsx. Sistem akan memvalidasi NIS, kesesuaian rombel baru di kelas terdaftar, dan format tanggal lahir secara ketat.
              </p>

              {/* Upload Drag Target */}
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 hover:border-emerald-500 transition text-center relative group">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleExcelDrop}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  id="siswa-excel-input-field"
                />
                <div className="flex flex-col items-center justify-center">
                  <div className="p-3 bg-slate-50 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 rounded-xl transition">
                    <Upload size={24} />
                  </div>
                  <p className="mt-3 text-xs font-bold text-slate-700">Tarik berkas excel ke sini, atau klik untuk memilih file</p>
                  <p className="text-[10px] text-slate-500 mt-1">Ekstensi berkas yang didukung: .xls, .xlsx</p>
                </div>
              </div>

              {/* Status information */}
              {importFile && (
                <div className="p-3 rounded-lg bg-teal-50 border border-teal-100 text-xs flex items-center justify-between">
                  <span className="text-teal-800 font-bold">Berkas terpilih: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</span>
                  <button onClick={() => { setImportFile(null); setImportPreview([]); setImportErrors([]); }} className="text-[10px] bg-white px-2 py-0.5 rounded border text-slate-600 font-bold hover:bg-slate-50">Ganti</button>
                </div>
              )}

              {/* Import success overlay */}
              {importSuccessMsg && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 font-bold flex items-center gap-2 text-xs">
                  <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                  {importSuccessMsg}
                </div>
              )}

              {/* Error list */}
              {importErrors.length > 0 && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-red-700 font-extrabold border-b border-red-100 pb-1">
                    <AlertCircle size={14} className="shrink-0" />
                    Validasi Gagal! Ditemukan {importErrors.length} kesalahan sel:
                  </div>
                  <ul className="text-[10px] text-red-600 list-disc list-inside space-y-1 font-semibold max-h-[150px] overflow-y-auto">
                    {importErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-slate-500 italic mt-2">Harap betulkan data di berkas Excel anda dan coba lampirkan ulang.</p>
                </div>
              )}

              {/* Roster preview */}
              {importPreview.length > 0 && (
                <div className="space-y-2 font-sans">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-green-500" />
                    Preview Data Rombel Baru ({importPreview.length} Siswa Terdeteksi)
                  </h4>
                  <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
                    <table className="w-full text-left text-[10px]">
                      <thead>
                        <tr className="bg-slate-50 font-bold text-slate-600 border-b border-slate-100 uppercase">
                          <th className="py-2 px-3">NIS/NISN</th>
                          <th className="py-2 px-3">Nama Siswa</th>
                          <th className="py-2 px-3 text-center">G</th>
                          <th className="py-2 px-3">Kategori Kelas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {importPreview.map((s, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-mono">{s.nis}</td>
                            <td className="py-2 px-3 font-bold text-slate-800">{s.name}</td>
                            <td className="py-2 px-3 text-center font-bold text-slate-600">{s.gender}</td>
                            <td className="py-2 px-3 font-bold text-blue-600">{getClassName(s.classId)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={cancelImport}
                className="px-3.5 py-2 border border-slate-200 rounded-lg text-slate-600 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                id="siswa-excel-cancel-btn"
              >
                Tutup
              </button>
              {importPreview.length > 0 && (
                <button
                  type="button"
                  onClick={saveBulkImport}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                  id="siswa-excel-confirm-btn"
                >
                  Simpan Massal ke Database
                </button>
              )}
            </div>
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
              <h3 className="text-sm font-bold text-slate-800">Konfirmasi Hapus Siswa</h3>
            </div>
            
            <p className="mt-4 text-xs text-slate-600 leading-relaxed font-semibold">
              Apakah Anda yakin ingin menghapus siswa <span className="text-slate-900 font-bold">"{students.find(s => s.id === deleteTargetId)?.name}"</span>?
            </p>
            <p className="mt-2 text-[11px] text-red-500 font-semibold leading-relaxed">
              Semua data absensi historis dari siswa ini juga akan dinonaktifkan dari sistem secara permanen. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="px-3.5 py-2 border border-slate-200 rounded-lg text-slate-600 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                id="delete-siswa-cancel-btn"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                id="delete-siswa-confirm-btn"
              >
                Hapus Siswa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal: Hapus Semua Data Siswa */}
      {isDeleteAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-red-100 animate-slide-up space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
                  <ShieldAlert size={24} className="text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Hapus Semua Data Siswa</h3>
                  <p className="text-xs text-slate-500 font-medium">Penghapusan data siswa secara massal dari database</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDeleteAllOpen(false);
                  setConfirmText('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scope Selection if classFilter is active */}
            {classFilter ? (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Pilih Cakupan Siswa yang Dihapus:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteAllScope('class')}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      deleteAllScope === 'class'
                        ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-800">{getClassName(classFilter)} Saja</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Menghapus <strong>{students.filter(s => s.classId === classFilter).length}</strong> siswa di kelas ini
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteAllScope('all')}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      deleteAllScope === 'all'
                        ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-800">Seluruh Kelas (Total)</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Menghapus total <strong>{students.length}</strong> siswa di semua rombel
                    </p>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Total data yang akan dihapus:</span>
                  <span className="font-extrabold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full text-xs">
                    {students.length} Siswa (Semua Rombel)
                  </span>
                </div>
              </div>
            )}

            {/* Warning Details */}
            <div className="p-3.5 bg-rose-50/80 rounded-xl border border-rose-200/80 text-rose-900 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                <span>Peringatan Permanen</span>
              </div>
              <p className="text-[11px] leading-relaxed text-rose-700">
                Tindakan ini akan menghapus data siswa beserta riwayat absensi yang berhubungan secara langsung dari penyimpanan browser lokal dan database Supabase Cloud.
              </p>
            </div>

            {/* Backup Excel Helper */}
            <div className="flex items-center justify-between p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-xs">
              <div>
                <p className="font-bold text-blue-900">Ingin mengamankan cadangan data?</p>
                <p className="text-[11px] text-blue-700">Unduh data siswa saat ini ke format file Excel (.xlsx).</p>
              </div>
              <button
                type="button"
                onClick={handleExportBackup}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
              >
                <Download size={13} />
                Unduh Cadangan
              </button>
            </div>

            {/* Security Confirmation Input */}
            <div className="space-y-1.5 pt-1">
              <label htmlFor="confirm-delete-all-input" className="block text-xs font-bold text-slate-700">
                Ketik kata <span className="text-rose-600 font-mono font-extrabold">HAPUS</span> di bawah untuk melanjutkan:
              </label>
              <input
                id="confirm-delete-all-input"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder='Ketik "HAPUS" di sini...'
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-mono font-bold uppercase placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
                autoComplete="off"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteAllOpen(false);
                  setConfirmText('');
                }}
                disabled={isDeletingAll}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                id="cancel-delete-all-btn"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={executeDeleteAll}
                disabled={confirmText.trim().toUpperCase() !== 'HAPUS' || isDeletingAll}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                id="confirm-delete-all-btn"
              >
                {isDeletingAll ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Ya, Hapus Semua Siswa
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
