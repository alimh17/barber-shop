/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ revision: string | null; url: string }>;
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();
self.skipWaiting();

self.addEventListener('push', (event: PushEvent) => {
  const fallback = {
    title: 'قیچی',
    body: 'یک اعلان جدید دارید.',
    url: '/dashboard',
    tag: 'barbershop-notification',
  };
  let payload = fallback;
  try {
    payload = {
      ...fallback,
      ...(event.data?.json() as Partial<typeof fallback>),
    };
  } catch {
    payload = { ...fallback, body: event.data?.text() || fallback.body };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: payload.tag,
      data: { url: payload.url },
      dir: 'rtl',
      lang: 'fa',
    }),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data as { url?: string } | undefined)?.url ??
      '/dashboard',
    self.location.origin,
  ).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clients) => {
        const existing = clients.find((client) =>
          client.url.startsWith(self.location.origin),
        );
        if (existing && 'focus' in existing) {
          await existing.navigate(target);
          return existing.focus();
        }
        return self.clients.openWindow(target);
      }),
  );
});
