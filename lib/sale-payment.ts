export type SalePaymentMethod = "cash" | "card" | "partial" | "udhar";
export type ImmediatePaymentMethod = "cash" | "card";

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export interface SalePaymentBreakdown {
  paidAmount: number;
  dueAmount: number;
  paidVia: ImmediatePaymentMethod | null;
  isValid: boolean;
}

export function getSalePaymentBreakdown(
  totalValue: number,
  method: SalePaymentMethod,
  partialPaidValue = 0,
  partialPaidVia: ImmediatePaymentMethod = "cash",
): SalePaymentBreakdown {
  const total = money(Math.max(Number(totalValue) || 0, 0));

  if (method === "udhar") {
    return { paidAmount: 0, dueAmount: total, paidVia: null, isValid: total > 0 };
  }

  if (method === "partial") {
    const paidAmount = money(Math.max(Number(partialPaidValue) || 0, 0));
    return {
      paidAmount,
      dueAmount: money(Math.max(total - paidAmount, 0)),
      paidVia: partialPaidVia,
      isValid: total > 0 && paidAmount > 0 && paidAmount < total,
    };
  }

  return { paidAmount: total, dueAmount: 0, paidVia: method, isValid: total > 0 };
}

export function getStoredCreditAmount(row: {
  payment_method?: string | null;
  subtotal?: number | null;
  due_amount?: number | null;
}) {
  if (row.payment_method === "udhari" || row.payment_method === "udhar") {
    return money(Math.max(Number(row.subtotal) || 0, 0));
  }
  if (row.payment_method === "partial") {
    return money(Math.max(Number(row.due_amount) || 0, 0));
  }
  return 0;
}
