"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import {
  useAuth,
  UserPermissions,
  DEFAULT_WORKER_PERMISSIONS,
  normalizeUserPermissions,
} from "@/providers/auth-provider";
import type { Database } from "@/lib/db-supabase-types";

type StaffUser = Database["public"]["Tables"]["users"]["Row"] & {
  permissions?: UserPermissions;
};

export function useStaff() {
  const { user, currentShopId } = useAuth();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const fetchStaff = useCallback(async () => {
    if (!currentShopId || user?.role !== "owner") return;

    setIsLoading(true);
    try {
      const { data: users, error } = await (supabase as any)
        .from("users")
        .select("*")
        .eq("shop_id", currentShopId)
        .eq("role", "worker")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (users) {
        // Fetch permissions for each user
        const staffWithPermissions = await Promise.all(
          users.map(async (staffUser: StaffUser) => {
            try {
              const { data: roleRows, error: roleError } = await (
                supabase as any
              )
                .from("user_roles")
                .select("permissions, updated_at")
                .eq("user_id", staffUser.id)
                .eq("shop_id", currentShopId)
                .order("updated_at", { ascending: false });

              if (roleError) {
                console.warn("Error fetching staff permissions:", roleError);
              }

              const latestRole =
                Array.isArray(roleRows) && roleRows.length > 0
                  ? roleRows[0]
                  : null;

              return {
                ...staffUser,
                permissions: normalizeUserPermissions(
                  "worker",
                  latestRole?.permissions as Partial<UserPermissions> | null,
                ),
              };
            } catch {
              return {
                ...staffUser,
                permissions: normalizeUserPermissions(
                  "worker",
                  DEFAULT_WORKER_PERMISSIONS,
                ),
              };
            }
          }),
        );

        setStaff(staffWithPermissions);
      }
    } catch (error) {
      console.error("Error fetching staff:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentShopId, user?.role, supabase]);

  const addStaff = useCallback(
    async (username: string, password: string) => {
      if (!currentShopId || user?.role !== "owner") return;

      try {
        const { data: newUser, error: userError } = await (supabase as any)
          .from("users")
          .insert({
            shop_id: currentShopId,
            username,
            password,
            role: "worker",
          })
          .select("*")
          .single();

        if (userError) throw userError;

        if (newUser) {
          const defaultPermissions = normalizeUserPermissions(
            "worker",
            DEFAULT_WORKER_PERMISSIONS,
          );

          const { error: roleError } = await (supabase as any)
            .from("user_roles")
            .insert({
              user_id: newUser.id,
              shop_id: currentShopId,
              role: "worker",
              permissions: defaultPermissions,
            });

          if (roleError) throw roleError;

          setStaff((prev) => [
            {
              ...(newUser as StaffUser),
              permissions: defaultPermissions,
            },
            ...prev,
          ]);

          await fetchStaff();
          return true;
        }
      } catch (error) {
        console.error("Error adding staff:", error);
        return false;
      }
      return false;
    },
    [currentShopId, user?.role, supabase, fetchStaff],
  );

  const updateStaff = useCallback(
    async (userId: number, username: string, password: string) => {
      if (!currentShopId || user?.role !== "owner") return;

      try {
        const updateData: any = {};
        if (username) updateData.username = username;
        if (password) updateData.password = password;

        const { error } = await (supabase as any)
          .from("users")
          .update(updateData)
          .eq("id", userId);

        if (error) throw error;

        setStaff((prev) =>
          prev.map((member) =>
            member.id === userId
              ? {
                  ...member,
                  ...(username ? { username } : {}),
                }
              : member,
          ),
        );

        await fetchStaff();
        return true;
      } catch (error) {
        console.error("Error updating staff:", error);
        return false;
      }
      return false;
    },
    [currentShopId, user?.role, supabase, fetchStaff],
  );

  const updateStaffPermissions = useCallback(
    async (userId: number, permissions: UserPermissions) => {
      if (!currentShopId || user?.role !== "owner") return;

      let previousPermissions: UserPermissions | undefined;

      try {
        previousPermissions = staff.find(
          (member) => member.id === userId,
        )?.permissions;

        const nextPermissions = normalizeUserPermissions("worker", permissions);
        const now = new Date().toISOString();

        setStaff((prev) =>
          prev.map((member) =>
            member.id === userId
              ? { ...member, permissions: nextPermissions }
              : member,
          ),
        );

        const { data: existingRoles, error: lookupError } = await (
          supabase as any
        )
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .eq("shop_id", currentShopId)
          .order("updated_at", { ascending: false });

        if (lookupError) throw lookupError;

        const latestRole =
          Array.isArray(existingRoles) && existingRoles.length > 0
            ? existingRoles[0]
            : null;

        if (latestRole?.id) {
          const { error } = await (supabase as any)
            .from("user_roles")
            .update({
              role: "worker",
              permissions: nextPermissions,
              updated_at: now,
            })
            .eq("id", latestRole.id);

          if (error) throw error;

          const duplicateIds = (existingRoles || [])
            .map((row: any) => row.id)
            .filter((id: number | null) => id && id !== latestRole.id);

          if (duplicateIds.length > 0) {
            const { error: cleanupError } = await (supabase as any)
              .from("user_roles")
              .delete()
              .in("id", duplicateIds);

            if (cleanupError) throw cleanupError;
          }
        } else {
          const { error } = await (supabase as any).from("user_roles").insert({
            user_id: userId,
            shop_id: currentShopId,
            role: "worker",
            permissions: nextPermissions,
            updated_at: now,
          });

          if (error) throw error;
        }

        await fetchStaff();
        return true;
      } catch (error) {
        console.error("Error updating staff permissions:", error);
        setStaff((prev) =>
          prev.map((member) =>
            member.id === userId
              ? { ...member, permissions: previousPermissions }
              : member,
          ),
        );
        return false;
      }
      return false;
    },
    [currentShopId, user?.role, supabase, fetchStaff, staff],
  );

  const removeStaff = useCallback(
    async (userId: number) => {
      if (!currentShopId || user?.role !== "owner") return;

      try {
        setStaff((prev) => prev.filter((member) => member.id !== userId));

        // Delete user roles first
        const { error: roleError } = await (supabase as any)
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("shop_id", currentShopId);

        if (roleError) throw roleError;

        // Delete user
        const { error: userError } = await (supabase as any)
          .from("users")
          .delete()
          .eq("id", userId);

        if (userError) throw userError;

        await fetchStaff();
        return true;
      } catch (error) {
        console.error("Error removing staff:", error);
        setStaff((prev) =>
          prev.some((member) => member.id === userId)
            ? prev
            : [
                ...prev,
                { id: userId, username: "", role: "worker" } as StaffUser,
              ],
        );
        return false;
      }
      return false;
    },
    [currentShopId, user?.role, supabase, fetchStaff],
  );

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  return {
    staff,
    isLoading,
    addStaff,
    updateStaff,
    updateStaffPermissions,
    removeStaff,
    refreshStaff: fetchStaff,
  };
}
