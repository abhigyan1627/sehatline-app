const CACHE_NAME = "sehatline-doctor-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./config.js",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./app-icon.png",
  "./app-icon-maskable.png",
  "/assets/logos/sehatline-animated.mp4",
  "/assets/logos/sehatline-logo-poster.png",
  "/assets/logos/sehatline-mark-frame.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
  );
});
