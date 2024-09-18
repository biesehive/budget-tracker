// Define a cache name
const CACHE_NAME = 'budget-tracker-cache-v1';

// List of files to cache
const urlsToCache = [
  '/',
  '/budget-tracker/', // Ensure the base path is correct for GitHub Pages
  '/budget-tracker/index.html',
  '/budget-tracker/styles.css',
  '/budget-tracker/script.js', // Your main JS file
  '/budget-tracker/manifest.json',
  '/budget-tracker/images/icon-192x192.png',
];

// Install the service worker and cache all the specified assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Intercept fetch requests and serve cached assets if available
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return the cached response if found, otherwise fetch from network
        return response || fetch(event.request);
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
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
