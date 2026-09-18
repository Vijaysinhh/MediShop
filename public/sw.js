// Service Worker for Dukan PWA
const CACHE_NAME = "dukan-v4";
const IS_DEVELOPMENT =
  new URL(self.location.href).searchParams.get("dev") === "1";
const urlsToCache = [
  "/",
  "/offline",
  "/manifest.json",
  "/icon.svg",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/apple-icon.png",
  "/favicon.ico",
];
const OFFLINE_FALLBACK_URL = "/offline";

// Install event
self.addEventListener("install", (event) => {
  console.log("[ServiceWorker] Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[ServiceWorker] Cache opened, adding URLs");
      return cache.addAll(urlsToCache);
    }),
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
  console.log("[ServiceWorker] Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[ServiceWorker] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

// Fetch event - only handle same-origin app assets/pages.
self.addEventListener("fetch", (event) => {
  if (IS_DEVELOPMENT) return;
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") {
    return;
  }

  const request = event.request;
  const isNavigationRequest = request.mode === "navigate";

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (isNavigationRequest) {
          const offlineRoute = await caches.match(OFFLINE_FALLBACK_URL);
          return offlineRoute || new Response("Offline", { status: 503 });
        }
        return new Response("Offline", { status: 503 });
      }),
  );
});

self.addEventListener("message", (event) => {
  const { type, payload } = event.data || {};
  if (type !== "DUKAN_SHOW_NOTIFICATION") return;

  const title = payload?.title || "Dukan";
  const options = {
    body: payload?.body || "You have a new shop alert.",
    icon: payload?.icon || "/icon-192x192.png",
    badge: payload?.icon || "/icon-192x192.png",
    tag: payload?.tag || "dukan-alert",
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: payload?.url || "/dashboard",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Dukan";
  const options = {
    body: payload.body || "You have a new shop alert.",
    icon: payload.icon || "/icon-192x192.png",
    badge: payload.icon || "/icon-192x192.png",
    tag: payload.tag || "dukan-alert",
    renotify: Boolean(payload.renotify),
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || "/dashboard",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(destination);
            return client.focus();
          }
        }
        return self.clients.openWindow(destination);
      }),
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag !== "dukan-sync") return;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "DUKAN_SYNC" }));
      }),
  );
});
