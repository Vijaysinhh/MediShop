'use client';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';
const SUPABASE_REQUEST_TIMEOUT_MS = 30000;

export const SUPABASE_UNAVAILABLE_MESSAGE =
  'Unable to reach Supabase. Check the project URL, project status, or network/DNS access.';
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseAnonKey.includes('placeholder'),
);

function createSupabaseUnavailableResponse() {
  return new Response(
    JSON.stringify({
      error: SUPABASE_UNAVAILABLE_MESSAGE,
      error_description: SUPABASE_UNAVAILABLE_MESSAGE,
      message: SUPABASE_UNAVAILABLE_MESSAGE,
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

const supabaseFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT_MS);
  const originalSignal = init?.signal;
  const abortFromOriginalSignal = () => controller.abort();

  if (originalSignal) {
    if (originalSignal.aborted) {
      controller.abort();
    } else {
      originalSignal.addEventListener('abort', abortFromOriginalSignal, { once: true });
    }
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch {
    return createSupabaseUnavailableResponse();
  } finally {
    clearTimeout(timeout);
    originalSignal?.removeEventListener('abort', abortFromOriginalSignal);
  }
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    global: { fetch: supabaseFetch },
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);

export function clearSupabaseAuthStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  Object.keys(window.localStorage)
    .filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
    .forEach((key) => window.localStorage.removeItem(key));
}

export function isSupabaseNetworkError(error: unknown) {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : formatSupabaseError(error);

  return /unable to reach supabase|failed to fetch|fetch failed|networkerror|timed out|abort|authretryablefetcherror|service unavailable|503/i.test(
    text,
  );
}

function formatSupabaseError(error: unknown) {
  try {
    return typeof error === 'object' ? JSON.stringify(error) : String(error);
  } catch {
    return String(error);
  }
}

function isForeignKeyError(error: unknown) {
  return /23503|foreign key/i.test(formatSupabaseError(error));
}

function isRowLevelSecurityError(error: unknown) {
  return /violates row-level security policy|permission denied|42501/i.test(formatSupabaseError(error));
}

function isTableMissingError(error: unknown) {
  return /Could not find the table .* in the schema cache|relation .* does not exist|table .* does not exist|missing relation|PGRST205/i.test(
    formatSupabaseError(error),
  );
}

function isExpectedSyncSkip(error: unknown) {
  return isSupabaseNetworkError(error) || isRowLevelSecurityError(error) || isTableMissingError(error);
}

export async function ensureUserExists(
  userId: string,
  userInfo: { email?: string; shopName?: string } = {},
) {
  const payload: any = {
    id: userId,
    email: userInfo.email || `unknown+${userId}@dukan.local`,
    password_hash: '',
  };

  if (userInfo.shopName) {
    payload.shop_name = userInfo.shopName;
  }

  const { data, error } = await supabase
    .from('users')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    if (isExpectedSyncSkip(error)) {
      console.warn('[v0] Supabase user row sync skipped:', formatSupabaseError(error));
      return null;
    }

    throw error;
  }

  return data;
}

export async function saveUnitToSupabase(userId: string, unit: any) {
  const { data, error } = await supabase
    .from('units')
    .upsert({
      id: unit.id,
      user_id: userId,
      name: unit.name,
      name_marathi: unit.nameMarathi,
      short_form: unit.shortForm,
      description: unit.description || '',
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (isExpectedSyncSkip(error)) {
      console.warn('[v0] Skipping unit sync:', formatSupabaseError(error));
      return null;
    }
    throw error;
  }

  return data || unit;
}

export async function saveCategoryToSupabase(userId: string, category: any) {
  const { data, error } = await supabase
    .from('categories')
    .upsert({
      id: category.id,
      user_id: userId,
      name: category.name,
      name_marathi: category.nameMarathi,
      description: category.description || '',
      color: category.color,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (isExpectedSyncSkip(error)) {
      console.warn('[v0] Skipping category sync:', formatSupabaseError(error));
      return null;
    }
    throw error;
  }

  return data || category;
}

export async function saveItemToSupabase(userId: string, item: any) {
  const { data, error } = await supabase
    .from('items')
    .upsert({
      id: item.id,
      user_id: userId,
      name: item.name,
      name_marathi: item.nameMarathi,
      category_id: item.categoryId,
      base_unit_id: item.unitId,
      unit_id: item.unitId,
      quantity: item.quantity,
      wholesale_cost: item.buyPrice || 0,
      wholesale_quantity: 1,
      buy_price: item.buyPrice || 0,
      sell_price: item.sellPrice || 0,
      low_stock_limit: item.lowStockLimit || 0,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (isExpectedSyncSkip(error)) {
      console.warn('[v0] Skipping item sync:', formatSupabaseError(error));
      return null;
    }
    if (isForeignKeyError(error)) {
      console.error('[v0] Item sync foreign key error:', formatSupabaseError(error));
    }
    throw error;
  }

  return data || item;
}

export async function savePriceTierToSupabase(userId: string, tier: any) {
  const { data, error } = await supabase
    .from('price_tiers')
    .upsert({
      id: tier.id,
      user_id: userId,
      item_id: tier.itemId,
      quantity: tier.quantity,
      unit_id: tier.unitId,
      price: tier.price,
      buy_price: tier.buyPrice || null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (isExpectedSyncSkip(error)) {
      console.warn('[v0] Skipping price tier sync:', formatSupabaseError(error));
      return null;
    }
    throw error;
  }

  return data || tier;
}

export async function saveSaleToSupabase(userId: string, sale: any) {
  const { data, error } = await supabase
    .from('sales')
    .upsert({
      id: sale.id,
      user_id: userId,
      date: sale.date,
      timestamp: sale.timestamp,
      items: sale.items,
      total_quantity_items: sale.totalQuantityItems,
      subtotal: sale.subtotal,
      total_cost: sale.totalCost,
      total_profit: sale.totalProfit,
      profit_margin_percent: sale.profitMarginPercent,
      payment_method: sale.paymentMethod,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (isExpectedSyncSkip(error)) {
      console.warn('[v0] Skipping sale sync:', formatSupabaseError(error));
      return null;
    }
    throw error;
  }

  return data || sale;
}

export async function saveBatchToSupabase(userId: string, batch: any) {
  const { data, error } = await supabase
    .from('batches')
    .upsert({
      id: batch.id,
      user_id: userId,
      item_id: batch.itemId,
      item_name: batch.itemName,
      batch_number: batch.batchNumber,
      purchase_date: batch.purchaseDate,
      expiry_date: batch.expiryDate || null,
      quantity_received: batch.quantityReceived,
      quantity_sold: batch.quantitySold,
      quantity_available: batch.quantityAvailable,
      cost_per_unit: batch.costPerUnit,
      supplier_id: batch.supplierId,
      status: batch.status,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (isExpectedSyncSkip(error)) {
      console.warn('[v0] Skipping batch sync:', formatSupabaseError(error));
      return null;
    }
    throw error;
  }

  return data || batch;
}

export async function saveAlertToSupabase(userId: string, alert: any) {
  const { data, error } = await supabase
    .from('alerts')
    .upsert({
      id: alert.id,
      user_id: userId,
      item_id: alert.itemId,
      item_name: alert.itemName,
      alert_type: alert.alertType,
      message: alert.message,
      severity: alert.severity,
      data: alert.data,
      read: alert.read || false,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (isExpectedSyncSkip(error)) {
      console.warn('[v0] Skipping alert sync:', formatSupabaseError(error));
      return null;
    }
    throw error;
  }

  return data || alert;
}

export async function fetchItemsFromSupabase(userId: string) {
  const { data, error } = await supabase.from('items').select('*').eq('user_id', userId);

  if (error) {
    if (!isSupabaseNetworkError(error)) {
      console.warn('[v0] Error fetching items from Supabase:', formatSupabaseError(error));
    }
    return [];
  }

  return data || [];
}

export async function fetchSalesFromSupabase(userId: string) {
  const { data, error } = await supabase.from('sales').select('*').eq('user_id', userId);

  if (error) {
    if (!isSupabaseNetworkError(error)) {
      console.warn('[v0] Error fetching sales from Supabase:', formatSupabaseError(error));
    }
    return [];
  }

  return data || [];
}

export async function syncToSupabase(
  userId: string,
  userInfo: { email?: string; shopName?: string } = {},
) {
  if (!userId) throw new Error('User ID required');

  const { db } = await import('./db');

  console.log('[v0] Starting full sync to Supabase...');

  const userRow = await ensureUserExists(userId, userInfo);
  if (!userRow) {
    console.warn('[v0] User row sync skipped; continuing local-first sync.');
  }

  const units = await db.units.toArray();
  for (const unit of units) {
    await saveUnitToSupabase(userId, unit).catch((error) => {
      console.warn('[v0] Failed to sync unit:', unit.id, formatSupabaseError(error));
    });
  }

  const categories = await db.categories.toArray();
  for (const category of categories) {
    await saveCategoryToSupabase(userId, category).catch((error) => {
      console.warn('[v0] Failed to sync category:', category.id, formatSupabaseError(error));
    });
  }

  const items = await db.items.toArray();
  for (const item of items) {
    await saveItemToSupabase(userId, item).catch((error) => {
      console.warn('[v0] Failed to sync item:', item.id, formatSupabaseError(error));
    });
  }

  const priceTiers = await db.priceTiers.toArray();
  for (const tier of priceTiers) {
    await savePriceTierToSupabase(userId, tier).catch((error) => {
      console.warn('[v0] Failed to sync price tier:', tier.id, formatSupabaseError(error));
    });
  }

  const sales = await db.sales.toArray();
  for (const sale of sales) {
    await saveSaleToSupabase(userId, sale).catch((error) => {
      console.warn('[v0] Failed to sync sale:', sale.id, formatSupabaseError(error));
    });
  }

  const batches = await db.batches.toArray();
  for (const batch of batches) {
    await saveBatchToSupabase(userId, batch).catch((error) => {
      console.warn('[v0] Failed to sync batch:', batch.id, formatSupabaseError(error));
    });
  }

  const alerts = await db.alerts.toArray();
  for (const alert of alerts) {
    await saveAlertToSupabase(userId, alert).catch((error) => {
      console.warn('[v0] Failed to sync alert:', alert.id, formatSupabaseError(error));
    });
  }

  console.log('[v0] Full sync to Supabase completed');
}

export async function syncUserData(
  userId: string,
  userInfo: { email?: string; shopName?: string } = {},
) {
  await syncToSupabase(userId, userInfo);
}
