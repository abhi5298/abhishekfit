/* AbhiFit service worker: offline app shell + cached exercise images. */
const VERSION = 'abhifit-v3';
const SHELL = ['./', './index.html', './style.css', './data.js', './app.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const IMG_CACHE = 'abhifit-images-v1';
const IMG_HOSTS = ['cdn.jsdelivr.net', 'raw.githubusercontent.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== IMG_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Exercise images: cache-first, fetched with CORS so entries are not opaque.
  if (IMG_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(IMG_CACHE).then(async (cache) => {
        const hit = await cache.match(req.url);
        if (hit) return hit;
        try {
          const res = await fetch(req.url, { mode: 'cors' });
          if (res.ok) cache.put(req.url, res.clone());
          return res;
        } catch (err) {
          return new Response('', { status: 504 });
        }
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // App shell: stale-while-revalidate
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
