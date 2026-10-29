const CACHE_NAME = 'tellmeweather-v4';
const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './components/utils.js',
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
        keys.filter(k => k.startsWith('tellmeweather-') && k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isApi = url.hostname === 'api.open-meteo.com' || url.hostname === 'nominatim.openstreetmap.org';

  if (isApi) {
    // Let app.js use its timestamped localStorage fallback. Serving an API
    // response from a second cache would incorrectly mark old forecasts fresh.
    event.respondWith(fetch(event.request));
  } else {
    // Stale-while-revalidate for the app shell so a new deploy reaches
    // users without requiring a manual CACHE_NAME bump.
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          const networkFetch = fetch(event.request)
            .then(response => {
              if (response.ok) cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
  }
});
