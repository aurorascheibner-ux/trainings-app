// Service Worker: hält die App-Dateien bereit, damit sie installierbar ist
// und auch ohne Netz startet. Bei jeder Änderung an der App VERSION erhöhen.
const VERSION = "v6";
const FILES = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "data.js",
  "charts.js",
  "config.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)));
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
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
