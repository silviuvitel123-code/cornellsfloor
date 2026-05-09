const CACHE = "cornells-floor-v2";

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      fetch(self.registration.scope).then(r => c.put(self.registration.scope, r)).catch(() => {})
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r && r.status === 200) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
      return r;
    }).catch(() => caches.match(e.request))
  );
});

self.addEventListener("push", e => {
  let data = { title: "Cornell's Floor", body: "Comanda noua de preluat!" };
  try { data = e.data.json(); } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: "cf-push",
      requireInteraction: true,
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
      const c = cs.find(x => x.url.includes("cornells-floor"));
      if (c) return c.focus();
      return clients.openWindow("https://cornells-floor.netlify.app/");
    })
  );
});
