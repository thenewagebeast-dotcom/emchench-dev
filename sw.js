// E=MC-HENCH Service Worker
// Cache version - increment this when you deploy a new version of index.html
const CACHE_VERSION = 'hench-v1';

// Files to cache for offline use
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json'
];

// These domains should NEVER be cached - always go to network
// Google Sheets API and Anthropic API must always use live data
const NEVER_CACHE = [
  'script.google.com',
  'api.anthropic.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com'
];

// ============================================================
// INSTALL - cache the app shell immediately
// ============================================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ============================================================
// ACTIVATE - clean up old cache versions
// ============================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH - serve from cache where safe, network for API calls
// ============================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept API calls - always go straight to network
  const isApiCall = NEVER_CACHE.some(domain => url.hostname.includes(domain));
  if (isApiCall) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Never intercept non-GET requests
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // For the app shell (index.html) use a network-first strategy
  // This means users always get the latest version when online
  // but fall back to the cached version when offline
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update the cache with the fresh version
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Offline - serve from cache
          return caches.match('./index.html');
        })
    );
    return;
  }

  // For everything else use cache-first
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});

// ============================================================
// MESSAGE - handle version update notifications from the app
// ============================================================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
