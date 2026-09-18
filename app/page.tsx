"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUserLandingPath, useAuth } from "@/providers/auth-provider";
import { useLanguage } from "@/providers/language-provider";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    const landingPath = getUserLandingPath(user);
    if (landingPath && landingPath !== "/") {
      router.replace(landingPath);
    }
  }, [isAuthenticated, isLoading, user, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-card/80 shadow-sm">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        {t("loading_dukan")}
      </p>
    </div>
  );
}
