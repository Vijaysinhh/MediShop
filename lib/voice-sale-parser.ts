export type VoiceSaleRequest = {
  quantity: number;
  productQuery: string;
  requestedUnit?: string;
  priceOverride?: number;
};

const numberWords: Record<string, number> = {
  zero: 0,
  one: 1,
  ek: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  don: 2,
  dhon: 2,
  एक: 1,
  दोन: 2,
  तीन: 3,
  चार: 4,
  पाच: 5,
  सहा: 6,
  सात: 7,
  आठ: 8,
  नऊ: 9,
  दहा: 10,
  अकरा: 11,
  बारा: 12,
  तेरा: 13,
  चौदा: 14,
  पंधरा: 15,
  सोळा: 16,
  सतरा: 17,
  अठरा: 18,
  एकोणीस: 19,
  वीस: 20,
  दीड: 1.5,
  अर्धा: 0.5,
  अर्धी: 0.5,
  पाव: 0.25,
  सव्वा: 1.25,
  अडीच: 2.5,
  साडेतीन: 3.5,
  half: 0.5,
  अर्धे: 0.5,
  शून्य: 0,
  पंचवीस: 25,
  पन्नास: 50,
  शंभर: 100,
  दोनशे: 200,
  पाचशे: 500,
};

const unitAliases: Record<string, string> = {
  pc: "pcs",
  pcs: "pcs",
  piece: "pcs",
  pieces: "pcs",
  नग: "pcs",
  नगा: "pcs",
  packet: "packet",
  packets: "packet",
  pkt: "packet",
  पॅकेट: "packet",
  पॅकेट्स: "packet",
  sachet: "sachet",
  sachets: "sachet",
  सॅशे: "sachet",
  box: "box",
  boxes: "box",
  डबा: "box",
  dozen: "dozen",
  dz: "dozen",
  डझन: "dozen",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  kilo: "kg",
  kilos: "kg",
  किलो: "kg",
  किलोग्राम: "kg",
  g: "g",
  gram: "g",
  grams: "g",
  ग्रॅम: "g",
  l: "l",
  liter: "l",
  litre: "l",
  लिटर: "l",
  ml: "ml",
  milliliter: "ml",
  millilitre: "ml",
  मिली: "ml",
};

const priceVariantWords = new Set([
  "wale",
  "वाले",
  "rupees",
  "rupee",
  "रुपये",
  "रुपयांची",
  "रुपयांचा",
  "रुपयाचे",
  "रुपयांचे",
  "रुपयाचेच",
  "रुपयाला",
  "rs",
  "price",
  "rate",
]);

const commandWords = new Set([
  "add",
  "please",
  "more",
  "आणखी",
  "अजून",
  "qty",
  "quantity",
  "करा",
  "टाका",
  "द्या",
  "द्याना",
  "हवे",
  "पाहिजे",
  "वस्तू",
  "आणून",
  "घ्या",
  "wale",
  "वाले",
  "रुपये",
  "रुपयाचे",
  "चा",
  "ची",
  "चे",
  "मला",
  "आहे",
  "a",
  "of",
]);

const speechAliases: Record<string, string> = {
  shivamrut: "shivamrut",
  shivamrutdoodh: "shivamrut doodh",
  shubhamrut: "shivamrut",
  shubhamrutdoodh: "shivamrut doodh",
  shivaamrut: "shivamrut",
  shivamrutdudh: "shivamrut doodh",
  shubhamrutdudh: "shivamrut doodh",
  doodh: "doodh",
  duudh: "doodh",
  dhoodh: "doodh",
  dudh: "doodh",
  दूध: "doodh",
  दुध: "doodh",
  milk: "doodh",
  dule: "doodh",
  dud: "doodh",
  पार्ले: "parle",
  जी: "g",
  बिस्किट: "biscuit",
  बिस्किटे: "biscuit",
  biscuits: "biscuit",
  ब्रेड: "bread",
  साखर: "sugar",
  मीठ: "salt",
  तांदूळ: "rice",
  तेल: "oil",
};

export function normalizeVoiceText(value: string, applyAliases = true) {
  const normalized = value
    .normalize("NFC")
    .replace(/\u200B/g, " ")
    .replace(/[\u200C\u200D\u2060\uFEFF]/g, "")
    .toLowerCase()
    .replace(/[०-९]/g, (digit) => String("०१२३४५६७८९".indexOf(digit)))
    .replace(
      /\b(?:i|ek|एक)\s+(?=(?:kilo|kilos|kg|kilogram|kilograms|किलो|किलोग्राम)\b)/g,
      "1 ",
    )
    .replace(/[-–—()]/g, " ")
    .replace(/[!?;:,।]/g, " ")
    .replace(/\.(?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const withoutRepeats = normalized
    .replace(/([a-z])\1{2,}/g, "$1$1")
    .replace(/([aeiou])\1{2,}/g, "$1");

  const aliasApplied = withoutRepeats
    .split(" ")
    .map((token) => applyAliases ? speechAliases[token] || token : token)
    .join(" ");

  return aliasApplied.replace(/\s+/g, " ").trim();
}

function numberFromToken(token: string) {
  if (/^\d+(?:\.\d+)?$/.test(token)) return Number(token);
  return Object.prototype.hasOwnProperty.call(numberWords, token) ? numberWords[token] : undefined;
}

// Only familiar grocery words are safe to collapse without catalog context.
// Do not deduplicate arbitrary names (for example, "Good Good") or whole items.
const groceryStutterWords = new Set(["doodh", "biscuit", "bread", "sugar", "salt", "rice", "oil"]);

/** Clean speech before parsing quantities or looking up products. */
export function cleanVoiceRepetitions(value: string) {
  return value
    .normalize("NFC")
    .replace(/\u200B/g, " ")
    .replace(/[\u200C\u200D\u2060\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\.{2,}|…/g, " ")
    // Preserve order boundaries even when the repeated token has punctuation.
    .split(/([,;।!?\n]+)/)
    .map((part, index) => index % 2 ? part : cleanVoiceLineRepetitions(part))
    .join("")
    .trim();
}

function cleanVoiceLineRepetitions(value: string) {
  const tokens = value.split(/\s+/).filter(Boolean);
  // Compare recognised quantities across scripts without translating the text
  // shown to the shopkeeper. This also runs before parser normalisation.
  const comparable = tokens.map((token) => normalizeVoiceText(token, false));
  const cleaned: string[] = [];
  for (let index = 0; index < tokens.length;) {
    const token = comparable[index];
    const quantity = numberFromToken(token);
    let end = index + 1;
    while (end < tokens.length && (quantity === undefined
      ? comparable[end] === token
      : numberFromToken(comparable[end]) === quantity)) end += 1;

    // पाव is also bread: only treat it as a fraction before a unit/price.
    const isQuantity = quantity !== undefined &&
      (token !== "पाव" || Boolean(unitAliases[comparable[end]]) || priceVariantWords.has(comparable[end]));
    const isGroceryStutter = groceryStutterWords.has(speechAliases[token] || token);
    const isUnitStutter = Boolean(unitAliases[token]) &&
      index > 0 && numberFromToken(comparable[index - 1]) !== undefined;

    if (end - index > 1 && (isQuantity || isGroceryStutter || isUnitStutter)) {
      cleaned.push(tokens[index]);
      // "दोन दोन रुपयांचे" is quantity 2 at ₹2, not a single stutter.
      if (isQuantity && priceVariantWords.has(comparable[end])) cleaned.push(tokens[end - 1]);
    } else {
      cleaned.push(...tokens.slice(index, end));
    }
    index = end;
  }
  // Keep separator spacing stable in the readable transcript.
  return (value.startsWith(" ") ? " " : "") + cleaned.join(" ") + (value.endsWith(" ") && cleaned.length ? " " : "");
}

function quantityStartIndexes(tokens: string[]) {
  const indexes: number[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const nextToken = tokens[index + 1];
    if (token === "पाव" && !unitAliases[nextToken]) continue;
    if (numberFromToken(token) === undefined) continue;
    if (nextToken && priceVariantWords.has(nextToken)) continue;
    if (index > 0 && numberFromToken(tokens[index - 1]) !== undefined) continue;
    indexes.push(index);
  }

  return indexes;
}

function splitRequests(value: string) {
  const normalized = normalizeVoiceText(cleanVoiceRepetitions(value)
    .replace(/₹\s*([\d०-९]+(?:\.[\d०-९]+)?)/g, "$1 rupees")
    .replace(/[,;।!?\n]+/g, " | "), false)
    .replace(/\b(?:and|then|plus|ani|mag|aani)\b/g, "|")
    .split(/\s+/).map((token) => ["आणि", "मग", "तथा"].includes(token) ? "|" : token).join(" ");

  const clauses = normalized
    .split("|")
    // Normalisation can expose stutters joined by dashes/parentheses. Clean
    // these tokens too, still before interpreting quantities or matching names.
    .map((part) => cleanVoiceRepetitions(part))
    .filter(Boolean);

  const resolved: string[] = [];

  for (const clause of clauses) {
    const tokens = clause.split(" ").filter(Boolean);
    const starts = quantityStartIndexes(tokens);

    if (starts.length <= 1) {
      resolved.push(clause);
      continue;
    }

    for (let index = 0; index < starts.length; index += 1) {
      const start = index === 0 ? 0 : starts[index];
      const end = starts[index + 1] ?? tokens.length;
      const segment = tokens.slice(start, end).join(" ").trim();
      if (segment) resolved.push(segment);
    }
  }

  return resolved.length > 0 ? resolved : clauses;
}

export function parseVoiceSaleCommand(value: string): VoiceSaleRequest[] {
  return splitRequests(value)
    .map((part) => {
      const tokens = part.split(" ").filter(Boolean);
      const ignoredIndexes = new Set<number>();
      let priceOverride: number | undefined;

      for (let index = 0; index < tokens.length - 1; index += 1) {
        const token = tokens[index];
        const nextToken = tokens[index + 1];
        if (
          numberFromToken(token) !== undefined &&
          nextToken &&
          priceVariantWords.has(nextToken)
        ) {
          ignoredIndexes.add(index);
          ignoredIndexes.add(index + 1);
          priceOverride = numberFromToken(token);
        }
      }

      const quantityIndex = tokens.findIndex(
        (token, index) =>
          !ignoredIndexes.has(index) && numberFromToken(token) !== undefined &&
          (token !== "पाव" || Boolean(unitAliases[tokens[index + 1]])),
      );

      let quantity =
        quantityIndex >= 0 ? numberFromToken(tokens[quantityIndex]) ?? 1 : 1;

      const productTokens = tokens.filter(
        (_, index) =>
          index !== quantityIndex &&
          !ignoredIndexes.has(index) &&
          !commandWords.has(tokens[index]),
      );

      let requestedUnit: string | undefined;
      const filteredTokens = productTokens.filter((token, index) => {
        // The G in the brand Parle-G is not a request for grams.
        const unit = token === "g" && normalizeVoiceText(productTokens[index - 1] || "") === "parle"
          ? undefined : unitAliases[token];
        if (unit) requestedUnit = unit;
        return !unit;
      });

      return {
        quantity,
        productQuery: filteredTokens.join(" ").trim(),
        ...(requestedUnit ? { requestedUnit } : {}),
        ...(priceOverride !== undefined ? { priceOverride } : {}),
      };
    })
    .filter((request) => request.productQuery.length > 0);
}
