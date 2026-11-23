// Spotlight service worker (filled in by scripts/web-postbuild.mjs).
// Makes the web app open and work without signal: at a viewpoint there often isn't any.
//  - The app itself (code, fonts, the spots of Israel): kept on install, served from the phone.
//  - Map tiles: kept as you see them, so the map around places you've looked at works offline.
//  - Terrain heights (Open-Meteo): fresh when online, the last answer when offline.
//  - Everything else (Overpass outside Israel): straight to the network.

const VERSION = '__VERSION__';
const BASE = '__BASE__';
const APP_CACHE = `spotlight-app-${VERSION}`;
const TILE_CACHE = 'spotlight-tiles';
const DATA_CACHE = 'spotlight-data';
const MAX_TILES = 600;
const PRECACHE = '__PRECACHE__';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('spotlight-app-') && k !== APP_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/** Answer from the cache straight away, and refresh it in the background. */
async function staleWhileRevalidate(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
        if (max) trimCache(cacheName, max);
      }
      return response;
    })
    .catch(() => cached);
  return cached || fresh;
}

/** The network when it answers, otherwise the last answer we kept. */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Opening the app (any address, including shared ?spot= links): the newest page when online.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(BASE, { cacheName: APP_CACHE }).then((r) => r || Response.error())),
    );
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith(BASE)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
    return;
  }

  if (url.hostname === 'tiles.openfreemap.org') {
    event.respondWith(staleWhileRevalidate(request, TILE_CACHE, MAX_TILES));
    return;
  }

  if (url.hostname === 'api.open-meteo.com') {
    event.respondWith(networkFirst(request, DATA_CACHE));
  }
});
