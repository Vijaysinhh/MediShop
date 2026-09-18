"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  dispatchSyncEvent,
  flushPendingMutations,
  getPendingSyncCount,
} from "@/lib/offline-sync";

interface OfflineSyncContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: number | null;
  syncNow: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function OfflineSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentShopId } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingSyncCount(currentShopId);
    setPendingCount(count);
  }, [currentShopId]);

  const syncNow = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOnline(false);
      await refreshPendingCount();
      return;
    }

    setIsSyncing(true);
    try {
      const result = await flushPendingMutations();
      setIsOnline(true);
      setPendingCount(result.remaining);
      if (result.synced > 0) {
        setLastSyncedAt(Date.now());
        window.dispatchEvent(new Event("refresh-dukan-data"));
      }
      dispatchSyncEvent();
    } finally {
      setIsSyncing(false);
    }
  }, [refreshPendingCount]);

  const queueBackgroundSync = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.onLine ||
      typeof window === "undefined"
    ) {
      return;
    }
    if (!("serviceWorker" in navigator) || pendingCount <= 0) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const syncManager = (
        registration as ServiceWorkerRegistration & {
          sync?: { register(tag: string): Promise<void> };
        }
      ).sync;
      if (syncManager) {
        await syncManager.register("dukan-sync");
      }
    } catch (error) {
      console.warn("[MediShop] Background sync registration failed:", error);
    }
  }, [pendingCount]);

  useEffect(() => {
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    void refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      void syncNow();
      void queueBackgroundSync();
    };
    const handleOffline = () => setIsOnline(false);
    const handleQueueChange = () => {
      void refreshPendingCount();
      void queueBackgroundSync();
    };
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "DUKAN_SYNC") {
        void syncNow();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("dukan-sync-state-changed", handleQueueChange);
    navigator.serviceWorker?.addEventListener(
      "message",
      handleServiceWorkerMessage,
    );

    const intervalId = window.setInterval(() => {
      if (navigator.onLine) void syncNow();
    }, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("dukan-sync-state-changed", handleQueueChange);
      navigator.serviceWorker?.removeEventListener(
        "message",
        handleServiceWorkerMessage,
      );
      window.clearInterval(intervalId);
    };
  }, [queueBackgroundSync, refreshPendingCount, syncNow]);

  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      void queueBackgroundSync();
    }
  }, [isOnline, pendingCount, queueBackgroundSync]);

  const value = useMemo(
    () => ({ isOnline, isSyncing, pendingCount, lastSyncedAt, syncNow }),
    [isOnline, isSyncing, pendingCount, lastSyncedAt, syncNow],
  );

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error("useOfflineSync must be used within OfflineSyncProvider");
  }
  return context;
}
