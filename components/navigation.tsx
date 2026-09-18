"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, Bell, ChevronRight, ClipboardList, CreditCard, HeartPulse,
  Home, LogOut, Menu, Package, ReceiptText, Search, Settings, Shield,
  ShoppingCart, Store, Truck, User, Users, Warehouse,
} from "lucide-react";
import { useAuth, canUserAccessPath, getUserLandingPath, normalizeUserPermissions } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NotificationCenter } from "@/components/notification-center";
import { OfflineStatus } from "@/components/offline-status";

type NavItem = { href: string; label: string; icon: typeof Home; description?: string };

const ownerDesktop: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/sales", label: "Billing", icon: ShoppingCart },
  { href: "/items", label: "Inventory", icon: Package },
  { href: "/new-stock", label: "Purchases", icon: Truck },
  { href: "/udhari", label: "Customers & Due", icon: Users },
  { href: "/stock-tasks", label: "Returns & Expiry", icon: ClipboardList },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/staff", label: "Team", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

const ownerMore: NavItem[] = [
  { href: "/udhari", label: "Customers & Due", icon: Users, description: "Customer credit and refill follow-ups" },
  { href: "/new-stock", label: "Purchases & Suppliers", icon: Truck, description: "Receive stock and manage supplier bills" },
  { href: "/stock-tasks", label: "Returns & Expiry", icon: ClipboardList, description: "Near-expiry, damage and supplier returns" },
  { href: "/reports", label: "Reports", icon: BarChart3, description: "Sales, stock and profitability" },
  { href: "/staff", label: "Staff", icon: User, description: "Team access and permissions" },
  { href: "/settings", label: "Settings", icon: Settings, description: "Pharmacy and billing preferences" },
  { href: "/subscription", label: "Subscription", icon: CreditCard, description: "Plan, renewal and payment status" },
];

export function Navigation() {
  const { user, currentShop, logout, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isAuthenticated || pathname?.startsWith("/login")) return;
    if (user?.role === "super_admin" && (pathname === "/" || !canUserAccessPath(user, pathname))) router.replace("/super-admin");
    else if (user?.role === "worker" && (pathname === "/" || !canUserAccessPath(user, pathname))) router.replace(getUserLandingPath(user));
    else if (pathname === "/") router.replace("/dashboard");
  }, [isAuthenticated, pathname, router, user]);

  const permissions = normalizeUserPermissions(user?.role, user?.permissions);
  const workerNav = useMemo<NavItem[]>(() => {
    const entries: NavItem[] = [];
    if (permissions.canCreateSales || permissions.canViewSales) entries.push({ href: "/sales", label: "Sell", icon: ShoppingCart });
    if (permissions.canViewItems) entries.push({ href: "/items", label: "Lookup", icon: Search });
    if (permissions.canViewDashboard) entries.push({ href: "/dashboard", label: "Activity", icon: ReceiptText });
    return entries;
  }, [permissions]);

  if (!isAuthenticated || pathname?.startsWith("/login")) return null;

  const isOwner = user?.role === "owner" || user?.role === "manager";
  const desktopItems = user?.role === "super_admin" ? [{ href: "/super-admin", label: "Platform", icon: Shield }] : isOwner ? ownerDesktop : workerNav;
  const mobileItems: NavItem[] = isOwner
    ? [{ href: "/dashboard", label: "Home", icon: Home }, { href: "/sales", label: "Sell", icon: ShoppingCart }, { href: "/items", label: "Inventory", icon: Package }]
    : workerNav.slice(0, 3);
  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

  async function signOut() { await logout(); router.replace("/login"); }
  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;
    router.push(`/items?search=${encodeURIComponent(query)}`);
    setSearch("");
  }

  return <>
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b bg-background/95 px-3 backdrop-blur sm:h-20 sm:px-5">
      <Link href={user?.role === "super_admin" ? "/super-admin" : "/dashboard"} className="flex shrink-0 items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white"><HeartPulse className="h-5 w-5" /></span>
        <span className="hidden sm:block"><span className="block text-lg font-bold leading-tight">MediShop</span><span className="block max-w-40 truncate text-xs text-muted-foreground">{currentShop?.name || (user?.role === "super_admin" ? "Platform administration" : "Pharmacy workspace")}</span></span>
      </Link>

      {user?.role !== "super_admin" && <form onSubmit={submitSearch} className="mx-3 flex flex-1 justify-center sm:mx-6"><div className="relative w-full max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search medicine, generic or barcode" /></div></form>}
      {user?.role === "super_admin" && <div className="flex-1" />}

      <div className="flex items-center gap-1.5"><OfflineStatus />
        {user?.role !== "super_admin" && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full"><Bell className="h-5 w-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-[340px] max-w-[calc(100vw-1rem)] p-2"><NotificationCenter compact /></DropdownMenuContent></DropdownMenu>}
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full"><Avatar className="h-9 w-9"><AvatarFallback className="bg-slate-900 text-white">{(user?.fullName || user?.username || "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-60"><DropdownMenuLabel><span className="block truncate">{user?.fullName || user?.username}</span><span className="text-xs font-normal capitalize text-muted-foreground">{user?.role?.replace("_", " ")}</span></DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href="/profile"><User className="mr-2 h-4 w-4" />Profile</Link></DropdownMenuItem>{isOwner && <DropdownMenuItem asChild><Link href="/subscription"><CreditCard className="mr-2 h-4 w-4" />Subscription</Link></DropdownMenuItem>}<DropdownMenuSeparator /><DropdownMenuItem className="text-red-600" onClick={() => void signOut()}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </div>
    </header>

    <aside className="fixed bottom-0 left-0 top-20 z-30 hidden w-56 border-r bg-background sm:flex sm:flex-col">
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">{isOwner && <Link href="/sales" className="mb-3 flex items-center gap-3 rounded-xl bg-teal-700 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"><ShoppingCart className="h-5 w-5" />New bill</Link>}{desktopItems.map((item) => <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", isActive(item.href) ? "bg-teal-50 text-teal-800" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><item.icon className="h-5 w-5" />{item.label}</Link>)}</nav>
      {isOwner && <div className="border-t p-3"><div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-2"><Store className="h-4 w-4 text-teal-700" /><span className="truncate text-xs font-semibold">{currentShop?.name}</span></div><p className="mt-1 text-[11px] capitalize text-muted-foreground">{currentShop?.subscription_plan || "Trial"} plan</p></div></div>}
    </aside>

    {(isOwner || user?.role === "worker") && <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t bg-background/95 backdrop-blur sm:hidden">{mobileItems.map((item) => <Link key={item.href} href={item.href} className={cn("flex flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold", isActive(item.href) ? "text-teal-700" : "text-muted-foreground")}><item.icon className="h-5 w-5" />{item.label}</Link>)}<button type="button" onClick={() => setMoreOpen(true)} className={cn("flex flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold", ownerMore.some((item) => isActive(item.href)) ? "text-teal-700" : "text-muted-foreground")}><Menu className="h-5 w-5" />More</button></nav>}

    <Sheet open={moreOpen} onOpenChange={setMoreOpen}><SheetContent side="bottom" className="max-h-[85dvh] rounded-t-3xl px-4 pb-7"><SheetHeader className="text-left"><SheetTitle>More pharmacy tools</SheetTitle><SheetDescription>Operations used outside the main counter flow.</SheetDescription></SheetHeader><div className="mt-4 grid gap-2 sm:grid-cols-2">{(isOwner ? ownerMore : workerNav).map((item) => <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className="flex items-center gap-3 rounded-2xl border p-3.5 transition hover:border-teal-200 hover:bg-teal-50"><span className="rounded-xl bg-slate-100 p-2 text-teal-700"><item.icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span>{item.description && <span className="block text-xs text-muted-foreground">{item.description}</span>}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>)}</div></SheetContent></Sheet>
  </>;
}
