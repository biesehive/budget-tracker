// service-worker.js

const CACHE_NAME = 'budget-tracker-v1.0.4.9';
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


// self.addEventListener('install', event => {
//   self.skipWaiting(); // Force this SW to activate immediately
//   event.waitUntil(
//     caches.open(CACHE_NAME).then(cache =>
//       Promise.all(
//         ASSETS_TO_CACHE.map(path =>
//           fetch(path)
//             .then(response => {
//               if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
//               return cache.put(path, response);
//             })
//         )
//       )
//     ).catch(err => console.error('Caching failed:', err))
//   );
// });

// INSTALL — Cache assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const path of ASSETS_TO_CACHE) {
        try {
          const response = await fetch(path, { cache: 'no-cache' });
          if (response.ok) {
            await cache.put(path, response.clone());
          } else {
            console.warn(`[SW] Skipped caching ${path}: ${response.status}`);
          }
        } catch (err) {
          console.error(`[SW] Failed to fetch ${path}:`, err);
        }
      }
    })
  );
});

// self.addEventListener('activate', event => {
//   clients.claim(); // Take control of uncontrolled clients immediately
//   event.waitUntil(
//     caches.keys().then(cacheNames =>
//       Promise.all(
//         cacheNames.map(cache => {
//           if (cache !== CACHE_NAME) {
//             return caches.delete(cache);
//           }
//         })
//       )
//     )
//   );
// });


// self.addEventListener('fetch', event => {
//   if (event.request.mode === 'navigate') {
//     event.respondWith(
//       fetch(event.request).catch(() => caches.match('/budget-tracker/index.html'))
//     );
//     return;
//   }

//   event.respondWith(
//     caches.match(event.request).then(cached => cached || fetch(event.request))
//   );
// });

// ACTIVATE — Delete old caches
self.addEventListener('activate', event => {
  clients.claim();
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      )
    )
  );
});

// FETCH — Cache-first, fallback to network
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/budget-tracker/index.html')
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).catch(() => {
        // You can handle offline fallback for images or others here
        return new Response('Offline', { status: 503 });
      });
    })
  );
});