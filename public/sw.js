// App-shell cache. API calls are never cached so financial data is always live.
const V = 'club-v3';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(() => caches.match('/'))); return; }
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(V).then((c) => c.put(r, copy)); } return res;
  })));
});
