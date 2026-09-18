// Unit conversion map - defines conversion factors for each unit
const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
  // Weight conversions
  kg: { g: 1000, mg: 1000000 },
  g: { kg: 0.001, mg: 1000 },
  mg: { kg: 0.000001, g: 0.001 },

  // Volume conversions
  l: { ml: 1000, cl: 100, lt: 1000 },
  lt: { ml: 1000, cl: 100, l: 1 },
  ml: { l: 0.001, lt: 0.001, cl: 0.1 },
  cl: { l: 0.01, lt: 0.01, ml: 10 },

  // Piece conversions (no conversion needed, 1:1)
  pcs: { pcs: 1, dozen: 1 / 12, packet: 1, box: 1 },
  dozen: { dozen: 1, pcs: 12, packet: 12, box: 12 },
  packet: { pcs: 1, dozen: 1 / 12, packet: 1, box: 1 },
  box: { pcs: 1, dozen: 1 / 12, packet: 1, box: 1 },
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
  ltr: 'l',
  ltrs: 'l',
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

export const convertUnits = (
  value: number,
  fromUnitShortForm: string,
  toUnitShortForm: string
): number => {
  const from = normalizeUnit(fromUnitShortForm);
  const to = normalizeUnit(toUnitShortForm);

  if (from === to) return value;

  const conversions = UNIT_CONVERSIONS[from];
  if (!conversions || !conversions[to]) {
    // If no conversion found, assume 1:1 (incompatible units)
    console.warn(`[v0] No conversion found from ${from} to ${to}`);
    return value;
  }

  return Number((value * conversions[to]).toFixed(6));
};
