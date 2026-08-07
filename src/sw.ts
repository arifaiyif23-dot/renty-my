/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

precacheAndRoute(self.__WB_MANIFEST);

cleanupOutdatedCaches();
self.skipWaiting();

// Enable navigation preload for faster navigations
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
    })()
  );
});

// Navigation route with offline fallback
const navigationStrategy = new NetworkFirst({
  cacheName: 'navigation-cache',
  networkTimeoutSeconds: 3,
  plugins: [
    new ExpirationPlugin({
      maxEntries: 20,
      maxAgeSeconds: 60 * 60 * 24,
    }),
  ],
});

// Handle incoming web push notifications.
self.addEventListener('push', (event) => {
  let payload: { title?: string; body?: string; icon?: string; badge?: string; tag?: string; data?: Record<string, unknown> } = {};

  try {
    const raw = event.data?.json();
    if (raw?.notification) {
      // FCM/web-push format: { notification: { title, body }, data }
      payload = {
        title: raw.notification.title,
        body: raw.notification.body,
        icon: raw.notification.icon,
        badge: raw.notification.badge,
        tag: raw.notification.tag,
        data: raw.data,
        link: raw.data?.link,
      };
    } else if (raw?.title) {
      // Direct format: { title, body, link, data }
      payload = { title: raw.title, body: raw.body, link: raw.link, data: raw.data, tag: raw.tag };
    } else if (event.data?.text()) {
      payload = { title: 'RENTY', body: event.data.text() };
    }
  } catch {
    // Non-JSON body
  }

  const title = payload.title || 'RENTY';
  const options: NotificationOptions = {
    body: payload.body || '',
    icon: payload.icon || '/logo-light.png',
    badge: payload.badge || '/logo-light.png',
    tag: payload.tag || 'renty-notification',
    data: { link: payload.link || '/', ts: Date.now(), ...(payload.data || {}) },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Open the app (or the deep link) when the user taps a notification.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.link || '/';
  const urlToOpen = new URL(target, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        const clientUrl = new URL((client as WindowClient).url);
        if (clientUrl.origin === self.location.origin) {
          await (client as WindowClient).navigate(urlToOpen);
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(urlToOpen);
    })()
  );
});

self.addEventListener('notificationclose', (event) => {
  event.notification.close();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await navigationStrategy.handle({ event, request: event.request });
        } catch {
          const cache = await caches.open('navigation-cache');
          const cachedResponse = await cache.match('/');
          return cachedResponse || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } });
        }
      })()
    );
    if (event.preloadResponse) {
      event.waitUntil(event.preloadResponse.then(() => {}, () => {}));
    }
  }
});

registerRoute(
  /^https:\/\/.*\.supabase\.co\/.*/i,
  new NetworkFirst({
    cacheName: 'supabase-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60,
      }),
    ],
  }),
  'GET'
);

registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  })
);

registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
);
