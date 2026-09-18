"use client";

function urlBase64ToUint8Array(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    throw new Error("This browser does not support notifications.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  return permission;
}

export async function showBackgroundNotification(payload: {
  title: string;
  body: string;
  tag: string;
  url?: string;
  icon?: string;
}) {
  if (typeof window === "undefined" || typeof Notification === "undefined")
    return;
  if (Notification.permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  const options = {
    body: payload.body,
    icon: payload.icon || "/icon-192x192.png",
    badge: payload.icon || "/icon-192x192.png",
    tag: payload.tag,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || "/dashboard",
    },
  };

  if (document.visibilityState === "visible") {
    new Notification(payload.title, options);
    return;
  }

  await registration.showNotification(payload.title, options);
}

export async function subscribeToPushNotifications(options: {
  shopId: number;
  userId?: number | null;
}) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error("Push notifications are not configured yet.");
  }
  if (!isPushSupported()) {
    throw new Error("This browser does not support push notifications.");
  }

  await requestNotificationPermission();

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shopId: options.shopId,
      userId: options.userId,
      subscription: subscription.toJSON(),
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.error || "Unable to save this device for notifications.",
    );
  }

  return subscription;
}
