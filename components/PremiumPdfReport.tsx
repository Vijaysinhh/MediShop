"use client";

import React, { ReactNode, useMemo } from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatNumber } from "@/lib/number-format";
import { getPdfFontFamily } from "@/lib/pdf-fonts";
import { getPdfLocale, getPdfT } from "@/lib/pdf-i18n";
import {
  pdfMoney,
  pdfPercent,
  pdfQty,
  pdfShortDate,
  pdfSignedPercent,
  pdfTime,
  safePdfText,
} from "@/lib/pdf-utils";
import type { PremiumReportData } from "@/lib/simple-pdf";

type Tone = "navy" | "green" | "blue" | "amber" | "red" | "purple" | "slate";
type StockReportItem = NonNullable<PremiumReportData["stockItems"]>[number];

const ROWS_PER_STOCK_PAGE = 12;
const ROWS_PER_TABLE = 8;
const ROWS_PER_REGISTER = 14;

const palette: Record<Tone, { ink: string; bg: string; border: string }> = {
  navy: { ink: "#0b245c", bg: "#eef4ff", border: "#bfdbfe" },
  green: { ink: "#147a3f", bg: "#f0fdf4", border: "#bbf7d0" },
  blue: { ink: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  amber: { ink: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  red: { ink: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  purple: { ink: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  slate: { ink: "#475569", bg: "#f8fafc", border: "#cbd5e1" },
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 48,
    paddingHorizontal: 36,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#0b245c",
  },
  headerCompact: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#dbeafe",
  },
  brandBlock: { flexDirection: "row", alignItems: "center" },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#0b245c",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  logoText: { color: "#ffffff", fontSize: 15, fontWeight: "bold" },
  brand: { color: "#0b245c", fontSize: 11, fontWeight: "bold", letterSpacing: 1.2 },
  shopName: { color: "#64748b", fontSize: 8.5, marginTop: 1 },
  title: { color: "#0b245c", fontSize: 18, fontWeight: "bold", marginTop: 4 },
  titleCompact: { color: "#0b245c", fontSize: 13, fontWeight: "bold" },
  meta: { color: "#64748b", fontSize: 8, marginTop: 3 },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fbbf24",
    color: "#92400e",
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "center",
  },
  pageLabel: { color: "#64748b", fontSize: 8, textAlign: "right" },
  heroRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  heroMain: {
    flex: 1.6,
    borderRadius: 8,
    backgroundColor: "#0b245c",
    padding: 16,
  },
  heroSide: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#dbeafe",
    padding: 14,
  },
  heroKicker: {
    color: "#bfdbfe",
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  heroTitle: { color: "#ffffff", fontSize: 13, fontWeight: "bold", marginTop: 4 },
  heroValue: { color: "#ffffff", fontSize: 26, fontWeight: "bold", marginTop: 6 },
  heroSub: { color: "#dbeafe", fontSize: 8.5, lineHeight: 1.4, marginTop: 6 },
  heroStats: { flexDirection: "row", gap: 8, marginTop: 12 },
  heroStat: {
    flex: 1,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  heroStatLabel: { color: "#64748b", fontSize: 7 },
  heroStatValue: { color: "#0b245c", fontSize: 11, fontWeight: "bold", marginTop: 2 },
  scoreLabel: {
    color: "#64748b",
    fontSize: 7.5,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  scoreValue: { color: "#0b245c", fontSize: 24, fontWeight: "bold", marginTop: 2 },
  scoreText: { color: "#111827", fontSize: 10, fontWeight: "bold", marginTop: 2 },
  scoreTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    marginTop: 8,
  },
  scoreFill: { height: 6, borderRadius: 999 },
  section: {
    marginBottom: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#ffffff",
    padding: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
  },
  sectionTitleWrap: { flexDirection: "row", alignItems: "center" },
  sectionIndex: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: "#0b245c",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "center",
    paddingTop: 4,
    marginRight: 8,
  },
  sectionTitle: { color: "#0b245c", fontSize: 11, fontWeight: "bold" },
  sectionHint: { color: "#64748b", fontSize: 7.5 },
  twoCol: { flexDirection: "row", gap: 12 },
  colHalf: { width: "48%" },
  colFull: { width: "100%" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  metric: {
    width: "23%",
    minHeight: 58,
    borderRadius: 6,
    borderWidth: 1,
    padding: 8,
  },
  metricWide: { width: "48%" },
  metricLabel: { fontSize: 7.5, fontWeight: "bold", marginBottom: 4 },
  metricValue: { color: "#111827", fontSize: 14, fontWeight: "bold" },
  metricSub: { color: "#64748b", fontSize: 7, marginTop: 4 },
  snapshotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  snapshotCard: {
    width: "48%",
    borderRadius: 6,
    borderWidth: 1,
    padding: 8,
    minHeight: 58,
  },
  snapshotLabel: { fontSize: 7.5, fontWeight: "bold", marginBottom: 4 },
  snapshotValue: { color: "#111827", fontSize: 11, fontWeight: "bold" },
  snapshotNote: { color: "#64748b", fontSize: 7, marginTop: 4, lineHeight: 1.25 },
  table: {
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#eef4ff",
    borderBottomWidth: 1,
    borderBottomColor: "#dbeafe",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
    minHeight: 22,
  },
  tableHeadCell: {
    paddingVertical: 5,
    paddingHorizontal: 5,
    color: "#0b245c",
    fontSize: 7.5,
    fontWeight: "bold",
  },
  tableCell: {
    paddingVertical: 5,
    paddingHorizontal: 5,
    fontSize: 7.8,
    justifyContent: "center",
  },
  rowTitle: { color: "#111827", fontWeight: "bold", fontSize: 7.8 },
  subText: { color: "#64748b", fontSize: 6.8, marginTop: 1 },
  positive: { color: "#15803d", fontWeight: "bold" },
  negative: { color: "#dc2626", fontWeight: "bold" },
  warning: { color: "#b45309", fontWeight: "bold" },
  callout: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    padding: 8,
    marginTop: 8,
  },
  calloutTitle: { color: "#78350f", fontSize: 8.5, fontWeight: "bold", marginBottom: 3 },
  calloutText: { color: "#78350f", fontSize: 8, lineHeight: 1.35 },
  actionRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 6,
  },
  actionNo: {
    width: 16,
    height: 16,
    borderRadius: 4,
    color: "#ffffff",
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "center",
    paddingTop: 3,
    marginRight: 8,
  },
  actionText: { flex: 1, color: "#334155", fontSize: 8, lineHeight: 1.35 },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
  },
  trendDate: { width: "22%", color: "#475569", fontSize: 7.5 },
  trendTrack: {
    width: "40%",
    height: 6,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    marginRight: 6,
  },
  trendFill: { height: 6, borderRadius: 999 },
  trendValue: { width: "38%", color: "#111827", fontSize: 7.5, textAlign: "right" },
  chipRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  chip: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 6,
  },
  chipLabel: { color: "#64748b", fontSize: 7 },
  chipValue: { color: "#111827", fontSize: 10, fontWeight: "bold", marginTop: 2 },
  pill: {
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 5,
    fontSize: 6.5,
    fontWeight: "bold",
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#dbeafe",
    paddingTop: 6,
    color: "#64748b",
    fontSize: 7.5,
  },
  partDivider: {
    borderRadius: 8,
    backgroundColor: "#0b245c",
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  partDividerTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 0.8,
  },
  partDividerSub: {
    color: "#bfdbfe",
    fontSize: 8.5,
    marginTop: 4,
  },
  coverMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  coverMetaChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    paddingVertical: 4,
    paddingHorizontal: 8,
    color: "#92400e",
    fontSize: 7.5,
    fontWeight: "bold",
  },
  categoryHeader: {
    marginTop: 6,
    marginBottom: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: "#eef4ff",
  },
  categoryHeaderText: {
    color: "#0b245c",
    fontSize: 8,
    fontWeight: "bold",
  },
});

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks.length ? chunks : [[]];
}

type PdfLocale = {
  lang: "en" | "mr";
  t: ReturnType<typeof getPdfT>;
  fontFamily: string;
  text: (value: unknown, fallbackKey?: Parameters<ReturnType<typeof getPdfT>>[0], maxLength?: number) => string;
  money: (value: number | undefined | null) => string;
  pct: (value: number | undefined | null) => string;
  signedPct: (value: number | undefined | null) => string;
  shortDate: (value?: string) => string;
  time: (value?: string | number) => string;
};

function createPdfLocale(data: PremiumReportData): PdfLocale {
  const lang = data.language || "en";
  const t = getPdfT(lang);
  return {
    lang,
    t,
    fontFamily: getPdfFontFamily(lang),
    text: (value, fallbackKey = "na", maxLength = 42) =>
      safePdfText(value, t(fallbackKey), maxLength, lang),
    money: (value) => pdfMoney(value, lang),
    pct: (value) => pdfPercent(value),
    signedPct: (value) => pdfSignedPercent(value),
    shortDate: (value) => pdfShortDate(value, lang, t("na")),
    time: (value) => pdfTime(value, lang),
  };
}

function normalizePremiumReportData(data?: Partial<PremiumReportData> | null): PremiumReportData {
  return {
    label: data?.label || "Selected Period",
    sales: data?.sales || [],
    transactions: data?.transactions || 0,
    revenue: data?.revenue || 0,
    cost: data?.cost || 0,
    profit: data?.profit || 0,
    margin: data?.margin || 0,
    topItems: data?.topItems || [],
    itemPerformance: data?.itemPerformance || [],
    shopName: data?.shopName || "Dukan",
    shopAddress: data?.shopAddress,
    shopPhone: data?.shopPhone,
    ownerName: data?.ownerName,
    language: data?.language || "en",
    totalStockValue: data?.totalStockValue || 0,
    productsCount: data?.productsCount || 0,
    lowStockItems: data?.lowStockItems || [],
    totalPendingUdhari: data?.totalPendingUdhari || 0,
    highestUdharCustomer: data?.highestUdharCustomer || null,
    paymentBreakdown: data?.paymentBreakdown || {},
    totalItemsSold: data?.totalItemsSold || 0,
    averageBill: data?.averageBill || 0,
    comparison: data?.comparison,
    expiryAlerts: data?.expiryAlerts || [],
    brandDemand: data?.brandDemand || [],
    staffSales: data?.staffSales || [],
    stockItems: data?.stockItems || [],
    stockMovements: data?.stockMovements || [],
    categoryStockSummary: data?.categoryStockSummary || [],
    categorySalesSummary: data?.categorySalesSummary || [],
    udhariCustomers: data?.udhariCustomers || [],
    saleRegister: data?.saleRegister || [],
    batchInventory: data?.batchInventory || [],
    suggestions: data?.suggestions || [],
    dailyData: data?.dailyData || [],
    notifications: data?.notifications || [],
  };
}

function paymentName(method: string, loc: PdfLocale) {
  const labels: Record<string, string> = {
    cash: loc.t("cash"),
    card: loc.t("card"),
    partial: loc.t("partial"),
    udhar: loc.t("udhar"),
  };
  return labels[method] || loc.text(method, "other", 18);
}

function statusTone(status: StockReportItem["status"]): Tone {
  if (status === "out" || status === "expired") return "red";
  if (status === "low" || status === "expiring") return "amber";
  return "green";
}

function statusLabel(status: StockReportItem["status"], loc: PdfLocale) {
  const labels: Record<StockReportItem["status"], string> = {
    good: loc.t("good"),
    low: loc.t("low"),
    out: loc.t("outStatus"),
    expired: loc.t("expired"),
    expiring: loc.t("expiringStatus"),
  };
  return labels[status];
}

function batchStatusLabel(status: "active" | "expiring" | "expired", loc: PdfLocale) {
  const labels = {
    active: loc.t("active"),
    expiring: loc.t("expiringStatus"),
    expired: loc.t("expired"),
  };
  return labels[status];
}

function riskLabel(risk: "fresh" | "recover" | "high", loc: PdfLocale) {
  const labels = {
    fresh: loc.t("fresh"),
    recover: loc.t("recover"),
    high: loc.t("high"),
  };
  return labels[risk];
}

function movementLabel(type: string, loc: PdfLocale) {
  const labels: Record<string, string> = {
    purchase: loc.t("stockIn"),
    sale: loc.t("sale"),
    adjustment: loc.t("adjust"),
    damage: loc.t("damage"),
    expiry: loc.t("expiryType"),
  };
  return labels[type] || loc.text(type, "update", 14);
}

function comparisonLabel(value: string | undefined, loc: PdfLocale) {
  const labels: Record<string, string> = {
    previous_year: loc.lang === "mr" ? "मागील वर्ष" : "Previous year",
    previous_month: loc.lang === "mr" ? "मागील महिना" : "Previous month",
    yesterday: loc.lang === "mr" ? "काल" : "Yesterday",
    comparison: loc.t("previousPeriod"),
  };
  return labels[value || ""] || loc.text(value, "previousPeriod", 24);
}

function PageFooter({ label, loc }: { label: string; loc: PdfLocale }) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        DUKAN · {label}
      </Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `${loc.t("pageOf")} ${pageNumber} ${loc.t("of")} ${totalPages}`
        }
      />
    </View>
  );
}

function PartDivider({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.partDivider}>
      <Text style={styles.partDividerTitle}>{title}</Text>
      {subtitle ? <Text style={styles.partDividerSub}>{subtitle}</Text> : null}
    </View>
  );
}

function ReportHeader({
  data,
  generatedAt,
  loc,
  compact = false,
}: {
  data: PremiumReportData;
  generatedAt: Date;
  loc?: PdfLocale;
  compact?: boolean;
}) {
  const headerLoc = loc ?? createPdfLocale(data);
  loc = headerLoc;
  const locale = getPdfLocale(headerLoc.lang);
  if (compact) {
    return (
      <View style={styles.headerCompact}>
        <View>
          <Text style={styles.titleCompact}>
            {headerLoc.text(data.label, "selectedPeriod")} {headerLoc.t("report")}
          </Text>
          <Text style={styles.meta}>
            {loc.text(data.shopName, "dukanShop")} ·{" "}
            {generatedAt.toLocaleDateString(locale, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </View>
        <Text style={styles.badge}>{headerLoc.t("premiumReport")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <View style={styles.brandBlock}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>D</Text>
          </View>
          <View>
            <Text style={styles.brand}>DUKAN</Text>
            <Text style={styles.shopName}>{headerLoc.text(data.shopName, "dukanShop")}</Text>
            {data.ownerName ? (
              <Text style={styles.meta}>
                {headerLoc.t("owner")}: {headerLoc.text(data.ownerName, "unknown", 28)}
              </Text>
            ) : null}
            {data.shopPhone ? (
              <Text style={styles.meta}>
                {headerLoc.t("phone")}: {headerLoc.text(data.shopPhone, "na", 20)}
              </Text>
            ) : null}
            {data.shopAddress ? (
              <Text style={styles.meta}>
                {headerLoc.t("address")}: {headerLoc.text(data.shopAddress, "na", 48)}
              </Text>
            ) : null}
          </View>
        </View>
        <Text style={styles.title}>
          {headerLoc.text(data.label, "selectedPeriod")} {headerLoc.t("businessReport")}
        </Text>
        <Text style={styles.meta}>
          {headerLoc.t("generated")}{" "}
          {generatedAt.toLocaleDateString(locale, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}{" "}
          {headerLoc.t("at")}{" "}
          {generatedAt.toLocaleTimeString(locale, {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        </Text>
      </View>
      <Text style={styles.badge}>{headerLoc.t("premiumDukanReport")}</Text>
    </View>
  );
}

function Section({
  index,
  title,
  hint,
  tone = "navy",
  children,
}: {
  index: number;
  title: string;
  hint?: string;
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <View style={[styles.section, { borderColor: palette[tone].border }]}>
      <View style={styles.sectionHeader} minPresenceAhead={40}>
        <View style={styles.sectionTitleWrap}>
          <Text style={[styles.sectionIndex, { backgroundColor: palette[tone].ink }]}>
            {index}
          </Text>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Metric({
  label,
  value,
  sub,
  tone = "blue",
  wide = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  wide?: boolean;
}) {
  return (
    <View
      wrap={false}
      style={[
        wide ? styles.metricWide : styles.metric,
        { backgroundColor: palette[tone].bg, borderColor: palette[tone].border },
      ]}
    >
      <Text style={[styles.metricLabel, { color: palette[tone].ink }]}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
}

function SnapshotCard({
  label,
  value,
  note,
  tone = "blue",
}: {
  label: string;
  value: string;
  note: string;
  tone?: Tone;
}) {
  return (
    <View
      wrap={false}
      style={[
        styles.snapshotCard,
        { backgroundColor: palette[tone].bg, borderColor: palette[tone].border },
      ]}
    >
      <Text style={[styles.snapshotLabel, { color: palette[tone].ink }]}>{label}</Text>
      <Text style={styles.snapshotValue}>{value}</Text>
      <Text style={styles.snapshotNote}>{note}</Text>
    </View>
  );
}

function Table({
  headers,
  widths,
  rows,
}: {
  headers: string[];
  widths: string[];
  rows: ReactNode[][];
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHead}>
        {headers.map((header, index) => (
          <Text
            key={`${header}-${index}`}
            style={[styles.tableHeadCell, { width: widths[index] }]}
          >
            {header}
          </Text>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View
          key={rowIndex}
          wrap={false}
          style={[
            styles.tableRow,
            rowIndex === rows.length - 1 ? { borderBottomWidth: 0 } : {},
          ]}
        >
          {row.map((cell, cellIndex) => (
            <View
              key={`${rowIndex}-${cellIndex}`}
              style={[styles.tableCell, { width: widths[cellIndex] }]}
            >
              {typeof cell === "string" || typeof cell === "number" ? (
                <Text>{cell}</Text>
              ) : (
                cell
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <View
      style={[
        styles.callout,
        { marginTop: 0, backgroundColor: "#f8fafc", borderColor: "#e2e8f0" },
      ]}
    >
      <Text style={[styles.calloutText, { color: "#64748b" }]}>{children}</Text>
    </View>
  );
}

function TrendRow({
  label,
  revenue,
  profit,
  maxRevenue,
  loc,
}: {
  label: string;
  revenue: number;
  profit: number;
  maxRevenue: number;
  loc: PdfLocale;
}) {
  return (
    <View wrap={false} style={styles.trendRow}>
      <Text style={styles.trendDate}>{label}</Text>
      <View style={styles.trendTrack}>
        <View
          style={[
            styles.trendFill,
            {
              width: `${clamp((revenue / Math.max(maxRevenue, 1)) * 100)}%`,
              backgroundColor: profit >= 0 ? palette.green.ink : palette.red.ink,
            },
          ]}
        />
      </View>
      <Text style={styles.trendValue}>
        {loc.money(revenue)} / {loc.money(profit)}
      </Text>
    </View>
  );
}

function buildStockRows(items: StockReportItem[], loc: PdfLocale) {
  return items.map((item) => {
    const tone = statusTone(item.status);
    return [
      <View key={`name-${item.name}`}>
        <Text style={styles.rowTitle}>{loc.text(item.name, "item", 24)}</Text>
        <Text style={styles.subText}>
          {loc.text(item.brand, "noBrand", 18)} · {loc.text(item.categoryName, "uncategorized", 16)}
        </Text>
      </View>,
      `${pdfQty(item.quantity)} ${loc.text(item.unit, "item", 6)}`,
      loc.money(item.buyPrice),
      loc.money(item.sellPrice),
      loc.money(item.stockValue),
      <View key={`margin-${item.name}`}>
        <Text style={item.marginPercent >= 15 ? styles.positive : styles.warning}>
          {loc.pct(item.marginPercent)}
        </Text>
        <Text style={styles.subText}>
          {loc.money(item.marginAmount)}
          {loc.t("perUnit")}
        </Text>
      </View>,
      <Text
        key={`status-${item.name}`}
        style={[
          styles.pill,
          {
            color: palette[tone].ink,
            backgroundColor: palette[tone].bg,
            borderColor: palette[tone].border,
            borderWidth: 1,
          },
        ]}
      >
        {statusLabel(item.status, loc)}
      </Text>,
      <View key={`dates-${item.name}`}>
        <Text>
          {loc.t("limit")}: {pdfQty(item.lowStockLimit)}
        </Text>
        <Text style={styles.subText}>
          {loc.t("expiry")}: {loc.shortDate(item.expiryDate)}
        </Text>
        <Text style={styles.subText}>
          {loc.t("updated")}: {loc.shortDate(item.lastUpdated)} · {loc.t("sold")}:{" "}
          {loc.shortDate(item.lastSoldDate)}
        </Text>
      </View>,
    ];
  });
}

export const PremiumPdfReport = ({
  data: rawData,
}: {
  data?: Partial<PremiumReportData> | null;
}) => {
  const data = useMemo(() => normalizePremiumReportData(rawData), [rawData]);
  const generatedAt = useMemo(() => new Date(), []);
  const loc = useMemo(() => createPdfLocale(data), [data]);
  const pageStyle = useMemo(
    () => [styles.page, { fontFamily: loc.fontFamily }],
    [loc.fontFamily],
  );
  const reportLabel = loc.text(data.label, "selectedPeriodShort");

  const dailyData = useMemo(() => {
    if (data.dailyData?.length) return data.dailyData;
    const byDate = new Map<string, { revenue: number; cost: number; profit: number }>();
    data.sales.forEach((sale) => {
      const date = typeof sale?.date === "string" ? sale.date : "Unknown";
      const existing = byDate.get(date) || { revenue: 0, cost: 0, profit: 0 };
      byDate.set(date, {
        revenue: existing.revenue + Number(sale.subtotal || 0),
        cost: existing.cost + Number(sale.totalCost || 0),
        profit: existing.profit + Number(sale.totalProfit || 0),
      });
    });
    return Array.from(byDate.entries())
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data.dailyData, data.sales]);

  const itemPerformance = useMemo(() => {
    if (data.itemPerformance?.length) return data.itemPerformance;
    return data.topItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      revenue: item.revenue,
      cost: item.revenue - item.profit,
      profit: item.profit,
      margin: item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0,
    }));
  }, [data.itemPerformance, data.topItems]);

  const stockItems = data.stockItems || [];
  const stockPages = chunkArray(stockItems, ROWS_PER_STOCK_PAGE);
  const stockSummary = {
    out: stockItems.filter((item) => item.status === "out").length,
    low: stockItems.filter((item) => item.status === "low").length,
    expired: stockItems.filter((item) => item.status === "expired").length,
    expiring: stockItems.filter((item) => item.status === "expiring").length,
    healthy: stockItems.filter((item) => item.status === "good").length,
  };

  const paymentRows = Object.entries(data.paymentBreakdown)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 4);
  const paymentTotal = paymentRows.reduce((sum, [, entry]) => sum + entry.amount, 0);

  const topItems = itemPerformance.slice(0, 6);
  const topRevenue = Math.max(...topItems.map((item) => item.revenue), 1);
  const goodMarginItems = [...itemPerformance]
    .filter((item) => item.profit > 0)
    .sort((a, b) => b.margin - a.margin)
    .slice(0, ROWS_PER_TABLE);
  const lowMarginItems = [...itemPerformance]
    .filter((item) => item.profit >= 0 && item.margin < 10)
    .sort((a, b) => a.margin - b.margin)
    .slice(0, ROWS_PER_TABLE);
  const lossItems = [...itemPerformance]
    .filter((item) => item.profit < 0)
    .sort((a, b) => a.profit - b.profit)
    .slice(0, ROWS_PER_TABLE);
  const bestProfitItem = [...itemPerformance].sort((a, b) => b.profit - a.profit)[0];
  const bestStaff = data.staffSales?.[0];
  const bestBrand = data.brandDemand?.[0];
  const reportComparisonLabel = comparisonLabel(data.comparison?.label, loc);

  const stockHealth = data.productsCount
    ? ((data.productsCount - data.lowStockItems.length - stockSummary.out) /
        data.productsCount) *
      100
    : 0;

  const stockMovements = data.stockMovements || [];
  const movementPages = chunkArray(stockMovements, ROWS_PER_TABLE);
  const categoryStock = data.categoryStockSummary || [];
  const categorySales = data.categorySalesSummary || [];
  const expiryAlerts = data.expiryAlerts || [];
  const udhariCustomers = data.udhariCustomers || [];
  const saleRegister = data.saleRegister || [];
  const batchInventory = data.batchInventory || [];
  const notifications = data.notifications || [];
  const saleRegisterPages = chunkArray(saleRegister, ROWS_PER_REGISTER);
  const batchPages = chunkArray(batchInventory, ROWS_PER_TABLE);
  const lowStockRegister = stockItems.filter(
    (item) => item.status === "low" || item.status === "out",
  );
  const actionItems =
    data.suggestions && data.suggestions.length > 0
      ? data.suggestions
      : [loc.t("defaultAction1"), loc.t("defaultAction2"), loc.t("defaultAction3")];

  const stockRiskCount =
    stockSummary.out + stockSummary.low + stockSummary.expired + stockSummary.expiring;
  const creditPressure =
    data.revenue > 0
      ? (data.totalPendingUdhari / data.revenue) * 100
      : data.totalPendingUdhari > 0
        ? 100
        : 0;

  const reportScore = Math.round(
    clamp(
      55 +
        clamp(data.margin, -20, 35) * 0.7 +
        (data.profit > 0 ? 8 : data.profit < 0 ? -18 : 0) +
        clamp(data.comparison?.revenueChange ?? 0, -40, 40) * 0.25 -
        Math.min(stockRiskCount * 2, 16) -
        (creditPressure > 70 ? 8 : creditPressure > 35 ? 4 : 0),
    ),
  );

  const scoreTone: Tone =
    reportScore >= 75 ? "green" : reportScore >= 55 ? "amber" : "red";
  const scoreLabel =
    reportScore >= 80
      ? loc.t("strongPeriod")
      : reportScore >= 65
        ? loc.t("healthyPeriod")
        : reportScore >= 50
          ? loc.t("needsAttention")
          : loc.t("atRisk");

  const urgentStock = stockItems.find((item) => item.status !== "good");
  const biggestRisk = lossItems[0]
    ? `${loc.text(lossItems[0].name, "item", 22)} · ${loc.money(lossItems[0].profit)}`
    : urgentStock
      ? `${loc.text(urgentStock.name, "item", 22)} · ${statusLabel(urgentStock.status, loc)}`
      : data.totalPendingUdhari > 0
        ? `${loc.money(data.totalPendingUdhari)} ${loc.t("pending")}`
        : loc.t("noMajorRisk");

  const bestOpportunity = bestProfitItem
    ? `${loc.text(bestProfitItem.name, "item", 22)} · ${loc.money(bestProfitItem.profit)}`
    : bestBrand
      ? `${loc.text(bestBrand.topBrand, "unknown", 18)}`
      : loc.t("addSalesData");

  const trendRows = dailyData.slice(-7);
  const maxTrendRevenue = Math.max(...trendRows.map((entry) => entry.revenue), 1);
  const alertCount =
    stockRiskCount +
    expiryAlerts.length +
    lossItems.length +
    (data.totalPendingUdhari > 0 ? 1 : 0);

  let sectionIndex = 1;
  const stockSectionIndex = sectionIndex;
  const movementSectionIndex = sectionIndex;

  const money = (v: number | undefined | null) => loc.money(v);
  const pct = (v: number | undefined | null) => loc.pct(v);
  const signedPct = (v: number | undefined | null) => loc.signedPct(v);
  const safeText = (v: unknown, fallback: string, max = 42) =>
    safePdfText(v, fallback, max, loc.lang);
  const shortDate = (v?: string) => loc.shortDate(v);
  const stockPageHint = (pageIndex: number) =>
    pageIndex === 0
      ? `${pdfQty(stockItems.length)} ${loc.t("currentInventory")}`
      : `${loc.t("items")} ${pdfQty(pageIndex * ROWS_PER_STOCK_PAGE + 1)}-${pdfQty(
          Math.min((pageIndex + 1) * ROWS_PER_STOCK_PAGE, stockItems.length),
        )} ${loc.t("of")} ${pdfQty(stockItems.length)}`;

  return (
    <Document title={`${reportLabel} Dukan Report`} author="Dukan">
      <Page size="A4" style={pageStyle}>
        <ReportHeader data={data} generatedAt={generatedAt} loc={loc} />

        <View style={styles.coverMetaRow}>
          <Text style={styles.coverMetaChip}>
            {pdfQty(data.transactions)} {loc.t("bills")}
          </Text>
          <Text style={styles.coverMetaChip}>
            {pdfQty(stockSummary.low + stockSummary.out)} {loc.t("low")}/{loc.t("out")}
          </Text>
          <Text style={styles.coverMetaChip}>
            {pdfQty(expiryAlerts.length)} {loc.t("expiry")}
          </Text>
          <Text style={styles.coverMetaChip}>
            {loc.money(data.totalPendingUdhari)} {loc.t("udhar")}
          </Text>
        </View>

        <View style={styles.heroRow}>
          <View style={styles.heroMain}>
            <Text style={styles.heroKicker}>{loc.t("executiveSummary")}</Text>
            <Text style={styles.heroTitle}>
              {reportLabel} {loc.t("performance")}
            </Text>
            <Text style={styles.heroValue}>{loc.money(data.revenue)}</Text>
            <Text style={styles.heroSub}>
              {data.comparison
                ? `${loc.signedPct(data.comparison.revenueChange)} ${loc.t("sales")} ${loc.t("and")} ${loc.signedPct(data.comparison.profitChange)} ${loc.t("profit")} ${loc.t("vs")} ${reportComparisonLabel}.`
                : `${pdfQty(data.transactions)} ${loc.t("bills")} · ${pdfQty(data.totalItemsSold)} ${loc.t("itemsSoldLabel")}`}
            </Text>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>{loc.t("profit")}</Text>
                <Text style={styles.heroStatValue}>{loc.money(data.profit)}</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>{loc.t("margin")}</Text>
                <Text style={styles.heroStatValue}>{loc.pct(data.margin)}</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>{loc.t("stockValue")}</Text>
                <Text style={styles.heroStatValue}>{loc.money(data.totalStockValue)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.heroSide}>
            <Text style={styles.scoreLabel}>{loc.t("healthScore")}</Text>
            <Text style={styles.scoreValue}>{reportScore}/100</Text>
            <Text style={[styles.scoreText, { color: palette[scoreTone].ink }]}>
              {scoreLabel}
            </Text>
            <View style={styles.scoreTrack}>
              <View
                style={[
                  styles.scoreFill,
                  { width: `${reportScore}%`, backgroundColor: palette[scoreTone].ink },
                ]}
              />
            </View>
            <Text style={[styles.meta, { marginTop: 8 }]}>
              {pdfQty(stockRiskCount)} {loc.t("stockAlerts")} · {pdfQty(lossItems.length)}{" "}
              {loc.t("lossItems")} · {loc.pct(creditPressure)} {loc.t("udhariPressure")}
            </Text>
            <Text style={[styles.meta, { marginTop: 4 }]}>
              {pdfQty(alertCount)} {loc.t("alertStrip")}
            </Text>
          </View>
        </View>

        <Section index={sectionIndex++} title={loc.t("ownerSnapshot")} tone="navy">
          <View style={styles.snapshotGrid}>
            <SnapshotCard
              label={loc.t("bestSeller")}
              value={topItems[0] ? loc.text(topItems[0].name, "item", 22) : loc.t("noSale")}
              note={
                topItems[0]
                  ? `${loc.money(topItems[0].revenue)} ${loc.t("sales")}`
                  : loc.t("noItemSold")
              }
              tone="green"
            />
            <SnapshotCard
              label={loc.t("profitLeader")}
              value={bestProfitItem ? loc.text(bestProfitItem.name, "item", 22) : loc.t("noItem")}
              note={
                bestProfitItem
                  ? `${loc.money(bestProfitItem.profit)} ${loc.t("profit")}`
                  : loc.t("profitAfterSales")
              }
              tone="blue"
            />
            <SnapshotCard
              label={loc.t("workerLeader")}
              value={bestStaff ? loc.text(bestStaff.staffName, "worker", 22) : loc.t("noWorker")}
              note={
                bestStaff
                  ? `${loc.money(bestStaff.revenue)} ${loc.t("sales")}`
                  : loc.t("linkStaff")
              }
              tone="purple"
            />
            <SnapshotCard
              label={loc.t("stockFocus")}
              value={urgentStock ? loc.text(urgentStock.name, "item", 22) : loc.t("stockOk")}
              note={
                urgentStock
                  ? `${statusLabel(urgentStock.status, loc)} · ${pdfQty(urgentStock.quantity)} ${loc.text(urgentStock.unit, "item", 6)}`
                  : `${pdfQty(stockSummary.healthy)} ${loc.t("healthyItems")}`
              }
              tone={urgentStock ? statusTone(urgentStock.status) : "green"}
            />
          </View>
          <View style={styles.callout}>
            <Text style={styles.calloutTitle}>{loc.t("priorityAction")}</Text>
            <Text style={styles.calloutText}>
              {loc.text(actionItems[0], "reviewSalesStock", 160)}
            </Text>
          </View>
        </Section>

        <PageFooter label={reportLabel} loc={loc} />
      </Page>

      {/* Page 2 — Profit watch & daily trend */}
      <Page size="A4" style={pageStyle}>
        <ReportHeader data={data} generatedAt={generatedAt} loc={loc} compact />

        <Section
          index={sectionIndex++}
          title={loc.t("profitWatch")}
          tone={lossItems.length > 0 ? "red" : "green"}
        >
          <Table
            headers={[loc.t("metric"), loc.t("value"), loc.t("recommendations")]}
            widths={["28%", "22%", "50%"]}
            rows={[
              [
                loc.t("opportunity"),
                bestProfitItem ? money(bestProfitItem.profit) : loc.t("na"),
                bestOpportunity,
              ],
              [loc.t("biggestRisk"), lossItems[0] ? money(lossItems[0].profit) : loc.t("na"), biggestRisk],
              [loc.t("lowMargin"), formatNumber(lowMarginItems.length), loc.t("lowMarginCount")],
              [loc.t("stockAlertsTitle"), formatNumber(stockRiskCount), loc.t("stockAlerts")],
            ]}
          />
        </Section>

        <View style={styles.twoCol}>
          <View style={styles.colHalf}>
            <Section index={sectionIndex++} title={loc.t("immediateActions")} tone="amber">
              {actionItems.slice(0, 5).map((action, index) => (
                <View
                  key={index}
                  wrap={false}
                  style={[
                    styles.actionRow,
                    index === Math.min(actionItems.length, 5) - 1
                      ? { borderBottomWidth: 0 }
                      : {},
                  ]}
                >
                  <Text
                    style={[
                      styles.actionNo,
                      {
                        backgroundColor:
                          index === 0
                            ? palette.red.ink
                            : index === 1
                              ? palette.amber.ink
                              : palette.blue.ink,
                      },
                    ]}
                  >
                    {index + 1}
                  </Text>
                  <Text style={styles.actionText}>{safeText(action, "Suggestion", 130)}</Text>
                </View>
              ))}
            </Section>
          </View>

          <View style={styles.colHalf}>
            <Section index={sectionIndex++} title={loc.t("dailySalesMovement")} tone="green">
              {trendRows.length > 0 ? (
                trendRows.slice(-6).map((entry, index) => (
                  <TrendRow
                    key={`${entry.date}-${index}`}
                    label={shortDate(entry.date)}
                    revenue={entry.revenue}
                    profit={entry.profit}
                    maxRevenue={maxTrendRevenue}
                    loc={loc}
                  />
                ))
              ) : (
                <Empty>{loc.t("noSaleRegister")}</Empty>
              )}
              <Text style={styles.subText}>{loc.t("salesProfitFormat")}</Text>
            </Section>
          </View>
        </View>

        <PageFooter label={safeText(data.label, "Report")} loc={loc} />
      </Page>

      {/* Page 3 — Sales analysis */}
      <Page size="A4" style={pageStyle}>
        <ReportHeader data={data} generatedAt={generatedAt} loc={loc} compact />

        <Section
          index={sectionIndex++}
          title={loc.t("salesAnalysis")}
          hint={`${loc.t("vs")} ${reportComparisonLabel}`}
          tone="green"
        >
          <View style={styles.metricGrid}>
            <Metric
              label={loc.t("totalSales")}
              value={money(data.revenue)}
              sub={
                data.comparison
                  ? `${signedPct(data.comparison.revenueChange)} ${loc.t("from")} ${reportComparisonLabel}`
                  : `${formatNumber(data.transactions)} ${loc.t("bills")}`
              }
              tone="green"
            />
            <Metric
              label={loc.t("totalBills")}
              value={formatNumber(data.transactions)}
              sub={`${loc.t("averageBill")} ${money(data.averageBill)}`}
              tone="blue"
            />
            <Metric
              label={loc.t("itemsSold")}
              value={formatNumber(data.totalItemsSold)}
              sub={loc.t("quantityMoved")}
              tone="purple"
            />
            <Metric
              label={loc.t("udhariSales")}
              value={money(data.paymentBreakdown.udhar?.amount || 0)}
              sub={`${data.paymentBreakdown.udhar?.count || 0} ${loc.t("bills")}`}
              tone="amber"
            />
          </View>

          <Table
            headers={[loc.t("metric"), loc.t("thisReport"), reportComparisonLabel, loc.t("change")]}
            widths={["28%", "24%", "24%", "24%"]}
            rows={[
              [
                <Text style={styles.rowTitle}>{loc.t("sales")}</Text>,
                money(data.revenue),
                data.comparison ? money(data.comparison.revenue) : loc.t("na"),
                <Text
                  style={
                    data.comparison && data.comparison.revenueChange < 0
                      ? styles.negative
                      : styles.positive
                  }
                >
                  {data.comparison ? signedPct(data.comparison.revenueChange) : loc.t("na")}
                </Text>,
              ],
              [
                <Text style={styles.rowTitle}>{loc.t("profit")}</Text>,
                money(data.profit),
                data.comparison ? money(data.comparison.profit) : loc.t("na"),
                <Text
                  style={
                    data.comparison && data.comparison.profitChange < 0
                      ? styles.negative
                      : styles.positive
                  }
                >
                  {data.comparison ? signedPct(data.comparison.profitChange) : loc.t("na")}
                </Text>,
              ],
              [
                <Text style={styles.rowTitle}>{loc.t("margin")}</Text>,
                pct(data.margin),
                data.comparison ? pct(data.comparison.margin) : loc.t("na"),
                <Text
                  style={
                    data.comparison && data.comparison.marginChange < 0
                      ? styles.negative
                      : styles.positive
                  }
                >
                  {data.comparison ? signedPct(data.comparison.marginChange) : loc.t("na")}
                </Text>,
              ],
              [
                <Text style={styles.rowTitle}>{loc.t("bills")}</Text>,
                formatNumber(data.transactions),
                data.comparison ? formatNumber(data.comparison.transactions) : loc.t("na"),
                data.comparison
                  ? formatNumber(data.transactions - data.comparison.transactions)
                  : loc.t("na"),
              ],
            ]}
          />

          <View style={styles.chipRow}>
            {paymentRows.length > 0 ? (
              paymentRows.map(([method, entry]) => (
                <View key={method} wrap={false} style={styles.chip}>
                  <Text style={styles.chipLabel}>{paymentName(method, loc)}</Text>
                  <Text style={styles.chipValue}>{money(entry.amount)}</Text>
                  <Text style={styles.subText}>
                    {paymentTotal > 0 ? pct((entry.amount / paymentTotal) * 100) : "0%"}{" "}
                    {loc.t("mix")}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.chip}>
                <Text style={styles.chipLabel}>{loc.t("payments")}</Text>
                <Text style={styles.chipValue}>{loc.t("noSale")}</Text>
              </View>
            )}
          </View>
        </Section>

        <PageFooter label={safeText(data.label, "Report")} loc={loc} />
      </Page>

      {/* Page 4 — Profit, workers, top items */}
      <Page size="A4" style={pageStyle}>
        <ReportHeader data={data} generatedAt={generatedAt} loc={loc} compact />

        <Section index={sectionIndex++} title={loc.t("profitMargin")} tone="blue">
          <View style={styles.metricGrid}>
            <Metric
              label={loc.t("totalCost")}
              value={money(data.cost)}
              sub={loc.t("soldStockCost")}
              tone="slate"
              wide
            />
            <Metric
              label={loc.t("totalProfit")}
              value={money(data.profit)}
              sub={`${pct(data.margin)} ${loc.t("margin")}`}
              tone={data.profit >= 0 ? "green" : "red"}
              wide
            />
          </View>

          {goodMarginItems.length > 0 ? (
            <Table
              headers={[loc.t("goodMarginItem"), loc.t("sales"), loc.t("profit"), loc.t("margin")]}
              widths={["42%", "20%", "20%", "18%"]}
              rows={goodMarginItems.map((item) => [
                <Text style={styles.rowTitle}>{safeText(item.name, "Item", 28)}</Text>,
                money(item.revenue),
                money(item.profit),
                <Text style={styles.positive}>{pct(item.margin)}</Text>,
              ])}
            />
          ) : (
            <Empty>{loc.t("noGoodMargin")}</Empty>
          )}

          {(lowMarginItems.length > 0 || lossItems.length > 0) && (
            <View style={styles.callout}>
              <Text style={styles.calloutTitle}>{loc.t("marginWatch")}</Text>
              <Text style={styles.calloutText}>
                {lossItems.length > 0
                  ? `${lossItems.length} ${loc.t("lossSold")}`
                  : `${lowMarginItems.length} ${loc.t("lowMarginSold")}`}
              </Text>
            </View>
          )}
        </Section>

        <Section index={sectionIndex++} title={loc.t("workerWiseSales")} tone="purple">
          {data.staffSales?.length ? (
            <Table
              headers={[loc.t("worker"), loc.t("sales"), loc.t("profit"), loc.t("bills"), loc.t("udhar")]}
              widths={["30%", "22%", "20%", "13%", "15%"]}
              rows={data.staffSales.slice(0, 7).map((worker) => [
                <View>
                  <Text style={styles.rowTitle}>{safeText(worker.staffName, "Worker", 20)}</Text>
                  <Text style={styles.subText}>{loc.t("avg")} {money(worker.averageBill)}</Text>
                </View>,
                money(worker.revenue),
                <Text style={(worker.profit || 0) >= 0 ? styles.positive : styles.negative}>
                  {money(worker.profit || 0)}
                </Text>,
                formatNumber(worker.transactions),
                money(worker.udhariAmount || 0),
              ])}
            />
          ) : (
            <Empty>{loc.t("noStaffSales")}</Empty>
          )}
        </Section>

        <Section index={sectionIndex++} title={loc.t("topSoldItems")} tone="green">
          {topItems.length > 0 ? (
            <Table
              headers={[loc.t("item"), loc.t("qty"), loc.t("sales"), loc.t("profit")]}
              widths={["42%", "16%", "22%", "20%"]}
              rows={topItems.map((item) => [
                <Text style={styles.rowTitle}>{safeText(item.name, "Item", 28)}</Text>,
                formatNumber(item.quantity),
                money(item.revenue),
                <Text style={item.profit >= 0 ? styles.positive : styles.negative}>
                  {money(item.profit)}
                </Text>,
              ])}
            />
          ) : (
            <Empty>{loc.t("noTopItems")}</Empty>
          )}
        </Section>

        <PageFooter label={safeText(data.label, "Report")} loc={loc} />
      </Page>

      {/* Stock inventory — one dedicated page per chunk */}
      {stockPages.map((chunk, pageIndex) => (
        <Page key={`stock-page-${pageIndex}`} size="A4" style={pageStyle}>
          <ReportHeader data={data} generatedAt={generatedAt} loc={loc} compact />

          <Section
            index={stockSectionIndex}
            title={
              pageIndex === 0
                ? loc.t("stockInventory")
                : loc.t("stockInventoryContinued")
            }
            hint={stockPageHint(pageIndex)}
            tone="amber"
          >
            {pageIndex === 0 && (
              <View style={styles.metricGrid}>
                <Metric
                  label={loc.t("stockValue")}
                  value={money(data.totalStockValue)}
                  sub={loc.t("currentInventoryWorth")}
                  tone="purple"
                  wide
                />
                <Metric
                  label={loc.t("totalItems")}
                  value={formatNumber(data.productsCount)}
                  sub={`${pdfQty(stockSummary.healthy)} ${loc.t("healthy")}`}
                  tone="blue"
                  wide
                />
                <Metric
                  label={loc.t("needAttention")}
                  value={formatNumber(
                    stockSummary.low +
                      stockSummary.out +
                      stockSummary.expired +
                      stockSummary.expiring,
                  )}
                  sub={`${pdfQty(stockSummary.out)} ${loc.t("out")} - ${pdfQty(stockSummary.low)} ${loc.t("low")}`}
                  tone={stockSummary.low + stockSummary.out > 0 ? "red" : "green"}
                  wide
                />
                <Metric
                  label={loc.t("stockHealth")}
                  value={pct(stockHealth)}
                  sub={`${pdfQty(stockSummary.expired + stockSummary.expiring)} ${loc.t("expiryAlertsCount")}`}
                  tone={stockHealth >= 75 ? "green" : "amber"}
                  wide
                />
              </View>
            )}

            {chunk.length > 0 ? (
              <Table
                headers={[loc.t("item"), loc.t("stockValue"), loc.t("value"), loc.t("margin"), loc.t("status"), loc.t("dates")]}
                widths={["30%", "14%", "15%", "14%", "12%", "15%"]}
                rows={buildStockRows(chunk, loc)}
              />
            ) : (
              <Empty>{loc.t("noStockItems")}</Empty>
            )}
          </Section>

          <PageFooter label={safeText(data.label, "Report")} loc={loc} />
        </Page>
      ))}

      {/* Stock movements */}
      {stockMovements.length > 0 &&
        movementPages.map((chunk, pageIndex) => (
        <Page key={`movement-page-${pageIndex}`} size="A4" style={pageStyle}>
          <ReportHeader data={data} generatedAt={generatedAt} loc={loc} compact />

          <Section
            index={movementSectionIndex}
            title={
              pageIndex === 0
                ? loc.t("stockMovements")
                : loc.t("stockMovementsContinued")
            }
            tone="blue"
          >
            {chunk.length > 0 ? (
              <Table
                headers={[loc.t("date"), loc.t("item"), loc.t("type"), loc.t("change"), loc.t("after")]}
                widths={["18%", "34%", "17%", "16%", "15%"]}
                rows={chunk.map((movement) => [
                  shortDate(movement.date),
                  <Text style={styles.rowTitle}>
                    {safeText(movement.itemName, "Item", 24)}
                  </Text>,
                  movementLabel(movement.type, loc),
                  <Text
                    style={
                      movement.quantityChanged < 0 ? styles.negative : styles.positive
                    }
                  >
                    {formatNumber(movement.quantityChanged)}
                  </Text>,
                  formatNumber(movement.quantityAfter),
                ])}
              />
            ) : (
              <Empty>{loc.t("noMovements")}</Empty>
            )}
          </Section>

          <PageFooter label={safeText(data.label, "Report")} loc={loc} />
        </Page>
      ))}

      {/* Udhari & insights */}
      <Page size="A4" style={pageStyle}>
        <ReportHeader data={data} generatedAt={generatedAt} loc={loc} compact />

        <Section index={11} title={loc.t("udhariPosition")} tone="red">
          <View style={styles.metricGrid}>
            <Metric
              label={loc.t("totalPending")}
              value={money(data.totalPendingUdhari)}
              sub={loc.t("allCustomers")}
              tone="red"
              wide
            />
            <Metric
              label={loc.t("reportUdhari")}
              value={money(data.paymentBreakdown.udhar?.amount || 0)}
              sub={`${data.paymentBreakdown.udhar?.count || 0} ${loc.t("bills")}`}
              tone="amber"
              wide
            />
          </View>
          {data.highestUdharCustomer ? (
            <View style={[styles.callout, { marginTop: 0 }]}>
              <Text style={styles.calloutTitle}>{loc.t("collectFirst")}</Text>
              <Text style={styles.calloutText}>
                {safeText(data.highestUdharCustomer.name, loc.t("customer"), 24)}{" "}
                {loc.t("hasPending")} {money(data.highestUdharCustomer.balance)}{" "}
                {loc.t("pending")}
              </Text>
            </View>
          ) : (
            <Empty>{loc.t("noUdhariCustomer")}</Empty>
          )}
        </Section>

        <View style={styles.twoCol}>
          <View style={styles.colHalf}>
            <Section index={12} title={loc.t("brandComparison")} tone="purple">
              {data.brandDemand?.length ? (
                <Table
                  headers={[loc.t("product"), loc.t("comparedBrands"), loc.t("sales"), loc.t("share")]}
                  widths={["28%", "36%", "20%", "16%"]}
                  rows={data.brandDemand.slice(0, 6).map((item) => [
                    <Text style={styles.rowTitle}>
                      {safeText(item.productName, loc.t("product"), 20)}
                    </Text>,
                    safeText(item.topBrands?.join(" | ") || item.topBrand, loc.t("topBrand"), 42),
                    money(item.topBrandRevenue),
                    <Text style={styles.positive}>
                      {pct(
                        Math.abs(item.topBrandShare) <= 1
                          ? item.topBrandShare * 100
                          : item.topBrandShare,
                      )}
                    </Text>,
                  ])}
                />
              ) : (
                <Empty>
                  {loc.t("noBrandComparison")}
                </Empty>
              )}
            </Section>
          </View>

          <View style={styles.colHalf}>
            <Section
              index={13}
              title={loc.t("lowMarginLoss")}
              tone="red"
            >
              {lossItems.length > 0 ? (
                <Table
                  headers={[loc.t("lossItem"), loc.t("sales"), loc.t("loss"), loc.t("margin")]}
                  widths={["40%", "20%", "20%", "20%"]}
                  rows={lossItems.map((item) => [
                    <Text style={styles.rowTitle}>{safeText(item.name, loc.t("item"), 22)}</Text>,
                    money(item.revenue),
                    <Text style={styles.negative}>{money(item.profit)}</Text>,
                    <Text style={styles.negative}>{pct(item.margin)}</Text>,
                  ])}
                />
              ) : lowMarginItems.length > 0 ? (
                <Table
                  headers={[loc.t("lowMargin"), loc.t("sales"), loc.t("profit"), loc.t("margin")]}
                  widths={["40%", "20%", "20%", "20%"]}
                  rows={lowMarginItems.map((item) => [
                    <Text style={styles.rowTitle}>{safeText(item.name, loc.t("item"), 22)}</Text>,
                    money(item.revenue),
                    money(item.profit),
                    <Text style={styles.warning}>{pct(item.margin)}</Text>,
                  ])}
                />
              ) : (
                <Empty>{loc.t("noLossItems")}</Empty>
              )}
            </Section>
          </View>
        </View>

        <Section index={14} title={loc.t("recommendations")} tone="amber">
          {actionItems.slice(0, 6).map((action, index) => (
            <View
              key={index}
              wrap={false}
              style={[
                styles.actionRow,
                index === Math.min(actionItems.length, 6) - 1
                  ? { borderBottomWidth: 0 }
                  : {},
              ]}
            >
              <Text
                style={[
                  styles.actionNo,
                  {
                    backgroundColor:
                      index === 0
                        ? palette.red.ink
                        : index === 1
                          ? palette.amber.ink
                          : palette.blue.ink,
                  },
                ]}
              >
                {index + 1}
              </Text>
              <Text style={styles.actionText}>{safeText(action, loc.t("suggestion"), 120)}</Text>
            </View>
          ))}
          <View style={styles.callout}>
            <Text style={styles.calloutTitle}>{loc.t("ownerFocus")}</Text>
            <Text style={styles.calloutText}>{loc.t("ownerFocusText")}</Text>
          </View>
        </Section>

        <PageFooter label={safeText(data.label, "Report")} loc={loc} />
      </Page>
    </Document>
  );
};
