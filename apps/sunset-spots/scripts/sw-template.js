// Spotlight service worker (filled in by scripts/web-postbuild.mjs).
// Makes the web app open and work without signal: at a viewpoint there often isn't any.
//  - The app itself (code, fonts, icons, the spots of Israel): kept on install, served from the phone.
//    The version is a hash of the files' contents, so any change ships a new copy.
//  - The map's tile index (TileJSON): fresh when online, the last one when offline. It names the current
//    tile paths, so it must not go stale, and it is kept apart from the tiles so it is never trimmed away.
//  - Map tiles: kept as you see them (the newest 600), so the map around places you've looked at works offline.
//  - Terrain heights and the cloud forecast (Open-Meteo): fresh when online, the last answer when offline
//    (the newest 150).
//  - Everything else (Overpass outside Israel): straight to the network.

const VERSION = '__VERSION__';
const BASE = '__BASE__';
const APP_CACHE = `spotlight-app-${VERSION}`;
const META_CACHE = 'spotlight-meta';
const TILE_CACHE = 'spotlight-tiles';
const DATA_CACHE = 'spotlight-data';
const MAX_TILES = 600;
const MAX_DATA = 150;
const PRECACHE = '__PRECACHE__';
const TILE_HOST = 'tiles.openfreemap.org';

/**
 * Which cache rule a request follows. Pure, so it can be tested without a browser.
 * @param {URL} url
 * @param {string} base the app's path, e.g. "/orkalifa/"
 * @param {string} origin the app's origin
 * @returns {'app' | 'tilejson' | 'tile' | 'data' | null}
 */
function routeFor(url, base, origin) {
  if (url.origin === origin && url.pathname.startsWith(base)) return 'app';
  if (url.hostname === TILE_HOST) return /\/\d+\/\d+\/\d+\.\w+$/.test(url.pathname) ? 'tile' : 'tilejson';
  if (url.hostname === 'api.open-meteo.com') return 'data';
  return null;
}

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
      // Older versions kept the tile index among the tiles; drop that copy so it cannot be served stale.
      .then(() => caches.open(TILE_CACHE))
      .then((cache) =>
        cache.keys().then((keys) =>
          Promise.all(
            keys.filter((r) => routeFor(new URL(r.url), BASE, self.location.origin) === 'tilejson').map((r) => cache.delete(r)),
          ),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Keep only the newest `max` entries (a cache lists its keys oldest first). */
async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/**
 * Background work (refreshing and trimming a cache) is reported through `done`, which settles a promise the
 * fetch handler handed to event.waitUntil synchronously: some browsers (Safari) reject a later waitUntil call.
 * The handler also calls done() when the response settles, so the worker is never kept alive forever.
 */

/** Answer from the cache straight away, and refresh it in the background. */
async function staleWhileRevalidate(request, cacheName, max, done) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fresh = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put(request, response.clone());
      if (max) await trimCache(cacheName, max);
    }
    return response;
  });
  done(fresh.catch(() => undefined));
  return cached || fresh.catch(() => Response.error());
}

/** The network when it answers, otherwise the last answer we kept. */
async function networkFirst(request, cacheName, max, done) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      done(
        cache
          .put(request, copy)
          .then(() => (max ? trimCache(cacheName, max) : undefined))
          .catch(() => undefined),
      );
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

/** Answer with `respond(done)`, keeping the worker alive (via a waitUntil made right now) until `done` is called. */
function respondWithBackground(event, respond) {
  let done = () => {};
  const background = new Promise((resolve) => (done = resolve));
  event.waitUntil(background);
  // Every path ends here too (cache hit without refresh, network error, a non-ok answer); a second call is a no-op.
  event.respondWith(respond(done).finally(() => done()));
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

  switch (routeFor(url, BASE, self.location.origin)) {
    case 'app':
      event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
      return;
    case 'tilejson':
      respondWithBackground(event, (done) => networkFirst(request, META_CACHE, 0, done));
      return;
    case 'tile':
      respondWithBackground(event, (done) => staleWhileRevalidate(request, TILE_CACHE, MAX_TILES, done));
      return;
    case 'data':
      respondWithBackground(event, (done) => networkFirst(request, DATA_CACHE, MAX_DATA, done));
      return;
    default:
  }
});
