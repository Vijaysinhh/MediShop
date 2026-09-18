'use client';

import Dexie, { type Table } from 'dexie';

export interface PriceTier {
  id?: number;
  itemId: number;
  quantity: number; // e.g., 50, 100, 250, 500
  unitId: number;
  price: number; // Retail price for this tier
  createdAt: number;
  updatedAt: number;
}

export interface Item {
  id?: number;
  name: string;
  nameMarathi: string;
  brand?: string;
  brandMarathi?: string;
  categoryId: number;
  unitId: number;
  quantity: number;
  expiryDate?: string | number | null;
  buyPrice: number; // Buy price per unit
  sellPrice: number; // Sell price per unit
  marginAmount?: number; // Auto-calculated: sellPrice - buyPrice
  marginPercent?: number; // Auto-calculated: (marginAmount / buyPrice) * 100
  lowStockLimit: number; // User-defined limit
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id?: number;
  name: string;
  nameMarathi: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Unit {
  id?: number;
  name: string;
  nameMarathi: string;
  shortForm: string; // kg, g, l, ml, pcs, dozen, packet, box
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  id?: number;
  language: 'en' | 'mr'; // en = English, mr = Marathi
  theme: 'light' | 'dark' | 'system';
  setupComplete: boolean;
  lastBackup?: number;
  updatedAt: number;
}

export interface SaleItem {
  id?: number;
  saleId: number;
  itemId: number;
  itemName: string;
  /** Total quantity in item's stock unit (for inventory math). */
  quantity: number;
  /** How the sale was shown at checkout, e.g. "2 x 200 g". */
  displayQuantity?: string;
  unitId: number;
  unitShortForm: string;
  priceTierId?: number; // Which price tier was used
  packCount?: number;
  priceTierQuantity?: number;
  priceTierUnitShortForm?: string;
  pricePerUnit: number; // Actual selling price used
  totalPrice: number; // quantity * pricePerUnit
  costPerUnit: number; // For profit calculation
  totalCost: number; // quantity * costPerUnit
  profit: number; // totalPrice - totalCost
  createdAt: number;
}

export interface StockHistory {
  id?: number;
  itemId: number;
  itemName: string;
  type: 'purchase' | 'sale' | 'adjustment' | 'damage' | 'expiry'; // Type of stock change
  quantityChanged: number; // Positive or negative
  quantityBefore: number; // Stock before change
  quantityAfter: number; // Stock after change
  reason?: string; // Explanation for adjustment
  costPerUnit?: number; // Cost at time of transaction
  reference?: string; // Sale ID or purchase order number
  createdAt: number;
}

export interface Batch {
  id?: number;
  itemId: number;
  itemName: string;
  batchNumber?: string; // Batch/Lot number from supplier
  purchaseDate: number; // When purchased
  expiryDate?: number; // When it expires
  quantityReceived: number; // Original quantity
  quantitySold: number; // How much sold so far
  quantityAvailable: number; // quantityReceived - quantitySold
  costPerUnit: number; // Cost when purchased
  supplierId?: string; // Which supplier
  status: 'active' | 'expiring' | 'expired'; // Status
  createdAt: number;
  updatedAt: number;
}

export interface Alert {
  id?: number;
  itemId: number;
  itemName: string;
  alertType: 'low_stock' | 'expiring' | 'slow_moving' | 'expired'; // Type of alert
  message: string; // Alert message
  severity: 'info' | 'warning' | 'critical'; // Alert level
  data?: any; // Additional data (quantity, days until expiry, etc)
  read: boolean; // Has user seen this?
  createdAt: number;
}

// New Types for Multi-Role System & Subscription
export interface Shop {
  id?: number;
  ownerName: string;
  shopName: string;
  address: string;
  phoneNumber: string;
  password: string; // Shop owner password
  isPaused: boolean;
  subscriptionEndDate?: number; // Unix timestamp of when subscription ends
  lastPaymentDate?: number; // Last payment date
  createdAt: number;
  updatedAt: number;
}

export interface Subscription {
  id?: number;
  shopId: number;
  amount: number; // Should be 299
  startDate: number; // Unix timestamp
  endDate: number; // Unix timestamp (1 month later)
  paymentMethod: string; // 'upi', 'cash', 'card', etc.
  transactionId?: string; // UPI transaction ID
  status: 'active' | 'pending' | 'failed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
}

export interface ShopPaymentInfo {
  id?: number;
  shopId: number;
  upiId?: string;
  qrCodeUrl?: string;
  phonePe?: string;
  gPay?: string;
  paytm?: string;
  createdAt: number;
  updatedAt: number;
}

export interface User {
  id?: number;
  shopId: number; // Which shop does this user belong to?
  username: string;
  password: string;
  role: 'super_admin' | 'owner' | 'worker';
  createdAt: number;
  updatedAt: number;
}

export interface Sale {
  id?: number;
  date: string; // YYYY-MM-DD format
  timestamp: number; // Unix timestamp
  items: (Omit<SaleItem, 'saleId'> & { saleId?: number })[]; // Array of items sold (saleId optional for new sales)
  totalQuantityItems: number; // Count of item types
  subtotal: number; // Sum of all item prices
  totalCost: number; // Sum of all item costs
  totalProfit: number; // subtotal - totalCost
  profitMarginPercent: number; // (totalProfit / subtotal) * 100
  paymentMethod: 'cash' | 'card' | 'partial' | 'udhar'; // How they paid
  paidAmount?: number;
  dueAmount?: number;
  paidVia?: 'cash' | 'card';
  creditCustomerId?: number; // Customer when all or part of the bill is on credit
  creditCustomerName?: string;
  notes?: string; // Optional notes
  createdAt: number;
  updatedAt: number;
}

export interface CreditCustomer {
  id?: number;
  name: string;
  phone?: string;
  balance: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreditBillItem {
  itemName: string;
  quantity: number;
  displayQuantity?: string;
  unitShortForm: string;
  pricePerUnit: number;
  totalPrice: number;
  priceTierId?: number;
  packCount?: number;
  priceTierQuantity?: number;
  priceTierUnitShortForm?: string;
}

export interface CreditEntry {
  id?: number;
  customerId: number;
  customerName: string;
  type: 'credit' | 'payment';
  amount: number;
  note?: string;
  saleId?: number;
  billItems?: CreditBillItem[];
  date: string;
  timestamp: number;
  createdAt: number;
}

export type OfflineSyncOperation = 'upsert' | 'delete';

export interface SyncQueueEntry {
  id?: number;
  shopId: number;
  table: string;
  operation: OfflineSyncOperation;
  row?: Record<string, unknown>;
  matchId?: number;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

export interface CloudCacheEntry {
  key: string;
  shopId: number;
  table: string;
  rows: Record<string, unknown>[];
  updatedAt: number;
}

export class DukanDB extends Dexie {
  items!: Table<Item>;
  priceTiers!: Table<PriceTier>;
  categories!: Table<Category>;
  units!: Table<Unit>;
  appSettings!: Table<AppSettings>;
  sales!: Table<Sale>;
  saleItems!: Table<SaleItem>;
  stockHistory!: Table<StockHistory>;
  batches!: Table<Batch>;
  alerts!: Table<Alert>;
  creditCustomers!: Table<CreditCustomer>;
  creditEntries!: Table<CreditEntry>;
  // New tables for multi-role system
  shops!: Table<Shop>;
  users!: Table<User>;
  // New tables for subscription system
  subscriptions!: Table<Subscription>;
  shopPaymentInfo!: Table<ShopPaymentInfo>;
  syncQueue!: Table<SyncQueueEntry>;
  cloudCache!: Table<CloudCacheEntry>;

  constructor() {
    super('DukanDB');
    this.version(1).stores({
      items: '++id, categoryId, updatedAt',
      priceTiers: '++id, itemId, updatedAt',
      categories: '++id, updatedAt',
      units: '++id, updatedAt',
      appSettings: '++id',
      sales: '++id, date, timestamp',
      saleItems: '++id, saleId, itemId',
      stockHistory: '++id, itemId, createdAt',
      batches: '++id, itemId, expiryDate',
      alerts: '++id, itemId, alertType, createdAt',
    });
    this.version(2).stores({
      items: '++id, categoryId, updatedAt',
      priceTiers: '++id, itemId, updatedAt',
      categories: '++id, updatedAt',
      units: '++id, updatedAt',
      appSettings: '++id',
      sales: '++id, date, timestamp',
      saleItems: '++id, saleId, itemId',
      stockHistory: '++id, itemId, createdAt',
      batches: '++id, itemId, expiryDate',
      alerts: '++id, itemId, alertType, createdAt',
      creditCustomers: '++id, name, updatedAt',
      creditEntries: '++id, customerId, date, timestamp',
    });
    // New version with shops and users tables
    this.version(3).stores({
      items: '++id, categoryId, updatedAt',
      priceTiers: '++id, itemId, updatedAt',
      categories: '++id, updatedAt',
      units: '++id, updatedAt',
      appSettings: '++id',
      sales: '++id, date, timestamp',
      saleItems: '++id, saleId, itemId',
      stockHistory: '++id, itemId, createdAt',
      batches: '++id, itemId, expiryDate',
      alerts: '++id, itemId, alertType, createdAt',
      creditCustomers: '++id, name, updatedAt',
      creditEntries: '++id, customerId, date, timestamp',
      shops: '++id, shopName, ownerName, isPaused, subscriptionEndDate, updatedAt',
      users: '++id, shopId, username, role, updatedAt',
    });
    // New version with subscription tables
    this.version(4).stores({
      items: '++id, categoryId, updatedAt',
      priceTiers: '++id, itemId, updatedAt',
      categories: '++id, updatedAt',
      units: '++id, updatedAt',
      appSettings: '++id',
      sales: '++id, date, timestamp',
      saleItems: '++id, saleId, itemId',
      stockHistory: '++id, itemId, createdAt',
      batches: '++id, itemId, expiryDate',
      alerts: '++id, itemId, alertType, createdAt',
      creditCustomers: '++id, name, updatedAt',
      creditEntries: '++id, customerId, date, timestamp',
      shops: '++id, shopName, ownerName, isPaused, subscriptionEndDate, updatedAt',
      users: '++id, shopId, username, role, updatedAt',
      subscriptions: '++id, shopId, status, startDate, endDate, updatedAt',
      shopPaymentInfo: '++id, shopId, updatedAt',
    });
    // Local-first cloud snapshots and mutations waiting for connectivity.
    this.version(5).stores({
      items: '++id, categoryId, updatedAt',
      priceTiers: '++id, itemId, updatedAt',
      categories: '++id, updatedAt',
      units: '++id, updatedAt',
      appSettings: '++id',
      sales: '++id, date, timestamp',
      saleItems: '++id, saleId, itemId',
      stockHistory: '++id, itemId, createdAt',
      batches: '++id, itemId, expiryDate',
      alerts: '++id, itemId, alertType, createdAt',
      creditCustomers: '++id, name, updatedAt',
      creditEntries: '++id, customerId, date, timestamp',
      shops: '++id, shopName, ownerName, isPaused, subscriptionEndDate, updatedAt',
      users: '++id, shopId, username, role, updatedAt',
      subscriptions: '++id, shopId, status, startDate, endDate, updatedAt',
      shopPaymentInfo: '++id, shopId, updatedAt',
      syncQueue: '++id, shopId, table, createdAt',
      cloudCache: '&key, shopId, table, updatedAt',
    });
  }
}

export const db = new DukanDB();

// Pre-loaded default categories for quick setup
export function getDefaultCategories(): Omit<Category, 'id'>[] {
  const now = Date.now();
  return [
    { name: 'Grocery', nameMarathi: 'किराणा', color: '#3b82f6', createdAt: now, updatedAt: now },
    { name: 'Dairy & Milk', nameMarathi: 'दुग्ध', color: '#f59e0b', createdAt: now, updatedAt: now },
    { name: 'Beverages', nameMarathi: 'पेय पदार्थ', color: '#ef4444', createdAt: now, updatedAt: now },
    { name: 'Snacks & Sweets', nameMarathi: 'स्नॅक्स', color: '#8b5cf6', createdAt: now, updatedAt: now },
    { name: 'Household Items', nameMarathi: 'घरेलू', color: '#06b6d4', createdAt: now, updatedAt: now },
    { name: 'Personal Care', nameMarathi: 'व्यक्तिगत', color: '#ec4899', createdAt: now, updatedAt: now },
  ];
}

// Pre-loaded default units for quick setup
export function getDefaultUnits(): Omit<Unit, 'id'>[] {
  const now = Date.now();
  return [
    { name: 'Kilogram', nameMarathi: 'किलोग्राम', shortForm: 'kg', createdAt: now, updatedAt: now },
    { name: 'Gram', nameMarathi: 'ग्राम', shortForm: 'g', createdAt: now, updatedAt: now },
    { name: 'Liter', nameMarathi: 'लिटर', shortForm: 'l', createdAt: now, updatedAt: now },
    { name: 'Milliliter', nameMarathi: 'मिली लिटर', shortForm: 'ml', createdAt: now, updatedAt: now },
    { name: 'Piece', nameMarathi: 'तुकडे', shortForm: 'pcs', createdAt: now, updatedAt: now },
    { name: 'Box', nameMarathi: 'डिब्बा', shortForm: 'box', createdAt: now, updatedAt: now },
  ];
}

export const DEMO_ITEMS: Omit<Item, 'id'>[] = [];

// Initialize database with default categories and units on first load
export async function initializeDatabase() {
  if (typeof window === 'undefined') return;
  
  try {
    if (!db.isOpen()) {
      await db.open();
    }

    const settingsCount = await db.appSettings.count();
    
    if (settingsCount === 0) {
      console.log('[Dukan] Initializing default settings...');
      
      // Check if categories already exist before adding
      const categoryCount = await db.categories.count();
      if (categoryCount === 0) {
        await db.categories.bulkAdd(getDefaultCategories());
      }

      // Check if units already exist before adding
      const unitCount = await db.units.count();
      if (unitCount === 0) {
        await db.units.bulkAdd(getDefaultUnits());
      }

      await db.appSettings.add({
    language: 'en',
        theme: 'light',
        setupComplete: true,
        updatedAt: Date.now(),
      });

      console.log('[Dukan] Database initialized with default categories and units');
    }
  } catch (error) {
    console.error('[Dukan] Database initialization error:', error);
  }
}
