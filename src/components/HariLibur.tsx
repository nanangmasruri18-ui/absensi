import React, { useState } from 'react';
import { db } from '../utils/db';
import { Holiday } from '../types';
import { Plus, Edit, Trash2, Calendar, X, AlertCircle, CalendarDays, Search } from 'lucide-react';

export default function HariLibur() {
  const [holidays, setHolidays] = useState<Holiday[]>(db.getHolidays());
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [isOpen, setIsOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  // Triggers
  const openAddModal = () => {
    setIsEdit(false);
    setDate('');
    setName('');
    setDescription('');
    setError('');
    setIsOpen(true);
  };

  const openEditModal = (h: Holiday) => {
    setIsEdit(true);
    setEditId(h.id);
    setDate(h.date);
    setName(h.name);
    setDescription(h.description || '');
    setError('');
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  // Submit CRUD
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!date || !name.trim()) {
      setError('Kolom Tanggal dan Nama Hari Libur wajib diisi.');
      return;
    }

    // Check if Sunday - Sunday shouldn't be added since it is automatically locked!
    const dObj = new Date(date);
    if (dObj.getDay() === 0) {
      setError('Hari Minggu otomatis nonaktif untuk absensi. Tidak perlu memasukkan hari Minggu ke daftar hari libur.');
      return;
    }

    // Check duplicate date
    const dupHoliday = holidays.find(
      (h) => h.date === date && (!isEdit || h.id !== editId)
    );
    if (dupHoliday) {
      setError(`Tanggal ${date} sudah didaftarkan sebagai hari libur "${dupHoliday.name}".`);
      return;
    }

    let updatedList: Holiday[] = [];
    if (isEdit) {
      updatedList = holidays.map((h) =>
        h.id === editId ? { ...h, date, name: name.trim(), description: description.trim() } : h
      );
    } else {
      const newHoliday: Holiday = {
        id: `hol-${Date.now()}`,
        date,
        name: name.trim(),
        description: description.trim(),
      };
      updatedList = [...holidays, newHoliday];
    }

    db.saveHolidays(updatedList);
    setHolidays(updatedList);
    setIsOpen(false);
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    const updatedList = holidays.filter((h) => h.id !== deleteTargetId);
    db.saveHolidays(updatedList);
    setHolidays(updatedList);
    setDeleteTargetId(null);
  };

  // Helpers to fetch day name
  const getDayLabel = (dateStr: string) => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const d = new Date(dateStr);
    return days[d.getDay()];
  };

  // Formatting date standard ID
  const formatDateID = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Filter lists sorted descending
  const filteredHolidays = holidays
    .filter((h) =>
      h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.date.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.description && h.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm font-sans animate-fade-in leading-normal">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5 gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800">Manajemen Hari Libur & Kalender Akademik</h2>
          <p className="text-xs text-slate-500 font-medium">Atur hari libur nasional atau khusus sekolah. Tanggal libur terkunci otomatis dari absensi.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
          id="libur-add-btn"
        >
          <Plus size={16} />
          Tambah Hari Libur
        </button>
      </div>

      {/* Info note */}
      <div className="my-5 p-3.5 bg-blue-50/50 border border-blue-100 text-blue-800 rounded-xl text-xs flex gap-2.5 font-medium leading-relaxed">
        <CalendarDays size={18} className="text-blue-600 shrink-0" />
        <div>
          <span className="font-bold">Ketentuan Otomasi Kalender:</span> Hari <strong className="text-blue-900 border-b border-red-200">Minggu otomatis nonaktif</strong> dan diwarnai merah pada form absensi tanpa perlu didaftarkan di sini. Tanggal-tanggal hari libur di bawah ini juga otomatis terkunci dan tidak dapat diubah absensinya oleh guru kelas.
        </div>
      </div>

      <div className="my-5 relative max-w-sm">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search size={16} />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari hari libur berdasarkan nama atau tanggal..."
          className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
        />
      </div>

      <div className="border border-slate-100 rounded-xl overflow-hidden mt-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Hari/Tanggal</th>
                <th className="py-3 px-4">Nama Hari Libur</th>
                <th className="py-3 px-4">Keterangan</th>
                <th className="py-3 px-4 w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredHolidays.length > 0 ? (
                filteredHolidays.map((h, index) => (
                  <tr key={h.id} className="hover:bg-slate-50/50 transition duration-100">
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-500">{index + 1}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-red-600">{getDayLabel(h.date)}</span>
                        <span className="font-mono text-[11px] text-slate-500">{formatDateID(h.date)}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{h.name}</td>
                    <td className="py-3.5 px-4 text-slate-500 italic max-w-xs truncate">{h.description || '-'}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(h)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Edit"
                          id={`libur-edit-btn-${h.id}`}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(h.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Hapus"
                          id={`libur-delete-btn-${h.id}`}
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
                    Belum ada data hari libur khusus yang didaftarkan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual modal block */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="text-blue-500" size={18} />
                {isEdit ? 'Ubah Hari Libur' : 'Daftarkan Libur Khusus Baru'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
                id="libur-modal-close-btn"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Tanggal Libur</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Nama Hari Libur / Agenda</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Libur Hari Raya Nyepi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Keterangan Tambahan (Pilihan)</label>
                <textarea
                  placeholder="Ketik detail keterangan libur..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
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
                  id="libur-modal-cancel-btn"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                  id="libur-modal-submit-btn"
                >
                  {isEdit ? 'Simpan' : 'Daftarkan Hari Libur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 animate-slide-up text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Hapus Hari Libur?</h3>
            <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
              Apakah Anda yakin ingin menghapus hari libur ini? Tanggal ini akan kembali aktif dan dapat diisi presensinya oleh guru kelas.
            </p>
            {(() => {
              const info = holidays.find((h) => h.id === deleteTargetId);
              return info ? (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-semibold text-slate-700 text-left">
                  <div className="flex justify-between">
                    <span>Hari/Tgl:</span>
                    <span className="font-extrabold text-red-600 font-mono">{getDayLabel(info.date)}, {formatDateID(info.date)}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Nama Libur:</span>
                    <span className="font-extrabold text-slate-900">{info.name}</span>
                  </div>
                </div>
              ) : null;
            })()}
            <div className="mt-5 flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                id="libur-delete-confirm-btn"
              >
                Hapus Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
