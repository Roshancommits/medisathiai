// MediSathi AI Service Worker for offline support and background dose reminders
const CACHE_NAME = 'medisathi-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for background reminder trigger messages from client or push
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_DOSE_NOTIFICATION') {
    const { title, body, doseId, tag } = event.data;
    self.registration.showNotification(title || 'Time for Your Medicine!', {
      body: body || 'Please take your scheduled medicine now.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200, 100, 400],
      tag: tag || `dose-${doseId}`,
      renotify: true,
      data: { doseId }
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
