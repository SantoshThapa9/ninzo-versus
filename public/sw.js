/* Ninzo Versus service worker. Keep this file at / so it controls the whole app. */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  event.waitUntil((async () => {
    // A visible chat already polls and renders new messages, so an OS alert
    // would only duplicate that update. Other pages still receive the push.
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (
      (payload.kind === "match_chat" || payload.kind === "support_reply") &&
      clients.some((client) => client.visibilityState === "visible")
    ) {
      return;
    }
    const targetPathname = new URL(
      payload.url || "/",
      self.location.origin,
    ).pathname;
    if (
      clients.some(
        (client) => new URL(client.url).pathname === targetPathname,
      )
    ) {
      return;
    }
    await self.registration.showNotification(payload.title || "Ninzo Versus", {
      body: payload.body || "You have a new update.",
      icon: "/nv.jpg",
      badge: "/nv.ico",
      tag: payload.tag,
      data: { url: payload.url || "/" },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url === url);
      return existing ? existing.focus() : self.clients.openWindow(url);
    }),
  );
});

// Network-first avoids serving stale authenticated or match data while satisfying
// the fetch-event requirement for PWA-capable browsers.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});
