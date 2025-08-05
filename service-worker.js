// service-worker.js

const CACHE_NAME = 'budget-tracker-v3.5';
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
  self.skipWaiting(); // Force this SW to activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        ASSETS_TO_CACHE.map(path =>
          fetch(path)
            .then(response => {
              if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
              return cache.put(path, response);
            })
        )
      )
    ).catch(err => console.error('Caching failed:', err))
  );
});

self.addEventListener('activate', event => {
  clients.claim(); // Take control of uncontrolled clients immediately
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      )
    )
  );
});

self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/budget-tracker/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});