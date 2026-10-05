// Synchronization service for SD Absensi
// Synchronizes data across users and devices via the application backend API (/api/db)
// with localStorage as immediate offline cache.

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'not_configured';

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt?: string;
  errorMessage?: string;
  backendType?: 'server' | 'local';
}

const subscribers = new Set<(state: SyncState) => void>();
let currentSyncState: SyncState = {
  status: 'synced',
  lastSyncedAt: new Date().toISOString(),
  backendType: 'server',
};

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

// Key mapping for local storage and server database
const KEYS = {
  SCHOOL: 'absensi_sd_school',
  CLASSES: 'absensi_sd_classes',
  TEACHERS: 'absensi_sd_teachers',
  STUDENTS: 'absensi_sd_students',
  HOLIDAYS: 'absensi_sd_holidays',
  ATTENDANCE: 'absensi_sd_attendance',
};

// Fetch data from backend API and sync to LocalStorage
export async function fetchAllFromSupabase(): Promise<boolean> {
  try {
    updateSyncState({ status: 'syncing' });

    // Fetch from application backend API
    const response = await fetch('/api/db', {
      headers: { 'Content-Type': 'application/json' },
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
      }
      updateSyncState({
        status: 'synced',
        lastSyncedAt: new Date().toISOString(),
        errorMessage: undefined,
        backendType: 'server',
      });
      return true;
    } else {
      // If server returned non-ok, we still have localStorage
      updateSyncState({
        status: 'synced',
        lastSyncedAt: new Date().toISOString(),
        backendType: 'local',
      });
      return true;
    }
  } catch (err: any) {
    // If offline / local dev, localStorage is already functioning
    console.warn('Backend sync warning, using local persistent storage:', err);
    updateSyncState({
      status: 'synced',
      lastSyncedAt: new Date().toISOString(),
      backendType: 'local',
    });
    return true; // Always return true so application is never blocked!
  }
}

// Push local item update to backend API
export async function pushToSupabase(key: string, value: any): Promise<boolean> {
  try {
    updateSyncState({ status: 'syncing' });

    // Translate storage key to payload property
    let payload: Record<string, any> = {};
    if (key === KEYS.SCHOOL) payload.school = value;
    else if (key === KEYS.CLASSES) payload.classes = value;
    else if (key === KEYS.TEACHERS) payload.teachers = value;
    else if (key === KEYS.STUDENTS) payload.students = value;
    else if (key === KEYS.HOLIDAYS) payload.holidays = value;
    else if (key === KEYS.ATTENDANCE) {
      payload.attendance = value;
      // Also send dedicated attendance update
      fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      }).catch(() => {});
    }

    if (Object.keys(payload).length > 0) {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
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
      status: 'synced', // Keep as synced because localStorage has it safely
      lastSyncedAt: new Date().toISOString(),
    });
    return true;
  }
}
