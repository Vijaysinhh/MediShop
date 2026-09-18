"use client";

import { useState, useEffect, useMemo } from "react";
import { useSales } from "@/hooks/use-supabase";
import { useAuth } from "@/providers/auth-provider";
import { useLanguage } from "@/providers/language-provider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { formatMoney, formatPercent, formatWholeNumber } from "@/lib/number-format";
import { monthKey } from "@/lib/utils";
import { formatSaleLineSubtitle } from "@/lib/sale-item-display";
import { Input } from "@/components/ui/input";

export function MonthlyPLReport() {
  const { currentShopId } = useAuth();
  const { sales } = useSales(currentShopId);
  const { t, formatDate } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(() => monthKey(new Date()));
  const [loading, setLoading] = useState(false);

  // Memoize the calculations to prevent unnecessary recalculations
  const {
    monthSales,
    dailyData,
    totalRevenue,
    totalCost,
    totalProfit,
    profitMargin,
  } = useMemo(() => {
    setLoading(true);

    try {
      const monthSalesData = sales.filter((s) =>
        s.date.startsWith(selectedMonth),
      );

      type DailyData = {
        date: string;
        revenue: number;
        cost: number;
        profit: number;
      };

      const dailyDataCalc = monthSalesData.reduce((acc, sale) => {
        const existing = acc.find((d: DailyData) => d.date === sale.date);
        if (existing) {
          existing.revenue += sale.subtotal;
          existing.cost += sale.totalCost;
          existing.profit += sale.totalProfit;
        } else {
          acc.push({
            date: sale.date,
            revenue: sale.subtotal,
            cost: sale.totalCost,
            profit: sale.totalProfit,
          });
        }
        return acc;
      }, [] as DailyData[]);

      const totalRevenueCalc = monthSalesData.reduce(
        (sum, s) => sum + s.subtotal,
        0,
      );
      const totalCostCalc = monthSalesData.reduce(
        (sum, s) => sum + s.totalCost,
        0,
      );
      const totalProfitCalc = totalRevenueCalc - totalCostCalc;
      const profitMarginCalc =
        totalRevenueCalc > 0
          ? (totalProfitCalc / totalRevenueCalc) * 100
          : 0;

      setLoading(false);

      return {
        monthSales: monthSalesData,
        dailyData: dailyDataCalc,
        totalRevenue: totalRevenueCalc,
        totalCost: totalCostCalc,
        totalProfit: totalProfitCalc,
        profitMargin: profitMarginCalc,
      };
    } catch (error) {
      console.error("[v0] Error calculating monthly data:", error);
      setLoading(false);
      return {
        monthSales: [],
        dailyData: [],
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        profitMargin: 0,
      };
    }
  }, [selectedMonth, sales]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="h-10"
          disabled={loading}
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("loading_report")}
        </div>
      ) : monthSales.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("no_sales_month")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <Card className="border-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {t("revenue")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  Rs. {formatMoney(totalRevenue)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("cost_of_goods")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  Rs. {formatMoney(totalCost)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  {t("profit_amount")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  Rs. {formatMoney(totalProfit)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("margin")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPercent(Number(profitMargin))}%</div>
              </CardContent>
            </Card>
          </div>

          {dailyData.length > 0 && (
            <Card className="border-2 hidden sm:block">
              <CardHeader>
                <CardTitle>{t("daily_breakdown")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="#3b82f6" name={t("revenue")} />
                    <Bar dataKey="cost" fill="#ef4444" name={t("cost")} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {dailyData.length > 0 && (
            <Card className="border-2 hidden sm:block">
              <CardHeader>
                <CardTitle>{t("profit_amount")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="#10b981"
                      strokeWidth={2}
                      name={t("profit_amount")}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {monthSales.length > 0 && (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg">{t("transactions")}</CardTitle>
                <CardDescription>
                  {t("top_selling_items")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {monthSales
                    .slice(-10)
                    .reverse()
                    .map((sale: any, idx: number) => (
                      <div
                        key={sale.id}
                        className="rounded-lg border bg-muted/30 p-3"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium text-sm">
                              {t("sale")} #{monthSales.length - idx}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(new Date(sale.timestamp))}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">
                              Rs. {formatMoney(sale.subtotal)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              +Rs. {formatMoney(sale.totalProfit)} {t("profit_amount")}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          {sale.items.map((item: any, itemIdx: number) => (
                            <div
                              key={itemIdx}
                              className="flex justify-between items-center text-xs bg-background p-2 rounded border"
                            >
                              <div className="flex-1">
                                <span className="font-medium">
                                  {item.itemName}
                                </span>
                                <span className="text-muted-foreground ml-1">
                                  {formatSaleLineSubtitle(item)}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold">
                                  Rs. {formatMoney(item.totalPrice)}
                                </div>
                                <div className="text-muted-foreground">
                                  +Rs. {formatMoney(item.profit)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {monthSales.length === 0 && !loading && (
            <Card className="border-2 border-dashed">
              <CardContent className="pt-8 pb-8 text-center">
                <p className="text-muted-foreground">
                  {t("no_sales_month")}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
