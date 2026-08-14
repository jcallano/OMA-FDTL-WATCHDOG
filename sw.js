/**
 * Oman Air FTL PWA - Service Worker
 * Strategy: Network-First for HTML/JS (instant GitHub Pages updates) + Offline Fallback
 * Regulations valid as of August 2026
 */

const CACHE_NAME = 'oman-air-ftl-v1.3.9'; // Crystal clear Days Off 28d vs 3-Mo labels
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './css/app.css',
  './js/ftl_rules.js',
  './js/storage.js',
  './js/ecrew_parser.js',
  './js/simulator.js',
  './js/app.js',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install: Pre-cache assets and immediately activate
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force active immediately without waiting for restart
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate: Delete any and all outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache version:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open client tabs immediately
  );
});

// Fetch Strategy: NETWORK-FIRST for core app files, FALLBACK to cache when offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If network request succeeds, update the cache copy in background
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline or Network Error: serve cached version
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
