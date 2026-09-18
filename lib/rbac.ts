import { useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'cashier' | 'viewer';

// Define role permissions
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: [
    'shops.create',
    'shops.read',
    'shops.update',
    'shops.delete',
    'inventory.read',
    'inventory.create',
    'inventory.update',
    'inventory.delete',
    'sales.read',
    'sales.create',
    'sales.update',
    'sales.delete',
    'udhari.read',
    'udhari.create',
    'udhari.update',
    'udhari.delete',
    'reports.read',
    'reports.create',
    'users.manage',
    'settings.manage',
    'billing.manage',
    'audit.read',
    'health.read',
  ],
  admin: [
    'shops.read',
    'shops.update',
    'inventory.read',
    'inventory.create',
    'inventory.update',
    'inventory.delete',
    'sales.read',
    'sales.create',
    'sales.update',
    'sales.delete',
    'udhari.read',
    'udhari.create',
    'udhari.update',
    'udhari.delete',
    'reports.read',
    'reports.create',
    'users.manage',
    'settings.manage',
    'audit.read',
  ],
  manager: [
    'inventory.read',
    'inventory.create',
    'inventory.update',
    'sales.read',
    'sales.create',
    'sales.update',
    'udhari.read',
    'udhari.create',
    'udhari.update',
    'reports.read',
  ],
  cashier: [
    'inventory.read',
    'sales.read',
    'sales.create',
    'udhari.read',
    'udhari.create',
  ],
  viewer: [
    'inventory.read',
    'sales.read',
    'udhari.read',
    'reports.read',
  ],
};

// Check if a role has a permission
export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// Check if user has any of the required permissions
export function hasAnyPermission(
  role: UserRole,
  permissions: string[]
): boolean {
  return permissions.some((perm) => hasPermission(role, perm));
}

// Check if user has all of the required permissions
export function hasAllPermissions(
  role: UserRole,
  permissions: string[]
): boolean {
  return permissions.every((perm) => hasPermission(role, perm));
}

// React hook for using RBAC
export function useRBAC() {
  const { user } = useAuth();

  const userRole = useMemo((): UserRole => {
    if (user?.role === 'super_admin') return 'super_admin';
    if (user?.role === 'owner') return 'admin';
    // Default to viewer if worker or not specified
    return 'viewer';
  }, [user]);

  const can = useMemo(() => {
    return (permission: string) => hasPermission(userRole, permission);
  }, [userRole]);

  const canAny = useMemo(() => {
    return (permissions: string[]) => hasAnyPermission(userRole, permissions);
  }, [userRole]);

  const canAll = useMemo(() => {
    return (permissions: string[]) => hasAllPermissions(userRole, permissions);
  }, [userRole]);

  return {
    userRole,
    isSuperAdmin: userRole === 'super_admin',
    isAdmin: userRole === 'admin',
    isManager: userRole === 'manager',
    isCashier: userRole === 'cashier',
    isViewer: userRole === 'viewer',
    can,
    canAny,
    canAll,
    permissions: ROLE_PERMISSIONS[userRole],
  };
}
