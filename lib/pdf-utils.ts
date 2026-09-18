import { formatMoney, formatNumber, formatPercent } from "@/lib/number-format";
import type { PdfLanguage } from "@/lib/pdf-i18n";
import { getPdfLocale, repairPdfMojibake } from "@/lib/pdf-i18n";

export function safePdfText(
  value: unknown,
  fallback = "N/A",
  maxLength = 42,
  language: PdfLanguage = "en",
) {
  let cleaned = repairPdfMojibake(String(value ?? ""))
    .replace(/₹/g, "Rs.")
    .replace(/[–—]/g, "-")
    .replace(/[×]/g, "x")
    .replace(/\s+/g, " ")
    .trim();

  {
    cleaned = cleaned.replace(/[^\x20-\x7E]/g, "");
  }

  const finalValue = cleaned || fallback;
  return finalValue.length > maxLength
    ? `${finalValue.slice(0, maxLength - 3)}...`
    : finalValue;
}

export function pdfMoney(value: number | undefined | null, language: PdfLanguage = "en") {
  const prefix = ("Rs.");
  return `${prefix} ${formatMoney(value)}`;
}

export function pdfPercent(value: number | undefined | null) {
  return `${formatPercent(value)}%`;
}

export function pdfSignedPercent(value: number | undefined | null) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${safe >= 0 ? "+" : ""}${formatPercent(safe)}%`;
}

export function pdfShortDate(
  value: string | undefined,
  language: PdfLanguage = "en",
  fallback = "N/A",
) {
  if (!value) return fallback;
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return safePdfText(value, fallback, 14, language);
  }
  return date.toLocaleDateString(getPdfLocale(language), {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

export function pdfTime(
  value: string | number | undefined,
  language: PdfLanguage = "en",
) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(getPdfLocale(language), {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function pdfQty(value: number | undefined | null) {
  return formatNumber(value);
}
