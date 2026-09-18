"use client";

import React from "react";
import { pdf } from "@react-pdf/renderer";
import { PremiumPdfReport } from "@/components/PremiumPdfReport";
import { registerPdfFonts } from "@/lib/pdf-fonts";
import type { PremiumReportData } from "./simple-pdf";

function normalizePremiumPdfData(data?: Partial<PremiumReportData> | null): PremiumReportData {
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

export async function downloadPremiumPdf(
  data: Partial<PremiumReportData> | null | undefined,
  fileName: string = `dukan-report-premium-${Date.now()}.pdf`,
) {
  try {
    console.info("downloadPremiumPdf: generating premium PDF", { fileName });
    await registerPdfFonts();
    const reportData = normalizePremiumPdfData(data);
    const blob = await pdf(<PremiumPdfReport data={reportData} />).toBlob();
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    console.info("downloadPremiumPdf: premium PDF download triggered", { fileName });
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (error) {
    console.error("Error downloading premium PDF:", error);
    // Fallback to simple PDF if premium fails
    throw error;
  }
}
