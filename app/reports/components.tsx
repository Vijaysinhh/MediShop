"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeIndianRupee,
  BarChart3,
  Boxes,
  Calendar,
  CreditCard,
  Clock,
  Download,
  Printer,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
  HeartPulse,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/auth-provider";
import { useLanguage } from "@/providers/language-provider";
import {
  useBatches,
  useCategories,
  useItems,
  useSales,
  useStockHistory,
  useUdhari,
} from "@/hooks/use-supabase";
import { getCreditPressure } from "@/lib/dukan-insights";
import { PageContainer, PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney, formatNumber, formatPercent } from "@/lib/number-format";
import { cn, dateKey } from "@/lib/utils";

type Period = "today" | "month" | "sixMonths" | "year" | "specificMonth";
type Tone = "green" | "amber" | "red" | "blue" | "purple" | "slate";
export type ReportSection = "overview" | "sales" | "stock" | "udhari";
type CopyText = (typeof copy)["en"] | (typeof copy)["mr"];

const copy = {
  en: {
    title: "Pharmacy Reports",
    description: "Sales, profit, medicine stock, payment, and udhari insights.",
    print: "Print / Save",
    today: "Today",
    sixMonths: "6 months",
    specificMonth: "Specific month",
    month: "This month",
    year: "This year",
    totalStock: "Total stock value",
    cashCredit: "Cash vs credit sales",
    netProfit: "Net profit",
    margin: "Profit margin",
    cash: "Cash",
    credit: "Credit",
    partial: "Partial",
    averageBill: "Average bill",
    unitsSold: "Units sold",
    salesTrend: "Sales trend",
    categoryPerformance: "Category performance",
    inventoryExposure: "Inventory exposure",
    stockMovement: "Stock movement",
    purchased: "Purchased",
    damaged: "Damaged",
    expired: "Expired",
    expiredLoss: "Expired loss",
    expiredProducts: "Expired products",
    damagedLoss: "Damage loss",
    pendingTotal: "Total pending",
    oldestDebt: "Oldest pending",
    salesStory: "Sales story",
    profitStory: "Profit story",
    stockStory: "Stock story",
    brandComparison: "Brand comparison",
    udhariRecovery: "Udhari recovery",
    rawExplore: "Raw data overview",
    topSellers: "Top sellers",
    paymentSplit: "Payment split",
    highMargin: "High-margin items",
    lowMargin: "Low-margin watch",
    lowStock: "Restock soon",
    expiry: "Expiry watch",
    noData: "No useful data yet for this period.",
    noBrands:
      "Add the same product under multiple brands to compare performance.",
    collectFirst: "Collect first",
    stockOk: "Stock is mostly okay.",
    item: "Item",
    sales: "Sales",
    profit: "Profit",
    stock: "Stock",
    brand: "Brand",
    customer: "Customer",
    balance: "Balance",
    quantity: "Qty",
    comparison: "vs previous period",
    salesChange: "Sales change",
    profitChange: "Profit change",
    lossChange: "Loss change",
    insight: "Owner insight",
    billRegister: "Bill register",
    bill: "Bill",
    date: "Date",
    payment: "Payment",
    aging: "Aging overview",
    customers: "Customers",
    collected: "Collected",
    creditGiven: "Credit given",
    collectionRate: "Collection rate",
    days: "days",
    profitContribution: "Profit contribution",
    slowStock: "Slow-moving stock",
    deadStock: "No recent sales",
    stockAtRisk: "Stock value at risk",
    reviewStock: "Review, discount, or bundle these products.",
    lossBreakdown: "Loss by product",
    lossBreakdownHint: "Find the products responsible for realized stock loss.",
    marginLeak: "High sales, low profit",
    marginLeakHint: "These products bring revenue but weaken your margin.",
    period: "Period",
    chooseMonth: "Choose month",
    chooseDate: "Choose date",
    quickStats: "Quick look",
    allBills: "All bills",
    noBills: "No bills yet in this period.",
    currentStock: "Current stock (today)",
    pendingNow: "Pending right now",
    notPeriod: "Not period-based",
    moneyIn: "Money in",
    moneyInNote: "Cash + online + partial",
    bestDay: "Best day",
    weakestDay: "Quietest day",
    peakHour: "Peak hour",
    weekdayMix: "Weekday mix",
    daysCover: "Stock cover",
    daysCoverNote: "Days inventory may last at this period's sales pace",
    restockCount: "Need restock",
    viewSection: "Open section",
    exportCsv: "Export CSV",
    showMore: "Show all bills",
    showLess: "Show fewer",
    billsShown: "Showing",
    thisPeriod: "This period",
    snapshot: "Shop snapshot",
    hourlySales: "Hourly sales",
    monthlyTrend: "Monthly trend",
    netCollection: "Collected vs given",
    stillPending: "Still sitting expired",
    periodLoss: "Written off this period",
  },
  mr: {
    title: "व्यवसाय अहवाल",
    description:
      "विक्री, नफा, स्टॉक, ब्रँड आणि उधारी यासाठी सोपा निर्णय अहवाल.",
    print: "प्रिंट / सेव्ह",
    today: "आज",
    sixMonths: "६ महिने",
    specificMonth: "निवडलेला महिना",
    month: "हा महिना",
    year: "हे वर्ष",
    totalStock: "एकूण स्टॉक मूल्य",
    cashCredit: "रोख विरुद्ध उधारी विक्री",
    netProfit: "निव्वळ नफा",
    margin: "नफा मार्जिन",
    cash: "रोख",
    credit: "उधारी",
    partial: "अंशतः",
    averageBill: "सरासरी बिल",
    unitsSold: "विकलेले युनिट",
    salesTrend: "विक्रीचा ट्रेंड",
    categoryPerformance: "वर्गनिहाय विक्री",
    inventoryExposure: "स्टॉक स्थिती",
    stockMovement: "स्टॉक हालचाल",
    purchased: "खरेदी",
    damaged: "नुकसान",
    expired: "कालबाह्य",
    expiredLoss: "कालबाह्य नुकसान",
    expiredProducts: "कालबाह्य वस्तू",
    damagedLoss: "नुकसान मूल्य",
    pendingTotal: "एकूण बाकी",
    oldestDebt: "सर्वात जुनी बाकी",
    salesStory: "विक्रीची गोष्ट",
    profitStory: "नफ्याची गोष्ट",
    stockStory: "स्टॉकची गोष्ट",
    brandComparison: "ब्रँड तुलना",
    udhariRecovery: "उधारी वसुली",
    rawExplore: "डेटा आढावा",
    topSellers: "सर्वाधिक विक्री",
    paymentSplit: "पेमेंट वाटा",
    highMargin: "जास्त मार्जिन वस्तू",
    lowMargin: "कमी मार्जिन लक्ष",
    lowStock: "लवकर स्टॉक भरा",
    expiry: "कालबाह्य लक्ष",
    noData: "या कालावधीसाठी अजून उपयोगी डेटा नाही.",
    noBrands: "तुलनेसाठी एकाच उत्पादनाचे वेगवेगळे ब्रँड जोडा.",
    collectFirst: "आधी वसूल करा",
    stockOk: "स्टॉक बऱ्यापैकी ठीक आहे.",
    item: "वस्तू",
    sales: "विक्री",
    profit: "नफा",
    stock: "स्टॉक",
    brand: "ब्रँड",
    customer: "ग्राहक",
    balance: "बाकी",
    quantity: "प्रमाण",
    comparison: "मागील कालावधीशी तुलना",
    salesChange: "विक्री बदल",
    profitChange: "नफा बदल",
    lossChange: "तोटा बदल",
    insight: "मालकासाठी निरीक्षण",
    billRegister: "बिल नोंद",
    bill: "बिल",
    date: "दिनांक",
    payment: "पेमेंट",
    aging: "बाकी वयाचा आढावा",
    customers: "ग्राहक",
    collected: "वसूल",
    creditGiven: "दिलेली उधारी",
    collectionRate: "वसुली दर",
    days: "दिवस",
    profitContribution: "नफ्यातील योगदान",
    slowStock: "हळू विकला जाणारा स्टॉक",
    deadStock: "अलीकडील विक्री नाही",
    stockAtRisk: "धोक्यातील स्टॉक मूल्य",
    reviewStock: "या वस्तूंचा आढावा घ्या, सवलत द्या किंवा बंडल करा.",
    lossBreakdown: "वस्तूनुसार तोटा",
    lossBreakdownHint: "झालेला स्टॉक तोटा कोणत्या वस्तूंमुळे झाला ते पहा.",
    marginLeak: "जास्त विक्री, कमी नफा",
    marginLeakHint: "या वस्तू विक्री आणतात पण मार्जिन कमी करतात.",
    period: "कालावधी",
    chooseMonth: "महिना निवडा",
    chooseDate: "दिनांक निवडा",
    quickStats: "झटपट आढावा",
    allBills: "सर्व बिले",
    noBills: "या कालावधीसाठी अजून बिले नाहीत.",
    currentStock: "सध्याचा स्टॉक (आज)",
    pendingNow: "सध्या बाकी",
    notPeriod: "कालावधी आधारित नाही",
    moneyIn: "आलेले पैसे",
    moneyInNote: "रोख + ऑनलाइन + अंशतः",
    bestDay: "सर्वोत्तम दिवस",
    weakestDay: "शांत दिवस",
    peakHour: "सर्वाधिक विक्री तास",
    weekdayMix: "आठवड्यातील वाटा",
    daysCover: "स्टॉक किती दिवस पुरेल",
    daysCoverNote: "या कालावधीच्या विक्री वेगाने स्टॉक किती दिवस चालेल",
    restockCount: "स्टॉक भरायचे",
    viewSection: "विभाग उघडा",
    exportCsv: "CSV काढा",
    showMore: "सगळी बिले दाखवा",
    showLess: "कमी दाखवा",
    billsShown: "दाखवत आहे",
    thisPeriod: "हा कालावधी",
    snapshot: "दुकान झलक",
    hourlySales: "तासानुसार विक्री",
    monthlyTrend: "महिन्यानुसार ट्रेंड",
    netCollection: "वसुली विरुद्ध दिलेली उधारी",
    stillPending: "अजून कालबाह्य स्टॉक",
    periodLoss: "या कालावधीत लिहून काढलेले",
  },
} as const;

function money(value: number | undefined | null) {
  return `₹${formatMoney(value)}`;
}

function pct(value: number | undefined | null) {
  return `${formatPercent(value)}%`;
}

function safeNumber(value: unknown) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function getPeriodStart(
  period: Period,
  selectedDate: string,
  selectedMonth: string,
) {
  const start = selectedDate
    ? new Date(`${selectedDate}T12:00:00`)
    : new Date();
  start.setHours(0, 0, 0, 0);
  if (period === "month") start.setDate(1);
  if (period === "sixMonths") {
    start.setMonth(start.getMonth() - 5, 1);
  }
  if (period === "year") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }
  if (period === "specificMonth" && selectedMonth) {
    const [year, month] = selectedMonth.split("-").map(Number);
    return new Date(year, month - 1, 1);
  }
  return start;
}

function getPeriodEnd(
  period: Period,
  selectedDate: string,
  selectedMonth: string,
) {
  if (period === "specificMonth" && selectedMonth) {
    const [year, month] = selectedMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return lastDay.getTime() > today.getTime() ? today : lastDay;
  }
  const end = selectedDate
    ? new Date(`${selectedDate}T23:59:59`)
    : new Date();
  end.setHours(23, 59, 59, 999);
  return end;
}

function periodDayCount(
  period: Period,
  selectedDate: string,
  selectedMonth: string,
) {
  const start = getPeriodStart(period, selectedDate, selectedMonth);
  const end = getPeriodEnd(period, selectedDate, selectedMonth);
  return Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );
}

function inPeriod(
  date: string | undefined,
  period: Period,
  selectedDate: string,
  selectedMonth: string,
) {
  if (!date) return false;
  if (period === "today") return date === selectedDate;
  if (period === "specificMonth" && selectedMonth) {
    return date.startsWith(selectedMonth);
  }
  const saleDate = new Date(`${date}T12:00:00`);
  if (Number.isNaN(saleDate.getTime())) return false;
  return saleDate >= getPeriodStart(period, selectedDate, selectedMonth);
}

function inPeriodTimestamp(
  timestamp: number | undefined,
  period: Period,
  selectedDate: string,
  selectedMonth: string,
) {
  if (!timestamp) return false;
  return inPeriod(dateKey(new Date(timestamp)), period, selectedDate, selectedMonth);
}

function paymentLabel(
  method: string | undefined,
  t: CopyText,
  language: "en" | "mr",
) {
  const value = String(method || "").toLowerCase();
  if (value === "udhar" || value === "udhari") return t.credit;
  if (value === "cash") return t.cash;
  if (value === "partial") return t.partial;
  if (value === "card" || value === "upi" || value === "online") {
    return textFor(language, "Online", "ऑनलाइन");
  }
  return method || "—";
}

function weekdayLabel(date: string, language: "en" | "mr") {
  const day = new Date(`${date}T12:00:00`).getDay();
  const en = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const mr = ["रवि", "सोम", "मंगळ", "बुध", "गुरु", "शुक्र", "शनि"];
  return (en[day]);
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getPreviousPeriodSales(
  sales: any[],
  period: Period,
  selectedDate: string,
  selectedMonth: string,
) {
  const anchor = new Date(`${selectedDate}T12:00:00`);
  const start = getPeriodStart(period, selectedDate, selectedMonth);
  const end = new Date(anchor);
  end.setHours(23, 59, 59, 999);
  const duration = Math.max(
    end.getTime() - start.getTime(),
    24 * 60 * 60 * 1000,
  );
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);
  return sales.filter((sale: any) => {
    const saleDate = new Date(`${sale.date}T12:00:00`);
    return saleDate >= previousStart && saleDate <= previousEnd;
  });
}

function textFor(language: "en" | "mr", en: string, mr: string) {
  return (en);
}

function metricToneClasses(tone: Tone) {
  const tones = {
    green:
      "border-green-200 bg-green-50 text-green-950 dark:border-green-900/60 dark:bg-green-950/20 dark:text-green-100",
    amber:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100",
    red: "border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-100",
    blue: "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-100",
    purple:
      "border-purple-200 bg-purple-50 text-purple-950 dark:border-purple-900/60 dark:bg-purple-950/20 dark:text-purple-100",
    slate:
      "border-slate-200 bg-slate-50 text-slate-950 dark:border-slate-800 dark:bg-slate-950/20 dark:text-slate-100",
  };
  return tones[tone];
}

function MetricCard({
  label,
  value,
  note,
  tone,
  icon: Icon,
  footnote,
}: {
  label: string;
  value: string;
  note: string;
  tone: Tone;
  icon: typeof BadgeIndianRupee;
  footnote?: React.ReactNode;
}) {
  return (
    <Card className={cn("gap-3 rounded-2xl border py-3.5 shadow-[0_4px_16px_rgba(15,23,42,0.045)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,118,110,0.10)]", metricToneClasses(tone))}>
      <CardContent className="space-y-1.5 px-3 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] sm:text-xs font-medium tracking-normal opacity-75">{label}</p>
          <Icon className="h-4 w-4 opacity-65" />
        </div>
        <div className="text-xl sm:text-2xl font-semibold tracking-tight leading-tight tabular-nums break-all">{value}</div>
        <p className="text-[11px] sm:text-xs opacity-75 leading-snug">{note}</p>
        {footnote ? <div className="pt-1">{footnote}</div> : null}
      </CardContent>
    </Card>
  );
}

function PeriodSelector({
  period,
  selectedDate,
  selectedMonth,
  language,
  t,
  onNavigate,
}: {
  period: Period;
  selectedDate: string;
  selectedMonth: string;
  language: "en" | "mr";
  t: CopyText;
  onNavigate: (params: Record<string, string>) => void;
}) {
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const buildHref = (params: Record<string, string>) => {
    const sp = new URLSearchParams(currentQuery);
    Object.entries(params).forEach(([k, v]) => sp.set(k, v));
    const next = sp.toString();
    return next ? `?${next}` : "";
  };
  const periodButtons: Array<[Period, string]> = [
    ["today", t.today],
    ["month", t.month],
    ["sixMonths", t.sixMonths],
    ["year", t.year],
    ["specificMonth", t.specificMonth],
  ];
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-teal-100 bg-teal-50/60 p-2.5 sm:p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {t.period}
        </div>
      </div>
      <div className="flex gap-1 -mx-0.5 px-0.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {periodButtons.map(([key, label]) => {
          const active = period === key;
          return (
            <Link
              key={key}
              href={buildHref({
                period: key,
                ...(key === "specificMonth" && !searchParams.get("month")
                  ? { month: selectedMonth }
                  : {}),
              })}
              className={cn(
                "shrink-0 rounded-xl px-3 py-2 text-[12px] sm:text-sm font-semibold transition-all whitespace-nowrap",
                active
                  ? "bg-teal-700 text-white shadow ring-1 ring-teal-700"
                  : "text-teal-800 hover:bg-white hover:text-teal-950",
              )}
              scroll={false}
            >
              {label}
            </Link>
          );
        })}
      </div>
      {period === "specificMonth" ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <Label
            htmlFor="rp-month"
            className="text-[11px] font-medium text-muted-foreground sm:w-auto"
          >
            {t.chooseMonth}
          </Label>
          <Input
            id="rp-month"
            type="month"
            value={selectedMonth}
            onChange={(e) =>
              onNavigate({ period: "specificMonth", month: e.target.value })
            }
            className="h-9 text-sm sm:max-w-[220px]"
          />
        </div>
      ) : null}
      {period === "today" ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <Label
            htmlFor="rp-date"
            className="text-[11px] font-medium text-muted-foreground sm:w-auto"
          >
            {t.chooseDate}
          </Label>
          <Input
            id="rp-date"
            type="date"
            value={selectedDate}
            onChange={(e) => onNavigate({ period: "today", date: e.target.value })}
            className="h-9 text-sm sm:max-w-[220px]"
          />
        </div>
      ) : null}
    </div>
  );
}

function ListCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-border/70 bg-card shadow-[0_4px_16px_rgba(15,23,42,0.045)]">
      <CardHeader>
        <CardTitle className="font-semibold tracking-tight">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function PaymentPie({
  cash,
  online,
  partial,
  credit,
  labels,
}: {
  cash: number;
  online: number;
  partial: number;
  credit: number;
  labels: { cash: string; online: string; partial: string; credit: string };
}) {
  const total = Math.max(cash + online + partial + credit, 1);
  const cashDeg = (cash / total) * 360;
  const onlineDeg = cashDeg + (online / total) * 360;
  const partialDeg = onlineDeg + (partial / total) * 360;
  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 rounded-2xl border bg-card/80 p-3 sm:p-4">
      <div
        className="h-24 w-24 sm:h-28 sm:w-28 shrink-0 rounded-full border"
        style={{
          background: `conic-gradient(#16a34a 0deg ${cashDeg}deg, #2563eb ${cashDeg}deg ${onlineDeg}deg, #a855f7 ${onlineDeg}deg ${partialDeg}deg, #f97316 ${partialDeg}deg 360deg)`,
        }}
      />
      <div className="grid flex-1 w-full gap-1.5 text-xs sm:text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-green-600" />
            {labels.cash}
          </span>
          <strong className="tabular-nums">
            {money(cash)}{" "}
            <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">
              ({pct((cash / total) * 100)})
            </span>
          </strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
            {labels.online}
          </span>
          <strong className="tabular-nums">
            {money(online)}{" "}
            <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">
              ({pct((online / total) * 100)})
            </span>
          </strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
            {labels.partial}
          </span>
          <strong className="tabular-nums">
            {money(partial)}{" "}
            <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">
              ({pct((partial / total) * 100)})
            </span>
          </strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
            {labels.credit}
          </span>
          <strong className="tabular-nums">
            {money(credit)}{" "}
            <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">
              ({pct((credit / total) * 100)})
            </span>
          </strong>
        </div>
      </div>
    </div>
  );
}

export function ReportsDashboard({
  section = "overview",
}: {
  section?: ReportSection;
}) {
  const { currentShopId, currentShop } = useAuth();
  const { language } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = copy.en;
  const [showAllBills, setShowAllBills] = useState(false);
  const periodParam = searchParams.get("period") as Period | null;
  const period: Period =
    periodParam === "today" ||
    periodParam === "month" ||
    periodParam === "sixMonths" ||
    periodParam === "year" ||
    periodParam === "specificMonth"
      ? periodParam
      : "month";
  const selectedDate = searchParams.get("date") || dateKey(new Date());
  const selectedMonth =
    searchParams.get("month") ||
    selectedDate.slice(0, 7) ||
    dateKey(new Date()).slice(0, 7);
  const periodLabel =
    period === "specificMonth"
      ? new Date(`${selectedMonth}-01T12:00:00`).toLocaleDateString(
          ("en-IN"),
          { month: "long", year: "numeric" },
        )
      : t[period];
  const query = searchParams.toString();
  const sectionLinks: Array<[ReportSection, string]> = [
    ["overview", textFor(language, "Overview", "आढावा")],
    ["sales", textFor(language, "Sales", "विक्री")],
    ["stock", textFor(language, "Stock", "स्टॉक")],
    ["udhari", textFor(language, "Udhari", "उधारी")],
  ];

  const onNavigate = (params: Record<string, string>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => sp.set(k, v));
    const qs = sp.toString();
    const sectionPart = section === "overview" ? "/reports" : `/reports/${section}`;
    router.replace(`${sectionPart}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const { items, isLoading: itemsLoading } = useItems(currentShopId);
  const { categories, isLoading: categoriesLoading } =
    useCategories(currentShopId);
  const { sales, isLoading: salesLoading } = useSales(currentShopId);
  const {
    customers,
    entries: udhariEntries,
    totalPending,
    isLoading: udhariLoading,
  } = useUdhari(currentShopId);
  const { batches, isLoading: batchesLoading } = useBatches(currentShopId);
  const { stockHistory, isLoading: stockHistoryLoading } =
    useStockHistory(currentShopId);

  const report = useMemo(() => {
    const periodSales = sales.filter((sale: any) =>
      inPeriod(sale.date, period, selectedDate, selectedMonth),
    );
    const previousSales = getPreviousPeriodSales(
      sales,
      period,
      selectedDate,
      selectedMonth,
    );
    const revenue = periodSales.reduce(
      (sum: number, sale: any) => sum + safeNumber(sale.subtotal),
      0,
    );
    const cost = periodSales.reduce(
      (sum: number, sale: any) => sum + safeNumber(sale.totalCost),
      0,
    );
    const profit = periodSales.reduce(
      (sum: number, sale: any) =>
        sum +
        safeNumber(
          sale.totalProfit ??
            safeNumber(sale.subtotal) - safeNumber(sale.totalCost),
        ),
      0,
    );
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const previousRevenue = previousSales.reduce(
      (sum: number, sale: any) => sum + safeNumber(sale.subtotal),
      0,
    );
    const previousProfit = previousSales.reduce(
      (sum: number, sale: any) => sum + safeNumber(sale.totalProfit),
      0,
    );
    const unitsSold = periodSales.reduce(
      (sum: number, sale: any) =>
        sum +
        (sale.items || []).reduce(
          (lineSum: number, line: any) => lineSum + safeNumber(line.quantity),
          0,
        ),
      0,
    );
    const averageBill =
      periodSales.length > 0 ? revenue / periodSales.length : 0;
    const dailySales = new Map<
      string,
      { revenue: number; profit: number; transactions: number }
    >();
    periodSales.forEach((sale: any) => {
      const current = dailySales.get(sale.date) || {
        revenue: 0,
        profit: 0,
        transactions: 0,
      };
      current.revenue += safeNumber(sale.subtotal);
      current.profit += safeNumber(sale.totalProfit);
      current.transactions += 1;
      dailySales.set(sale.date, current);
    });
    const dailyEntries = Array.from(dailySales.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, ...values }));
    const useMonthlyTrend = period === "year" || period === "sixMonths";
    const monthlySales = new Map<
      string,
      { revenue: number; profit: number; transactions: number }
    >();
    if (useMonthlyTrend) {
      periodSales.forEach((sale: any) => {
        const key = String(sale.date || "").slice(0, 7);
        if (!key) return;
        const current = monthlySales.get(key) || {
          revenue: 0,
          profit: 0,
          transactions: 0,
        };
        current.revenue += safeNumber(sale.subtotal);
        current.profit += safeNumber(sale.totalProfit);
        current.transactions += 1;
        monthlySales.set(key, current);
      });
    }
    const salesTrend = useMonthlyTrend
      ? Array.from(monthlySales.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, values]) => ({ date, ...values }))
      : dailyEntries.slice(-14);
    const bestDay = dailyEntries.reduce(
      (best: any, day) =>
        !best || day.revenue > best.revenue ? day : best,
      null as null | { date: string; revenue: number; profit: number },
    );
    const weakestDay = dailyEntries
      .filter((day) => day.revenue > 0)
      .reduce(
        (weakest: any, day) =>
          !weakest || day.revenue < weakest.revenue ? day : weakest,
        null as null | { date: string; revenue: number },
      );
    const hourlySales = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      revenue: 0,
      transactions: 0,
    }));
    if (period === "today") {
      periodSales.forEach((sale: any) => {
        const hour = new Date(sale.timestamp).getHours();
        if (!Number.isFinite(hour)) return;
        hourlySales[hour].revenue += safeNumber(sale.subtotal);
        hourlySales[hour].transactions += 1;
      });
    }
    const peakHour = hourlySales.reduce(
      (peak, slot) => (slot.revenue > peak.revenue ? slot : peak),
      hourlySales[0],
    );
    const weekdayMix = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      day,
      label: weekdayLabel(
        `1970-01-${String(4 + day).padStart(2, "0")}`,
        language,
      ),
      revenue: 0,
    }));
    dailyEntries.forEach((entry) => {
      const day = new Date(`${entry.date}T12:00:00`).getDay();
      if (Number.isFinite(day)) weekdayMix[day].revenue += entry.revenue;
    });
    weekdayMix.forEach((slot, index) => {
      slot.label = ((["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]))[index];
    });
    const amountByPayment = (methods: string[]) =>
      periodSales
        .filter((sale: any) => methods.includes(String(sale.paymentMethod)))
        .reduce((sum: number, sale: any) => sum + safeNumber(sale.subtotal), 0);
    const cashSales = amountByPayment(["cash"]);
    const partialSales = amountByPayment(["partial"]);
    const creditSales = amountByPayment(["udhar", "udhari"]);
    const totalStockValue = items.reduce(
      (sum: number, item: any) =>
        sum + safeNumber(item.quantity) * safeNumber(item.buyPrice),
      0,
    );
    const lowStock = items
      .filter(
        (item: any) =>
          safeNumber(item.quantity) <= safeNumber(item.lowStockLimit),
      )
      .sort(
        (a: any, b: any) => safeNumber(a.quantity) - safeNumber(b.quantity),
      );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiring = batches
      .filter((batch: any) => {
        if (batch.status === "expired" || batch.status === "expiring")
          return true;
        if (!batch.expiryDate) return false;
        const expiryDate = new Date(batch.expiryDate);
        return !Number.isNaN(expiryDate.getTime()) && expiryDate <= today;
      })
      .slice(0, 5);
    const expiredBatches = batches.filter(
      (batch: any) => batch.status === "expired",
    );
    const expiredProductCount = new Set(
      expiredBatches.map((batch: any) => Number(batch.itemId ?? batch.item_id)),
    ).size;
    const badStockValue = expiredBatches.reduce(
      (sum: number, batch: any) =>
        sum +
        safeNumber(batch.quantityAvailable ?? batch.quantity_available) *
          safeNumber(batch.costPerUnit ?? batch.cost_per_unit),
      0,
    );
    const expiringStockValue = batches
      .filter((batch: any) => batch.status === "expiring")
      .reduce(
        (sum: number, batch: any) =>
          sum +
          safeNumber(batch.quantityAvailable ?? batch.quantity_available) *
            safeNumber(batch.costPerUnit ?? batch.cost_per_unit),
        0,
      );
    const periodStockHistory = stockHistory.filter((entry: any) =>
      inPeriodTimestamp(
        entry.createdAt,
        period,
        selectedDate,
        selectedMonth,
      ),
    );
    const stockMovement = periodStockHistory.reduce(
      (
        summary: {
          purchased: number;
          damaged: number;
          expired: number;
          damagedValue: number;
          expiredValue: number;
        },
        entry: any,
      ) => {
        const quantity = Math.abs(safeNumber(entry.quantityChanged));
        if (entry.type === "purchase") summary.purchased += quantity;
        if (entry.type === "damage") {
          summary.damaged += quantity;
          summary.damagedValue += quantity * safeNumber(entry.costPerUnit);
        }
        if (entry.type === "expiry") {
          summary.expired += quantity;
          summary.expiredValue += quantity * safeNumber(entry.costPerUnit);
        }
        return summary;
      },
      {
        purchased: 0,
        damaged: 0,
        expired: 0,
        damagedValue: 0,
        expiredValue: 0,
      },
    );
    const onlineSales = amountByPayment(["card", "upi", "online"]);
    const moneyIn = cashSales + onlineSales + partialSales;
    const realizedLoss = stockMovement.expiredValue + stockMovement.damagedValue;
    const daysInPeriod = periodDayCount(period, selectedDate, selectedMonth);
    const inventoryUnits = items.reduce(
      (sum: number, item: any) => sum + Math.max(safeNumber(item.quantity), 0),
      0,
    );
    const dailyUnitPace = unitsSold / daysInPeriod;
    const daysCover =
      dailyUnitPace > 0 ? inventoryUnits / dailyUnitPace : null;
    const previousPeriod = {
      revenue: previousRevenue,
      profit: previousProfit,
      margin:
        previousRevenue > 0 ? (previousProfit / previousRevenue) * 100 : 0,
    };
    const percentChange = (current: number, previous: number): number | null => {
      if (previous === 0) return current === 0 ? 0 : null;
      return ((current - previous) / Math.abs(previous)) * 100;
    };
    const absoluteChange = (current: number, previous: number) =>
      current - previous;
    const agingBuckets = [
      { label: "0-15", amount: 0, customers: 0 },
      { label: "16-30", amount: 0, customers: 0 },
      { label: "31-60", amount: 0, customers: 0 },
      { label: "60+", amount: 0, customers: 0 },
    ];
    customers
      .filter((customer: any) => safeNumber(customer.balance) > 0)
      .forEach((customer: any) => {
        const daysPending = getCreditPressure(
          Number(customer.id),
          safeNumber(customer.balance),
          udhariEntries,
        ).daysPending;
        const bucket =
          daysPending <= 15
            ? agingBuckets[0]
            : daysPending <= 30
              ? agingBuckets[1]
              : daysPending <= 60
                ? agingBuckets[2]
                : agingBuckets[3];
        bucket.amount += safeNumber(customer.balance);
        bucket.customers += 1;
      });
    const periodCreditEntries = udhariEntries.filter((entry: any) =>
      inPeriod(entry.date, period, selectedDate, selectedMonth),
    );
    const creditGiven = periodCreditEntries
      .filter((entry: any) => entry.type === "credit")
      .reduce((sum: number, entry: any) => sum + safeNumber(entry.amount), 0);
    const collected = periodCreditEntries
      .filter((entry: any) => entry.type === "payment")
      .reduce((sum: number, entry: any) => sum + safeNumber(entry.amount), 0);

    const itemSales = new Map<string, any>();
    const categorySales = new Map<
      string,
      { name: string; revenue: number; profit: number; quantity: number }
    >();
    const categoryLookup = new Map(
      categories.map((category: any) => [Number(category.id), category]),
    );
    const lossByProduct = new Map<
      string,
      {
        name: string;
        category: string;
        value: number;
        quantity: number;
        reasons: Set<string>;
      }
    >();
    const addLoss = (
      itemId: unknown,
      itemName: string,
      quantity: number,
      value: number,
      reason: string,
    ) => {
      const item = items.find(
        (candidate: any) => Number(candidate.id) === Number(itemId),
      );
      const category = categoryLookup.get(Number(item?.categoryId));
      const name =
        item?.name ||
        itemName ||
        textFor(language, "Unknown item", "अज्ञात वस्तू");
      const current = lossByProduct.get(name) || {
        name,
        category:
          category?.name || textFor(language, "Uncategorized", "वर्गीकृत नाही"),
        value: 0,
        quantity: 0,
        reasons: new Set<string>(),
      };
      current.value += value;
      current.quantity += quantity;
      current.reasons.add(reason);
      lossByProduct.set(name, current);
    };
    expiredBatches.forEach((batch: any) => {
      const quantity = safeNumber(
        batch.quantityAvailable ?? batch.quantity_available,
      );
      addLoss(
        batch.itemId ?? batch.item_id,
        batch.itemName || batch.item_name,
        quantity,
        quantity * safeNumber(batch.costPerUnit ?? batch.cost_per_unit),
        "expired",
      );
    });
    periodStockHistory.forEach((entry: any) => {
      if (entry.type !== "damage" && entry.type !== "expiry") return;
      const quantity = Math.abs(safeNumber(entry.quantityChanged));
      addLoss(
        entry.itemId,
        entry.itemName,
        quantity,
        quantity * safeNumber(entry.costPerUnit),
        entry.type,
      );
    });
    const lossByProductList = Array.from(lossByProduct.values())
      .map((entry) => ({ ...entry, reasons: Array.from(entry.reasons) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    periodSales.forEach((sale: any) => {
      (sale.items || []).forEach((line: any) => {
        const key = String(line.itemId || line.itemName);
        const item = items.find(
          (candidate: any) => Number(candidate.id) === Number(line.itemId),
        );
        const current = itemSales.get(key) || {
          name: line.itemName || "Item",
          quantity: 0,
          revenue: 0,
          profit: 0,
        };
        current.quantity += safeNumber(line.quantity);
        current.revenue += safeNumber(line.totalPrice);
        current.profit += safeNumber(
          line.profit ??
            safeNumber(line.totalPrice) - safeNumber(line.totalCost),
        );
        itemSales.set(key, current);
        const category = categoryLookup.get(Number(item?.categoryId));
        const categoryName =
          category?.name || textFor(language, "Uncategorized", "वर्गीकृत नाही");
        const categoryCurrent = categorySales.get(categoryName) || {
          name: categoryName,
          revenue: 0,
          profit: 0,
          quantity: 0,
        };
        categoryCurrent.revenue += safeNumber(line.totalPrice);
        categoryCurrent.profit += safeNumber(
          line.profit ??
            safeNumber(line.totalPrice) - safeNumber(line.totalCost),
        );
        categoryCurrent.quantity += safeNumber(line.quantity);
        categorySales.set(categoryName, categoryCurrent);
      });
    });
    const performance = Array.from(itemSales.values()).map((item) => ({
      ...item,
      margin: item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0,
      contribution: profit > 0 ? (item.profit / profit) * 100 : 0,
    }));
    const topSellers = [...performance]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    const highMargin = [...performance]
      .filter((item) => item.revenue > 0 && item.margin >= 15)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);
    const lowMargin = [...performance]
      .filter((item) => item.revenue > 0 && item.margin < 10)
      .sort((a, b) => a.margin - b.margin)
      .slice(0, 5);
    const marginLeaks = [...performance]
      .filter((item) => item.revenue > 0 && item.margin < 10)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    const itemLastSold = new Map<number, string>();
    sales.forEach((sale: any) => {
      (sale.items || []).forEach((line: any) => {
        if (!line.itemId) return;
        const current = itemLastSold.get(Number(line.itemId));
        if (!current || String(sale.date) > current) {
          itemLastSold.set(Number(line.itemId), String(sale.date));
        }
      });
    });
    const todayKey = dateKey(new Date());
    const slowStock = items
      .filter((item: any) => safeNumber(item.quantity) > 0)
      .map((item: any) => {
        const lastSold = itemLastSold.get(Number(item.id));
        const daysSinceSale = lastSold
          ? Math.max(
              0,
              Math.floor(
                (new Date(`${todayKey}T12:00:00`).getTime() -
                  new Date(`${lastSold}T12:00:00`).getTime()) /
                  (24 * 60 * 60 * 1000),
              ),
            )
          : null;
        return {
          ...item,
          lastSold,
          daysSinceSale,
          stockValue: safeNumber(item.quantity) * safeNumber(item.buyPrice),
          potentialProfit:
            safeNumber(item.quantity) *
            (safeNumber(item.sellPrice) - safeNumber(item.buyPrice)),
        };
      })
      .filter(
        (item: any) => item.daysSinceSale === null || item.daysSinceSale >= 30,
      )
      .sort((a: any, b: any) => b.stockValue - a.stockValue)
      .slice(0, 8);
    const stockAtRiskValue = slowStock.reduce(
      (sum: number, item: any) => sum + item.stockValue,
      0,
    );

    const itemLookup = new Map(
      items.map((item: any) => [Number(item.id), item]),
    );
    const productGroups = new Map<string, any>();
    items.forEach((item: any) => {
      const key = String(item.name || item.nameMarathi || "")
        .trim()
        .toLowerCase();
      if (!key) return;
      const group = productGroups.get(key) || {
        name:
          (item.name || item.nameMarathi),
        brands: new Map<string, any>(),
      };
      const brand =
        (item.brand || item.brandMarathi || "No brand");
      group.brands.set(brand, {
        brand,
        revenue: 0,
        profit: 0,
        quantity: 0,
        margin: 0,
      });
      productGroups.set(key, group);
    });
    periodSales.forEach((sale: any) => {
      (sale.items || []).forEach((line: any) => {
        const item = itemLookup.get(Number(line.itemId));
        if (!item) return;
        const key = String(item.name || item.nameMarathi || "")
          .trim()
          .toLowerCase();
        const group = productGroups.get(key);
        if (!group) return;
        const brand =
          (item.brand || item.brandMarathi || "No brand");
        const brandData = group.brands.get(brand);
        if (!brandData) return;
        brandData.revenue += safeNumber(line.totalPrice);
        brandData.profit += safeNumber(
          line.profit ??
            safeNumber(line.totalPrice) - safeNumber(line.totalCost),
        );
        brandData.quantity += safeNumber(line.quantity);
        brandData.margin =
          brandData.revenue > 0
            ? (brandData.profit / brandData.revenue) * 100
            : 0;
      });
    });
    const brandComparisons = Array.from(productGroups.values())
      .map((group) => ({
        ...group,
        brands: Array.from(group.brands.values()).sort(
          (a: any, b: any) => b.revenue - a.revenue,
        ),
      }))
      .filter((group) => group.brands.length >= 2)
      .sort(
        (a, b) =>
          b.brands.reduce((sum: number, brand: any) => sum + brand.revenue, 0) -
          a.brands.reduce((sum: number, brand: any) => sum + brand.revenue, 0),
      )
      .slice(0, 4);

    const topCustomers = [...customers]
      .filter((customer: any) => safeNumber(customer.balance) > 0)
      .sort((a: any, b: any) => safeNumber(b.balance) - safeNumber(a.balance))
      .slice(0, 5);
    const creditFrequency = new Map<
      number,
      { customer: any; count: number; amount: number }
    >();
    udhariEntries
      .filter((entry: any) => entry.type === "credit")
      .forEach((entry: any) => {
        const customer = customers.find(
          (item: any) => Number(item.id) === Number(entry.customerId),
        );
        if (!customer) return;
        const current = creditFrequency.get(Number(customer.id)) || {
          customer,
          count: 0,
          amount: 0,
        };
        current.count += 1;
        current.amount += safeNumber(entry.amount);
        creditFrequency.set(Number(customer.id), current);
      });
    const frequentCreditCustomers = Array.from(creditFrequency.values())
      .sort((a, b) => b.count - a.count || b.amount - a.amount)
      .slice(0, 3);
    const longPendingCustomers = [...customers]
      .filter((customer: any) => safeNumber(customer.balance) > 0)
      .map((customer: any) => ({
        ...customer,
        creditPressure: getCreditPressure(
          Number(customer.id),
          safeNumber(customer.balance),
          udhariEntries,
        ),
      }))
      .sort(
        (a: any, b: any) =>
          b.creditPressure.daysPending - a.creditPressure.daysPending,
      )
      .slice(0, 3);

    return {
      revenue,
      profit,
      margin,
      previousPeriod,
      changes: {
        revenue: percentChange(revenue, previousRevenue),
        profit: percentChange(profit, previousProfit),
        margin: margin - previousPeriod.margin,
        revenueDelta: absoluteChange(revenue, previousRevenue),
        profitDelta: absoluteChange(profit, previousProfit),
        loss: realizedLoss,
      },
      realizedLoss,
      agingBuckets,
      creditGiven,
      collected,
      collectionRate: creditGiven > 0 ? (collected / creditGiven) * 100 : 0,
      billRegister: [...periodSales].sort(
        (a: any, b: any) => safeNumber(b.timestamp) - safeNumber(a.timestamp),
      ),
      unitsSold,
      averageBill,
      salesTrend,
      categorySales: Array.from(categorySales.values()).sort(
        (a, b) => b.revenue - a.revenue,
      ),
      cashSales,
      partialSales,
      creditSales,
      onlineSales,
      moneyIn,
      totalStockValue,
      expiredProductCount,
      stockMovement,
      badStockValue,
      expiringStockValue,
      daysCover,
      daysInPeriod,
      bestDay,
      weakestDay,
      peakHour,
      weekdayMix,
      hourlySales,
      trendGranularity: useMonthlyTrend ? "month" : "day",
      lowStock,
      expiring,
      topSellers,
      highMargin,
      lowMargin,
      marginLeaks,
      slowStock,
      stockAtRiskValue,
      lossByProduct: lossByProductList,
      brandComparisons,
      topCustomers,
      frequentCreditCustomers,
      longPendingCustomers,
      transactionCount: periodSales.length,
    };
  }, [
    batches,
    categories,
    customers,
    items,
    language,
    period,
    sales,
    selectedDate,
    selectedMonth,
    stockHistory,
    udhariEntries,
  ]);

  const isLoading =
    itemsLoading ||
    categoriesLoading ||
    salesLoading ||
    udhariLoading ||
    batchesLoading ||
    stockHistoryLoading;

  const visibleBills = showAllBills
    ? report.billRegister
    : report.billRegister.slice(0, 20);

  const exportBills = () => {
    downloadCsv(`bills-${periodLabel.replace(/\s+/g, "-")}.csv`, [
      [t.bill, t.date, t.payment, t.customer, t.sales, t.profit],
      ...report.billRegister.map((sale: any) => [
        String(sale.id),
        String(sale.date || ""),
        paymentLabel(sale.paymentMethod, t, language),
        String(sale.creditCustomerName || ""),
        String(safeNumber(sale.subtotal)),
        String(safeNumber(sale.totalProfit)),
      ]),
    ]);
  };

  if (isLoading) {
    return (
      <PageContainer size="wide">
        <PageHeader
          title={t.title}
          description={`${currentShop?.shopName || "MediShop"} · ${periodLabel}`}
        />
        <div className="rounded-2xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          {textFor(
            language,
            "Loading recorded business data...",
            "नोंदवलेला व्यवसाय डेटा लोड होत आहे...",
          )}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer size="wide">
      <section className="relative overflow-hidden rounded-[2rem] border border-teal-800/10 bg-gradient-to-br from-teal-700 to-emerald-600 p-5 text-white shadow-[0_18px_45px_rgba(15,118,110,0.18)] sm:p-7 print:border-slate-200 print:bg-white print:text-slate-950 print:shadow-none">
        <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-white/10 print:hidden" />
        <div className="relative flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-100 print:text-slate-500">
              <HeartPulse className="h-4 w-4" />
              Pharmacy performance
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{t.title}</h1>
            <p className="mt-1 text-sm leading-6 text-teal-100 print:text-slate-600">
              {currentShop?.shopName || "MediShop"} · {periodLabel}
            </p>
          </div>
          <Button className="border-white/30 bg-white/15 text-white hover:bg-white/25 print:hidden" variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">{t.print}</span>
          </Button>
        </div>
      </section>

      <div className="space-y-3 print:hidden">
        <nav
          className="sticky top-[4.5rem] z-20 flex gap-1 overflow-x-auto rounded-2xl border border-teal-100 bg-white/95 p-1 shadow-sm backdrop-blur sm:top-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={textFor(language, "Report sections", "अहवाल विभाग")}
        >
          {sectionLinks.map(([href, label]) => (
            <Link
              key={href}
              href={`/reports/${href === "overview" ? "" : href}${query ? `?${query}` : ""}`}
              className={cn(
                "shrink-0 rounded-xl px-3 sm:px-4 py-2 text-[13px] sm:text-sm font-semibold transition-all whitespace-nowrap",
                section === href
                  ? "bg-teal-700 text-white shadow-sm ring-1 ring-teal-700"
                  : "text-teal-800 hover:bg-teal-50 hover:text-teal-950",
              )}
              scroll={false}
            >
              {label}
            </Link>
          ))}
        </nav>

        <PeriodSelector
          period={period}
          selectedDate={selectedDate}
          selectedMonth={selectedMonth}
          language={language}
          t={t}
          onNavigate={onNavigate}
        />
      </div>

      {section === "overview" && (
        <section className="grid gap-2.5 grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label={t.sales}
            value={money(report.revenue)}
            note={`${formatNumber(report.transactionCount)} ${textFor(language, "bills", "बिले")} · ${periodLabel}`}
            tone="blue"
            icon={BadgeIndianRupee}
          />
          <MetricCard
            label={t.netProfit}
            value={money(report.profit)}
            note={`${t.margin} ${pct(report.margin)}`}
            tone={report.profit >= 0 ? "green" : "red"}
            icon={TrendingUp}
          />
          <MetricCard
            label={t.moneyIn}
            value={money(report.moneyIn)}
            note={`${t.credit} ${money(report.creditSales)}`}
            tone={report.creditSales > report.moneyIn ? "amber" : "green"}
            icon={Wallet}
          />
          <MetricCard
            label={t.averageBill}
            value={money(report.averageBill)}
            note={`${formatNumber(report.unitsSold)} ${t.unitsSold.toLowerCase()}`}
            tone="slate"
            icon={BarChart3}
          />
        </section>
      )}

      {section === "overview" && (
        <section className="grid gap-3 md:gap-4 lg:grid-cols-[1fr_1fr]">
          <ListCard title={t.comparison} description={`${t.comparison} · ${periodLabel}`}>
            <div className="grid gap-2 grid-cols-3">
              {[
                [t.sales, report.changes.revenue],
                [t.profit, report.changes.profit],
                [t.margin, report.changes.margin],
              ].map(([label, change]) => {
                const isMargin = label === t.margin;
                const positive = Number(change) >= 0;
                return (
                  <div
                    key={String(label)}
                    className="rounded-xl bg-muted/40 p-2.5 sm:p-3"
                  >
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                      {positive && !isMargin ? (
                        <TrendingUp className="h-3 w-3 text-emerald-600" />
                      ) : !positive && !isMargin ? (
                        <TrendingDown className="h-3 w-3 text-red-600" />
                      ) : null}
                      {label}
                    </div>
                    <div
                      className={cn(
                        "mt-1 text-lg sm:text-xl font-bold tabular-nums",
                        positive ? "text-emerald-700" : "text-red-700",
                      )}
                    >
                      {positive ? "+" : ""}
                      {formatNumber(Number(change))}
                      <span className="text-[10px] sm:text-xs font-medium text-muted-foreground ml-0.5">
                        {isMargin
                          ? textFor(language, " pts", " गुण")
                          : "%"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ListCard>

          <ListCard title={t.paymentSplit} description={t.cashCredit}>
            <PaymentPie
              cash={report.cashSales}
              online={report.onlineSales}
              partial={report.partialSales}
              credit={report.creditSales}
              labels={{
                cash: t.cash,
                online: textFor(language, "Online", "ऑनलाइन"),
                partial: t.partial,
                credit: t.credit,
              }}
            />
          </ListCard>
        </section>
      )}

      {section === "overview" && (
        <section className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={`/reports/sales${query ? `?${query}` : ""}`}
            className="rounded-2xl border bg-card p-3 sm:p-4 hover:border-primary/40 transition-colors"
          >
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t.topSellers}
            </p>
            <p className="mt-1 truncate text-base sm:text-lg font-semibold">
              {report.topSellers[0]?.name || t.noData}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {report.topSellers[0]
                ? `${money(report.topSellers[0].revenue)} · ${formatNumber(report.topSellers[0].quantity)} ${t.quantity}`
                : t.viewSection}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
              {t.sales} <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
          <Link
            href={`/reports/stock${query ? `?${query}` : ""}`}
            className="rounded-2xl border bg-card p-3 sm:p-4 hover:border-primary/40 transition-colors"
          >
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t.restockCount}
            </p>
            <p className="mt-1 text-base sm:text-lg font-semibold tabular-nums">
              {formatNumber(report.lowStock.length)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t.daysCover}:{" "}
              {report.daysCover != null
                ? `${formatNumber(report.daysCover)} ${t.days}`
                : "—"}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
              {t.stock} <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
          <Link
            href={`/reports/udhari${query ? `?${query}` : ""}`}
            className="rounded-2xl border bg-card p-3 sm:p-4 hover:border-primary/40 transition-colors"
          >
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t.pendingNow}
            </p>
            <p className="mt-1 text-base sm:text-lg font-semibold tabular-nums">
              {money(totalPending)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t.collectionRate} {pct(report.collectionRate)}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
              {t.udhariRecovery} <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
          <div className="rounded-2xl border bg-card p-3 sm:p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {period === "today" ? t.peakHour : t.bestDay}
            </p>
            <p className="mt-1 text-base sm:text-lg font-semibold tabular-nums">
              {period === "today"
                ? report.peakHour.revenue > 0
                  ? `${String(report.peakHour.hour).padStart(2, "0")}:00`
                  : "—"
                : report.bestDay
                  ? money(report.bestDay.revenue)
                  : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {period === "today"
                ? money(report.peakHour.revenue)
                : report.bestDay
                  ? report.bestDay.date
                  : t.noData}
            </p>
          </div>
        </section>
      )}

      {section === "overview" && (
        <section className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-red-300 bg-red-50 p-3 sm:p-4 text-red-950 col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide opacity-70 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {t.periodLoss}
                </p>
                <p className="mt-1 text-xl sm:text-2xl font-bold tabular-nums">
                  {money(report.realizedLoss)}
                </p>
                <p className="mt-1 text-[11px] sm:text-xs opacity-80">
                  {t.expiredLoss} {money(report.stockMovement.expiredValue)} ·{" "}
                  {t.damagedLoss} {money(report.stockMovement.damagedValue)}
                </p>
              </div>
              <Scale className="h-5 w-5 opacity-70 shrink-0" />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] sm:text-xs font-medium">
              <span className="rounded-full bg-white/70 px-2.5 py-1">
                {formatNumber(report.stockMovement.expired)} {t.expired}
              </span>
              <span className="rounded-full bg-white/70 px-2.5 py-1">
                {formatNumber(report.stockMovement.damaged)} {t.damaged}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 sm:p-4 text-red-950">
            <p className="text-[11px] sm:text-xs opacity-80 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t.stillPending}
            </p>
            <p className="mt-1 text-lg sm:text-xl font-bold tabular-nums">
              {money(report.badStockValue)}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-4 text-amber-950">
            <p className="text-[11px] sm:text-xs opacity-80 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {textFor(
                language,
                "Going-expiry value",
                "लवकर कालबाह्य मूल्य",
              )}
            </p>
            <p className="mt-1 text-lg sm:text-xl font-bold tabular-nums">
              {money(report.expiringStockValue)}
            </p>
          </div>
        </section>
      )}

      {section === "overview" && (
        <ListCard
          title={t.insight}
          description={textFor(
            language,
            "What to focus on for this period.",
            "या कालावधीसाठी काय लक्ष द्यायचे.",
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center dark:bg-indigo-950/40 dark:text-indigo-200">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm sm:text-[15px] leading-6 sm:leading-7 text-foreground/90">
                {report.revenue === 0
                  ? t.noData
                  : (report.changes.profit ?? 0) < (report.changes.revenue ?? 0)
                    ? textFor(
                        language,
                        "Sales grew faster than profit — review pricing, discounts and product mix for margin leakage.",
                        "विक्री नफ्यापेक्षा वेगाने वाढली आहे. मार्जिन कमी होत नाही यासाठी किंमत, सवलती आणि उत्पादन मिश्रण तपासा.",
                      )
                    : report.realizedLoss > 0
                      ? textFor(
                          language,
                          `Realized stock loss is ${money(report.realizedLoss)}. Start with expiry and damage records — then fix slow-moving stock worth ${money(report.stockAtRiskValue)}.`,
                          `झालेला स्टॉक तोटा ${money(report.realizedLoss)} आहे. कालबाह्य आणि नुकसान नोंदींपासून सुरुवात करा — नंतर ${money(report.stockAtRiskValue)} च्या हळू विकल्या जाणाऱ्या स्टॉकवर काम करा.`,
                        )
                      : report.creditSales > report.cashSales
                        ? textFor(
                            language,
                            `Credit sales (${money(report.creditSales)}) are higher than cash. Focus on udhari recovery — ${money(totalPending)} is pending right now.`,
                            `उधारी विक्री (${money(report.creditSales)}) रोखपेक्षा जास्त आहे. उधारी वसुलीवर लक्ष द्या — सध्या ${money(totalPending)} बाकी आहे.`,
                          )
                        : textFor(
                            language,
                            "Profit is keeping pace with sales. Double-down on the products and categories driving your margin, and restock top sellers before they run out.",
                            "नफा विक्रीसोबत चालला आहे. मार्जिन देणाऱ्या वस्तू आणि वर्गांवर जास्त लक्ष द्या आणि त्वरित विकणाऱ्या वस्तू संपण्यापूर्वी पुन्हा स्टॉक भरा.",
                          )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] sm:text-xs font-medium">
                {report.stockAtRiskValue > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-3 py-1">
                    <AlertTriangle className="h-3 w-3" />
                    {t.stockAtRisk}: {money(report.stockAtRiskValue)}
                  </span>
                ) : null}
                {totalPending > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-800 px-3 py-1">
                    <CreditCard className="h-3 w-3" />
                    {t.pendingNow}: {money(totalPending)}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-800 px-3 py-1">
                  <Boxes className="h-3 w-3" />
                  {t.currentStock}: {money(report.totalStockValue)}
                </span>
              </div>
            </div>
          </div>
        </ListCard>
      )}

      <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
        {section === "sales" && (
          <>
            <div className="grid gap-2.5 grid-cols-2 lg:col-span-2 lg:grid-cols-4">
              <MetricCard
                label={t.sales}
                value={money(report.revenue)}
                note={`${formatNumber(report.transactionCount)} ${textFor(language, "bills", "बिले")}`}
                tone="blue"
                icon={BadgeIndianRupee}
              />
              <MetricCard
                label={t.netProfit}
                value={money(report.profit)}
                note={`${t.margin} ${pct(report.margin)}`}
                tone={report.profit >= 0 ? "green" : "red"}
                icon={TrendingUp}
              />
              <MetricCard
                label={t.moneyIn}
                value={money(report.moneyIn)}
                note={t.moneyInNote}
                tone="green"
                icon={Wallet}
              />
              <MetricCard
                label={t.averageBill}
                value={money(report.averageBill)}
                note={`${formatNumber(report.unitsSold)} ${t.quantity}`}
                tone="slate"
                icon={BarChart3}
              />
            </div>
            <div id="sales" className="scroll-mt-24">
              <ListCard title={t.salesStory} description={t.topSellers}>
                {report.topSellers.length ? (
                  report.topSellers.map((item: any) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3"
                    >
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.quantity}: {formatNumber(item.quantity)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {money(item.revenue)}
                        </div>
                        <div className="text-xs text-green-600">
                          {money(item.profit)} {t.profit} ·{" "}
                          {pct(item.contribution)} {t.profitContribution}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyLine>{t.noData}</EmptyLine>
                )}
              </ListCard>
            </div>

            <ListCard
              title={t.profitStory}
              description={`${t.highMargin} / ${t.lowMargin}`}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700"
                  >
                    {t.highMargin}
                  </Badge>
                  {report.highMargin.length ? (
                    report.highMargin.slice(0, 3).map((item: any) => (
                      <div
                        key={item.name}
                        className="rounded-xl border border-green-100 p-3 text-sm"
                      >
                        <div className="font-medium">{item.name}</div>
                        <div className="text-muted-foreground">
                          {money(item.profit)} · {pct(item.margin)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyLine>{t.noData}</EmptyLine>
                  )}
                </div>
                <div className="space-y-2">
                  <Badge
                    variant="outline"
                    className="bg-amber-50 text-amber-700"
                  >
                    {t.lowMargin}
                  </Badge>
                  {report.lowMargin.length ? (
                    report.lowMargin.slice(0, 3).map((item: any) => (
                      <div
                        key={item.name}
                        className="rounded-xl border border-amber-100 p-3 text-sm"
                      >
                        <div className="font-medium">{item.name}</div>
                        <div className="text-muted-foreground">
                          {money(item.profit)} · {pct(item.margin)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyLine>
                      {textFor(
                        language,
                        "No low-margin issue found.",
                        "कमी मार्जिन समस्या नाही.",
                      )}
                    </EmptyLine>
                  )}
                </div>
              </div>
            </ListCard>

            <ListCard title={t.marginLeak} description={t.marginLeakHint}>
              {report.marginLeaks.length ? (
                <div className="space-y-2">
                  {report.marginLeaks.map((item: any) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatNumber(item.quantity)} {t.quantity} ·{" "}
                          {pct(item.margin)} {t.margin}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-semibold">
                          {money(item.revenue)}
                        </div>
                        <div className="text-xs text-red-700">
                          {money(item.profit)} {t.profit}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyLine>{t.noData}</EmptyLine>
              )}
            </ListCard>

            <ListCard
              title={t.brandComparison}
              description={textFor(
                language,
                "Same product, different brands.",
                "एकच उत्पादन, वेगवेगळे ब्रँड.",
              )}
            >
              {report.brandComparisons.length ? (
                report.brandComparisons.map((group: any) => (
                  <div key={group.name} className="rounded-2xl border p-3">
                    <div className="font-semibold">{group.name}</div>
                    <div className="mt-3 grid gap-2">
                      {group.brands.slice(0, 3).map((brand: any) => (
                        <div
                          key={brand.brand}
                          className="flex items-center justify-between rounded-xl bg-muted/40 p-2 text-sm"
                        >
                          <span>{brand.brand}</span>
                          <span className="font-medium">
                            {money(brand.revenue)} · {pct(brand.margin)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyLine>{t.noBrands}</EmptyLine>
              )}
            </ListCard>

            <ListCard
              title={
                report.trendGranularity === "month"
                  ? t.monthlyTrend
                  : period === "today"
                    ? t.hourlySales
                    : t.salesTrend
              }
              description={textFor(
                language,
                report.trendGranularity === "month"
                  ? "Revenue and profit by month in this period."
                  : period === "today"
                    ? "Sales by hour for the selected date."
                    : "Revenue and profit across the latest days in this period.",
                report.trendGranularity === "month"
                  ? "या कालावधीतील महिन्यानुसार विक्री आणि नफा."
                  : period === "today"
                    ? "निवडलेल्या दिवसाची तासानुसार विक्री."
                    : "या कालावधीतील अलीकडच्या दिवसांची विक्री आणि नफा.",
              )}
            >
              {period === "today" && report.hourlySales.some((slot: any) => slot.revenue > 0) ? (
                <div className="space-y-3">
                  <div className="flex h-32 items-end gap-px border-b border-border/70 px-0.5">
                    {report.hourlySales.map((slot: any) => {
                      const maxRevenue = Math.max(
                        ...report.hourlySales.map((entry: any) => entry.revenue),
                        1,
                      );
                      return (
                        <div
                          key={slot.hour}
                          className="flex h-full flex-1 items-end justify-center"
                          title={`${String(slot.hour).padStart(2, "0")}:00 · ${money(slot.revenue)}`}
                        >
                          <div
                            className="w-full rounded-t bg-blue-500"
                            style={{
                              height: `${Math.max((slot.revenue / maxRevenue) * 100, slot.revenue > 0 ? 6 : 2)}%`,
                              opacity: slot.revenue > 0 ? 1 : 0.25,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>00</span>
                    <span>06</span>
                    <span>12</span>
                    <span>18</span>
                    <span>23</span>
                  </div>
                </div>
              ) : report.salesTrend.length ? (
                <div className="space-y-3">
                  <div className="flex h-40 items-end gap-1 border-b border-border/70 px-1">
                    {report.salesTrend.map((day: any) => {
                      const maxRevenue = Math.max(
                        ...report.salesTrend.map((entry: any) => entry.revenue),
                        1,
                      );
                      return (
                        <div
                          key={day.date}
                          className="group flex h-full flex-1 items-end justify-center gap-0.5"
                          title={`${day.date}: ${money(day.revenue)}`}
                        >
                          <div
                            className="w-1/2 rounded-t bg-blue-500 transition-all group-hover:bg-blue-700"
                            style={{
                              height: `${Math.max((day.revenue / maxRevenue) * 100, 3)}%`,
                            }}
                          />
                          <div
                            className="w-1/2 rounded-t bg-emerald-500 transition-all group-hover:bg-emerald-700"
                            style={{
                              height: `${Math.max((Math.max(day.profit, 0) / maxRevenue) * 100, 3)}%`,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{report.salesTrend[0].date}</span>
                    <span>
                      {report.salesTrend[report.salesTrend.length - 1].date}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <i className="h-2 w-2 rounded-full bg-blue-500" />
                      {t.sales}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <i className="h-2 w-2 rounded-full bg-emerald-500" />
                      {t.profit}
                    </span>
                  </div>
                </div>
              ) : (
                <EmptyLine>{t.noData}</EmptyLine>
              )}
            </ListCard>

            {period !== "today" ? (
              <ListCard title={t.weekdayMix}>
                {report.weekdayMix.some((slot: any) => slot.revenue > 0) ? (
                  <div className="grid grid-cols-7 gap-1.5">
                    {report.weekdayMix.map((slot: any) => {
                      const maxRevenue = Math.max(
                        ...report.weekdayMix.map((entry: any) => entry.revenue),
                        1,
                      );
                      return (
                        <div key={slot.day} className="text-center">
                          <div className="mx-auto flex h-20 items-end sm:h-24">
                            <div
                              className="mx-auto w-full max-w-6 rounded-t bg-indigo-500"
                              style={{
                                height: `${Math.max((slot.revenue / maxRevenue) * 100, slot.revenue > 0 ? 8 : 3)}%`,
                                opacity: slot.revenue > 0 ? 1 : 0.2,
                              }}
                            />
                          </div>
                          <div className="mt-1 text-[10px] font-medium text-muted-foreground">
                            {slot.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyLine>{t.noData}</EmptyLine>
                )}
              </ListCard>
            ) : null}

            <ListCard
              title={t.categoryPerformance}
              description={textFor(
                language,
                "Where your sales are coming from.",
                "विक्री कोणत्या वर्गातून येते.",
              )}
            >
              {report.categorySales.length ? (
                report.categorySales.slice(0, 6).map((category: any) => {
                  const share =
                    report.revenue > 0
                      ? (category.revenue / report.revenue) * 100
                      : 0;
                  return (
                    <div key={category.name} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{category.name}</span>
                        <span>
                          {money(category.revenue)} · {pct(share)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-cyan-500"
                          style={{ width: `${Math.min(share, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyLine>{t.noData}</EmptyLine>
              )}
            </ListCard>

            <div className="lg:col-span-2">
            <ListCard
              title={t.allBills}
              description={textFor(
                language,
                "Every bill in the selected period, with payment and profit.",
                "निवडलेल्या कालावधीतील प्रत्येक बिल, पेमेंट आणि नफ्यासह.",
              )}
            >
              {report.billRegister.length ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {t.billsShown} {formatNumber(visibleBills.length)} /{" "}
                      {formatNumber(report.billRegister.length)}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={exportBills}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span className="ml-1.5">{t.exportCsv}</span>
                    </Button>
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-155 text-left text-sm">
                      <thead className="border-b text-xs text-muted-foreground">
                        <tr>
                          <th className="pb-2 font-medium">{t.bill}</th>
                          <th className="pb-2 font-medium">{t.date}</th>
                          <th className="pb-2 font-medium">{t.payment}</th>
                          <th className="pb-2 font-medium">{t.customer}</th>
                          <th className="pb-2 text-right font-medium">{t.sales}</th>
                          <th className="pb-2 text-right font-medium">
                            {t.profit}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {visibleBills.map((sale: any) => (
                          <tr key={sale.id}>
                            <td className="py-2 font-medium tabular-nums">#{sale.id}</td>
                            <td className="py-2 text-muted-foreground">{sale.date}</td>
                            <td className="py-2">{paymentLabel(sale.paymentMethod, t, language)}</td>
                            <td className="py-2 text-muted-foreground truncate max-w-36">
                              {sale.creditCustomerName || "—"}
                            </td>
                            <td className="py-2 text-right tabular-nums">{money(sale.subtotal)}</td>
                            <td
                              className={cn(
                                "py-2 text-right font-medium tabular-nums",
                                safeNumber(sale.totalProfit) >= 0
                                  ? "text-emerald-700"
                                  : "text-red-700",
                              )}
                            >
                              {money(sale.totalProfit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden space-y-2">
                    {visibleBills.map((sale: any) => {
                      const method = String(sale.paymentMethod || "").toLowerCase();
                      const methodLabel = paymentLabel(sale.paymentMethod, t, language);
                      const methodBadge =
                        method === "cash"
                          ? "bg-green-100 text-green-800"
                          : method === "udhar" || method === "udhari"
                            ? "bg-orange-100 text-orange-800"
                            : method === "partial"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800";
                      return (
                        <div
                          key={sale.id}
                          className="rounded-xl border bg-card p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold tabular-nums">#{sale.id}</div>
                            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", methodBadge)}>
                              {methodLabel}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 gap-2">
                            <span>{sale.date}</span>
                            {sale.creditCustomerName ? (
                              <span className="truncate">{sale.creditCustomerName}</span>
                            ) : null}
                          </div>
                          <div className="grid grid-cols-2 gap-2 border-t pt-2">
                            <div>
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.sales}</div>
                              <div className="text-sm font-semibold tabular-nums">{money(sale.subtotal)}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.profit}</div>
                              <div
                                className={cn(
                                  "text-sm font-semibold tabular-nums",
                                  safeNumber(sale.totalProfit) >= 0
                                    ? "text-emerald-700"
                                    : "text-red-700",
                                )}
                              >
                                {money(sale.totalProfit)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {report.billRegister.length > 20 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setShowAllBills((value) => !value)}
                    >
                      {showAllBills ? t.showLess : t.showMore}
                    </Button>
                  ) : null}
                </>
              ) : (
                <EmptyLine>{t.noBills}</EmptyLine>
              )}
            </ListCard>
            </div>
          </>
        )}

        {section === "stock" && (
          <>
            <div className="grid gap-2.5 grid-cols-2 lg:col-span-2 lg:grid-cols-3">
              <MetricCard
                label={t.totalStock}
                value={money(report.totalStockValue)}
                note={`${formatNumber(items.length)} ${t.item}`}
                tone="purple"
                icon={Boxes}
                footnote={
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium">
                    <Clock className="h-2.5 w-2.5" />
                    {t.currentStock}
                  </span>
                }
              />
              <MetricCard
                label={textFor(language, "Bad stock", "खराब स्टॉक")}
                value={money(report.badStockValue)}
                note={t.expiry}
                tone="red"
                icon={AlertTriangle}
              />
              <MetricCard
                label={textFor(language, "Going expiry", "लवकर कालबाह्य")}
                value={money(report.expiringStockValue)}
                note={t.expiry}
                tone="amber"
                icon={Clock}
              />
            </div>
            <ListCard
              title={t.stockMovement}
              description={textFor(
                language,
                "Recorded inventory movements across the shop.",
                "दुकानातील नोंदवलेल्या स्टॉक हालचाली.",
              )}
            >
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-900">
                  <div className="text-lg font-bold">
                    {formatNumber(report.stockMovement.purchased)}
                  </div>
                  <div className="text-xs">{t.purchased}</div>
                </div>
                <div className="rounded-xl bg-amber-50 p-3 text-amber-900">
                  <div className="text-lg font-bold">
                    {formatNumber(report.stockMovement.damaged)}
                  </div>
                  <div className="text-xs">{t.damaged}</div>
                </div>
                <div className="rounded-xl bg-red-50 p-3 text-red-900">
                  <div className="text-lg font-bold">
                    {formatNumber(report.stockMovement.expired)}
                  </div>
                  <div className="text-xs">{t.expired}</div>
                </div>
              </div>
            </ListCard>
            <ListCard
              title={t.slowStock}
              description={`${t.stockAtRisk}: ${money(report.stockAtRiskValue)}`}
            >
              {report.slowStock.length ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t.reviewStock}
                  </p>
                  <div className="space-y-2">
                    {report.slowStock.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {(item.name || item.nameMarathi)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.lastSold
                              ? `${textFor(language, "Last sold", "शेवटची विक्री")}: ${item.lastSold}`
                              : t.deadStock}{" "}
                            · {formatNumber(item.quantity)} {t.quantity}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-semibold">
                            {money(item.stockValue)}
                          </div>
                          <div className="text-xs text-emerald-700">
                            {money(item.potentialProfit)} {t.profit}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyLine>{t.noData}</EmptyLine>
              )}
            </ListCard>
            <ListCard title={t.lossBreakdown} description={t.lossBreakdownHint}>
              {report.lossByProduct.length ? (
                <div className="space-y-2">
                  {report.lossByProduct.map((entry: any) => (
                    <div
                      key={entry.name}
                      className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/70 p-3 text-sm text-red-950"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{entry.name}</div>
                        <div className="text-xs opacity-70">
                          {entry.category} · {formatNumber(entry.quantity)}{" "}
                          {t.quantity} · {entry.reasons.join(" + ")}
                        </div>
                      </div>
                      <div className="shrink-0 text-right font-semibold">
                        {money(entry.value)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyLine>
                  {textFor(
                    language,
                    "No realized product loss recorded.",
                    "वस्तूनुसार झालेला तोटा नोंदलेला नाही.",
                  )}
                </EmptyLine>
              )}
            </ListCard>
            <div id="stock" className="scroll-mt-24">
              <ListCard
                title={t.stockStory}
                description={`${t.lowStock} / ${t.expiry}`}
              >
                <div className="grid gap-3">
                  <div>
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-700"
                    >
                      {t.lowStock}
                    </Badge>
                    <div className="mt-2 space-y-2">
                      {report.lowStock.length ? (
                        report.lowStock.slice(0, 5).map((item: any) => (
                          <div
                            key={item.id || item.name}
                            className="flex items-center justify-between rounded-xl bg-amber-50 p-3 text-sm text-amber-950"
                          >
                            <span className="font-medium">
                              {(item.name || item.nameMarathi)}
                            </span>
                            <span>
                              {formatNumber(item.quantity)} /{" "}
                              {formatNumber(item.lowStockLimit)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <EmptyLine>{t.stockOk}</EmptyLine>
                      )}
                    </div>
                  </div>
                  <div>
                    <Badge variant="outline" className="bg-red-50 text-red-700">
                      {t.expiry}
                    </Badge>
                    <div className="mt-2 space-y-2">
                      {report.expiring.length ? (
                        report.expiring.map((batch: any) => (
                          <div
                            key={
                              batch.id ||
                              `${batch.itemName}-${batch.expiryDate}`
                            }
                            className="flex items-center justify-between rounded-xl bg-red-50 p-3 text-sm text-red-950"
                          >
                            <div>
                              <div className="font-medium">
                                {batch.itemName || batch.item_name || t.item}
                              </div>
                              <div className="text-xs opacity-70">
                                {batch.expiryDate || batch.expiry_date || "NA"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">
                                {money(
                                  safeNumber(
                                    batch.quantityAvailable ??
                                      batch.quantity_available,
                                  ) *
                                    safeNumber(
                                      batch.costPerUnit ?? batch.cost_per_unit,
                                    ),
                                )}
                              </div>
                              <div className="text-xs opacity-70">
                                {formatNumber(
                                  batch.quantityAvailable ??
                                    batch.quantity_available,
                                )}{" "}
                                {t.quantity}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyLine>
                          {textFor(
                            language,
                            "No expired or near-expiry stock.",
                            "कालबाह्य किंवा लवकर कालबाह्य स्टॉक नाही.",
                          )}
                        </EmptyLine>
                      )}
                    </div>
                  </div>
                </div>
              </ListCard>
            </div>
          </>
        )}

        {section === "udhari" && (
          <>
            <div className="grid gap-2.5 grid-cols-2 lg:col-span-2">
              <MetricCard
                label={t.pendingTotal}
                value={money(totalPending)}
                note={`${formatNumber(report.topCustomers.length)} ${t.customer}`}
                tone="red"
                icon={CreditCard}
                footnote={
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium">
                    <Clock className="h-2.5 w-2.5" />
                    {t.pendingNow}
                  </span>
                }
              />
              <MetricCard
                label={t.oldestDebt}
                value={
                  report.longPendingCustomers[0]
                    ? `${formatNumber(report.longPendingCustomers[0].creditPressure.daysPending)} ${textFor(language, "days", "दिवस")}`
                    : "0"
                }
                note={report.longPendingCustomers[0]?.name || t.noData}
                tone="amber"
                icon={Clock}
              />
            </div>
            <ListCard
              title={t.aging}
              description={textFor(
                language,
                "Pending balances grouped by the age of the oldest unpaid credit.",
                "न भरलेल्या उधारीच्या वयानुसार बाकीचे वर्गीकरण.",
              )}
            >
              <div className="grid gap-2.5 grid-cols-2 md:grid-cols-4">
                {report.agingBuckets.map((bucket: any) => {
                  const share =
                    totalPending > 0 ? (bucket.amount / totalPending) * 100 : 0;
                  return (
                    <div
                      key={bucket.label}
                      className="rounded-xl bg-muted/40 p-3"
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="font-semibold">{bucket.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {bucket.customers} {t.customers}
                        </span>
                      </div>
                      <div className="mt-2 text-lg font-bold">
                        {money(bucket.amount)}
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
                        <div
                          className="h-full rounded-full bg-orange-500"
                          style={{ width: `${Math.min(share, 100)}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {pct(share)} {t.pendingTotal}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid gap-2 border-t pt-3 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">{t.creditGiven}</span>
                  <strong className="ml-2">{money(report.creditGiven)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">{t.collected}</span>
                  <strong className="ml-2 text-emerald-700">
                    {money(report.collected)}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {t.collectionRate}
                  </span>
                  <strong className="ml-2">{pct(report.collectionRate)}</strong>
                </div>
              </div>
            </ListCard>
            <div id="udhari" className="scroll-mt-24">
              <ListCard title={t.udhariRecovery} description={t.collectFirst}>
                <div className="grid gap-4">
                  <div>
                    <Badge variant="outline" className="bg-red-50 text-red-700">
                      {textFor(language, "Most udhari", "सर्वाधिक उधारी")}
                    </Badge>
                    <div className="mt-2 space-y-2">
                      {report.topCustomers.length ? (
                        report.topCustomers.slice(0, 3).map((customer: any) => (
                          <div
                            key={customer.id || customer.name}
                            className="flex items-center justify-between rounded-xl bg-red-50 p-3 text-sm text-red-950"
                          >
                            <div>
                              <div className="font-medium">{customer.name}</div>
                              <div className="text-xs opacity-70">
                                {customer.phone || t.customer}
                              </div>
                            </div>
                            <div className="font-semibold">
                              {money(customer.balance)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyLine>
                          {textFor(
                            language,
                            "No pending udhari customers.",
                            "उधारी बाकी ग्राहक नाहीत.",
                          )}
                        </EmptyLine>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Badge
                        variant="outline"
                        className="bg-orange-50 text-orange-700"
                      >
                        {textFor(language, "Most frequent", "वारंवार उधारी")}
                      </Badge>
                      <div className="mt-2 space-y-2">
                        {report.frequentCreditCustomers.length ? (
                          report.frequentCreditCustomers.map((entry: any) => (
                            <div
                              key={entry.customer.id}
                              className="rounded-xl bg-muted/40 p-3 text-sm"
                            >
                              <div className="font-medium">
                                {entry.customer.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatNumber(entry.count)}{" "}
                                {textFor(
                                  language,
                                  "credit bills",
                                  "उधारी बिले",
                                )}{" "}
                                · {money(entry.amount)}
                              </div>
                            </div>
                          ))
                        ) : (
                          <EmptyLine>{t.noData}</EmptyLine>
                        )}
                      </div>
                    </div>
                    <div>
                      <Badge
                        variant="outline"
                        className="bg-slate-50 text-slate-700"
                      >
                        {textFor(language, "Long-time pending", "जुनी उधारी")}
                      </Badge>
                      <div className="mt-2 space-y-2">
                        {report.longPendingCustomers.length ? (
                          report.longPendingCustomers.map((customer: any) => (
                            <div
                              key={customer.id || customer.name}
                              className="rounded-xl bg-muted/40 p-3 text-sm"
                            >
                              <div className="font-medium">{customer.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {money(customer.balance)} ·{" "}
                                {formatNumber(
                                  customer.creditPressure.daysPending,
                                )}{" "}
                                {textFor(language, "days pending", "दिवस बाकी")}
                              </div>
                            </div>
                          ))
                        ) : (
                          <EmptyLine>{t.noData}</EmptyLine>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </ListCard>
            </div>
          </>
        )}

      </div>

      {isLoading ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full border bg-background px-4 py-2 text-sm shadow">
          {textFor(
            language,
            "Loading report data...",
            "अहवाल डेटा लोड होत आहे...",
          )}
        </div>
      ) : null}
    </PageContainer>
  );
}
