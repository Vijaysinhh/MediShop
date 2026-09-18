"use client";

import { useEffect, useState } from "react";
import { useSales, useItems } from "@/hooks/use-supabase";
import { useAuth } from "@/providers/auth-provider";
import { useLanguage } from "@/providers/language-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, DollarSign, Zap } from "lucide-react";
import Link from "next/link";
import { formatMoney, formatPercent, formatWholeNumber } from "@/lib/number-format";
import { dateKey } from "@/lib/utils";
import { formatSaleLineSubtitle } from "@/lib/sale-item-display";
import { Input } from "@/components/ui/input";

export function DailySalesReport() {
  const { currentShopId } = useAuth();
  const { getDailySummary, sales } = useSales(currentShopId);
  const { items } = useItems(currentShopId);
  const { t } = useLanguage();
  const [dailyData, setDailyData] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const summary = await getDailySummary(selectedDate);
        setDailyData(summary);
      } catch (error) {
        console.error("[v0] Error fetching daily summary:", error);
        setDailyData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedDate]);

  if (loading) {
    return <div className="py-8 text-center">{t("loading_report")}</div>;
  }

  if (!dailyData) {
    return <div className="py-8 text-center">{t("no_data")}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("daily_report_title")}</h1>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="mt-2 h-10 w-full sm:w-auto"
          />
        </div>
        <Link href="/sales" className="w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto h-10 sm:h-9"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("back_to_sales")}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("total_transactions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dailyData.totalSales}</div>
            <p className="mt-1 text-xs text-muted-foreground">{t("sales_completed")}</p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              {t("total_revenue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rs. {formatMoney(dailyData.totalRevenue)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("revenue")}</p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {t("total_profit")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rs. {formatMoney(dailyData.totalProfit)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("profit_amount")}</p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4" />
              {t("margin")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercent(dailyData.profitMarginPercent)}%
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("margin")}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-base">{t("total_cost")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("total_revenue")}</span>
              <span className="font-bold">
                Rs. {formatMoney(dailyData.totalRevenue)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("total_cost")}</span>
              <span className="font-bold">
                -Rs. {formatMoney(dailyData.totalCost)}
              </span>
            </div>
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="font-semibold">{t("total_profit")}</span>
              <span className="font-bold">
                Rs. {formatMoney(dailyData.totalProfit)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {dailyData.sales.length > 0 && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-base">{t("transactions")}</CardTitle>
            <CardDescription>{dailyData.sales.length} {t("transactions")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {dailyData.sales.map((sale: any, idx: number) => (
                <div key={sale.id} className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-sm">{t("sale")} #{idx + 1}</div>
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
                          <span className="font-medium">{item.itemName}</span>
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

      {dailyData.sales.length === 0 && (
        <Card className="border-2 border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{t("no_sales_day")} ({selectedDate})</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
