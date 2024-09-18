// Define a cache name, use versioning for cache management
const CACHE_NAME = 'budget-tracker-cache-v2';

// List of files to cache
const urlsToCache = [
  '/budget-tracker/',
  '/budget-tracker/index.html',
  '/budget-tracker/css/styles.css',
  '/budget-tracker/js/app.js',
  '/budget-tracker/manifest.json',
  '/budget-tracker/images/icon-192x192.png',
  '/budget-tracker/images/settings.png', // Include any additional required assets
  '/budget-tracker/images/graph.png',
  '/budget-tracker/images/trash-can.png',
];

// Install the service worker and cache all the specified assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Intercept fetch requests and serve cached assets if available
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return the cached response if found, otherwise fetch from the network
        return response || fetch(event.request).catch(() => {
          // If the fetch fails (e.g., offline), serve a fallback page
          if (event.request.mode === 'navigate') {
            return caches.match('/budget-tracker/index.html');
          }
        });
      })
  );
});

// Activate the service worker and remove old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
