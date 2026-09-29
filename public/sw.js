/* Ninzo Versus service worker. Keep this file at / so it controls the whole app. */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-first avoids serving stale authenticated or match data while satisfying
// the fetch-event requirement for PWA-capable browsers.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});
