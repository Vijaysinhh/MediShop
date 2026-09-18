"use client";

import { cn } from "@/lib/utils";

type PageSize = "default" | "wide" | "narrow";

const sizeClasses: Record<PageSize, string> = {
  default: "max-w-5xl",
  wide: "max-w-7xl",
  narrow: "max-w-4xl",
};

export function PageContainer({
  children,
  className,
  size = "default",
}: {
  children: React.ReactNode;
  className?: string;
  size?: PageSize;
}) {
  return (
    <div
      className={cn(
        "mx-auto space-y-6 pb-24 pt-3 sm:pb-10 sm:pt-4",
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  help,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  help?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-start sm:justify-between sm:p-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {help}
        </div>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
