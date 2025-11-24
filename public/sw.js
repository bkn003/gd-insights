const CACHE_NAME = 'dgi-v1';
const urlsToCache = [
  '/',
  '/src/main.tsx',
  '/src/index.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Push notification support
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'New GD Entry';
  const options = {
    body: data.body || 'A new goods damaged entry has been added',
    icon: '/lovable-uploads/d9731f6e-4026-4be4-aaf0-1a401d8ba7be.png',
    badge: '/lovable-uploads/d9731f6e-4026-4be4-aaf0-1a401d8ba7be.png',
    data: data.url || '/',
    requireInteraction: true,
    tag: 'gd-notification',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});

// Listen for messages from the main app to send notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NEW_GD_ENTRY') {
    const { title, body, url } = event.data;
    self.registration.showNotification(title || 'New GD Entry', {
      body: body || 'A new goods damaged entry has been added',
      icon: '/lovable-uploads/d9731f6e-4026-4be4-aaf0-1a401d8ba7be.png',
      badge: '/lovable-uploads/d9731f6e-4026-4be4-aaf0-1a401d8ba7be.png',
      data: url || '/',
      requireInteraction: true,
      tag: 'gd-notification',
      renotify: true
    });
  }
});
