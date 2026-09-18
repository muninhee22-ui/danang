/* 문패밀리 다낭 여행 - 오프라인 캐시 (같은 출처 파일만) */
var VER = 'mf-202609180615';
var PRECACHE = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'img/hero.jpg', 'img/hero-m.jpg', 'img/d1.jpg', 'img/d2.jpg', 'img/d3.jpg', 'img/d4.jpg', 'img/d5a.jpg', 'img/d5b.jpg', 'img/d6.jpg', 'img/d7.jpg'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VER).then(function (c) { return c.addAll(PRECACHE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VER; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return; // CDN 폰트 등은 브라우저 기본 캐시에 맡김
  var isPage = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (isPage) {
    // 페이지는 항상 최신 먼저, 안 되면 캐시
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(VER).then(function (c) { c.put(req, copy); }); return res;
    }).catch(function () { return caches.match(req).then(function (r) { return r || caches.match('./'); }); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (r) {
    return r || fetch(req).then(function (res) { var copy = res.clone(); caches.open(VER).then(function (c) { c.put(req, copy); }); return res; });
  }));
});
