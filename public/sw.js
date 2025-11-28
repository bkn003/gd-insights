const CACHE_NAME = 'dgi-v2';
const STATIC_CACHE = 'static-v2';
const DATA_CACHE = 'data-v2';

const urlsToCache = [
  '/',
  '/src/main.tsx',
  '/src/index.css'
];

// Install service worker and cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate service worker and clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DATA_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch with network-first strategy for API calls, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip chrome-extension and non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Network-first for API calls (Supabase)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET requests
          if (request.method === 'GET' && response.ok) {
            const responseClone = response.clone();
            caches.open(DATA_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached data if offline
          return caches.match(request).then((response) => {
            return response || new Response(JSON.stringify({ 
              error: 'Offline', 
              message: 'You are offline. Data saved locally.' 
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(request).then((response) => {
          // Cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
      .catch(() => {
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/');
        }
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
