const CACHE_PREFIX = "sehatline-receptionist-";
const CACHE = `${CACHE_PREFIX}v1`;
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "/patient/icons/icon.png",
  "/patient/icons/icon-192.png",
  "/patient/icons/icon-maskable.png",
  "/assets/motion/sehatline-motion.css",
  "/assets/motion/sehatline-motion.js",
  "/assets/pwa/install-prompt.css",
  "/assets/pwa/install-prompt.js",
  "/assets/care/care-background.css",
  "/assets/footer/site-footer.css",
  "/assets/footer/site-footer.js",
  "/assets/logos/sehatline-mark-frame.png",
  "/assets/brand-motion/hospital-care-background-v1.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request).catch(() => new Response(JSON.stringify({ error: { message: "Receptionist portal is offline" } }), { status: 503, headers: { "Content-Type": "application/json" } })));
    return;
  }
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(match => match || caches.match("./index.html"))));
});
