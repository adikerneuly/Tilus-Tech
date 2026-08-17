// sw.js — permet au site de s'ouvrir même sans connexion (mode hors-ligne basique).
// Les données (projets, messages, réglages) nécessitent toujours une connexion ;
// seule la structure visuelle du site (HTML/CSS/JS) est mise en cache.
//
// IMPORTANT : à chaque mise à jour importante du site, changez le numéro
// ci-dessous (v2, v3, v4...). Ça force les téléphones ayant déjà installé
// l'app à télécharger la nouvelle version au lieu de garder l'ancienne en mémoire.
const CACHE_NAME = 'tilus-tech-v2';
const APP_SHELL = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  // On n'active plus tout de suite : on attend que la page demande
  // explicitement la mise à jour (voir message SKIP_WAITING plus bas),
  // pour pouvoir avertir l'utilisateur avant de basculer.
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ne jamais mettre en cache les appels à l'API : ils doivent toujours être à jour.
  if (request.url.includes('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
