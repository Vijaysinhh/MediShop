"use client";

import { useMemo } from "react";
import { useSales, useItems } from "@/hooks/use-supabase";
import { useAuth } from "@/providers/auth-provider";
import { useLanguage } from "@/providers/language-provider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, TrendingUp } from "lucide-react";
import { formatMoney, formatPercent, formatWholeNumber } from "@/lib/number-format";

export function TopProductsReport() {
  const { currentShopId } = useAuth();
  const { sales } = useSales(currentShopId);
  const { items } = useItems(currentShopId);
  const { t, language } = useLanguage();

  // Calculate product metrics
  const productStats = useMemo(() => {
    const stats: Record<number, any> = {};

    // Initialize stats for all items
    items.forEach(item => {
      if (item.id) {
        stats[item.id] = {
          itemId: item.id,
          name: item.name,
          nameMarathi: item.nameMarathi,
          totalQuantity: 0,
          totalRevenue: 0,
          totalProfit: 0,
        };
      }
    });

    // Aggregate sales data
    sales.forEach(sale => {
      sale.items?.forEach((saleItem: any) => {
        const itemId = saleItem.itemId;
        if (itemId && stats[itemId]) {
          stats[itemId].totalQuantity += saleItem.quantity || 0;
          stats[itemId].totalRevenue += saleItem.totalPrice || 0;
          stats[itemId].totalProfit += saleItem.profit || 0;
        }
      });
    });

    // Convert to array and sort
    return Object.values(stats)
      .filter(stat => stat.totalQuantity > 0)
      .sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [sales, items]);

  const topByProfit = [...productStats].sort((a, b) => b.totalProfit - a.totalProfit);

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Top Selling Products (By Quantity)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {productStats.slice(0, 10).map((stat, idx) => (
              <div key={stat.itemId} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-xs font-bold">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-medium">
                      {((stat.name || stat.nameMarathi))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatWholeNumber(stat.totalQuantity)} units sold
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">Rs. {formatMoney(stat.totalRevenue)}</p>
                  <p className="text-xs text-green-600 font-medium">+Rs. {formatMoney(stat.totalProfit)}</p>
                </div>
              </div>
            ))}
            {productStats.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">No sales data available</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Most Profitable Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topByProfit.slice(0, 10).map((stat, idx) => (
              <div key={stat.itemId} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-bold">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-medium">
                      {((stat.name || stat.nameMarathi))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatWholeNumber(stat.totalQuantity)} units sold
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">+Rs. {formatMoney(stat.totalProfit)}</p>
                </div>
              </div>
            ))}
            {topByProfit.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">No sales data available</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
