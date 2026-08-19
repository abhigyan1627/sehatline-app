const CACHE_PREFIX = "sehatline-doctor-";
const CACHE_NAME = `${CACHE_PREFIX}v18`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./config.js",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./app-icon.png",
  "./app-icon-192.png",
  "./app-icon-maskable.png",
  "/assets/motion/sehatline-motion.css",
  "/assets/motion/sehatline-motion.js",
  "/assets/pwa/install-prompt.css",
  "/assets/pwa/install-prompt.js",
  "/assets/footer/site-footer.css",
  "/assets/footer/site-footer.js",
  "/assets/care/care-tools.js",
  "/assets/care/care-background.css",
  "/assets/brand-motion/hospital-care-background-v1.png",
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
      .then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key))))
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
