const CACHE_PREFIX = "sehatline-patient-";
const CACHE = `${CACHE_PREFIX}v37`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./config.js",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon.png",
  "./icons/icon-192.png",
  "./icons/icon-maskable.png",
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
  "/assets/logos/sehatline-mark-frame.png",
  "/assets/logos/sehatline-care-logo.jpeg",
  "/assets/logos/sehatline-care-mark-animated.svg?v=3",
  "/assets/logos/sehatline-care-lockup-animated.svg?v=4",
  "/assets/brand-motion/auth-care-tree-doctor.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request).catch(() => new Response(JSON.stringify({ offline: true }), {
      headers: { "Content-Type": "application/json" }
    })));
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
}
return response;
  })
      .catch(() => caches.match(event.request).then((match) => match || caches.match("./index.html")))
  );
});
