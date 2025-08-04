// service-worker.js

const CACHE_NAME = 'budget-tracker-v1';
const ASSETS_TO_CACHE = [
  '/budget-tracker/',
  '/budget-tracker/index.html',
  '/budget-tracker/js/app.js',
  '/budget-tracker/css/styles.css',
  '/budget-tracker/manifest.json',
  '/budget-tracker/images/icon.png',
  '/budget-tracker/images/trash-can.png',
  '/budget-tracker/images/settings.png',
  '/budget-tracker/images/graph.png'
];


self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Bypass for CSP error sources like inline JS/CSS or invalid integrity hashes
  if (
    url.href.includes("inline") ||
    url.href.includes("csp") ||
    url.href.includes("sha")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request).catch(() => {
        // Fallback for 404s or CSP failure assets
        if (event.request.destination === 'image') {
          return caches.match('/budget-tracker/images/trash-can.png');
        }
        return new Response('Offline or CSP Blocked', {
          status: 503,
          statusText: 'Offline or Blocked by CSP'
        });
      });
    })
  );
});
