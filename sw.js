/* 문패밀리 다낭 여행 - 오프라인 캐시. 같은 출처 파일 + 폰트 CDN(cdn.jsdelivr.net) 런타임 캐시 */
var VER = 'mf-202609180647';
var PRECACHE = ['./', 'index.html', 'style.css?v=202609180647', 'app.js?v=202609180647', 'manifest.webmanifest',
  'vendor/phosphor/style.css?v=202609180647', 'vendor/phosphor/Phosphor.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'img/hero.jpg', 'img/hero-m.jpg', 'img/d1.jpg', 'img/d2.jpg', 'img/d3.jpg', 'img/d4.jpg', 'img/d5a.jpg', 'img/d5b.jpg', 'img/d6.jpg', 'img/d7.jpg'];
var CDN = /^https:\/\/cdn\.jsdelivr\.net\//;

function timeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]); }

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VER).then(function (c) {
    // 하나가 실패해도 설치는 되게(개별 addAll 대신 allSettled)
    return Promise.all(PRECACHE.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
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
  var same = url.origin === location.origin, cdn = CDN.test(req.url);
  if (!same && !cdn) return; // 지도·날씨 API 등은 그대로 네트워크
  var isPage = same && (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/'));
  if (isPage) {
    // 페이지: 네트워크 먼저(최대 4초), 느리거나 끊기면 캐시
    e.respondWith(timeout(fetch(req), 4000).then(function (res) {
      var copy = res.clone(); caches.open(VER).then(function (c) { c.put(req, copy); }); return res;
    }).catch(function () { return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('./'); }); }));
    return;
  }
  // 나머지(사진·CSS·JS·폰트·CDN): 캐시 먼저, 없으면 네트워크 후 저장
  e.respondWith(caches.match(req).then(function (r) {
    return r || fetch(req).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) { var copy = res.clone(); caches.open(VER).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  }));
});
