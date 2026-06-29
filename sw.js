// bump esta versão sempre que mudar assets
const CACHE = 'sst-v1';
const ASSETS = [
  '.', 'index.html', 'styles.css', 'app.js',
  'src/logic.js', 'src/state.js', 'src/views.js',
  'data/questoes.json', 'data/discursivas.json',
  'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/nunito-400.woff2', 'fonts/nunito-700.woff2', 'fonts/nunito-800.woff2',
  'fonts/fredoka.woff2',
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch', e => e.respondWith(
  caches.match(e.request).then(r => r || fetch(e.request))));
