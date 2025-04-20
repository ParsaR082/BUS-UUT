// فایل: ./sw.js
const CACHE_NAME = 'uut-bus-v5';
const DYNAMIC_CACHE = 'dynamic-cache-v1';
const OFFLINE_URL = './offline.html';

const PRECACHE_URLS = [
  './',
  './index.html',
  './src/script.js',
  './manifest.json',
  './offline.html',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];
// قبل از addEventListener('fetch')
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
      event.waitUntil(
        fetchNewData() // تابعی برای دریافت داده‌های جدید
          .then(data => updateCaches(data))
      );
    }
  });
// نصب و پیش‌کش
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// فعال‌سازی و حذف کش‌های قدیمی
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME && key !== DYNAMIC_CACHE) {
          return caches.delete(key);
        }
      })
    )).then(() => self.clients.claim())
  );
});

// مدیریت درخواست‌ها
self.addEventListener('fetch', event => {
  // برای مسیرهای اصلی، صفحه اصلی را برگردان
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // استراتژی Cache First با Fallback به شبکه
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request)
        .then(response => {
          // ذخیره پاسخ‌های معتبر در کش پویا
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Fallback برای فایل‌های دیگر
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match(OFFLINE_URL);
          }
          return new Response('داده آفلاین');
        })
      )
  );
});
