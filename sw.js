const CACHE_NAME = 'tellmeweather-v3';
const API_CACHE_NAME = 'tellmeweather-api-v3';
const API_CACHE_MAX_ENTRIES = 20;
const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './components/weather.js',
  './components/laundry.js',
  './components/clothes.js',
  './components/hourly.js',
  './components/heatstroke.js',
  './components/settings.js',
  './assets/app-background.png',
  './assets/app-icon.png',
  './assets/app-icon-192.png',
  './assets/weather/sunny.png',
  './assets/weather/cloudy.png',
  './assets/weather/rainy.png',
  './assets/weather/snowy.png',
  './assets/weather/storm.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== API_CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  while (keys.length > maxEntries) {
    await cache.delete(keys.shift());
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isApi = url.hostname.includes('open-meteo.com') || url.hostname.includes('nominatim');

  if (isApi) {
    // Network-first with a bounded cache as an offline fallback.
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(API_CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
            trimCache(API_CACHE_NAME, API_CACHE_MAX_ENTRIES);
          });
          return response;
        })
        .catch(() => caches.match(event.request, { cacheName: API_CACHE_NAME }))
    );
  } else {
    // Stale-while-revalidate for the app shell so a new deploy reaches
    // users without requiring a manual CACHE_NAME bump.
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          const networkFetch = fetch(event.request)
            .then(response => {
              cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
  }
});
