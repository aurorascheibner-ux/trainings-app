// Service Worker: hält die App-Dateien bereit, damit sie installierbar ist
// und auch ohne Netz startet. Bei jeder Änderung an der App VERSION erhöhen.
const VERSION = "v34";
const FILES = [
  "./",
  "index.html",
  "styles.css",
  "designs.css",
  "app.js",
  "plan.js",
  "diktat.js",
  "grundnahrung.js",
  "supplemente.js",
  "data.js",
  "charts.js",
  "ex-icons.js",
  "designs-neu.css",
  "zyklus.js",
  "food.js",
  "config.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  // "reload": am Browser-Zwischenspeicher vorbei, sonst landen alte Dateien in der neuen Version
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Erst aus dem Netz laden (immer die neueste Version), sonst aus dem Speicher.
self.addEventListener("fetch", (event) => {
  // Nur die App-Dateien selbst; Anfragen an die Datenbank nie zwischenspeichern.
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) return;
  // GitHub Pages lässt Dateien 10 Minuten im Browser liegen. "no-cache" fragt trotzdem jedes Mal
  // kurz nach, ob es etwas Neues gibt, damit nie alte und neue Dateien gemischt werden.
  const req = event.request.mode === "navigate" ? event.request.url : event.request;
  event.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
