import { normalizeVoiceText } from "./voice-sale-parser";

type Product = { id: number; name: string; nameMarathi?: string; brand?: string; brandMarathi?: string };

/** Approximate words offer alternatives, never automatically choose the product. */
export function shortlistVoiceProducts<T extends Product>(query: string, items: T[]) {
  const exact = matchVoiceProducts(query, items).candidates;
  const words = normalizeVoiceText(query).split(" ").filter((word) => word.length > 2);
  const bigrams = (word: string) => new Set(Array.from({length: Math.max(0, word.length - 1)}, (_, i) => word.slice(i, i + 2)));
  const similarity = (first: string, second: string) => {
    const a = bigrams(first), b = bigrams(second);
    return a.size + b.size ? 2 * [...a].filter((pair) => b.has(pair)).length / (a.size + b.size) : 0;
  };
  const fuzzy = items.map((item) => {
    const tokens = normalizeVoiceText([item.name, item.nameMarathi, item.brand, item.brandMarathi].filter(Boolean).join(" ")).split(" ");
    return { item, score: Math.max(0, ...words.flatMap((word) => tokens.map((token) => similarity(word, token)))) };
  }).filter((entry) => entry.score >= 0.5).sort((a, b) => b.score - a.score);
  return [...new Map([...exact, ...fuzzy.map((entry) => entry.item)].map((item) => [item.id, item])).values()].slice(0, 6);
}

/** Exact bilingual tokens may select a unique item; approximate matches require a choice. */
export function matchVoiceProducts<T extends Product>(query: string, items: T[]) {
  const words = normalizeVoiceText(query).split(" ").filter(Boolean);
  if (!words.length) return { candidates: [] as T[], selectedId: null as number | null };
  const ranked = items.map((item) => {
    const names = [item.name, item.nameMarathi, item.brand, item.brandMarathi]
      .filter((name): name is string => Boolean(name)).map((name) => normalizeVoiceText(name));
    const tokens = new Set(names.join(" ").split(" "));
    const fullMatch = words.every((word) => tokens.has(word));
    const exact = names.includes(words.join(" "));
    const overlap = words.filter((word) => tokens.has(word)).length / words.length;
    return { item, fullMatch, score: (exact ? 2 : 0) + (fullMatch ? 1 : 0) + overlap };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  const fullMatches = ranked.filter((entry) => entry.fullMatch);
  return {
    candidates: (fullMatches.length ? fullMatches : ranked).slice(0, 3).map((entry) => entry.item),
    selectedId: fullMatches.length === 1 ? fullMatches[0].item.id : null,
  };
}

const aliases: Record<string, string> = {
  gm: "g", grams: "g", gram: "g", kilogram: "kg", किलो: "kg", ग्रॅम: "g",
  lt: "l", liter: "l", litre: "l", लिटर: "l", मिली: "ml",
  pc: "pcs", piece: "pcs", pieces: "pcs", pce: "pcs", नग: "pcs",
  dz: "dozen", डझन: "dozen", pack: "packet", pkt: "packet", पॅकेट: "packet",
};
const dimensions: Record<string, [string, number]> = {
  kg: ["weight", 1000], g: ["weight", 1], mg: ["weight", 0.001],
  l: ["volume", 1000], ml: ["volume", 1], cl: ["volume", 10],
  pcs: ["count", 1], dozen: ["count", 12],
};

/** Unknown or incompatible units need review, never a silent 1:1 conversion. */
export function convertVoiceQuantity(quantity: number, fromUnit: string | undefined, toUnit: string) {
  const normalize = (unit: string) => aliases[unit.toLowerCase().trim()] || unit.toLowerCase().trim();
  const to = normalize(toUnit);
  const from = fromUnit ? normalize(fromUnit) : to;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (from === to) return quantity;
  if (!dimensions[from] || !dimensions[to] || dimensions[from][0] !== dimensions[to][0]) return null;
  return Number((quantity * dimensions[from][1] / dimensions[to][1]).toFixed(6));
}

export function checkVoiceStock(
  item: { quantity: number; expiryDate?: string | Date | null },
  quantity: number,
  inBill = 0,
  reserved = 0,
  now = new Date(),
) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  if (item.expiryDate) {
    const expiry = new Date(item.expiryDate);
    if (!Number.isFinite(expiry.getTime())) return { state: "invalid" as const };
    if (expiry < today) return { state: "expired" as const };
  }
  if (![item.quantity, quantity, inBill, reserved].every(Number.isFinite) || quantity <= 0) {
    return { state: "invalid" as const };
  }
  const available = Math.max(0, Number((item.quantity - inBill - reserved).toFixed(6)));
  return quantity > available
    ? { state: "insufficient" as const, available }
    : { state: "ready" as const, available };
}
