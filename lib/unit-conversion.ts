'use client';

// Unit conversion map - defines conversion factors for each unit
const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
  // Weight conversions
  g: { g: 1, kg: 0.001, mg: 1000 },
  kg: { g: 1000, kg: 1, mg: 1000000 },
  mg: { g: 0.001, kg: 0.000001, mg: 1 },

  // Volume conversions
  ml: { ml: 1, l: 0.001, lt: 0.001, cl: 0.01 },
  l: { ml: 1000, l: 1, lt: 1, cl: 100 },
  lt: { ml: 1000, l: 1, lt: 1, cl: 100 },
  cl: { ml: 10, l: 0.01, lt: 0.01, cl: 1 },

  // Piece-based (no conversion)
  pcs: { pcs: 1, piece: 1, pce: 1, dozen: 1 / 12, packet: 1, box: 1 },
  piece: { pcs: 1, piece: 1, pce: 1, dozen: 1 / 12, packet: 1, box: 1 },
  pce: { pcs: 1, piece: 1, pce: 1, dozen: 1 / 12, packet: 1, box: 1 },
  dozen: { pcs: 12, piece: 12, pce: 12, dozen: 1, packet: 12, box: 12 },
  packet: { pcs: 1, piece: 1, pce: 1, dozen: 1 / 12, packet: 1, box: 1 },
  box: { pcs: 1, piece: 1, pce: 1, dozen: 1 / 12, packet: 1, box: 1 },
};

const UNIT_ALIASES: Record<string, string> = {
  gram: 'g',
  grams: 'g',
  gm: 'g',
  gms: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  kilo: 'kg',
  liter: 'l',
  litre: 'l',
  liters: 'l',
  litres: 'l',
  milliliter: 'ml',
  millilitre: 'ml',
  milliliters: 'ml',
  millilitres: 'ml',
  centiliter: 'cl',
  centilitre: 'cl',
  centiliters: 'cl',
  centilitres: 'cl',
  piece: 'pcs',
  pieces: 'pcs',
  pc: 'pcs',
  pkt: 'packet',
};

function normalizeUnit(unit: string): string {
  const key = (unit || '').toLowerCase().trim();
  return UNIT_ALIASES[key] || key;
}

export function convertUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string,
): number {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  if (from === to) return quantity;

  const conversions = UNIT_CONVERSIONS[from];
  if (!conversions || conversions[to] === undefined) {
    console.warn(
      `[v0] Cannot convert ${from} to ${to}, using original quantity`,
    );
    return quantity;
  }

  // Avoid JavaScript floating point errors by rounding to 6 decimal places
  const result = quantity * conversions[to];
  return Number(result.toFixed(6));
}

/**
 * Calculate ACTUAL cost per price tier unit
 *
 * CORRECT LOGIC:
 * 1. Convert base item cost to per-base-unit cost (e.g., Rs. 90/kg = Rs. 0.09/g)
 * 2. Convert price tier quantity to base unit (e.g., 50g = 50g, 1kg = 1000g)
 * 3. Calculate: cost = price_tier_qty_in_base_unit × cost_per_base_unit
 *
 * Example:
 * - Base: 1kg @ Rs. 90 buy → Rs. 0.09 per gram
 * - Price tier: 50g sold at Rs. 7
 * - Cost of 50g = 50 × 0.09 = Rs. 4.50
 * - Profit = Rs. 7 - Rs. 4.50 = Rs. 2.50
 */
export function calculatePriceTierCost(
  baseBuyPrice: number, // Rs. 90 (per 1 base unit)
  basePriceTierQuantity: number, // 50 (quantity of tier)
  basePriceTierUnit: string, // 'g' (unit of tier)
  baseItemQuantity: number, // 1000 (1kg = 1000g)
  baseItemUnit: string, // 'kg' (base unit)
): number {
  // Step 1: Convert base item to its smallest unit
  const baseItemQtyInBaseUnit = convertUnit(
    baseItemQuantity,
    baseItemUnit,
    baseItemUnit,
  );

  // Step 2: Convert price tier quantity to base unit for calculation
  const priceTierQtyInBaseUnit = convertUnit(
    basePriceTierQuantity,
    basePriceTierUnit,
    baseItemUnit,
  );

  // Step 3: Calculate cost per base unit
  const costPerBaseUnit = baseBuyPrice / baseItemQtyInBaseUnit;

  // Step 4: Calculate cost of price tier
  const costOfPriceTier = priceTierQtyInBaseUnit * costPerBaseUnit;

  return costOfPriceTier;
}
