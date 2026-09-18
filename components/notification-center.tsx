"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useLanguage } from "@/providers/language-provider";
import {
  useAlerts,
  useItems,
  useSales,
  useStockHistory,
  useUdhari,
} from "@/hooks/use-supabase";
import { Button } from "@/components/ui/button";
import { PushNotificationToggle } from "@/components/push-notification-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadPremiumPdf } from "@/lib/premium-pdf";
import { formatMoney, formatNumber, formatPercent } from "@/lib/number-format";
import { showBackgroundNotification } from "@/lib/push-notifications";
import {
  Activity,
  AlertTriangle,
  BellRing,
  Clock3,
  CreditCard,
  FileDown,
  Package,
  X,
} from "lucide-react";

type NotificationCategory = "stock" | "expiry" | "credit" | "sale" | "activity";

interface NotificationItem {
  id: string;
  category: NotificationCategory;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  meta?: string;
  createdAt: number;
  href?: string;
  staffName?: string;
}

function getExpiryStatus(item: any, today: Date) {
  if (!item.expiryDate) return null;
  const expiryDate = new Date(item.expiryDate);
  if (Number.isNaN(expiryDate.getTime())) return null;
  const expiryStart = new Date(expiryDate);
  expiryStart.setHours(0, 0, 0, 0);
  const sevenDaysAhead = new Date(today);
  sevenDaysAhead.setDate(today.getDate() + 7);
  if (expiryStart < today) return "expired";
  if (expiryStart <= sevenDaysAhead) return "expiring";
  return null;
}

function getItemFocusHref(itemId?: number | string | null, filter?: string) {
  const numericId = Number(itemId);
  if (!Number.isFinite(numericId) || numericId <= 0) return "/items";

  const params = new URLSearchParams({ focusItemId: String(numericId) });
  if (filter) params.set("filter", filter);
  return `/items?${params.toString()}`;
}

function getSaleFocusHref(saleId?: number | string | null) {
  const numericId = Number(saleId);
  return Number.isFinite(numericId) && numericId > 0
    ? `/sales?focusSaleId=${numericId}`
    : "/sales";
}

function getCustomerFocusHref(customerId?: number | string | null) {
  const numericId = Number(customerId);
  return Number.isFinite(numericId) && numericId > 0
    ? `/udhari?focusCustomerId=${numericId}`
    : "/udhari";
}

function getAlertItemFilter(alertType: string) {
  if (alertType === "low_stock") return "lowStock";
  if (alertType === "expired") return "expired";
  if (alertType === "expiring") return "expiring";
  return undefined;
}

const notificationCategoryStyles: Record<
  NotificationCategory,
  {
    border: string;
    icon: string;
    dot: string;
    badge: string;
  }
> = {
  stock: {
    border: "#f59e0b",
    icon: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-800",
  },
  expiry: {
    border: "#ef4444",
    icon: "bg-red-100 text-red-700",
    dot: "bg-red-500",
    badge: "bg-red-100 text-red-800",
  },
  credit: {
    border: "#f97316",
    icon: "bg-orange-100 text-orange-700",
    dot: "bg-orange-500",
    badge: "bg-orange-100 text-orange-800",
  },
  sale: {
    border: "#22c55e",
    icon: "bg-green-100 text-green-700",
    dot: "bg-green-500",
    badge: "bg-green-100 text-green-800",
  },
  activity: {
    border: "#3b82f6",
    icon: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-800",
  },
};

function NotificationIcon({
  category,
  size,
}: {
  category: NotificationCategory;
  size: "sm" | "md";
}) {
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  if (category === "stock") return <Package className={iconClass} />;
  if (category === "expiry") return <AlertTriangle className={iconClass} />;
  if (category === "credit") return <CreditCard className={iconClass} />;
  if (category === "sale") return <Activity className={iconClass} />;
  return <Activity className={iconClass} />;
}

export function NotificationCenter({ compact = false }: { compact?: boolean }) {
  const { user, currentShopId } = useAuth();
  const { t, language } = useLanguage();
  const router = useRouter();
  const { items } = useItems(currentShopId);
  const { sales } = useSales(currentShopId);
  const { stockHistory } = useStockHistory(currentShopId);
  const { customers, entries, totalPending } = useUdhari(currentShopId);
  const { alerts } = useAlerts(currentShopId);
  const [exporting, setExporting] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const lastNotifiedRef = useRef<string[]>([]);
  const actorName = useMemo(() => {
    const currentUser = user as any;
    return (currentUser?.fullName ||
      currentUser?.username ||
      currentUser?.name ||
      currentUser?.email ||
      "staff") as string;
  }, [user]);

  const notifications = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const derived: NotificationItem[] = [];

    items.forEach((item) => {
      const qty = Number(item.quantity || 0);
      const lowLimit = Number(item.lowStockLimit || 0);
      if (qty <= lowLimit && qty > 0) {
        derived.push({
          id: `low-stock-${item.id}`,
          category: "stock",
          severity: qty === 0 ? "critical" : "warning",
          title: ("Low stock"),
          message: `${item.name || item.nameMarathi || "Item"} ${("is running low")}`,
          meta: `${formatNumber(qty)} ${item.unitShortForm || ""}`.trim(),
          createdAt: item.updatedAt || Date.now(),
          href: getItemFocusHref(item.id, "lowStock"),
        });
      }

      const expiryStatus = getExpiryStatus(item, today);
      if (expiryStatus) {
        derived.push({
          id: `expiry-${item.id}`,
          category: "expiry",
          severity: expiryStatus === "expired" ? "critical" : "warning",
          title:
            expiryStatus === "expired"
              ? ("Expired")
              : ("Expiring soon"),
          message: `${item.name || item.nameMarathi || "Item"} ${expiryStatus === "expired" ? (("has expired")) : ("is nearing expiry")}`,
          meta: item.expiryDate
            ? new Date(item.expiryDate).toLocaleDateString(
                ("en-IN"),
              )
            : undefined,
          createdAt: item.updatedAt || Date.now(),
          href: getItemFocusHref(item.id, expiryStatus),
        });
      }
    });

    customers.forEach((customer) => {
      const balance = Number(customer.balance || 0);
      if (balance > 0) {
        const entriesForCustomer = entries
          .filter((entry) => entry.customerId === customer.id)
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const lastActivity = entriesForCustomer[0];
        const daysSinceActivity = lastActivity
          ? Math.max(
              0,
              Math.floor(
                (Date.now() - (lastActivity.timestamp || Date.now())) /
                  (1000 * 60 * 60 * 24),
              ),
            )
          : 999;
        if (daysSinceActivity >= 15) {
          derived.push({
            id: `credit-${customer.id}`,
            category: "credit",
            severity: daysSinceActivity >= 30 ? "critical" : "warning",
            title: ("Credit overdue"),
            message: `${customer.name} ${("has outstanding credit")}`,
            meta: `₹${formatMoney(balance)}`,
            createdAt:
              lastActivity?.timestamp || customer.updatedAt || Date.now(),
            href: getCustomerFocusHref(customer.id),
          });
        }
      }
    });

    sales.slice(0, 8).forEach((sale) => {
      derived.push({
        id: `sale-${sale.id}`,
        category: "sale",
        severity: "info",
        title: ("Sale recorded"),
        message: `${sale.creditCustomerName ? `${sale.creditCustomerName} • ` : ""}₹${formatMoney(sale.subtotal || 0)} • ${("staff")}: ${actorName}`,
        meta: sale.date,
        createdAt: sale.timestamp || sale.createdAt || Date.now(),
        href: getSaleFocusHref(sale.id),
        staffName: actorName,
      });
    });

    stockHistory.slice(0, 8).forEach((entry) => {
      derived.push({
        id: `stock-${entry.id}`,
        category: "stock",
        severity:
          entry.quantityChanged && entry.quantityChanged < 0
            ? "warning"
            : "info",
        title: ("Stock change"),
        message: `${entry.itemName || "Item"} ${entry.quantityChanged > 0 ? (("added")) : ("updated")} • ${("staff")}: ${actorName}`,
        meta: `${entry.type || "adjustment"}`,
        createdAt: entry.createdAt || Date.now(),
        href: getItemFocusHref(entry.itemId),
        staffName: actorName,
      });
    });

    entries
      .filter((entry) => entry.type === "credit")
      .slice(0, 6)
      .forEach((entry) => {
        derived.push({
          id: `udhari-${entry.id}`,
          category: "credit",
          severity: "info",
          title: ("Udhari entry"),
          message: `${entry.customerName || "Customer"} ${("credit entry recorded")} • ${("staff")}: ${actorName}`,
          meta: `₹${formatMoney(entry.amount || 0)}`,
          createdAt: entry.timestamp || entry.createdAt || Date.now(),
          href: getCustomerFocusHref(entry.customerId),
          staffName: actorName,
        });
      });

    const persisted: NotificationItem[] = alerts.map((alert: any) => {
      const category: NotificationItem["category"] =
        alert.alertType === "expiring" || alert.alertType === "expired"
          ? "expiry"
          : "stock";
      const severity: NotificationItem["severity"] = (alert.severity ||
        "warning") as NotificationItem["severity"];
      const itemId =
        alert.itemId ||
        alert.data?.itemId ||
        alert.data?.item_id ||
        alert.data?.id;

      return {
        id: `alert-${alert.id}`,
        category,
        severity,
        title:
          alert.alertType === "low_stock"
            ? ("Low stock")
            : alert.alertType === "expiring" || alert.alertType === "expired"
              ? ("Expiring")
              : ("Activity"),
        message: alert.message || "",
        meta: alert.data ? `${alert.data?.itemName || ""}`.trim() : undefined,
        createdAt: alert.createdAt || Date.now(),
        href: getItemFocusHref(itemId, getAlertItemFilter(alert.alertType)),
      };
    });

    return [...persisted, ...derived]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 25);
  }, [
    alerts,
    actorName,
    customers,
    entries,
    items,
    language,
    sales,
    stockHistory,
  ]);

  const visibleNotifications = useMemo(() => {
    return notifications.filter((item) => !dismissedIds.includes(item.id));
  }, [dismissedIds, notifications]);

  const stats = useMemo(() => {
    const critical = visibleNotifications.filter(
      (item) => item.severity === "critical",
    ).length;
    const warning = visibleNotifications.filter(
      (item) => item.severity === "warning",
    ).length;
    return { critical, warning, total: visibleNotifications.length };
  }, [visibleNotifications]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(
        "dukan-notifications-dismissed",
      );
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setDismissedIds(parsed);
      }
    } catch {
      // ignore invalid storage
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "dukan-notifications-dismissed",
        JSON.stringify(dismissedIds),
      );
    } catch {
      // ignore storage issues
    }
  }, [dismissedIds]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.Notification === "undefined"
    ) {
      return;
    }

    const incoming = visibleNotifications.filter(
      (item) => !lastNotifiedRef.current.includes(item.id),
    );

    if (
      incoming.length > 0 &&
      document.visibilityState === "hidden" &&
      Notification.permission === "granted"
    ) {
      incoming.slice(0, 3).forEach((item) => {
        void showBackgroundNotification({
          title: item.title,
          body: item.message,
          tag: item.id,
          url: item.href || "/dashboard",
        });
      });
    }

    lastNotifiedRef.current = visibleNotifications.map((item) => item.id);
  }, [visibleNotifications]);

  const handleDismiss = (id: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleOpenNotification = (item: NotificationItem) => {
    handleDismiss(item.id);
    if (item.href) router.push(item.href);
  };

  const handleClearAll = () => {
    setDismissedIds((prev) =>
      Array.from(new Set([...prev, ...notifications.map((item) => item.id)])),
    );
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const revenue = sales.reduce(
        (sum, sale) => sum + Number(sale.subtotal || 0),
        0,
      );
      const cost = sales.reduce(
        (sum, sale) => sum + Number(sale.totalCost || 0),
        0,
      );
      const profit = revenue - cost;
      const paymentBreakdown = sales.reduce<
        Record<string, { count: number; amount: number }>
      >((acc, sale) => {
        const method = sale.paymentMethod || sale.payment_method || "cash";
        if (!acc[method]) acc[method] = { count: 0, amount: 0 };
        acc[method].count += 1;
        acc[method].amount += Number(sale.subtotal || 0);
        return acc;
      }, {});
      const topItems = Object.values(
        sales.reduce<
          Record<
            string,
            { name: string; quantity: number; revenue: number; profit: number }
          >
        >((acc, sale) => {
          (sale.items || []).forEach((item: any) => {
            const key = item.itemName || item.item_name || "item";
            if (!acc[key])
              acc[key] = { name: key, quantity: 0, revenue: 0, profit: 0 };
            acc[key].quantity += Number(item.quantity || 0);
            acc[key].revenue += Number(item.totalPrice || 0);
            acc[key].profit += Number(item.profit || 0);
          });
          return acc;
        }, {}),
      )
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      const totalStockValue = items.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0) * Number(item.buyPrice || 0),
        0,
      );
      const highestUdharCustomer =
        customers
          .filter((customer) => Number(customer.balance || 0) > 0)
          .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))[0] ||
        null;
      await downloadPremiumPdf(
        {
          label:
            ("Notification center report"),
          sales,
          transactions: sales.length,
          revenue,
          cost,
          profit,
          margin: revenue > 0 ? (profit / revenue) * 100 : 0,
          topItems,
          shopName: "Dukan",
          totalStockValue,
          productsCount: items.length,
          lowStockItems: items
            .filter(
              (item) =>
                Number(item.quantity || 0) <= Number(item.lowStockLimit || 0),
            )
            .map((item) => ({
              name: item.name || item.nameMarathi || "Item",
              quantity: Number(item.quantity || 0),
              lowStockLimit: Number(item.lowStockLimit || 0),
            })),
          totalPendingUdhari: totalPending,
          highestUdharCustomer: highestUdharCustomer
            ? {
                name: highestUdharCustomer.name,
                balance: Number(highestUdharCustomer.balance || 0),
              }
            : null,
          paymentBreakdown,
          totalItemsSold: sales.reduce(
            (sum, sale) =>
              sum +
              (sale.items || []).reduce(
                (carry: number, item: any) =>
                  carry + Number(item.quantity || 0),
                0,
              ),
            0,
          ),
          averageBill: sales.length > 0 ? revenue / sales.length : 0,
          notifications: notifications.slice(0, 12),
        },
        `notification-center-${Date.now()}.pdf`,
      );
    } finally {
      setExporting(false);
    }
  };

  const title = ("Notification center");
  const subtitle =
    ("A live overview of stock, credit, and recent activity");

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex flex-col gap-3 rounded-xl border bg-background/70 p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">{title}</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <Button
            onClick={handleExportPdf}
            disabled={exporting}
            variant="outline"
            className="gap-2"
          >
            <FileDown className="h-4 w-4" />
            {exporting
              ? ("Preparing PDF...")
              : ("Download PDF")}
          </Button>
        </div>
      )}

      {compact ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-2.5 py-1.5">
            <div>
              <p className="text-sm font-semibold">
                {("Recent alerts")}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0
                  ? `${stats.total} ${("notifications")}`
                  : ("No alerts right now")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PushNotificationToggle compact />
              {visibleNotifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {("Clear")}
                </button>
              )}
            </div>
          </div>

          {visibleNotifications.length === 0 ? (
            <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
              {("You are all caught up.")}
            </div>
          ) : (
            <div className="space-y-1.5">
              {visibleNotifications.slice(0, 3).map((item) => {
                const styles = notificationCategoryStyles[item.category];

                return (
                  <div
                    key={item.id}
                    className="rounded-lg border bg-background p-2.5 transition-colors hover:bg-muted/40"
                    style={{
                      borderLeftColor: styles.border,
                      borderLeftWidth: 4,
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenNotification(item)}
                        className="flex flex-1 items-start gap-2 text-left"
                      >
                        <div
                          className={`mt-0.5 rounded-full p-1.5 ${styles.icon}`}
                        >
                          <NotificationIcon
                            category={item.category}
                            size="sm"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold">
                              {item.title}
                            </p>
                            <span
                              className={`h-2 w-2 rounded-full ${styles.dot}`}
                            />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.message}
                          </p>
                          {item.meta ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {item.meta}
                            </p>
                          ) : null}
                          {item.staffName ? (
                            <p className="mt-1 text-[11px] font-medium text-primary">
                              {("Staff action")}
                              : {item.staffName}
                            </p>
                          ) : null}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => handleDismiss(item.id, event)}
                        className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={
                          ("Clear notification")
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {("Total alerts")}
                    </p>
                    <p className="text-2xl font-semibold">{stats.total}</p>
                  </div>
                  <BellRing className="h-5 w-5 text-primary" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {("Critical")}
                    </p>
                    <p className="text-2xl font-semibold text-red-600">
                      {stats.critical}
                    </p>
                  </div>
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {("Needs attention")}
                    </p>
                    <p className="text-2xl font-semibold text-amber-600">
                      {stats.warning}
                    </p>
                  </div>
                  <Clock3 className="h-5 w-5 text-amber-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {visibleNotifications.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {("No notifications right now.")}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {visibleNotifications.map((item) => {
                const styles = notificationCategoryStyles[item.category];

                return (
                  <Card
                    key={item.id}
                    className="border-l-4"
                    style={{ borderLeftColor: styles.border }}
                  >
                    <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
                      <button
                        type="button"
                        onClick={() => handleOpenNotification(item)}
                        className="flex flex-1 gap-3 text-left"
                      >
                        <div
                          className={`mt-0.5 rounded-full p-2 ${styles.icon}`}
                        >
                          <NotificationIcon
                            category={item.category}
                            size="md"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{item.title}</p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${styles.badge}`}
                            >
                              {item.category}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.message}
                          </p>
                          {item.meta ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.meta}
                            </p>
                          ) : null}
                          {item.staffName ? (
                            <p className="mt-1 text-xs font-medium text-primary">
                              {("Staff action")}
                              : {item.staffName}
                            </p>
                          ) : null}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => handleDismiss(item.id, event)}
                        className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={
                          ("Clear notification")
                        }
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
