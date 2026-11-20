'use strict';

const BUILD = '8086bc18e9ad';
const PRECACHE = [
  "./",
  "./about.html",
  "./data/concepts.json",
  "./data/course.json",
  "./data/registry.json",
  "./assets/app.css?v=d49583bf3077",
  "./host/host.css?v=4fa2018c4d85",
  "./host/progress-store.js?v=7854702d7a5d",
  "./host/backup.js?v=912d7a4b9199",
  "./host/boot.js?v=41df814bff09",
  "./host/consent.js?v=24e8f944a9cf",
  "./host/welcome.js?v=57918881caa0",
  "./host/install-guide.js?v=f905c0abe912",
  "./host/pwa.js?v=4d48abeacefe",
  "./host/about-link.js?v=a2e9f2650913",
  "./host/install.js?v=a8af3b19c8ea",
  "./vendor/pwa-install/pwa-install.bundle.js?v=89518cf364a9",
  "./assets/labs.js?v=9b1c421bc4c8",
  "./assets/term-guide.js?v=437ef37535de",
  "./assets/easy-reasons.js?v=c67b66a8dee7",
  "./assets/basic-terms.js?v=c6e064d4da49",
  "./assets/basic-hints.js?v=085bcf7c5a63",
  "./assets/quiz-references.js?v=65f07dfeb45a",
  "./assets/dictionary-ox.js?v=4fb486a55191",
  "./assets/atomic-atlas.js?v=cfc1d066430e",
  "./assets/atlas-layout.js?v=d87d9da1745d",
  "./assets/concept-atlas.js?v=28278f2cd912",
  "./assets/term-figures.js?v=416a4d07945e",
  "./assets/app.js?v=72409716f7e4",
  "./assets/fonts/OFL.txt",
  "./assets/fonts/PretendardVariable.woff2",
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];
const CACHE_PREFIX = '2ws-';
const LEGACY_CACHE_PREFIX = 'site-';
const CACHE = CACHE_PREFIX + BUILD;
const NETWORK_TIMEOUT_MS = 4000;

const SCOPE_URL = new URL(self.registration.scope);
const SCOPE_PATH = SCOPE_URL.pathname;
const SW_PATH = new URL('./sw.js', SCOPE_URL).pathname;
const SHELL_URL = new URL('./', SCOPE_URL).href;
const PRECACHED = new Set(PRECACHE.map((path) => new URL(path, SCOPE_URL).href));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async (path) => {
      const url = new URL(path, SCOPE_URL).href;
      const response = await fetch(new Request(url, { cache: 'no-cache' }));
      if (!response.ok) throw new Error('precache failed: ' + path + ' (' + response.status + ')');
      await cache.put(url, response);
    }));
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name !== CACHE && (name.startsWith(CACHE_PREFIX) || name.startsWith(LEGACY_CACHE_PREFIX)))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_PATH)) return;
  if (url.pathname === SW_PATH) return;
  if (isShellNavigation(request, url)) event.respondWith(cacheFirst(event, SHELL_URL, request));
  else if (PRECACHED.has(keyOf(request))) event.respondWith(cacheFirst(event, keyOf(request), request));
  else event.respondWith(networkFirst(event, request));
});

function keyOf(request) {
  const url = new URL(request.url);
  url.hash = '';
  return url.href;
}

function isShellNavigation(request, url) {
  return request.mode === 'navigate' &&
    (url.pathname === SCOPE_PATH || url.pathname === SCOPE_PATH + 'index.html');
}

async function cacheFirst(event, key, request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(key);
  if (hit) return hit;
  const response = await fetch(request);
  if (response && response.ok) event.waitUntil(cache.put(key, response.clone()).catch(() => {}));
  return response;
}

async function lookup(cache, request) {
  const exact = await cache.match(keyOf(request));
  if (exact) return exact;
  if (request.mode !== 'navigate') return undefined;
  return cache.match(keyOf(request), { ignoreSearch: true });
}

async function networkFirst(event, request) {
  const cache = await caches.open(CACHE);
  const network = fetch(request, { cache: 'no-cache' }).then((response) => {
    if (response && response.ok) {
      event.waitUntil(cache.put(keyOf(request), response.clone()).catch(() => {}));
    }
    return response;
  });
  network.catch(() => {});
  event.waitUntil(network.catch(() => {}));

  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS); });
  const first = await Promise.race([network.catch(() => null), timeout]);
  clearTimeout(timer);
  if (first && first.ok) return first;

  const cached = await lookup(cache, request);
  if (cached) return cached;
  if (first) return first;
  return network;
}
