// bump esta versão sempre que mudar assets
const CACHE = 'sst-v2';
const ASSETS = [
  '.', 'index.html', 'styles.css', 'app.js',
  'src/logic.js', 'src/state.js', 'src/views.js',
  'data/questoes.json', 'data/discursivas.json',
  'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/nunito-400.woff2', 'fonts/nunito-700.woff2', 'fonts/nunito-800.woff2',
  'fonts/fredoka.woff2',
];
// install: pré-cache + assume o controle na hora (não espera abas fecharem)
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{}));
});
// activate: limpa caches antigos e passa a controlar as páginas abertas imediatamente
self.addEventListener('activate', e => e.waitUntil((async () => {
  const ks = await caches.keys();
  await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));
// HTML/CSS/JS: rede primeiro (sempre pega a versão nova); cai no cache só offline.
// Demais assets (fontes/ícones/dados): cache primeiro (rápido/offline).
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const ehCodigo = /\.(html|css|js)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (ehCodigo) {
    e.respondWith(
      fetch(e.request).then(r => {
        const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)).catch(()=>{});
        return r;
      }).catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
