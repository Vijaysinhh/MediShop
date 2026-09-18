import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "@/providers/auth-provider";
import { LanguageProvider } from "@/providers/language-provider";
import { ServiceWorkerProvider } from "@/providers/service-worker-provider";
import { OfflineSyncProvider } from "@/providers/offline-sync-provider";
import { ToastProvider } from "@/providers/toast-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { Navigation } from "@/components/navigation";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { SubscriptionCheck } from "@/components/SubscriptionCheck";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediShop - Pharmacy Manager",
  description: "Manage pharmacy stock, sales, customers, and your team",
  generator: "v0.app",
  manifest: "/manifest.json",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="font-sans antialiased bg-background overflow-x-hidden m-0 p-0" suppressHydrationWarning>
        <ErrorBoundary>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
          >
            <AuthProvider>
              <OfflineSyncProvider>
                <ServiceWorkerProvider>
                  <LanguageProvider>
                    <SubscriptionCheck>
                      <Navigation />
                      <main className="pt-20 sm:pt-24 pb-24 sm:pb-10 px-3 sm:px-4 sm:ml-56 md:px-6 overflow-y-auto overflow-x-hidden min-h-screen transition-all duration-300" key="main-content">
                        {children}
                      </main>
                      <Toaster />
                      <ToastProvider />
                    </SubscriptionCheck>
                  </LanguageProvider>
                </ServiceWorkerProvider>
              </OfflineSyncProvider>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
