import React from 'react';
import { UserSession } from '../types';
import { db } from '../utils/db';
import { 
  BarChart3, 
  CalendarDays, 
  CircleUser, 
  FolderLock, 
  Calendar, 
  GraduationCap, 
  LayoutDashboard, 
  LogOut, 
  ClipboardCheck, 
  School, 
  Settings2, 
  UsersRound,
  FileSpreadsheet
} from 'lucide-react';

interface SidebarProps {
  session: UserSession;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export default function Sidebar({
  session,
  activeTab,
  setActiveTab,
  onLogout,
  isMobileOpen,
  setIsMobileOpen,
}: SidebarProps) {
  const school = db.getSchool();
  const isAdmin = session.role === 'admin';

  // Navigation Links based on role
  const menuItems = isAdmin
    ? [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'rombel', label: 'Data Kelas / Rombel', icon: GraduationCap },
        { id: 'guru', label: 'Data Guru', icon: UsersRound },
        { id: 'siswa', label: 'Data Siswa', icon: CircleUser },
        { id: 'libur', label: 'Hari Libur / Kalender', icon: Calendar },
        { id: 'absensi', label: 'Input Absensi Siswa', icon: ClipboardCheck },
        { id: 'rekap-bulanan', label: 'Rekapitulasi Bulanan', icon: FileSpreadsheet },
        { id: 'rekap-semester', label: 'Rekapitulasi Semester', icon: BarChart3 },
        { id: 'pengaturan', label: 'Pengaturan Akun', icon: Settings2 },
      ]
    : [
        { id: 'dashboard', label: 'Dashboard Guru', icon: LayoutDashboard },
        { id: 'absensi', label: 'Absensi Harian', icon: ClipboardCheck },
        { id: 'rekap-bulanan', label: 'Rekap Bulanan', icon: FileSpreadsheet },
        { id: 'rekap-semester', label: 'Rekap Semester', icon: BarChart3 },
        { id: 'pengaturan', label: 'Pengaturan Akun', icon: Settings2 },
      ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 font-sans">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-800">
        <div className="p-2.5 bg-blue-600 rounded-xl text-white">
          <School size={20} />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-wide truncate max-w-[150px]">
            {school.name}
          </h1>
          <p className="text-[10px] text-slate-400 font-medium">NPSN: {school.npsn}</p>
        </div>
      </div>

      {/* Profile Bar */}
      <div className="px-6 py-4 bg-slate-950/40 border-b border-slate-800/60 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-blue-400 font-semibold text-sm">
          {session.name.substring(0, 2).toUpperCase()}
        </div>
        <div className="truncate">
          <p className="text-xs font-bold text-slate-100 truncate">{session.name}</p>
          <div className="flex items-center gap-1">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              {isAdmin ? 'ADMINISTRATOR' : 'GURU KELAS'}
            </p>
          </div>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileOpen(false); // auto-close on mobile selection
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium tracking-wide transition-all duration-150 group cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10'
                  : 'hover:bg-slate-800/70 hover:text-slate-100 text-slate-400'
              }`}
            >
              <IconComponent
                size={16}
                className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}
              />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer sign */}
      <div className="px-6 py-4 border-t border-slate-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-slate-800 rounded-lg text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800/40 transition cursor-pointer"
        >
          <LogOut size={14} />
          Keluar Sistem
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop view sidebar */}
      <aside className="hidden lg:flex lg:flex-shrink-0 w-64 h-screen flex-col border-r border-slate-200">
        {sidebarContent}
      </aside>

      {/* Mobile view responsive drawer overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
          
          {/* Drawer content */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-950 animate-slide-right">
            <div className="absolute top-0 right-0 -mr-12 pt-6">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white text-white"
                onClick={() => setIsMobileOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
