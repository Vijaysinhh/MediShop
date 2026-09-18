'use client';

import { Check, CloudOff, RefreshCw } from 'lucide-react';
import { useOfflineSync } from '@/providers/offline-sync-provider';

export function OfflineStatus() {
  const { isOnline, isSyncing, pendingCount, syncNow } = useOfflineSync();

  if (!isOnline) {
    return (
      <div
        className="hidden items-center gap-1.5 text-xs font-medium text-amber-700 sm:flex"
        title="Changes are saved on this device and will sync when internet returns"
        aria-live="polite"
      >
        <CloudOff className="h-4 w-4" />
        <span>Offline{pendingCount > 0 ? ` · ${pendingCount} pending` : ''}</span>
      </div>
    );
  }

  if (isSyncing || pendingCount > 0) {
    return (
      <button
        type="button"
        onClick={() => void syncNow()}
        className="hidden items-center gap-1.5 text-xs font-medium text-blue-700 sm:flex"
        title="Sync saved changes now"
        aria-label="Sync saved changes now"
      >
        <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
        <span>{isSyncing ? 'Syncing…' : `${pendingCount} saved locally`}</span>
      </button>
    );
  }

  return (
    <div
      className="hidden items-center gap-1.5 text-xs font-medium text-green-700 sm:flex"
      title="All changes are synced"
      aria-label="All changes are synced"
    >
      <Check className="h-4 w-4" />
      <span>Synced</span>
    </div>
  );
}

