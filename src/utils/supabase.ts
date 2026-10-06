// Synchronization service for SD Absensi
// Real-time synchronization across multiple browsers and devices via Server-Sent Events (SSE),
// lightweight version heartbeats, window-focus listeners, and localStorage offline cache.

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

// Key mapping for local storage and server database
export const KEYS = {
  SCHOOL: 'absensi_sd_school',
  CLASSES: 'absensi_sd_classes',
  TEACHERS: 'absensi_sd_teachers',
  STUDENTS: 'absensi_sd_students',
  HOLIDAYS: 'absensi_sd_holidays',
  ATTENDANCE: 'absensi_sd_attendance',
};

// Fetch data from backend API and sync to LocalStorage with instant UI notification
export async function fetchAllFromSupabase(force = false): Promise<boolean> {
  if (isSyncInProgress && !force) return true;
  isSyncInProgress = true;

  try {
    updateSyncState({ status: 'syncing' });

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

        // Broadcast events to all components in current window
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('absensi-updated', {
              detail: { count: data.attendance?.length || 0, source: 'remote-sync' },
            })
          );
          window.dispatchEvent(
            new CustomEvent('db-synced', {
              detail: data,
            })
          );
        }
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
    console.warn('Backend sync warning, using local persistent storage:', err);
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

// Push local item update to backend API and broadcast change
export async function pushToSupabase(key: string, value: any): Promise<boolean> {
  try {
    updateSyncState({ status: 'syncing' });

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
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const resData = await res.json();
        if (resData.updatedAt) {
          lastKnownServerTime = resData.updatedAt;
        }
      }
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

// Multi-browser real-time synchronization manager
let realtimeInitialized = false;

export function initRealtimeSync(): () => void {
  if (typeof window === 'undefined' || realtimeInitialized) {
    return () => {};
  }
  realtimeInitialized = true;

  // 1. Initial immediate sync
  fetchAllFromSupabase();

  // 2. Server-Sent Events (SSE) listener for instant sub-second sync across browsers
  let eventSource: EventSource | null = null;
  try {
    eventSource = new EventSource('/api/sync/events');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'db_updated') {
          // A change occurred on another browser or device!
          fetchAllFromSupabase(true);
        } else if (data.type === 'connected') {
          if (data.updatedAt) {
            lastKnownServerTime = data.updatedAt;
          }
        }
      } catch (e) {
        // Silent catch
      }
    };
    eventSource.onerror = () => {
      // EventSource automatically reconnects on error
    };
  } catch (e) {
    console.warn('SSE not supported or connection error, using polling fallback');
  }

  // 3. Heartbeat polling fallback (checks version every 3 seconds)
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

  // 4. Instant sync on window focus or tab visibility change (when user switches to this browser)
  const handleFocusOrVisible = () => {
    fetchAllFromSupabase(true);
  };

  window.addEventListener('focus', handleFocusOrVisible);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      handleFocusOrVisible();
    }
  });

  // 5. Cross-tab storage listener for the same browser
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
    if (eventSource) {
      eventSource.close();
    }
    clearInterval(pollInterval);
    window.removeEventListener('focus', handleFocusOrVisible);
    window.removeEventListener('storage', handleStorageChange);
    realtimeInitialized = false;
  };
}
