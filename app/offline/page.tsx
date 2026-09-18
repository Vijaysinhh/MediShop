import type { Metadata } from "next";
import OfflinePageClient from "./offline-page-client";

export const metadata: Metadata = {
  title: "Offline",
  description: "The app is temporarily offline. Cached content is available.",
};

export default function OfflinePage() {
  return <OfflinePageClient />;
}
