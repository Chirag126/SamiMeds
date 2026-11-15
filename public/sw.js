/* Offline-friendly shell: static files cache-first, API always from the network. */
const CACHE = 'samimeds-v2';
const SHELL = [
  '/', '/elder', '/family',
  '/css/base.css', '/css/login.css', '/css/elder.css', '/css/family.css',
  '/js/common.js', '/js/i18n.js', '/js/i18n-hi.js', '/js/login.js', '/js/elder.js', '/js/family.js',
  '/icons/icon.svg', '/icons/icon-192.png', '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  // Network first for pages (fresh data), falling back to cache when offline.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request)),
  );
});

/* Phone notifications: show the reminder, and open the app when it is tapped. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch { /* not JSON */ }
  event.waitUntil(self.registration.showNotification(data.title || 'SamiMeds', {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag,
    renotify: Boolean(data.tag),
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => new URL(c.url).origin === self.location.origin);
    return open ? open.focus().then((c) => c.navigate(url)).catch(() => self.clients.openWindow(url)) : self.clients.openWindow(url);
  }));
});
