"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

export type UserPermissions = {
  canViewDashboard: boolean; canViewItems: boolean; canManageItems: boolean;
  canViewSales: boolean; canCreateSales: boolean; canViewUdhari: boolean;
  canManageUdhari: boolean; canViewReports: boolean; canViewSettings: boolean; canManageStaff: boolean;
};

export const DEFAULT_WORKER_PERMISSIONS: UserPermissions = {
  canViewDashboard: false, canViewItems: true, canManageItems: false, canViewSales: true,
  canCreateSales: true, canViewUdhari: false, canManageUdhari: false, canViewReports: false,
  canViewSettings: false, canManageStaff: false,
};
export const FULL_PERMISSIONS: UserPermissions = {
  canViewDashboard: true, canViewItems: true, canManageItems: true, canViewSales: true,
  canCreateSales: true, canViewUdhari: true, canManageUdhari: true, canViewReports: true,
  canViewSettings: true, canManageStaff: true,
};

export type MediShopRole = "super_admin" | "owner" | "manager" | "cashier" | "worker";

/** Compatibility shape consumed while legacy Dukan pages are migrated to UUID records. */
export type User = {
  id: string; username: string; role: MediShopRole; shop_id: string | null; shopId?: string | null;
  permissions: UserPermissions; fullName?: string | null; created_at?: string; updated_at?: string;
  /** Legacy compatibility only; Supabase Auth is the sole password authority. */ password?: string;
};
export type Shop = {
  id: string; name: string; shopName: string; legal_name?: string | null;
  drug_license_number?: string | null; phone?: string | null; phoneNumber?: string | null;
  email?: string | null; address?: string | null; status: "active" | "paused" | "archived";
  isPaused: boolean; ownerName?: string | null; subscriptionEndDate?: number; lastPaymentDate?: number;
  subscription_plan?: string | null; subscription_ends_at?: string | null;
  created_at?: string; updated_at?: string;
};

type PermissionRole = MediShopRole | string | null | undefined;
export function normalizeUserPermissions(role: PermissionRole, permissions?: Partial<UserPermissions> | null): UserPermissions {
  if (role === "owner" || role === "manager" || role === "super_admin") return { ...FULL_PERMISSIONS };
  return { ...DEFAULT_WORKER_PERMISSIONS, ...(permissions || {}), canManageStaff: false };
}
export function getUserLandingPath(user: Pick<User, "role" | "permissions"> | null): string {
  if (!user) return "/login";
  if (user.role === "super_admin") return "/super-admin";
  if (user.role === "owner" || user.role === "manager") return "/dashboard";
  const permissions = normalizeUserPermissions(user.role, user.permissions);
  return permissions.canCreateSales || permissions.canViewSales ? "/sales" : permissions.canViewItems ? "/items" : "/dashboard";
}
export function canUserAccessPath(user: Pick<User, "role" | "permissions"> | null, pathname: string | null | undefined): boolean {
  if (!pathname || pathname === "/" || pathname.startsWith("/login")) return true;
  if (!user) return false;
  if (user.role === "super_admin") return pathname.startsWith("/super-admin") || pathname.startsWith("/profile");
  if (pathname.startsWith("/super-admin")) return false;
  if (user.role === "owner" || user.role === "manager") return true;
  const permissions = normalizeUserPermissions(user.role, user.permissions);
  if (pathname.startsWith("/sales")) return permissions.canCreateSales || permissions.canViewSales;
  if (pathname.startsWith("/items")) return permissions.canViewItems;
  if (pathname.startsWith("/udhari")) return permissions.canViewUdhari;
  if (pathname.startsWith("/reports")) return permissions.canViewReports;
  return pathname.startsWith("/profile");
}

type AuthContextType = {
  user: User | null; currentShop: Shop | null;
  /** Temporary compatibility for legacy numeric Dukan hooks. */ currentShopId: any;
  isAuthenticated: boolean; isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>; refreshUser: () => Promise<void>;
};
const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapShop(row: any): Shop {
  return { ...row, name: row.name, shopName: row.name, phoneNumber: row.phone, isPaused: row.status === "paused" };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) { setUser(null); setCurrentShop(null); return; }
    const authUser = authData.user;
    const [{ data: profile }, { data: admin }] = await Promise.all([
      (supabase as any).from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
      (supabase as any).from("platform_admins").select("user_id").eq("user_id", authUser.id).maybeSingle(),
    ]);
    if (admin) {
      setUser({ id: authUser.id, username: authUser.email || "", role: "super_admin", shop_id: null, fullName: profile?.full_name || null, permissions: { ...FULL_PERMISSIONS } });
      setCurrentShop(null);
      return;
    }
    const { data: memberships, error: membershipError } = await (supabase as any)
      .from("shop_memberships").select("shop_id, role, permissions, shops(*)")
      .eq("user_id", authUser.id).eq("is_active", true);
    if (membershipError || !memberships?.length) { setUser(null); setCurrentShop(null); return; }
    const rememberedShopId = window.localStorage.getItem("medishop-current-shop-id");
    const membership = memberships.find((entry: any) => entry.shop_id === rememberedShopId) || memberships[0];
    const shop = mapShop(membership.shops);
    const role = membership.role as MediShopRole;
    setCurrentShop(shop);
    setUser({ id: authUser.id, username: authUser.email || "", role, shop_id: shop.id, shopId: shop.id, fullName: profile?.full_name || null, permissions: normalizeUserPermissions(role, membership.permissions) });
    window.localStorage.setItem("medishop-current-shop-id", shop.id);
  }, [supabase]);

  useEffect(() => {
    let mounted = true;
    void refreshUser().finally(() => { if (mounted) setIsLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void refreshUser(); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [refreshUser, supabase]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { success: false, error: error.message };
    await refreshUser();
    return { success: true };
  }, [refreshUser, supabase]);
  const logout = useCallback(async () => {
    await supabase.auth.signOut(); window.localStorage.removeItem("medishop-current-shop-id");
    setUser(null); setCurrentShop(null);
  }, [supabase]);

  return <AuthContext.Provider value={{ user, currentShop, currentShopId: currentShop?.id, isAuthenticated: !!user, isLoading, login, logout, refreshUser }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
