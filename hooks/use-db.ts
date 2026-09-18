'use client';

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  type Item,
  type Category,
  type Unit,
  type PriceTier,
  type Sale,
  type SaleItem,
  type StockHistory,
  type Batch,
  type Alert,
  type CreditCustomer,
  type CreditEntry,
  type CreditBillItem,
} from '@/lib/db';
import { dateKey } from '@/lib/utils';

// Categories Hook
export function useCategories() {
  const categories = useLiveQuery(() => db.categories.toArray());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (categories !== undefined) {
      setIsLoading(false);
    }
  }, [categories]);

  const addCategory = async (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    return db.categories.add({
      ...category,
      createdAt: now,
      updatedAt: now,
    });
  };

  const updateCategory = async (id: number, updates: Partial<Omit<Category, 'id' | 'createdAt'>>) => {
    return db.categories.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  };

  const deleteCategory = async (id: number) => {
    return db.categories.delete(id);
  };

  return {
    categories: categories || [],
    isLoading,
    addCategory,
    updateCategory,
    deleteCategory,
  };
}

// Units Hook
export function useUnits() {
  const units = useLiveQuery(() => db.units.toArray());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (units !== undefined) {
      setIsLoading(false);
    }
  }, [units]);

  const addUnit = async (unit: Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    return db.units.add({
      ...unit,
      createdAt: now,
      updatedAt: now,
    });
  };

  const updateUnit = async (id: number, updates: Partial<Omit<Unit, 'id' | 'createdAt'>>) => {
    return db.units.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  };

  const deleteUnit = async (id: number) => {
    return db.units.delete(id);
  };

  return {
    units: units || [],
    isLoading,
    addUnit,
    updateUnit,
    deleteUnit,
  };
}

// Items Hook
export function useItems() {
  const items = useLiveQuery(() => db.items.toArray());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (items !== undefined) {
      setIsLoading(false);
    }
  }, [items]);

  const addItem = async (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'marginAmount' | 'marginPercent'>) => {
    const now = Date.now();
    const marginAmount = item.sellPrice - item.buyPrice;
    const marginPercent = item.buyPrice > 0 ? (marginAmount / item.buyPrice) * 100 : 0;

    return db.items.add({
      ...item,
      marginAmount,
      marginPercent,
      createdAt: now,
      updatedAt: now,
    });
  };

  const updateItem = async (
    id: number,
    updates: Partial<Omit<Item, 'id' | 'createdAt' | 'marginAmount' | 'marginPercent'>>
  ) => {
    let updateData: any = {
      ...updates,
      updatedAt: Date.now(),
    };

    // Recalculate margins if prices changed
    if (updates.buyPrice !== undefined || updates.sellPrice !== undefined) {
      const existingItem = await db.items.get(id);
      if (existingItem) {
        const buyPrice = updates.buyPrice ?? existingItem.buyPrice;
        const sellPrice = updates.sellPrice ?? existingItem.sellPrice;
        const marginAmount = sellPrice - buyPrice;
        const marginPercent = buyPrice > 0 ? (marginAmount / buyPrice) * 100 : 0;

        updateData = {
          ...updateData,
          marginAmount,
          marginPercent,
        };
      }
    }

    return db.items.update(id, updateData);
  };

  const deleteItem = async (id: number) => {
    return db.items.delete(id);
  };

  const getItemsByCategory = async (categoryId: number) => {
    return db.items.where('categoryId').equals(categoryId).toArray();
  };

  const getLowStockItems = async () => {
    const allItems = await db.items.toArray();
    return allItems.filter((item) => item.quantity <= item.lowStockLimit);
  };

  return {
    items: items || [],
    isLoading,
    addItem,
    updateItem,
    deleteItem,
    getItemsByCategory,
    getLowStockItems,
  };
}

// Dashboard Statistics Hook
export function useDashboardStats() {
  const items = useLiveQuery(() => db.items.toArray());

  const stats = {
    totalItems: items?.length || 0,
    lowStockCount: items?.filter((item) => item.quantity <= item.lowStockLimit).length || 0,
    totalValue: items?.reduce((sum, item) => sum + item.quantity * item.buyPrice, 0) || 0,
    avgMargin:
      items && items.length > 0
        ? items.reduce((sum, item) => sum + (item.marginPercent || 0), 0) / items.length
        : 0,
  };

  return stats;
}

// Price Tiers Hook
export function usePriceTiers(itemId?: number) {
  const priceTiers = useLiveQuery(
    () => (itemId ? db.priceTiers.where('itemId').equals(itemId).toArray() : db.priceTiers.toArray()),
    [itemId]
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (priceTiers !== undefined) {
      setIsLoading(false);
    }
  }, [priceTiers]);

  const addPriceTier = async (tier: Omit<PriceTier, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    return db.priceTiers.add({
      ...tier,
      createdAt: now,
      updatedAt: now,
    });
  };

  const updatePriceTier = async (id: number, updates: Partial<Omit<PriceTier, 'id' | 'createdAt'>>) => {
    return db.priceTiers.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  };

  const deletePriceTier = async (id: number) => {
    return db.priceTiers.delete(id);
  };

  const getPriceTiersByItem = async (itemId: number) => {
    return db.priceTiers.where('itemId').equals(itemId).toArray();
  };

  return {
    priceTiers: priceTiers || [],
    isLoading,
    addPriceTier,
    updatePriceTier,
    deletePriceTier,
    getPriceTiersByItem,
  };
}

// Sales Hook - Record and retrieve daily sales
export function useSales() {
  const sales = useLiveQuery(() => db.sales.toArray());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (sales !== undefined) {
      setIsLoading(false);
    }
  }, [sales]);

  const createSale = async (sale: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    return db.sales.add({
      ...sale,
      createdAt: now,
      updatedAt: now,
    });
  };

  const getSalesByDate = async (date: string) => {
    // date format: YYYY-MM-DD
    return db.sales.where('date').equals(date).toArray();
  };

  const getTodaySales = async () => {
    const today = dateKey(new Date());
    return db.sales.where('date').equals(today).toArray();
  };

  const getDailySummary = async (date: string) => {
    const sales = await getSalesByDate(date);
    return {
      date,
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum, s) => sum + s.subtotal, 0),
      totalCost: sales.reduce((sum, s) => sum + s.totalCost, 0),
      totalProfit: sales.reduce((sum, s) => sum + s.totalProfit, 0),
      profitMarginPercent:
        sales.length > 0
          ? (sales.reduce((sum, s) => sum + s.totalProfit, 0) /
              sales.reduce((sum, s) => sum + s.subtotal, 0)) *
            100
          : 0,
      sales,
    };
  };

  const deleteSale = async (saleId: number) => {
    await db.saleItems.where('saleId').equals(saleId).delete();
    return db.sales.delete(saleId);
  };

  const updateStockAfterSale = async (saleItems: SaleItem[]) => {
    for (const saleItem of saleItems) {
      const item = await db.items.get(saleItem.itemId);
      if (item) {
        const newQuantity = item.quantity - saleItem.quantity;
        await db.items.update(saleItem.itemId, { quantity: newQuantity });
      }
    }
  };

  return {
    sales: sales || [],
    isLoading,
    createSale,
    getSalesByDate,
    getTodaySales,
    getDailySummary,
    deleteSale,
    updateStockAfterSale,
  };
}

// Stock History Hook - Track all stock changes
export function useStockHistory() {
  const history = useLiveQuery(() => db.stockHistory.toArray());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (history !== undefined) {
      setIsLoading(false);
    }
  }, [history]);

  const addStockHistory = async (entry: Omit<StockHistory, 'id'>) => {
    return db.stockHistory.add(entry);
  };

  const getItemHistory = async (itemId: number) => {
    return db.stockHistory.where('itemId').equals(itemId).toArray();
  };

  const getRecentHistory = async (days: number = 30) => {
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    return db.stockHistory.where('createdAt').above(cutoffTime).toArray();
  };

  return {
    history: history || [],
    isLoading,
    addStockHistory,
    getItemHistory,
    getRecentHistory,
  };
}

// Batch Tracking Hook - Track inventory batches/lots
export function useBatches() {
  const batches = useLiveQuery(() => db.batches.toArray());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (batches !== undefined) {
      setIsLoading(false);
    }
  }, [batches]);

  const createBatch = async (batch: Omit<Batch, 'id'>) => {
    return db.batches.add(batch);
  };

  const getItemBatches = async (itemId: number) => {
    return db.batches.where('itemId').equals(itemId).toArray();
  };

  const getExpiringBatches = async (daysUntilExpiry: number = 7) => {
    const cutoffTime = Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000;
    return db.batches.where('expiryDate').below(cutoffTime).toArray();
  };

  const getExpiredBatches = async () => {
    return db.batches.where('expiryDate').below(Date.now()).toArray();
  };

  const updateBatchSold = async (batchId: number, quantitySold: number) => {
    const batch = await db.batches.get(batchId);
    if (batch) {
      const quantityAvailable = batch.quantityReceived - quantitySold;
      return db.batches.update(batchId, {
        quantitySold,
        quantityAvailable,
        status: quantityAvailable <= 0 ? 'expired' : batch.status,
      });
    }
  };

  const deleteBatch = async (batchId: number) => {
    return db.batches.delete(batchId);
  };

  return {
    batches: batches || [],
    isLoading,
    createBatch,
    getItemBatches,
    getExpiringBatches,
    getExpiredBatches,
    updateBatchSold,
    deleteBatch,
  };
}

// Alerts Hook - Smart notifications
export function useAlerts() {
  const alerts = useLiveQuery(() => db.alerts.toArray());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (alerts !== undefined) {
      setIsLoading(false);
    }
  }, [alerts]);

  const createAlert = async () => {
    console.warn('[v0] Alerts disabled - use Supabase alerts in future version');
  };

  const getUnreadAlerts = async () => {
    return [];
  };

  const markAlertAsRead = async () => {
    return 0;
  };

  const deleteAlert = async () => {
    return 0;
  };

  const clearOldAlerts = async () => {
    return null;
  };

  return {
    alerts: alerts || [],
    isLoading,
    createAlert,
    getUnreadAlerts,
    markAlertAsRead,
    deleteAlert,
    clearOldAlerts,
  };
}

// Udhari Hook - Customer credit notebook
export function useUdhari() {
  const customers = useLiveQuery(() => db.creditCustomers.orderBy('updatedAt').reverse().toArray());
  const entries = useLiveQuery(() => db.creditEntries.orderBy('timestamp').reverse().toArray());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (customers !== undefined && entries !== undefined) {
      setIsLoading(false);
    }
  }, [customers, entries]);

  const addCustomer = async (customer: Omit<CreditCustomer, 'id' | 'balance' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    return db.creditCustomers.add({
      ...customer,
      balance: 0,
      createdAt: now,
      updatedAt: now,
    });
  };

  const updateCustomer = async (
    id: number,
    updates: Partial<Omit<CreditCustomer, 'id' | 'createdAt' | 'balance'>>,
  ) => {
    return db.creditCustomers.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  };

  const deleteCustomer = async (id: number) => {
    return db.transaction('rw', db.creditCustomers, db.creditEntries, async () => {
      await db.creditEntries.where('customerId').equals(id).delete();
      await db.creditCustomers.delete(id);
    });
  };

  const addCredit = async (
    customerId: number,
    amount: number,
    note?: string,
    billItems?: CreditBillItem[],
    saleId?: number,
  ) => {
    const customer = await db.creditCustomers.get(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const now = Date.now();
    const date = dateKey(new Date());

    return db.transaction('rw', db.creditCustomers, db.creditEntries, async () => {
      await db.creditEntries.add({
        customerId,
        customerName: customer.name,
        type: 'credit',
        amount,
        note,
        saleId,
        billItems,
        date,
        timestamp: now,
        createdAt: now,
      });

      await db.creditCustomers.update(customerId, {
        balance: customer.balance + amount,
        updatedAt: now,
      });
    });
  };

  const receivePayment = async (customerId: number, amount: number, note?: string) => {
    const customer = await db.creditCustomers.get(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const now = Date.now();
    const date = dateKey(new Date());

    return db.transaction('rw', db.creditCustomers, db.creditEntries, async () => {
      await db.creditEntries.add({
        customerId,
        customerName: customer.name,
        type: 'payment',
        amount,
        note,
        date,
        timestamp: now,
        createdAt: now,
      });

      await db.creditCustomers.update(customerId, {
        balance: Math.max(0, customer.balance - amount),
        updatedAt: now,
      });
    });
  };

  const getCustomerEntries = (customerId: number) => {
    return (entries || []).filter((entry) => entry.customerId === customerId);
  };

  const totalPending = (customers || []).reduce((sum, customer) => sum + customer.balance, 0);

  return {
    customers: customers || [],
    entries: entries || [],
    isLoading,
    totalPending,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addCredit,
    receivePayment,
    getCustomerEntries,
  };
}
