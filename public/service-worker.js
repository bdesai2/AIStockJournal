/* StonkJournal Service Worker */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `stonk-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `stonk-dynamic-${CACHE_VERSION}`;
const API_CACHE = `stonk-api-${CACHE_VERSION}`;

// Core shell assets to pre-cache. Note: Vite will fingerprint JS/CSS, so we
// rely mostly on runtime caching for those, but keeping index + manifest
// ensures basic offline shell.
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-512-maskable.svg',
];

self.addEventListener('install', (event) => {
  // Activate updated worker immediately
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).catch((err) => {
      console.error('[SW] Failed to pre-cache static assets', err);
    })
  );
});

self.addEventListener('activate', (event) => {
  // Clean up old versioned caches
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) =>
              key.startsWith('stonk-static-') ||
              key.startsWith('stonk-dynamic-') ||
              key.startsWith('stonk-api-')
            )
            .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== API_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ignore non-HTTP(S) schemes
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Navigation requests: try network first, fallback to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, STATIC_CACHE, true));
    return;
  }

  // API requests (Supabase / API routes) → network-first
  const isApiRequest =
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/');

  if (isApiRequest) {
    event.respondWith(networkFirst(request, API_CACHE, false));
    return;
  }

  // Static assets (JS, CSS, images, fonts, icons) → cache-first
  const isStaticAsset =
    url.origin === self.location.origin &&
    (request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'font' ||
      request.destination === 'image' ||
      url.pathname.startsWith('/icons/') ||
      url.pathname.startsWith('/assets/'));

  if (isStaticAsset) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Fallback: let the request pass through
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // If network fails and nothing in cache, propagate error
    console.error('[SW] cacheFirst fetch failed', err);
    throw err;
  }
}

async function networkFirst(request, cacheName, isNavigation) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] networkFirst falling back to cache', err);
    const cached = await cache.match(request);
    if (cached) return cached;

    // Navigation-specific fallback: try cached shell, else offline response
    if (isNavigation) {
      const shell = await cache.match('/');
      if (shell) return shell;
      return new Response('You are offline. Please check your connection.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    throw err;
  }
}
