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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classId: sample.classId,
        date: sample.date,
        records,
      }),
    }).catch(() => {});
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

          // Format school
          if (schoolRes.data && schoolRes.data.length > 0) {
            const row = schoolRes.data[0];
            const schoolObj: SchoolProfile = {
              name: row.name || 'SD Negeri Gelora 01',
              address: row.address || '',
              npsn: row.npsn || '',
              adminName: row.admin_name || '',
            };
            localStorage.setItem(KEYS.SCHOOL, JSON.stringify(schoolObj));
          }

          // Format classes
          if (classesRes.data && classesRes.data.length > 0) {
            const classesObj: ClassRombel[] = classesRes.data.map((r: any) => ({
              id: r.id,
              name: r.name,
              grade: r.grade,
              homeroomTeacherId: r.homeroom_teacher_id || '',
            }));
            localStorage.setItem(KEYS.CLASSES, JSON.stringify(classesObj));
          }

          // Format teachers
          if (teachersRes.data && teachersRes.data.length > 0) {
            const teachersObj: Teacher[] = teachersRes.data.map((r: any) => ({
              id: r.id,
              nip: r.nip || '',
              name: r.name,
              gender: r.gender || 'L',
              username: r.username,
              passwordHash: r.password_hash,
              assignedClassId: r.assigned_class_id || '',
              role: r.role || 'guru',
            }));
            localStorage.setItem(KEYS.TEACHERS, JSON.stringify(teachersObj));
          }

          // Format students
          if (studentsRes.data && studentsRes.data.length > 0) {
            const studentsObj: Student[] = studentsRes.data.map((r: any) => ({
              id: r.id,
              nis: r.nis || '',
              nisn: r.nisn || '',
              name: r.name,
              gender: r.gender || 'L',
              birthPlace: r.birth_place || '',
              birthDate: r.birth_date || '',
              classId: r.class_id,
            }));
            localStorage.setItem(KEYS.STUDENTS, JSON.stringify(studentsObj));
          }

          // Format holidays
          if (holidaysRes.data && holidaysRes.data.length > 0) {
            const holidaysObj: Holiday[] = holidaysRes.data.map((r: any) => ({
              id: r.id,
              date: r.date,
              name: r.name,
            }));
            localStorage.setItem(KEYS.HOLIDAYS, JSON.stringify(holidaysObj));
          }

          // Also sync retrieved Supabase models to local backend /api/db
          try {
            const serverDbPayload: Record<string, any> = {};
            if (schoolRes.data && schoolRes.data.length > 0) serverDbPayload.school = JSON.parse(localStorage.getItem(KEYS.SCHOOL) || '{}');
            if (classesRes.data && classesRes.data.length > 0) serverDbPayload.classes = JSON.parse(localStorage.getItem(KEYS.CLASSES) || '[]');
            if (teachersRes.data && teachersRes.data.length > 0) serverDbPayload.teachers = JSON.parse(localStorage.getItem(KEYS.TEACHERS) || '[]');
            if (studentsRes.data && studentsRes.data.length > 0) serverDbPayload.students = JSON.parse(localStorage.getItem(KEYS.STUDENTS) || '[]');
            if (holidaysRes.data && holidaysRes.data.length > 0) serverDbPayload.holidays = JSON.parse(localStorage.getItem(KEYS.HOLIDAYS) || '[]');
            if (Object.keys(serverDbPayload).length > 0) {
              fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serverDbPayload),
              }).catch(() => {});
            }
          } catch {}

          // Format attendance
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

            // Merge with local records so unsaved offline inputs are not lost
            let localRecords: Attendance[] = [];
            try {
              const raw = localStorage.getItem(KEYS.ATTENDANCE);
              if (raw) localRecords = JSON.parse(raw);
            } catch {}

            const recordMap = new Map<string, Attendance>();
            // Remote records are primary source of truth
            remoteAttendance.forEach((a) => recordMap.set(a.id, a));
            // Keep local records if not present in remote
            localRecords.forEach((a) => {
              if (!recordMap.has(a.id)) {
                recordMap.set(a.id, a);
              }
            });

            const mergedAttendance = Array.from(recordMap.values());
            localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(mergedAttendance));

            // Sync to local server cache as well
            fetch('/api/attendance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mergedAttendance),
            }).catch(() => {});

            // Notify UI
            broadcastLocalUpdate(mergedAttendance.length, 'supabase-cloud');

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
        if (data.school) localStorage.setItem(KEYS.SCHOOL, JSON.stringify(data.school));
        if (data.classes) localStorage.setItem(KEYS.CLASSES, JSON.stringify(data.classes));
        if (data.teachers) localStorage.setItem(KEYS.TEACHERS, JSON.stringify(data.teachers));
        if (data.students) localStorage.setItem(KEYS.STUDENTS, JSON.stringify(data.students));
        if (data.holidays) localStorage.setItem(KEYS.HOLIDAYS, JSON.stringify(data.holidays));
        if (data.attendance) localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(data.attendance));

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
          }));
          await supabase.from('teachers').upsert(rows, { onConflict: 'id' });
        } else if (key === KEYS.SCHOOL && value) {
          await supabase.from('school').upsert({
            id: 'school-1',
            name: value.name,
            address: value.address || '',
            npsn: value.npsn || '',
            admin_name: value.adminName || '',
          });
        } else if (key === KEYS.HOLIDAYS && Array.isArray(value)) {
          const rows = value.map((h: Holiday) => ({
            id: h.id,
            date: h.date,
            name: h.name,
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      }).catch(() => {});
    }

    if (Object.keys(payload).length > 0) {
      fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
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

// 6. Broadcast helper to trigger instant React component updates
function broadcastLocalUpdate(count: number, source: string) {
  if (typeof window !== 'undefined') {
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
  }
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

  // A. Supabase Realtime Channel (Instant multi-device broadcast)
  let sbChannel: any = null;
  if (supabase) {
    try {
      sbChannel = supabase
        .channel('absensi-cloud-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attendance' },
          (payload) => {
            fetchAllFromSupabase(true);
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
          fetchAllFromSupabase(true);
        } else if (data.type === 'connected') {
          if (data.updatedAt) {
            lastKnownServerTime = data.updatedAt;
          }
        }
      } catch (e) {}
    };
  } catch (e) {}

  // C. Heartbeat polling fallback (checks version every 3 seconds)
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
  }, 3000);

  // D. Instant sync on window focus or tab visibility change
  const handleFocusOrVisible = () => {
    fetchAllFromSupabase(true);
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
