import { dateKey } from "./utils";

const DAY_MS = 24 * 60 * 60 * 1000;

type SaleLike = {
  date: string;
  subtotal?: number;
  totalCost?: number;
  totalProfit?: number;
  items?: Array<{
    itemName?: string;
    quantity?: number;
    totalPrice?: number;
    profit?: number;
  }>;
};

type CreditEntryLike = {
  customerId?: number;
  customer_id?: number;
  type: string;
  amount: number;
  timestamp: number | string;
};

export type CreditRiskLevel = "fresh" | "recover" | "high";

export function getPreviousDateKey(date: Date) {
  const previous = new Date(date);
  previous.setDate(previous.getDate() - 1);
  return dateKey(previous);
}

export function summarizeSales(sales: SaleLike[]) {
  const revenue = sales.reduce((sum, sale) => sum + Number(sale.subtotal || 0), 0);
  const cost = sales.reduce((sum, sale) => sum + Number(sale.totalCost || 0), 0);
  const profit = sales.reduce(
    (sum, sale) =>
      sum +
      Number(
        sale.totalProfit ??
          Number(sale.subtotal || 0) - Number(sale.totalCost || 0),
      ),
    0,
  );

  return {
    revenue,
    cost,
    profit,
    transactions: sales.length,
    margin: revenue > 0 ? (profit / revenue) * 100 : 0,
  };
}

export function getSignedPercentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function getSalesStreak(sales: SaleLike[], fromDate = new Date()) {
  const saleDates = new Set(
    sales
      .filter((sale) => Number(sale.subtotal || 0) > 0)
      .map((sale) => sale.date),
  );
  let streak = 0;
  const cursor = new Date(fromDate);
  cursor.setHours(0, 0, 0, 0);

  while (saleDates.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function getTopSellingItem(sales: SaleLike[]) {
  const itemTotals = new Map<
    string,
    { name: string; quantity: number; revenue: number; profit: number }
  >();

  for (const sale of sales) {
    for (const item of sale.items || []) {
      const name = item.itemName || "Item";
      const existing = itemTotals.get(name) || {
        name,
        quantity: 0,
        revenue: 0,
        profit: 0,
      };
      itemTotals.set(name, {
        name,
        quantity: existing.quantity + Number(item.quantity || 0),
        revenue: existing.revenue + Number(item.totalPrice || 0),
        profit: existing.profit + Number(item.profit || 0),
      });
    }
  }

  return (
    Array.from(itemTotals.values()).sort((a, b) => b.revenue - a.revenue)[0] ||
    null
  );
}

export function getCreditRiskLevel(daysPending: number): CreditRiskLevel {
  if (daysPending <= 15) return "fresh";
  if (daysPending <= 30) return "recover";
  return "high";
}

function entryCustomerId(entry: CreditEntryLike) {
  return entry.customerId ?? entry.customer_id;
}

function entryTimestamp(entry: CreditEntryLike) {
  return typeof entry.timestamp === "number"
    ? entry.timestamp
    : new Date(entry.timestamp).getTime();
}

export function getCreditPressure(
  customerId: number | undefined,
  balance: number,
  entries: CreditEntryLike[],
  now = Date.now(),
) {
  if (!customerId || balance <= 0) {
    return {
      daysPending: 0,
      oldestTimestamp: null as number | null,
      riskLevel: "fresh" as CreditRiskLevel,
    };
  }

  const remainingCredits: Array<{ amount: number; timestamp: number }> = [];
  const customerEntries = entries
    .filter((entry) => entryCustomerId(entry) === customerId)
    .sort((a, b) => entryTimestamp(a) - entryTimestamp(b));

  for (const entry of customerEntries) {
    const amount = Number(entry.amount || 0);
    if (amount <= 0) continue;

    if (entry.type === "credit") {
      remainingCredits.push({ amount, timestamp: entryTimestamp(entry) });
      continue;
    }

    if (entry.type === "payment") {
      let paymentLeft = amount;
      while (paymentLeft > 0 && remainingCredits.length > 0) {
        const oldestCredit = remainingCredits[0];
        const used = Math.min(oldestCredit.amount, paymentLeft);
        oldestCredit.amount -= used;
        paymentLeft -= used;

        if (oldestCredit.amount <= 0.001) {
          remainingCredits.shift();
        }
      }
    }
  }

  const oldestTimestamp = remainingCredits[0]?.timestamp ?? null;
  const daysPending =
    oldestTimestamp === null
      ? 0
      : Math.max(0, Math.floor((now - oldestTimestamp) / DAY_MS));

  return {
    daysPending,
    oldestTimestamp,
    riskLevel: getCreditRiskLevel(daysPending),
  };
}
