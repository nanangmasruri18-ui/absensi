import { createClient } from '@supabase/supabase-js';

// Get the credentials provided by the user
const metaEnv = (import.meta as any).env || {};
const SUPABASE_URL = (metaEnv.VITE_SUPABASE_URL || 'https://rdsptjslgnjyzizmioru.supabase.co').replace(/\/rest\/v1\/?$/, '');
const SUPABASE_ANON_KEY = metaEnv.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc3B0anNsZ25qeXppem1pb3J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNDI1MTIsImV4cCI6MjA5NzYxODUxMn0.W-EN15YTa69bqOMtl4ab20XF5XDJs8AotbFX2ZNhwxE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'not_configured';

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt?: string;
  errorMessage?: string;
}

// Global subscribers for sync state updates
const subscribers = new Set<(state: SyncState) => void>();
let currentSyncState: SyncState = { status: 'synced', lastSyncedAt: new Date().toISOString() };

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

// Synchronize all keys from Supabase to LocalStorage
export async function fetchAllFromSupabase(): Promise<boolean> {
  try {
    updateSyncState({ status: 'syncing' });
    const { data, error } = await supabase
      .from('absensi_sync')
      .select('key, value');

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist yet
        throw new Error('Tabel "absensi_sync" belum dibuat di Supabase.');
      }
      throw error;
    }

    if (data && data.length > 0) {
      // Sync from Supabase to localStorage
      data.forEach((row) => {
        localStorage.setItem(row.key, JSON.stringify(row.value));
      });
      console.log('Successfully loaded and synchronized data from Supabase!');
    } else {
      // Supabase has no records, sync existing local state to Supabase
      const keysToSync = [
        'absensi_sd_school',
        'absensi_sd_classes',
        'absensi_sd_teachers',
        'absensi_sd_students',
        'absensi_sd_holidays',
        'absensi_sd_attendance'
      ];
      for (const key of keysToSync) {
        const localValStr = localStorage.getItem(key);
        if (localValStr) {
          try {
            const parsedVal = JSON.parse(localValStr);
            await supabase.from('absensi_sync').upsert({
              key,
              value: parsedVal,
              updated_at: new Date().toISOString()
            });
          } catch (e) {
            console.error(`Failed to push initial local key "${key}" to Supabase:`, e);
          }
        }
      }
      console.log('Initialized empty Supabase space with standard local dataset!');
    }
    updateSyncState({ status: 'synced', lastSyncedAt: new Date().toISOString(), errorMessage: undefined });
    return true;
  } catch (err: any) {
    console.error('Failed to sync from Supabase:', err);
    updateSyncState({ 
      status: 'error', 
      errorMessage: err.message || 'Koneksi database Gagal' 
    });
    return false;
  }
}

// Push local item update to Supabase
export async function pushToSupabase(key: string, value: any): Promise<boolean> {
  try {
    updateSyncState({ status: 'syncing' });
    const { error } = await supabase
      .from('absensi_sync')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString()
      });

    if (error) {
      if (error.code === '42P01') {
        throw new Error('Tabel "absensi_sync" belum dibuat di Supabase.');
      }
      throw error;
    }

    updateSyncState({ status: 'synced', lastSyncedAt: new Date().toISOString(), errorMessage: undefined });
    return true;
  } catch (err: any) {
    console.error(`Failed to push key "${key}" to Supabase:`, err);
    updateSyncState({ 
      status: 'error', 
      errorMessage: err.message || 'Gagal menyimpang ke Supabase' 
    });
    return false;
  }
}
