const CACHE_NAME = "cocktails-v19";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, "./index.html"));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

function networkFirst(request, fallbackUrl) {
  return fetch(request)
    .then((response) => {
      if (isCacheable(response)) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(fallbackUrl, copy));
      }
      return response;
    })
    .catch(() => caches.match(fallbackUrl).then((cached) => cached || notFoundResponse()));
}

function cacheFirst(request) {
  return caches.match(request, { ignoreSearch: true })
    .then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => notFoundResponse());
    });
}

function isCacheable(response) {
  return response && response.status === 200;
}

function notFoundResponse() {
  return new Response("", {
    status: 404,
    statusText: "Not Found"
  });
}
