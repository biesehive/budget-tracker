// File: service-worker.js

"use strict";

/* Versioning & Cache Names */
const APP_VERSION = "1.0.5.8";
const STATIC_CACHE = `budget-tracker-static-v${APP_VERSION}`;
const RUNTIME_CACHE = `budget-tracker-runtime-v${APP_VERSION}`;

/* Precache Asset List */
const ORIGIN = self.location.origin;
const BASE = "/budget-tracker/";

const ASSETS_TO_CACHE = [
  `${BASE}`,
  `${BASE}index.html`,
  // JS
  `${BASE}js/app.js`,
  `${BASE}js/app.js?v=${APP_VERSION}`,
  `${BASE}js/vendor/chart.umd.min.js`,
  `${BASE}js/vendor/chart.umd.min.js?v=4.4.1`,
  // CSS
  `${BASE}css/styles.css`,
  `${BASE}css/styles.css?v=${APP_VERSION}`,
  // Manifest
  `${BASE}manifest.json`,
  // Images
  `${BASE}images/icon.png`,
  `${BASE}images/trash-can.png`,
  `${BASE}images/settings.png`,
  `${BASE}images/graph.png`,
];

/* Helpers */
const isSameOrigin = (url) => new URL(url).origin === ORIGIN;

function isAssetRequest(url) {
  const { pathname } = new URL(url);
  return (
    pathname.endsWith(".js") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".json") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".gif") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".ico")
  );
}

async function safePut(cache, request, response) {
  try {
    await cache.put(request, response.clone());
  } catch {
    // ignore
  }
}

async function cacheWarmup() {
  const cache = await caches.open(STATIC_CACHE);
  for (const path of ASSETS_TO_CACHE) {
    try {
      const res = await fetch(path, { cache: "no-cache", credentials: "same-origin" });
      if (res && res.ok) await safePut(cache, path, res);
    } catch {
      // ignore individual failures
    }
  }
}

async function cleanupOldCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys.map((key) => {
      if (![STATIC_CACHE, RUNTIME_CACHE].includes(key)) return caches.delete(key);
    })
  );
}

async function networkFirst(request, { fallbackURL = `${BASE}index.html` } = {}) {
  try {
    const netRes = await fetch(request);
    if (request.method === "GET" && isSameOrigin(request.url) && netRes && netRes.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await safePut(cache, request, netRes);
    }
    return netRes;
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shell = await cache.match(fallbackURL, { ignoreSearch: true });
      if (shell) return shell;
    }
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function cacheFirst(request, cacheName = STATIC_CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (request.method === "GET" && res && res.ok) await safePut(cache, request, res);
    return res;
  } catch {
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(request, cacheName = RUNTIME_CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  const fetchPromise = (async () => {
    try {
      const res = await fetch(request);
      if (res && res.ok) await safePut(cache, request, res);
      return res;
    } catch {
      return null;
    }
  })();
  return cached || (await fetchPromise) || new Response("Offline", { status: 503, statusText: "Offline" });
}

/* Install */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(cacheWarmup());
});

/* Activate */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await cleanupOldCaches();
      await self.clients.claim();
    })()
  );
});

/* Fetch */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Navigations
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, { fallbackURL: `${BASE}index.html` }));
    return;
  }

  // Same-origin assets — cache-first
  if (isSameOrigin(url.href) && isAssetRequest(url.href)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Default same-origin GET — SWR
  if (isSameOrigin(url.href)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  // Cross-origin GET (should be none in hardened config) — network-first fallback
  event.respondWith(networkFirst(request));
});
