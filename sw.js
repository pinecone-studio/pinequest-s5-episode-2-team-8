/* Service worker: always tries the network first so players get the newest version,
   and falls back to the saved copy when there is no internet (countryside, airplane mode). */
const CACHE = 'naadamy-v34';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/styles.css', './assets/icon.svg', './assets/fonts/fonts.css',
  './assets/fonts/nunito-cyrillic.woff2', './assets/fonts/nunito-cyrillic-ext.woff2', './assets/fonts/nunito-latin.woff2',
  './assets/fonts/rubik-cyrillic.woff2', './assets/fonts/rubik-cyrillic-ext.woff2', './assets/fonts/rubik-latin.woff2',
  './assets/fonts/tiny5-cyrillic.woff2', './assets/fonts/tiny5-cyrillic-ext.woff2', './assets/fonts/tiny5-latin.woff2', './assets/fonts/NotoSansMongolian-Regular.ttf',
  './js/vendor/phaser.min.js', './js/vendor/PHASER-LICENSE.txt', './js/core.js', './js/icons.js', './js/store.js', './js/data.js', './js/app.js', './js/music.js', './js/qr.js', './js/dialog.js', './js/tutorial.js',
  './js/village/rules.js', './js/village/pixel.js', './js/scene.js', './js/landmarks.js', './js/village/world.js', './js/village/view.js', './js/village/tasks.js', './js/village/gerwork.js', './js/village/village.js',
  './js/basar/knowledge.js', './js/basar/basar.js', './js/learn/scenes.js', './js/learn/lessons.js', './js/achievements.js', './js/seasons.js', './js/aimags.js', './js/passport.js', './js/nomin.js', './js/travel.js', './js/fpworld.js', './js/fp.js', './js/ethnic.js', './js/battles.js', './js/history.js', './js/bichig.js',
];
const NETWORK_TIMEOUT = 4000; // on very slow connections, use the saved copy instead of waiting

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache so a new version never stores old files
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  // music files are large and streamed in ranges, so the browser handles them directly
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/') || url.pathname.includes('/assets/music/') || req.headers.has('range')) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const network = fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT));
    try {
      const res = await Promise.race([network, timeout]);
      if (res) return res;
      return (await cache.match(req)) || (await network);
    } catch (err) {
      return (await cache.match(req)) || (await cache.match('./index.html')) || Response.error();
    }
  })());
});
