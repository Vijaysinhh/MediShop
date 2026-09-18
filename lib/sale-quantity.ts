import { formatNumber } from "./number-format";

type QuantityLine = {
  itemId: number;
  quantity: number;
  packCount?: number;
  priceTierId?: number;
  priceTierQuantity?: number;
  priceTierUnitShortForm?: string;
  unitShortForm: string;
  pricePerUnit: number;
  costPerUnit: number;
  displayQuantity: string;
  totalPrice: number;
  totalCost: number;
};

export function hasInvalidSaleQuantity(lines: Array<{ quantity?: unknown; packCount?: unknown }>) {
  return lines.some((line) => {
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return true;
    if (line.packCount == null) return false;
    const packCount = Number(line.packCount);
    return !Number.isFinite(packCount) || packCount <= 0;
  });
}

export function hasInvalidSalePrice(lines: Array<{ pricePerUnit?: unknown }>) {
  return lines.some((line) => {
    const price = Number(line.pricePerUnit);
    return !Number.isFinite(price) || price <= 0;
  });
}

export function editableSaleQuantity(line: QuantityLine) {
  return line.priceTierId != null && line.packCount != null && line.packCount > 0
    ? line.packCount
    : line.quantity;
}

export function isSaleQuantityApplied(line: QuantityLine, value: number, max: number) {
  return Number.isFinite(value) && value > 0 && value <= max && value === editableSaleQuantity(line);
}

export function stepSaleQuantity(value: number, direction: -1 | 1, max: number) {
  const current = Number.isFinite(value) ? value : 0;
  return direction > 0
    ? Math.min(max, Number((current + 1).toFixed(6)))
    : Math.max(0, Number((current - 1).toFixed(6)));
}

export function maxSaleQuantity(stock: number, reserved: number, baseUnitsPerQuantity = 1) {
  if (![stock, reserved, baseUnitsPerQuantity].every(Number.isFinite) || baseUnitsPerQuantity <= 0) return 0;
  // Round down to six decimals; never offer more than the available stock.
  return Math.floor((Math.max(0, stock - reserved) / baseUnitsPerQuantity + 1e-10) * 1e6) / 1e6;
}

export function maxBillLineQuantity(stock: number, lines: QuantityLine[], index: number) {
  const line = lines[index];
  if (!line) return 0;
  const reserved = lines.reduce((sum, other, otherIndex) =>
    otherIndex !== index && other.itemId === line.itemId ? sum + other.quantity : sum, 0);
  return maxSaleQuantity(stock, reserved, line.quantity / editableSaleQuantity(line));
}

export function resizeSaleLine<T extends QuantityLine>(line: T, next: number, max: number): T | null {
  if (!Number.isFinite(next) || next <= 0 || next > max) return null;
  const isPack = line.priceTierId != null && line.packCount != null && line.packCount > 0;
  const quantity = isPack ? Number((next * line.quantity / line.packCount!).toFixed(9)) : next;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return {
    ...line,
    quantity,
    ...(isPack ? { packCount: next } : {}),
    displayQuantity: isPack
      ? `${formatNumber(next)} x ${formatNumber(line.priceTierQuantity)} ${line.priceTierUnitShortForm || line.unitShortForm}`
      : `${formatNumber(quantity)} ${line.unitShortForm}`,
    totalPrice: quantity * line.pricePerUnit,
    totalCost: quantity * line.costPerUnit,
  };
}
