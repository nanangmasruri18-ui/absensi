// Unified synchronization service for SD Absensi
// Integrates with:
// 1. Direct Supabase Cloud Database (@supabase/supabase-js) + Supabase Realtime Channels
// 2. Local Express / Vercel Serverless API (/api/db, /api/attendance, /api/sync/events)
// 3. Browser-level EventTarget & StorageEvent listeners for sub-second reactive UI updates

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Attendance, Student, ClassRombel, Teacher, SchoolProfile, Holiday } from '../types';

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'not_configured';

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt?: string;
  errorMessage?: string;
  backendType?: 'supabase' | 'server' | 'local';
}

export interface SupabaseStatusInfo {
  isConfigured: boolean;
  url: string;
  isTablesReady: boolean;
  errorMessage?: string;
  lastChecked?: string;
}

// 1. Initialize Supabase Client
const env = (import.meta as any).env || {};
const rawSupabaseUrl = (env.VITE_SUPABASE_URL || '').trim();
const supabaseKey = (env.VITE_SUPABASE_ANON_KEY || '').trim();

// Normalize URL: remove trailing /rest/v1 or slashes
export const cleanSupabaseUrl = rawSupabaseUrl
  ? rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
  : '';

export const isSupabaseConfigured = Boolean(cleanSupabaseUrl && supabaseKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(cleanSupabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

let supabaseTablesVerified = false;
let supabaseCheckedAt = '';
let supabaseErrorReason = '';

export function getSupabaseStatus(): SupabaseStatusInfo {
  return {
    isConfigured: isSupabaseConfigured,
    url: cleanSupabaseUrl,
    isTablesReady: supabaseTablesVerified,
    errorMessage: supabaseErrorReason,
    lastChecked: supabaseCheckedAt,
  };
}

// 2. State & Subscribers
const subscribers = new Set<(state: SyncState) => void>();
let currentSyncState: SyncState = {
  status: 'synced',
  lastSyncedAt: new Date().toISOString(),
  backendType: isSupabaseConfigured ? 'supabase' : 'server',
};

let lastKnownServerTime = '';
let isSyncInProgress = false;

export function getSyncState(): SyncState {
  return currentSyncState;
}

export function subscribeToSync(callback: (state: SyncState) => void) {
  subscribers.add(callback);
  callback(currentSyncState);
  return () => {
    subscribers.delete(callback);
  };
}

function updateSyncState(newState: Partial<SyncState>) {
  currentSyncState = { ...currentSyncState, ...newState };
  subscribers.forEach((sub) => sub(currentSyncState));
}

// Storage keys
export const KEYS = {
  SCHOOL: 'absensi_sd_school',
  CLASSES: 'absensi_sd_classes',
  TEACHERS: 'absensi_sd_teachers',
  STUDENTS: 'absensi_sd_students',
  HOLIDAYS: 'absensi_sd_holidays',
  ATTENDANCE: 'absensi_sd_attendance',
};

// Guard against race conditions: if user saved within last 6 seconds, do not let remote fetch overwrite it
const recentSaves = new Map<string, number>();

export function recordRecentSave(key: string) {
  recentSaves.set(key, Date.now());
}

export function isRecentlySaved(key: string, maxAgeMs = 6000): boolean {
  const t = recentSaves.get(key);
  if (!t) return false;
  return Date.now() - t < maxAgeMs;
}

const TOMBSTONES_KEY = 'absensi_deleted_ids';

export function recordDeletedId(id: string) {
  try {
    const raw = localStorage.getItem(TOMBSTONES_KEY) || '[]';
    const list: string[] = JSON.parse(raw);
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(list));
    }
  } catch {}
}

export function isDeletedId(id: string): boolean {
  try {
    const raw = localStorage.getItem(TOMBSTONES_KEY) || '[]';
    const list: string[] = JSON.parse(raw);
    return list.includes(id);
  } catch {
    return false;
  }
}

export async function deleteFromSupabase(
  table: 'school' | 'classes' | 'teachers' | 'students' | 'holidays' | 'attendance',
  id: string
): Promise<boolean> {
  recordDeletedId(id);
  try {
    if (supabase) {
      await supabase.from(table).delete().eq('id', id);
    }
    fetch(`/api/db/item/${table}/${id}`, {
      method: 'DELETE',
      headers: { 'x-sync-source': 'internal-sync' },
    }).catch(() => {});
    return true;
  } catch (e) {
    console.warn(`Error deleting ${id} from ${table}:`, e);
    return false;
  }
}

// 3. Test if Supabase tables exist
export async function checkSupabaseTables(): Promise<boolean> {
  if (!supabase) {
    supabaseTablesVerified = false;
    return false;
  }

  try {
    const { data, error } = await supabase.from('attendance').select('id').limit(1);
    supabaseCheckedAt = new Date().toISOString();
    if (error) {
      supabaseTablesVerified = false;
      supabaseErrorReason = error.message;
      return false;
    }
    supabaseTablesVerified = true;
    supabaseErrorReason = '';
    return true;
  } catch (err: any) {
    supabaseTablesVerified = false;
    supabaseErrorReason = err?.message || 'Gagal menghubungi server Supabase';
    return false;
  }
}

// Helper to fetch all attendance rows across pages (bypasses PostgREST 1000 limit)
async function fetchAllAttendanceRows(client: SupabaseClient): Promise<{ data: any[]; error: any }> {
  const allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await client
      .from('attendance')
      .select('*')
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      return { data: allRows, error };
    }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return { data: allRows, error: null };
}

// Dedicated helper to directly push day's attendance records to Supabase & backend
export async function pushAttendanceRecords(records: Attendance[]): Promise<boolean> {
  if (!records || records.length === 0) return true;

  // 1. Direct Supabase Cloud Upsert
  if (supabase) {
    try {
      const rows = records.map((a: Attendance) => ({
        id: a.id,
        class_id: a.classId,
        student_id: a.studentId,
        date: a.date,
        status: a.status,
        notes: a.notes || '',
        updated_at: a.updatedAt || new Date().toISOString(),
      }));
      await supabase.from('attendance').upsert(rows, { onConflict: 'id' });
    } catch (err) {
      console.warn('Direct push to Supabase attendance warning:', err);
    }
  }

  // 2. Local backend / Vercel API
  const sample = records[0];
  if (sample) {
    fetch('/api/attendance', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-sync-source': 'internal-sync'
      },
      body: JSON.stringify({
        classId: sample.classId,
        date: sample.date,
        records,
      }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data?.updatedAt) lastKnownServerTime = data.updatedAt;
        }
      })
      .catch(() => {});
  }

  // 3. Broadcast to all open tabs and components
  broadcastLocalUpdate(records.length, 'user-save');
  return true;
}

// 4. Fetch all data: Tries Supabase first, falls back to /api/db and localStorage
export async function fetchAllFromSupabase(force = false): Promise<boolean> {
  if (isSyncInProgress && !force) return true;
  isSyncInProgress = true;

  try {
    updateSyncState({ status: 'syncing' });

    // Method A: Try Direct Supabase Cloud Query
    if (supabase) {
      try {
        const [
          schoolRes,
          classesRes,
          teachersRes,
          studentsRes,
          holidaysRes,
          attendanceRes,
        ] = await Promise.all([
          supabase.from('school').select('*').limit(1),
          supabase.from('classes').select('*'),
          supabase.from('teachers').select('*'),
          supabase.from('students').select('*'),
          supabase.from('holidays').select('*'),
          fetchAllAttendanceRows(supabase),
        ]);

        // If attendance table exists and succeeds:
        if (!attendanceRes.error) {
          supabaseTablesVerified = true;
          supabaseErrorReason = '';

          // 1. Format & resolve school (Never overwrite newer local edit with older remote)
          let localSchool: SchoolProfile | null = null;
          try {
            const raw = localStorage.getItem(KEYS.SCHOOL);
            if (raw) localSchool = JSON.parse(raw);
          } catch {}

          if (schoolRes.data && schoolRes.data.length > 0) {
            const row = schoolRes.data[0];
            const remoteSchool: SchoolProfile = {
              name: row.name || 'SDN 005 Gelora',
              address: row.address || '',
              npsn: row.npsn || '',
              adminName: row.admin_name || '',
              updatedAt: row.updated_at,
            };

            const locTime = localSchool?.updatedAt ? new Date(localSchool.updatedAt).getTime() : 0;
            const remTime = remoteSchool.updatedAt ? new Date(remoteSchool.updatedAt).getTime() : 0;

            if (isRecentlySaved(KEYS.SCHOOL)) {
              if (localSchool) pushToSupabase(KEYS.SCHOOL, localSchool);
            } else if (localSchool && locTime > remTime) {
              // Local is strictly newer: push to Supabase to persist user edit
              pushToSupabase(KEYS.SCHOOL, localSchool);
            } else {
              // Remote is newer or equal
              const prevRaw = localStorage.getItem(KEYS.SCHOOL);
              const nextRaw = JSON.stringify(remoteSchool);
              if (prevRaw !== nextRaw) {
                localStorage.setItem(KEYS.SCHOOL, nextRaw);
                window.dispatchEvent(new CustomEvent('db-synced', { detail: { entity: 'school' } }));
              }
            }
          } else if (localSchool) {
            pushToSupabase(KEYS.SCHOOL, localSchool);
          }

          // 2. Format & resolve classes
          let localClasses: ClassRombel[] = [];
          try {
            const raw = localStorage.getItem(KEYS.CLASSES);
            if (raw) localClasses = JSON.parse(raw);
          } catch {}

          if (classesRes.data && classesRes.data.length > 0) {
            const remoteClasses: ClassRombel[] = classesRes.data.map((r: any) => ({
              id: r.id,
              name: r.name,
              grade: r.grade,
              homeroomTeacherId: r.homeroom_teacher_id || '',
              updatedAt: r.updated_at,
            }));

            if (isRecentlySaved(KEYS.CLASSES)) {
              if (localClasses.length > 0) pushToSupabase(KEYS.CLASSES, localClasses);
            } else {
              const classMap = new Map<string, ClassRombel>();
              localClasses.forEach((c) => {
                if (!isDeletedId(c.id)) classMap.set(c.id, c);
              });
              remoteClasses.forEach((rem) => {
                if (isDeletedId(rem.id)) return;
                const loc = classMap.get(rem.id);
                if (!loc) {
                  classMap.set(rem.id, rem);
                } else {
                  const locTime = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
                  const remTime = rem.updatedAt ? new Date(rem.updatedAt).getTime() : 0;
                  if (remTime > locTime) classMap.set(rem.id, rem);
                }
              });

              const mergedClasses = Array.from(classMap.values())
                .filter((c) => !isDeletedId(c.id))
                .sort((a, b) => a.id.localeCompare(b.id));
              const prevRaw = localStorage.getItem(KEYS.CLASSES);
              const nextRaw = JSON.stringify(mergedClasses);
              if (prevRaw !== nextRaw) {
                localStorage.setItem(KEYS.CLASSES, nextRaw);
                window.dispatchEvent(new CustomEvent('db-synced', { detail: { entity: 'classes' } }));
              }
            }
          } else if (localClasses.length > 0) {
            pushToSupabase(KEYS.CLASSES, localClasses);
          }

          // 3. Format & resolve teachers (Data Akun Guru & Admin)
          let localTeachers: Teacher[] = [];
          try {
            const raw = localStorage.getItem(KEYS.TEACHERS);
            if (raw) localTeachers = JSON.parse(raw);
          } catch {}

          if (teachersRes.data && teachersRes.data.length > 0) {
            const remoteTeachers: Teacher[] = teachersRes.data.map((r: any) => ({
              id: r.id,
              nip: r.nip || '',
              name: r.name,
              gender: r.gender || 'L',
              username: r.username,
              passwordHash: r.password_hash,
              assignedClassId: r.assigned_class_id || '',
              role: r.role || 'guru',
              updatedAt: r.updated_at,
            }));

            if (isRecentlySaved(KEYS.TEACHERS)) {
              if (localTeachers.length > 0) pushToSupabase(KEYS.TEACHERS, localTeachers);
            } else {
              const teacherMap = new Map<string, Teacher>();
              localTeachers.forEach((t) => {
                if (!isDeletedId(t.id)) teacherMap.set(t.id, t);
              });

              remoteTeachers.forEach((rem) => {
                if (isDeletedId(rem.id)) return;
                const loc = teacherMap.get(rem.id);
                if (!loc) {
                  teacherMap.set(rem.id, rem);
                } else {
                  const locTime = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
                  const remTime = rem.updatedAt ? new Date(rem.updatedAt).getTime() : 0;
                  if (remTime > locTime) {
                    teacherMap.set(rem.id, rem);
                  }
                }
              });

              const mergedTeachers = Array.from(teacherMap.values())
                .filter((t) => !isDeletedId(t.id))
                .sort((a, b) => a.id.localeCompare(b.id));
              const prevRaw = localStorage.getItem(KEYS.TEACHERS);
              const nextRaw = JSON.stringify(mergedTeachers);
              if (prevRaw !== nextRaw) {
                localStorage.setItem(KEYS.TEACHERS, nextRaw);
                window.dispatchEvent(new CustomEvent('db-synced', { detail: { entity: 'teachers' } }));
              }
            }
          } else if (localTeachers.length > 0) {
            pushToSupabase(KEYS.TEACHERS, localTeachers);
          }

          // 4. Format & resolve students
          let localStudents: Student[] = [];
          try {
            const raw = localStorage.getItem(KEYS.STUDENTS);
            if (raw) localStudents = JSON.parse(raw);
          } catch {}

          if (studentsRes.data && studentsRes.data.length > 0) {
            const remoteStudents: Student[] = studentsRes.data.map((r: any) => ({
              id: r.id,
              nis: r.nis || '',
              nisn: r.nisn || '',
              name: r.name,
              gender: r.gender || 'L',
              birthPlace: r.birth_place || '',
              birthDate: r.birth_date || '',
              classId: r.class_id,
              updatedAt: r.updated_at,
            }));

            if (isRecentlySaved(KEYS.STUDENTS)) {
              if (localStudents.length > 0) pushToSupabase(KEYS.STUDENTS, localStudents);
            } else {
              const studentMap = new Map<string, Student>();
              localStudents.forEach((s) => {
                if (!isDeletedId(s.id)) studentMap.set(s.id, s);
              });
              remoteStudents.forEach((rem) => {
                if (isDeletedId(rem.id)) return;
                const loc = studentMap.get(rem.id);
                if (!loc) {
                  studentMap.set(rem.id, rem);
                } else {
                  const locTime = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
                  const remTime = rem.updatedAt ? new Date(rem.updatedAt).getTime() : 0;
                  if (remTime > locTime) studentMap.set(rem.id, rem);
                }
              });

              const mergedStudents = Array.from(studentMap.values())
                .filter((s) => !isDeletedId(s.id))
                .sort((a, b) => a.id.localeCompare(b.id));
              const prevRaw = localStorage.getItem(KEYS.STUDENTS);
              const nextRaw = JSON.stringify(mergedStudents);
              if (prevRaw !== nextRaw) {
                localStorage.setItem(KEYS.STUDENTS, nextRaw);
                window.dispatchEvent(new CustomEvent('db-synced', { detail: { entity: 'students' } }));
              }
            }
          } else if (localStudents.length > 0) {
            pushToSupabase(KEYS.STUDENTS, localStudents);
          }

          // 5. Format & resolve holidays
          let localHolidays: Holiday[] = [];
          try {
            const raw = localStorage.getItem(KEYS.HOLIDAYS);
            if (raw) localHolidays = JSON.parse(raw);
          } catch {}

          if (holidaysRes.data && holidaysRes.data.length > 0) {
            const remoteHolidays: Holiday[] = holidaysRes.data.map((r: any) => ({
              id: r.id,
              date: r.date,
              name: r.name,
              updatedAt: r.updated_at,
            }));

            if (isRecentlySaved(KEYS.HOLIDAYS)) {
              if (localHolidays.length > 0) pushToSupabase(KEYS.HOLIDAYS, localHolidays);
            } else {
              const holidayMap = new Map<string, Holiday>();
              localHolidays.forEach((h) => {
                if (!isDeletedId(h.id)) holidayMap.set(h.id, h);
              });
              remoteHolidays.forEach((rem) => {
                if (isDeletedId(rem.id)) return;
                const loc = holidayMap.get(rem.id);
                if (!loc) holidayMap.set(rem.id, rem);
                else {
                  const locTime = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
                  const remTime = rem.updatedAt ? new Date(rem.updatedAt).getTime() : 0;
                  if (remTime > locTime) holidayMap.set(rem.id, rem);
                }
              });

              const mergedHolidays = Array.from(holidayMap.values())
                .filter((h) => !isDeletedId(h.id))
                .sort((a, b) => a.date.localeCompare(b.date));
              const prevRaw = localStorage.getItem(KEYS.HOLIDAYS);
              const nextRaw = JSON.stringify(mergedHolidays);
              if (prevRaw !== nextRaw) {
                localStorage.setItem(KEYS.HOLIDAYS, nextRaw);
                window.dispatchEvent(new CustomEvent('db-synced', { detail: { entity: 'holidays' } }));
              }
            }
          } else if (localHolidays.length > 0) {
            pushToSupabase(KEYS.HOLIDAYS, localHolidays);
          }

          // Also sync models to local backend /api/db (marked as internal-sync)
          try {
            const serverDbPayload: Record<string, any> = {};
            serverDbPayload.school = JSON.parse(localStorage.getItem(KEYS.SCHOOL) || '{}');
            serverDbPayload.classes = JSON.parse(localStorage.getItem(KEYS.CLASSES) || '[]');
            serverDbPayload.teachers = JSON.parse(localStorage.getItem(KEYS.TEACHERS) || '[]');
            serverDbPayload.students = JSON.parse(localStorage.getItem(KEYS.STUDENTS) || '[]');
            serverDbPayload.holidays = JSON.parse(localStorage.getItem(KEYS.HOLIDAYS) || '[]');
            if (Object.keys(serverDbPayload).length > 0) {
              fetch('/api/db', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'x-sync-source': 'internal-sync'
                },
                body: JSON.stringify(serverDbPayload),
              })
                .then(async (res) => {
                  if (res.ok) {
                    const data = await res.json();
                    if (data?.updatedAt) lastKnownServerTime = data.updatedAt;
                  }
                })
                .catch(() => {});
            }
          } catch {}

          // Format & resolve attendance
          if (attendanceRes.data && attendanceRes.data.length > 0) {
            const remoteAttendance: Attendance[] = attendanceRes.data.map((r: any) => ({
              id: r.id,
              classId: r.class_id,
              studentId: r.student_id,
              date: r.date,
              status: r.status,
              notes: r.notes || '',
              updatedAt: r.updated_at,
            }));

            // Read current local records
            let localRecords: Attendance[] = [];
            try {
              const raw = localStorage.getItem(KEYS.ATTENDANCE);
              if (raw) localRecords = JSON.parse(raw);
            } catch {}

            // CRITICAL TIMESTAMP-BASED RESOLUTION:
            // Never overwrite newer local edits with older remote data!
            const recordMap = new Map<string, Attendance>();
            localRecords.forEach((local) => {
              if (local && local.id) recordMap.set(local.id, local);
            });

            remoteAttendance.forEach((remote) => {
              if (!remote || !remote.id) return;
              const local = recordMap.get(remote.id);
              if (!local) {
                recordMap.set(remote.id, remote);
              } else {
                const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
                const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
                if (remoteTime > localTime) {
                  recordMap.set(remote.id, remote);
                }
              }
            });

            // Deterministic sort: date ASC, classId ASC, studentId ASC
            const mergedAttendance = Array.from(recordMap.values()).sort((a, b) => {
              if (a.date !== b.date) return a.date.localeCompare(b.date);
              if (a.classId !== b.classId) return a.classId.localeCompare(b.classId);
              return (a.studentId || '').localeCompare(b.studentId || '');
            });

            // Check if actual data values changed (ignore array order / formatting)
            let isDataDifferent = false;
            if (localRecords.length !== mergedAttendance.length) {
              isDataDifferent = true;
            } else {
              for (let i = 0; i < mergedAttendance.length; i++) {
                const m = mergedAttendance[i];
                const l = localRecords[i];
                if (!l || l.id !== m.id || l.status !== m.status || l.notes !== m.notes) {
                  isDataDifferent = true;
                  break;
                }
              }
            }

            if (isDataDifferent) {
              const nextRaw = JSON.stringify(mergedAttendance);
              localStorage.setItem(KEYS.ATTENDANCE, nextRaw);

              // Notify UI smoothly
              broadcastLocalUpdate(mergedAttendance.length, 'supabase-cloud');

              // Sync to local server cache with internal-sync header to avoid echo loop
              fetch('/api/attendance', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'x-sync-source': 'internal-sync'
                },
                body: nextRaw,
              })
                .then(async (res) => {
                  if (res.ok) {
                    const data = await res.json();
                    if (data?.updatedAt) lastKnownServerTime = data.updatedAt;
                  }
                })
                .catch(() => {});
            }

            updateSyncState({
              status: 'synced',
              lastSyncedAt: new Date().toISOString(),
              errorMessage: undefined,
              backendType: 'supabase',
            });
            return true;
          } else {
            // Supabase attendance table is empty!
            // CRITICAL: DO NOT wipe local data! Check local data or /api/db and push UP to Supabase to restore it!
            let existingLocal: Attendance[] = [];
            try {
              const raw = localStorage.getItem(KEYS.ATTENDANCE);
              if (raw) existingLocal = JSON.parse(raw);
            } catch {}

            if (existingLocal.length === 0) {
              try {
                const resp = await fetch('/api/db');
                if (resp.ok) {
                  const dbData = await resp.json();
                  if (dbData.attendance && dbData.attendance.length > 0) {
                    existingLocal = dbData.attendance;
                    localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(existingLocal));
                  }
                }
              } catch {}
            }

            if (existingLocal.length > 0) {
              // Push local data up to Supabase to populate it!
              pushToSupabase(KEYS.ATTENDANCE, existingLocal);
              broadcastLocalUpdate(existingLocal.length, 'local-restored');
            }

            updateSyncState({
              status: 'synced',
              lastSyncedAt: new Date().toISOString(),
              errorMessage: undefined,
              backendType: 'supabase',
            });
            return true;
          }
        } else {
          // Record error reason so UI can offer SQL script
          supabaseErrorReason = attendanceRes.error.message;
        }
      } catch (sbErr: any) {
        supabaseErrorReason = sbErr?.message || '';
      }
    }

    // Method B: Fallback to Server API /api/db (Express or Vercel serverless)
    const response = await fetch('/api/db', {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (response.ok) {
      const data = await response.json();
      if (data) {
        if (data.school && !isRecentlySaved(KEYS.SCHOOL)) {
          let locSchool: any = null;
          try {
            const raw = localStorage.getItem(KEYS.SCHOOL);
            if (raw) locSchool = JSON.parse(raw);
          } catch {}
          const locTime = locSchool?.updatedAt ? new Date(locSchool.updatedAt).getTime() : 0;
          const srvTime = data.school.updatedAt ? new Date(data.school.updatedAt).getTime() : 0;
          if (srvTime >= locTime || !locSchool?.name) {
            localStorage.setItem(KEYS.SCHOOL, JSON.stringify(data.school));
            window.dispatchEvent(new CustomEvent('db-synced', { detail: { entity: 'school' } }));
          }
        }
        if (Array.isArray(data.classes) && !isRecentlySaved(KEYS.CLASSES)) {
          const filtered = data.classes.filter((c: any) => !isDeletedId(c.id));
          localStorage.setItem(KEYS.CLASSES, JSON.stringify(filtered));
        }
        if (Array.isArray(data.teachers) && !isRecentlySaved(KEYS.TEACHERS)) {
          const filtered = data.teachers.filter((t: any) => !isDeletedId(t.id));
          localStorage.setItem(KEYS.TEACHERS, JSON.stringify(filtered));
        }
        if (Array.isArray(data.students) && !isRecentlySaved(KEYS.STUDENTS)) {
          const filtered = data.students.filter((s: any) => !isDeletedId(s.id));
          localStorage.setItem(KEYS.STUDENTS, JSON.stringify(filtered));
        }
        if (Array.isArray(data.holidays) && !isRecentlySaved(KEYS.HOLIDAYS)) {
          const filtered = data.holidays.filter((h: any) => !isDeletedId(h.id));
          localStorage.setItem(KEYS.HOLIDAYS, JSON.stringify(filtered));
        }
        if (Array.isArray(data.attendance) && !isRecentlySaved(KEYS.ATTENDANCE)) {
          localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(data.attendance));
        }

        if (data.updatedAt) {
          lastKnownServerTime = data.updatedAt;
        }

        broadcastLocalUpdate(data.attendance?.length || 0, 'server-api');
      }

      updateSyncState({
        status: 'synced',
        lastSyncedAt: new Date().toISOString(),
        errorMessage: undefined,
        backendType: 'server',
      });
      return true;
    } else {
      updateSyncState({
        status: 'synced',
        lastSyncedAt: new Date().toISOString(),
        backendType: 'local',
      });
      return true;
    }
  } catch (err: any) {
    console.warn('Sync notice: using cached local persistent storage:', err);
    updateSyncState({
      status: 'synced',
      lastSyncedAt: new Date().toISOString(),
      backendType: 'local',
    });
    return true;
  } finally {
    isSyncInProgress = false;
  }
}

// 5. Push local item update: writes to Supabase Cloud AND server API
export async function pushToSupabase(key: string, value: any): Promise<boolean> {
  try {
    updateSyncState({ status: 'syncing' });

    // 1. Direct Supabase Cloud Upsert
    if (supabase) {
      try {
        if (key === KEYS.ATTENDANCE && Array.isArray(value)) {
          const rows = value.map((a: Attendance) => ({
            id: a.id,
            class_id: a.classId,
            student_id: a.studentId,
            date: a.date,
            status: a.status,
            notes: a.notes || '',
            updated_at: a.updatedAt || new Date().toISOString(),
          }));
          const CHUNK_SIZE = 250;
          for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);
            await supabase.from('attendance').upsert(chunk, { onConflict: 'id' });
          }
        } else if (key === KEYS.STUDENTS && Array.isArray(value)) {
          const rows = value.map((s: Student) => ({
            id: s.id,
            nis: s.nis || '',
            nisn: s.nisn || '',
            name: s.name,
            gender: s.gender || 'L',
            birth_place: s.birthPlace || '',
            birth_date: s.birthDate || '',
            class_id: s.classId,
          }));
          await supabase.from('students').upsert(rows, { onConflict: 'id' });
        } else if (key === KEYS.CLASSES && Array.isArray(value)) {
          const rows = value.map((c: ClassRombel) => ({
            id: c.id,
            name: c.name,
            grade: c.grade,
            homeroom_teacher_id: c.homeroomTeacherId || '',
            updated_at: c.updatedAt || new Date().toISOString(),
          }));
          await supabase.from('classes').upsert(rows, { onConflict: 'id' });
        } else if (key === KEYS.TEACHERS && Array.isArray(value)) {
          const rows = value.map((t: Teacher) => ({
            id: t.id,
            nip: t.nip || '',
            name: t.name,
            gender: t.gender || 'L',
            username: t.username,
            password_hash: t.passwordHash,
            assigned_class_id: t.assignedClassId || '',
            role: t.role || 'guru',
            updated_at: t.updatedAt || new Date().toISOString(),
          }));
          await supabase.from('teachers').upsert(rows, { onConflict: 'id' });
        } else if (key === KEYS.SCHOOL && value) {
          await supabase.from('school').upsert({
            id: 'school-1',
            name: value.name,
            address: value.address || '',
            npsn: value.npsn || '',
            admin_name: value.adminName || '',
            updated_at: value.updatedAt || new Date().toISOString(),
          }, { onConflict: 'id' });
        } else if (key === KEYS.HOLIDAYS && Array.isArray(value)) {
          const rows = value.map((h: Holiday) => ({
            id: h.id,
            date: h.date,
            name: h.name,
            updated_at: h.updatedAt || new Date().toISOString(),
          }));
          await supabase.from('holidays').upsert(rows, { onConflict: 'id' });
        }
      } catch (sbErr) {
        console.warn('Supabase cloud push notice:', sbErr);
      }
    }

    // 2. Also send to local backend / Vercel API
    let payload: Record<string, any> = {};
    if (key === KEYS.SCHOOL) payload.school = value;
    else if (key === KEYS.CLASSES) payload.classes = value;
    else if (key === KEYS.TEACHERS) payload.teachers = value;
    else if (key === KEYS.STUDENTS) payload.students = value;
    else if (key === KEYS.HOLIDAYS) payload.holidays = value;
    else if (key === KEYS.ATTENDANCE) {
      payload.attendance = value;
      fetch('/api/attendance', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-sync-source': 'internal-sync'
        },
        body: JSON.stringify(value),
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            if (data?.updatedAt) lastKnownServerTime = data.updatedAt;
          }
        })
        .catch(() => {});
    }

    if (Object.keys(payload).length > 0) {
      fetch('/api/db', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-sync-source': 'internal-sync'
        },
        body: JSON.stringify(payload),
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            if (data?.updatedAt) lastKnownServerTime = data.updatedAt;
          }
        })
        .catch(() => {});
    }

    updateSyncState({
      status: 'synced',
      lastSyncedAt: new Date().toISOString(),
      errorMessage: undefined,
    });
    return true;
  } catch (err: any) {
    console.warn(`Could not sync key "${key}" to server, cached locally:`, err);
    updateSyncState({
      status: 'synced',
      lastSyncedAt: new Date().toISOString(),
    });
    return true;
  }
}

// 6. Broadcast helper to trigger instant React component updates with debounce
let broadcastTimer: any = null;
function broadcastLocalUpdate(count: number, source: string) {
  if (typeof window === 'undefined') return;

  if (broadcastTimer) {
    clearTimeout(broadcastTimer);
  }

  broadcastTimer = setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent('absensi-updated', {
        detail: { count, source },
      })
    );
    window.dispatchEvent(
      new CustomEvent('db-synced', {
        detail: { source },
      })
    );
  }, 100);
}

// 7. Multi-browser real-time synchronization manager
let realtimeInitialized = false;

export function initRealtimeSync(): () => void {
  if (typeof window === 'undefined' || realtimeInitialized) {
    return () => {};
  }
  realtimeInitialized = true;

  // Initial check of Supabase tables
  checkSupabaseTables();

  // Initial immediate fetch
  fetchAllFromSupabase();

  let sbDebounceTimer: any = null;
  let sseDebounceTimer: any = null;
  let focusDebounceTimer: any = null;

  // A. Supabase Realtime Channel (Instant multi-device broadcast)
  let sbChannel: any = null;
  if (supabase) {
    try {
      sbChannel = supabase
        .channel('absensi-cloud-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attendance' },
          () => {
            if (sbDebounceTimer) clearTimeout(sbDebounceTimer);
            sbDebounceTimer = setTimeout(() => {
              fetchAllFromSupabase(true);
            }, 1200);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'school' },
          () => {
            if (sbDebounceTimer) clearTimeout(sbDebounceTimer);
            sbDebounceTimer = setTimeout(() => {
              fetchAllFromSupabase(true);
            }, 800);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'teachers' },
          () => {
            if (sbDebounceTimer) clearTimeout(sbDebounceTimer);
            sbDebounceTimer = setTimeout(() => {
              fetchAllFromSupabase(true);
            }, 800);
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Supabase realtime channel warning:', e);
    }
  }

  // B. Server-Sent Events (SSE) listener for backend server
  let eventSource: EventSource | null = null;
  try {
    eventSource = new EventSource('/api/sync/events');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'db_updated') {
          if (sseDebounceTimer) clearTimeout(sseDebounceTimer);
          sseDebounceTimer = setTimeout(() => {
            fetchAllFromSupabase(true);
          }, 1500);
        } else if (data.type === 'connected') {
          if (data.updatedAt) {
            lastKnownServerTime = data.updatedAt;
          }
        }
      } catch (e) {}
    };
  } catch (e) {}

  // C. Heartbeat polling fallback (checks version every 15 seconds, non-intrusive)
  const pollInterval = setInterval(async () => {
    try {
      const res = await fetch('/api/db/version', { cache: 'no-store' });
      if (res.ok) {
        const info = await res.json();
        if (info.updatedAt && info.updatedAt !== lastKnownServerTime) {
          lastKnownServerTime = info.updatedAt;
          fetchAllFromSupabase(true);
        }
      }
    } catch {}
  }, 15000);

  // D. Instant sync on window focus or tab visibility change (debounced)
  const handleFocusOrVisible = () => {
    if (focusDebounceTimer) clearTimeout(focusDebounceTimer);
    focusDebounceTimer = setTimeout(() => {
      fetchAllFromSupabase();
    }, 800);
  };

  window.addEventListener('focus', handleFocusOrVisible);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      handleFocusOrVisible();
    }
  });

  // E. Cross-tab storage listener for the same browser
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key && Object.values(KEYS).includes(e.key)) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('absensi-updated', { detail: { source: 'tab-storage' } }));
        window.dispatchEvent(new CustomEvent('db-synced'));
      }
    }
  };
  window.addEventListener('storage', handleStorageChange);

  return () => {
    if (sbChannel && supabase) {
      supabase.removeChannel(sbChannel);
    }
    if (eventSource) {
      eventSource.close();
    }
    clearInterval(pollInterval);
    window.removeEventListener('focus', handleFocusOrVisible);
    window.removeEventListener('storage', handleStorageChange);
    realtimeInitialized = false;
  };
}
