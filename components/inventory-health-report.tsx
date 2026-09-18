"use client";

import { useMemo } from "react";
import { useItems } from "@/hooks/use-supabase";
import { useAuth } from "@/providers/auth-provider";
import { useLanguage } from "@/providers/language-provider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, Clock, Package } from "lucide-react";
import { formatMoney, formatWholeNumber } from "@/lib/number-format";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function InventoryHealthReport() {
  const { currentShopId } = useAuth();
  const { items } = useItems(currentShopId);
  const { t, language } = useLanguage();

  const {
    totalInventoryValue,
    lowStockItems,
    expiredItems,
    nearExpiryItems,
    outOfStockItems,
  } = useMemo(() => {
    let totalValue = 0;
    const lowStock: any[] = [];
    const expired: any[] = [];
    const nearExpiry: any[] = [];
    const outOfStock: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    items.forEach(item => {
      const qty = Number(item.quantity || 0);
      const cost = Number(item.buyPrice || 0);
      totalValue += qty * cost;

      if (qty === 0) {
        outOfStock.push(item);
      } else if (qty <= item.lowStockLimit) {
        lowStock.push(item);
      }

      if (item.expiryDate) {
        const expiryDate = new Date(item.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);
        if (expiryDate < today) {
          expired.push(item);
        } else if (expiryDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)) {
          nearExpiry.push(item);
        }
      }
    });

    return {
      totalInventoryValue: totalValue,
      lowStockItems: lowStock,
      expiredItems: expired,
      nearExpiryItems: nearExpiry,
      outOfStockItems: outOfStock,
    };
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="w-4 h-4" />
              Total Inventory Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rs. {formatMoney(totalInventoryValue)}</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Low Stock Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{lowStockItems.length}</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Near Expiry Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{nearExpiryItems.length}</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Expired Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{expiredItems.length}</div>
          </CardContent>
        </Card>
      </div>

      {lowStockItems.length > 0 && (
        <Card className="border-2 border-orange-200">
          <CardHeader>
            <CardTitle className="text-base">Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStockItems.slice(0, 10).map((item) => (
              <div key={item.id} className="flex justify-between items-center p-3 rounded-lg border border-orange-100">
                <div>
                  <p className="font-medium">
                    {((item.name || item.nameMarathi))}
                  </p>
                  <p className="text-xs text-orange-600">
                    {formatWholeNumber(item.quantity)} left (Low stock limit: {item.lowStockLimit})
                  </p>
                </div>
              </div>
            ))}
            <div className="pt-2">
              <Link href="/items">
                <Button variant="outline" size="sm">View All Items</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {expiredItems.length > 0 && (
        <Card className="border-2 border-red-200">
          <CardHeader>
            <CardTitle className="text-base text-red-700">Expired Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {expiredItems.slice(0, 10).map((item) => (
              <div key={item.id} className="flex justify-between items-center p-3 rounded-lg border border-red-100 bg-red-50">
                <div>
                  <p className="font-medium">
                    {((item.name || item.nameMarathi))}
                  </p>
                  <p className="text-xs text-red-600">
                    Expired on {new Date(item.expiryDate).toLocaleDateString(('en-IN'))}
                  </p>
                </div>
              </div>
            ))}
            <div className="pt-2">
              <Link href="/items">
                <Button variant="outline" size="sm">View All Items</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {nearExpiryItems.length > 0 && (
        <Card className="border-2 border-orange-200">
          <CardHeader>
            <CardTitle className="text-base text-orange-700">Items Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nearExpiryItems.slice(0, 10).map((item) => (
              <div key={item.id} className="flex justify-between items-center p-3 rounded-lg border border-orange-100 bg-orange-50">
                <div>
                  <p className="font-medium">
                    {((item.name || item.nameMarathi))}
                  </p>
                  <p className="text-xs text-orange-600">
                    Expires on {new Date(item.expiryDate).toLocaleDateString(('en-IN'))}
                  </p>
                </div>
              </div>
            ))}
            <div className="pt-2">
              <Link href="/items">
                <Button variant="outline" size="sm">View All Items</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
