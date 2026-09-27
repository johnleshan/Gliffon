// Custom service worker: precache + web push notifications.
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Gliffon', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Gliffon';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    tag: data.tag || 'gliffon',
    renotify: true,
    data: { url: data.url || '/' },
    vibrate: [40, 30, 40],
    actions: [{ action: 'open', title: 'Open' }]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
