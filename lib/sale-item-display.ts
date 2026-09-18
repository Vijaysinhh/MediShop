import { formatMoney, formatNumber } from "@/lib/number-format";
import { convertUnit } from "@/lib/unit-conversion";

/** Fields needed to show how a line was sold (especially price-tier packs). */
export type SaleLineDisplayInput = {
  quantity: number;
  unitShortForm: string;
  displayQuantity?: string;
  priceTierId?: number;
  packCount?: number;
  priceTierQuantity?: number;
  priceTierUnitShortForm?: string;
  pricePerUnit?: number;
  totalPrice?: number;
};

type PriceTierRef = {
  id?: number;
  quantity: number;
  unitId: number;
};

type UnitRef = { id?: number; shortForm: string };

/** Reconstruct pack display for older sales that only stored base-unit quantity. */
export function inferSaleLineDisplayFields(
  item: SaleLineDisplayInput,
  priceTiers?: PriceTierRef[],
  units?: UnitRef[],
  itemUnitId?: number,
): SaleLineDisplayInput {
  if (item.displayQuantity?.trim()) return item;
  if (
    item.packCount != null &&
    item.priceTierQuantity != null &&
    item.priceTierUnitShortForm
  ) {
    return item;
  }
  if (!item.priceTierId || !priceTiers?.length || !units?.length) return item;

  const tier = priceTiers.find((t) => t.id === item.priceTierId);
  if (!tier) return item;

  const tierUnit = units.find((u) => u.id === tier.unitId);
  const itemUnit = units.find((u) => u.id === itemUnitId);
  if (!tierUnit || !itemUnit) return item;

  const tierQtyInItemUnit = convertUnit(
    tier.quantity,
    tierUnit.shortForm,
    itemUnit.shortForm,
  );
  if (tierQtyInItemUnit <= 0) return item;

  const packCount = Math.round(item.quantity / tierQtyInItemUnit);
  if (packCount <= 0) return item;

  return {
    ...item,
    packCount,
    priceTierQuantity: tier.quantity,
    priceTierUnitShortForm: tierUnit.shortForm,
    displayQuantity: `${formatNumber(packCount)} x ${formatNumber(tier.quantity)} ${tierUnit.shortForm}`,
  };
}

/** Human-readable quantity: e.g. "2 x 200 g" instead of "0.4 kg". */
export function formatSaleLineQuantity(item: SaleLineDisplayInput): string {
  const stored = item.displayQuantity?.trim();
  if (stored) return stored;

  if (
    item.priceTierId &&
    item.packCount != null &&
    item.packCount > 0 &&
    item.priceTierQuantity != null &&
    item.priceTierUnitShortForm
  ) {
    return `${formatNumber(item.packCount)} x ${formatNumber(item.priceTierQuantity)} ${item.priceTierUnitShortForm}`;
  }

  const unit = item.unitShortForm?.trim() || "";
  return unit ? `${formatNumber(item.quantity)} ${unit}` : formatNumber(item.quantity);
}

/** Price label for a sale line (per pack when tier, else per base unit). */
export function formatSaleLineUnitPrice(item: SaleLineDisplayInput): string {
  if (
    item.priceTierId &&
    item.packCount != null &&
    item.packCount > 0 &&
    item.totalPrice != null
  ) {
    return formatMoney(item.totalPrice / item.packCount);
  }
  return formatMoney(item.pricePerUnit ?? 0);
}

/** Full subtitle: "2 x 200 g × ₹50". */
export function formatSaleLineSubtitle(item: SaleLineDisplayInput): string {
  const qty = formatSaleLineQuantity(item);
  const price = formatSaleLineUnitPrice(item);
  return `${qty} × ₹${price}`;
}
