'use client';

import { useEffect } from 'react';

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );
      return;
    }

    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(
      (registration) => {
        console.log('[MediShop] Service Worker registered:', registration);
      },
      (error) => {
        console.error('[MediShop] Service Worker registration failed:', error);
      }
    );
  }, []);

  return <>{children}</>;
}
