"use client";

import Link from "next/link";

export default function OfflinePageClient() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-border/70 bg-background/80 p-8 shadow-sm backdrop-blur">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Offline mode
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">
          You are offline, but the app is still available.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your last cached inventory, sales, and shop data are available
          locally. Connect to the internet to sync pending changes.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Go to dashboard
          </Link>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
