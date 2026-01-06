const CACHE_NAME = 'exp-er-v2-cdn'; // เปลี่ยนชื่อเวอร์ชั่นเพื่อบังคับอัปเดต
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    // Cache External Libraries (เพื่อให้ทำงานได้เร็วขึ้น)
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    // Cache Icon from CDN
    'https://cdn-icons-png.flaticon.com/512/3063/3063822.png'
];

// Install: Cache files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching assets');
            // ใช้ try-catch หรือ return เพื่อป้องกันการล้มเหลวหากไฟล์ใดไฟล์หนึ่งโหลดไม่ได้
            return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                console.error('[Service Worker] Caching failed:', err);
            });
        })
    );
    self.skipWaiting();
});

// Activate: Clean old caches
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

// Fetch: Serve from Cache -> Network
self.addEventListener('fetch', (event) => {
    // ไม่ Cache การเรียก API ไปยัง Google Script
    if (event.request.url.includes('script.google.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});