const CACHE_NAME = 'exp-er-v3-local'; // เปลี่ยนชื่อเวอร์ชั่นเพื่อบังคับอัปเดต
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching local assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[Service Worker] Removing old cache', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('script.google.com')) return;
    event.respondWith(
        caches.match(event.request).then((response) => response || fetch(event.request))
    );
});