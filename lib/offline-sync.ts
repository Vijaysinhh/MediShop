"use client";

import { db, type CloudCacheEntry, type SyncQueueEntry } from "@/lib/db";

const OFFLINE_ID_KEY = "dukan-next-offline-id";
const NETWORK_ERROR_PATTERN =
  /failed to fetch|fetch failed|networkerror|network request failed|timed out|abort|service unavailable|503|offline/i;

export function isBrowserOnline() {
  return typeof navigator === "undefined" || navigator.onLine;
}

export function isOfflineError(error: unknown) {
  if (!isBrowserOnline()) return true;
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return NETWORK_ERROR_PATTERN.test(message);
}

function cacheKey(shopId: number, table: string) {
  return `${shopId}:${table}`;
}

function getLocalTableName(table: string) {
  const normalized = table.toLowerCase();
  const tableMap: Record<string, string> = {
    appsettings: "appSettings",
    price_tiers: "priceTiers",
    sale_items: "saleItems",
    stock_history: "stockHistory",
    credit_customers: "creditCustomers",
    credit_entries: "creditEntries",
    shop_payment_info: "shopPaymentInfo",
    syncqueue: "syncQueue",
    cloudcache: "cloudCache",
  };
  return tableMap[normalized] || normalized;
}

async function ensureDatabase() {
  if (!db.isOpen()) await db.open();
}

async function readLocalTableRows(shopId: number, table: string) {
  await ensureDatabase();
  const localTableName = getLocalTableName(table);
  const localTable = (db as unknown as Record<string, unknown>)[
    localTableName
  ] as { toArray?: () => Promise<Record<string, unknown>[]> } | undefined;
  if (
    !localTable ||
    typeof localTable !== "object" ||
    typeof localTable.toArray !== "function"
  ) {
    return [] as Record<string, unknown>[];
  }

  const rows = await localTable.toArray();
  return rows.filter((row) => {
    const rowShopId =
      (row as Record<string, unknown>).shop_id ??
      (row as Record<string, unknown>).shopId;
    if (rowShopId === undefined || rowShopId === null) return true;
    return Number(rowShopId) === Number(shopId);
  });
}

export async function readCachedCollection<T = Record<string, unknown>>(
  shopId: number,
  table: string,
) {
  await ensureDatabase();
  const entry = await db.cloudCache.get(cacheKey(shopId, table));
  if (entry?.rows?.length) {
    return entry.rows as T[];
  }

  const localRows = await readLocalTableRows(shopId, table);
  return (localRows || []) as T[];
}

export async function writeCachedCollection(
  shopId: number,
  table: string,
  rows: Record<string, unknown>[],
) {
  await ensureDatabase();
  const entry: CloudCacheEntry = {
    key: cacheKey(shopId, table),
    shopId,
    table,
    rows: JSON.parse(JSON.stringify(rows)),
    updatedAt: Date.now(),
  };
  await db.cloudCache.put(entry);

  const localTableName = getLocalTableName(table);
  const localTable = (db as unknown as Record<string, unknown>)[
    localTableName
  ] as
    | {
        clear?: () => Promise<void>;
        bulkPut?: (rows: Record<string, unknown>[]) => Promise<unknown>;
      }
    | undefined;
  if (localTable && typeof localTable === "object") {
    const clearMethod = localTable.clear;
    const bulkPutMethod = localTable.bulkPut;
    if (
      typeof clearMethod === "function" &&
      typeof bulkPutMethod === "function"
    ) {
      await clearMethod.call(localTable);
      if (rows.length > 0) {
        await bulkPutMethod.call(localTable, JSON.parse(JSON.stringify(rows)));
      }
    }
  }
}

export async function upsertCachedRow(
  shopId: number,
  table: string,
  row: Record<string, unknown>,
) {
  const rows = await readCachedCollection(shopId, table);
  const rowId = row.id;
  const nextRows =
    rowId === undefined || rowId === null
      ? [...rows, row]
      : rows.some((current) => current.id === rowId)
        ? rows.map((current) =>
            current.id === rowId ? { ...current, ...row } : current,
          )
        : [...rows, row];
  await writeCachedCollection(shopId, table, nextRows);
}

export async function removeCachedRow(
  shopId: number,
  table: string,
  id: number,
) {
  const rows = await readCachedCollection(shopId, table);
  await writeCachedCollection(
    shopId,
    table,
    rows.filter((row) => Number(row.id) !== id),
  );
}

export function createOfflineId() {
  if (typeof window === "undefined") return -Date.now();
  const current = Number(window.localStorage.getItem(OFFLINE_ID_KEY) || "-1");
  const next = Number.isFinite(current) && current < 0 ? current : -1;
  window.localStorage.setItem(OFFLINE_ID_KEY, String(next - 1));
  return next;
}

export async function queueUpsert(
  shopId: number,
  table: string,
  row: Record<string, unknown>,
) {
  const entry: SyncQueueEntry = {
    shopId,
    table,
    operation: "upsert",
    row: JSON.parse(JSON.stringify(row)),
    createdAt: Date.now(),
    attempts: 0,
  };
  await db.syncQueue.add(entry);
  await upsertCachedRow(shopId, table, row);
  dispatchSyncEvent();
}

export async function queueDelete(shopId: number, table: string, id: number) {
  const entry: SyncQueueEntry = {
    shopId,
    table,
    operation: "delete",
    matchId: id,
    createdAt: Date.now(),
    attempts: 0,
  };
  await db.syncQueue.add(entry);
  await removeCachedRow(shopId, table, id);
  dispatchSyncEvent();
}

export async function getPendingSyncCount(shopId?: number) {
  await ensureDatabase();
  if (!shopId) return db.syncQueue.count();
  return db.syncQueue.where("shopId").equals(shopId).count();
}

export async function executeWithOfflineUpsert<T>(options: {
  shopId: number;
  table: string;
  row: Record<string, unknown>;
  request: () => Promise<T>;
}) {
  const { shopId, table, row, request } = options;
  await ensureDatabase();

  if (!isBrowserOnline()) {
    await queueUpsert(shopId, table, row);
    return { data: row as T, queued: true };
  }

  try {
    const data = await request();
    await upsertCachedRow(
      shopId,
      table,
      (data || row) as Record<string, unknown>,
    );
    return { data, queued: false };
  } catch (error) {
    if (!isOfflineError(error)) throw error;
    await queueUpsert(shopId, table, row);
    return { data: row as T, queued: true };
  }
}

export async function executeWithOfflineDelete(options: {
  shopId: number;
  table: string;
  id: number;
  request: () => Promise<unknown>;
}) {
  const { shopId, table, id, request } = options;
  await ensureDatabase();

  if (!isBrowserOnline()) {
    await queueDelete(shopId, table, id);
    return { queued: true };
  }

  try {
    await request();
    await removeCachedRow(shopId, table, id);
    return { queued: false };
  } catch (error) {
    if (!isOfflineError(error)) throw error;
    await queueDelete(shopId, table, id);
    return { queued: true };
  }
}

export async function flushPendingMutations() {
  await ensureDatabase();
  if (!isBrowserOnline())
    return { synced: 0, remaining: await getPendingSyncCount() };

  const { createClient } = await import("@/lib/supabase");
  const supabase = createClient();
  const entries = await db.syncQueue.orderBy("createdAt").toArray();
  let synced = 0;

  for (const entry of entries) {
    try {
      if (entry.operation === "upsert" && entry.row) {
        const { error } = await (supabase as any)
          .from(entry.table)
          .upsert(entry.row, { onConflict: "id" });
        if (error) throw error;
      } else if (entry.operation === "delete" && entry.matchId !== undefined) {
        const { error } = await (supabase as any)
          .from(entry.table)
          .delete()
          .eq("id", entry.matchId);
        if (error) throw error;
      }

      if (entry.id !== undefined) await db.syncQueue.delete(entry.id);
      synced += 1;
    } catch (error) {
      if (entry.id !== undefined) {
        await db.syncQueue.update(entry.id, {
          attempts: (entry.attempts || 0) + 1,
          lastError: error instanceof Error ? error.message : String(error),
        });
      }
      // Preserve queue order so dependent offline rows (sale -> sale items)
      // are replayed in the same order they were created.
      break;
    }
  }

  dispatchSyncEvent();
  return { synced, remaining: await getPendingSyncCount() };
}

export function dispatchSyncEvent() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("dukan-sync-state-changed"));
  }
}
