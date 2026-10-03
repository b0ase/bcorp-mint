/* Bitcoin Mint service worker.
 *
 * Strategy
 *  - App shell (/mint, /hash, /sign, manifest, icons): precached on install, served
 *    network-first with the cache as the offline fallback, so an installed PWA opens
 *    without a connection and still picks up new deploys when online.
 *  - Next.js build assets (/_next/static/*): cache-first. Their file names are
 *    content-hashed, so a cached copy is never stale.
 *  - Everything under /api/ and any cross-origin request: network only, never cached.
 *
 * Privacy: this worker only caches responses for this origin and sends nothing
 * anywhere. No analytics, no sync, no push.
 */

const VERSION = 'bitcoin-mint-v3';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const SHELL = [
  '/mint',
  '/hash',
  '/sign',
  '/manifest.json',
  '/bapp.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Add one at a time: one missing file must not fail the whole install.
      Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // cross-origin: leave to the network
  if (url.pathname.startsWith('/api/')) return; // API: never cached

  // Hashed build assets: cache-first.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((res) => {
              if (res.ok) cache.put(request, res.clone());
              return res;
            }),
        ),
      ),
    );
    return;
  }

  // Pages and public files: network-first, cache fallback.
  const isNavigation = request.mode === 'navigate' || request.destination === 'document';
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && (isNavigation || SHELL.includes(url.pathname))) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (isNavigation) {
          // Offline and this page was never cached: open the Mint shell instead.
          const shell = await caches.match('/mint');
          if (shell) return shell;
        }
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }),
  );
});
