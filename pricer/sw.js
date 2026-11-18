// =============================================================================
// SkinOracle™ Product Pricer — service worker (v1.0.0)
// Owner, founder, author, designer and architect: Roxanne Benjamin (also Roxy Benjamin; maiden name Roxanne Haberland). All hers, no one else's. © 2026 Roxanne Benjamin. See OWNERSHIP.md.
//
// Job: make the installed app open fast and keep the big files (background-removal
// model ~4.5 MB, AI runtime ~15 MB, barcode reader ~1 MB) on the phone after the
// first download so they are not fetched again on every scan.
//
//   * Pages, code and assets/ (styles, the frame guard): network first, cached copy only when offline, so a security
//     fix reaches installed phones on their next open (security review L3, 14 Nov 2026).
//   * vendor/ and icons/: cache first (big, and they only change with a new version).
//   * Calls to Supabase are NEVER cached (they go straight to the network).
//
// RELEASE RULE: CACHE carries the Pricer's version (config.js); bump both on every release so phones re-download.
// =============================================================================
const CACHE = "pricer-v1.1.3";
const PRECACHE = [
  "/pricer/", "/pricer/app/", "/pricer/assets/styles.css",
  "/pricer/config.js", "/pricer/manifest.webmanifest",
  "/pricer/icons/icon-192.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("pricer-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || !url.pathname.startsWith("/pricer/")) return;
  const cacheFirst = /\/pricer\/(vendor|icons)\//.test(url.pathname);
  e.respondWith(cacheFirst ? fromCacheThenNetwork(e.request) : fromNetworkThenCache(e.request));
});

async function fromCacheThenNetwork(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
  return res;
}
async function fromNetworkThenCache(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}
