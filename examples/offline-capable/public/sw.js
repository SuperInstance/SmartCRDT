/**
 * Service Worker for Offline-Capable App
 *
 * Provides offline caching and background sync capabilities.
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `offline-app-${CACHE_VERSION}`;

// Resources to cache immediately
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/bundle.js',
  '/styles.css'
];

// Dynamic caching strategies
const CACHE_STRATEGIES = {
  cacheFirst: [/\.(?:png|jpg|jpeg|svg|gif|webp)$/, /\.(?:woff|woff2|ttf|otf)$/],
  networkFirst: [/\/api\/.*/],
  cacheOnly: [/\/offline\.(?:html|js|css)$/],
  networkOnly: [/\/api\/real-time/]
};

// Install event - precache assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching assets');
      return cache.addAll(PRECACHE_URLS);
    })
  );

  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  const strategy = getStrategy(url.pathname);

  switch (strategy) {
    case 'cacheFirst':
      event.respondWith(cacheFirstStrategy(request));
      break;
    case 'networkFirst':
      event.respondWith(networkFirstStrategy(request));
      break;
    case 'cacheOnly':
      event.respondWith(cacheOnlyStrategy(request));
      break;
    case 'networkOnly':
      event.respondWith(networkOnlyStrategy(request));
      break;
    default:
      event.respondWith(staleWhileRevalidateStrategy(request));
  }
});

// Determine caching strategy for URL
function getStrategy(pathname) {
  for (const [strategy, patterns] of Object.entries(CACHE_STRATEGIES)) {
    for (const pattern of patterns) {
      if (pattern.test(pathname)) {
        return strategy;
      }
    }
  }
  return 'staleWhileRevalidate';
}

// Cache first strategy
async function cacheFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    await cache.put(request, response.clone());
    return response;
  } catch (error) {
    console.error('[SW] Cache first failed:', error);
    throw error;
  }
}

// Network first strategy
async function networkFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    await cache.put(request, response.clone());
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache...');
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Cache only strategy
async function cacheOnlyStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  throw new Error('[SW] No cache found');
}

// Network only strategy
async function networkOnlyStrategy(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.error('[SW] Network only failed:', error);
    throw error;
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    cache.put(request, response.clone());
    return response;
  });

  return cached || fetchPromise;
}

// Background sync
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

// Sync data to server
async function syncData() {
  try {
    // Sync implementation would go here
    console.log('[SW] Syncing data...');
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon.png'
    });
  }
});
