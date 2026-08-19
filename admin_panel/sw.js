const CACHE_PREFIX = "sehatline-admin-";
const CACHE = `${CACHE_PREFIX}v26`;
const SHELL = [
  "./",
  "./index.html",
  "./login.html",
  "./change-password.html",
  "./styles.css",
  "./app.js",
  "./auth.js",
  "./manifest.json",
  "./app-icon.png",
  "/assets/motion/sehatline-motion.css",
  "/assets/motion/sehatline-motion.js",
  "/assets/footer/site-footer.css",
  "/assets/footer/site-footer.js",
  "/assets/logos/sehatline-animated.mp4",
  "/assets/logos/sehatline-mark-frame.png",
  "/assets/logos/sehatline-care-logo.jpeg",
  "/assets/logos/sehatline-care-mark-animated.svg?v=2",
  "/assets/logos/sehatline-care-lockup-animated.svg?v=2"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
  );
});
