/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

precacheAndRoute(self.__WB_MANIFEST);

cleanupOutdatedCaches();
self.skipWaiting();
self.clients.claim();

registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'navigation-cache',
      networkTimeoutSeconds: 3,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 1,
          maxAgeSeconds: 60 * 60,
        }),
      ],
    })
  )
);

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
