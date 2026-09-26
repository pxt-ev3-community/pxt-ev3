/* BrickCode PWA Offline Service Worker
 * Provides offline caching for beta.brickcode.org
 */

const CACHE_NAME = 'brickcode-pwa-v1';

// Static assets to precache immediately on install
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './ev3-community.js',
    './ev3-community.css',
    './pxtapp.js',
    './target.js',
    './editor.js',
    './semantic.css',
    './semantic.js',
    './icons.css'
];

self.addEventListener('install', (event) => {
    // Force immediate activation
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(
                PRECACHE_ASSETS.map((url) =>
                    fetch(url, { cache: 'no-cache' }).then((response) => {
                        if (response.ok) {
                            return cache.put(url, response);
                        }
                    }).catch(() => {
                        // Precache best-effort, ignore missing files on partial builds
                    })
                )
            );
        })
    );
});

self.addEventListener('activate', (event) => {
    // Take control of all clients immediately
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Only handle GET requests from the same origin or CDN resources
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Skip Web Serial or API calls
    if (url.pathname.startsWith('/api/')) return;

    // Cache-first or network-first depending on resource
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // If network fetch succeeds, cache valid response
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(async () => {
                // Network failed (offline), attempt to serve from cache
                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }

                // If navigation request fails, return cached index.html
                if (event.request.mode === 'navigate') {
                    const cachedIndex = await caches.match('./index.html') || await caches.match('./');
                    if (cachedIndex) return cachedIndex;
                }

                return new Response('Offline: Resource not available in cache.', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 'Content-Type': 'text/plain' }
                });
            })
    );
});
