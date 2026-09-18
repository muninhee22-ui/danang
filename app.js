/* 문패밀리 다낭 여행 - 잠금 해제(AES-GCM) + 화면 동작 */
(function () {
  'use strict';
  var KEY_STORE = 'mf_danang_key';
  var CHK_STORE = 'mf_danang_chk';
  var enc = JSON.parse(document.getElementById('enc').textContent);
  var lock = document.getElementById('lock');
  var form = document.getElementById('lockForm');
  var msg = document.getElementById('lockMsg');
  var app = document.getElementById('app');
  var deferredInstall = null;

  function b64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function drop(k) { try { localStorage.removeItem(k); } catch (e) {} }

  if (!window.crypto || !crypto.subtle) {
    msg.textContent = '이 브라우저에서는 열 수 없어요. 크롬이나 사파리로 열어 주세요.';
    return;
  }

  function deriveKey(pin) {
    var te = new TextEncoder();
    return crypto.subtle.importKey('raw', te.encode(pin.normalize('NFKC')), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: b64(enc.salt), iterations: enc.it, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
      });
  }
  function decrypt(key) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(enc.iv) }, key, b64(enc.ct))
      .then(function (buf) { return new TextDecoder().decode(buf); });
  }
  function open(html) {
    app.innerHTML = html;
    app.hidden = false;
    lock.hidden = true;
    init();
  }

  // 저장된 키가 있으면 바로 열기
  var saved = load(KEY_STORE);
  if (saved) {
    try {
      crypto.subtle.importKey('jwk', JSON.parse(saved), { name: 'AES-GCM' }, true, ['decrypt'])
        .then(decrypt).then(open).catch(function () { drop(KEY_STORE); });
    } catch (e) { drop(KEY_STORE); }
  }

  form.pin.setAttribute('enterkeyhint', 'go');
  form.pin.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' || ev.keyCode === 13) { ev.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.querySelector('button').click(); }
  });
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var pin = form.pin.value.trim();
    if (!pin) return;
    msg.textContent = '여는 중…';
    form.querySelector('button').disabled = true;
    deriveKey(pin).then(function (key) {
      return decrypt(key).then(function (html) {
        return crypto.subtle.exportKey('jwk', key).then(function (jwk) { store(KEY_STORE, JSON.stringify(jwk)); open(html); });
      });
    }).catch(function () {
      msg.textContent = '비밀번호가 맞지 않아요.';
      form.pin.value = '';
      form.pin.focus();
    }).then(function () { form.querySelector('button').disabled = false; });
  });

  /* ---------- 화면 동작 ---------- */
  function init() {
    dday();
    checklist();
    scrollSpy();
    reveal();
    install();
    var lb = document.getElementById('lockBtn');
    if (lb) lb.addEventListener('click', function () { drop(KEY_STORE); location.reload(); });
  }

  function dday() {
    var el = document.getElementById('dday'); if (!el) return;
    var now = new Date();
    var kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
    var today = new Date(kst.getFullYear(), kst.getMonth(), kst.getDate());
    var t0 = new Date(2026, 8, 21), t1 = new Date(2026, 8, 28);
    var d = Math.round((t0 - today) / 86400000);
    if (d > 0) el.innerHTML = 'D-' + d + '<small>출발까지</small>';
    else if (d === 0) el.innerHTML = 'D-DAY<small>오늘 출발</small>';
    else if (today <= t1) {
      var n = 1 - d;
      el.innerHTML = n + '일째<small>여행 중</small>';
      var cur = document.getElementById('d' + n);
      if (cur) {
        cur.classList.add('today');
        if (!location.hash) setTimeout(function () { cur.scrollIntoView({ block: 'start' }); }, 300);
      }
    } else el.innerHTML = '다녀왔어요<small>2026년 9월</small>';
  }

  function checklist() {
    var st = {};
    try { st = JSON.parse(load(CHK_STORE) || '{}') || {}; } catch (e) { st = {}; }
    var boxes = app.querySelectorAll('.check input');
    Array.prototype.forEach.call(boxes, function (b) {
      b.checked = !!st[b.dataset.k];
      b.addEventListener('change', function () { st[b.dataset.k] = b.checked; store(CHK_STORE, JSON.stringify(st)); });
    });
  }

  function scrollSpy() {
    var nav = document.getElementById('daynav'); if (!nav || !('IntersectionObserver' in window)) return;
    var links = nav.querySelectorAll('a');
    var map = {};
    Array.prototype.forEach.call(links, function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        Array.prototype.forEach.call(links, function (a) { a.removeAttribute('aria-current'); });
        var a = map[e.target.id]; if (!a) return;
        a.setAttribute('aria-current', 'true');
        a.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(map).forEach(function (id) { var t = document.getElementById(id); if (t) io.observe(t); });
  }

  function reveal() {
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var els = app.querySelectorAll('.day, .stay li, .tk, .check li');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    Array.prototype.forEach.call(els, function (el) { el.classList.add('rv'); io.observe(el); });
  }

  function install() {
    var sec = document.getElementById('install'), btn = document.getElementById('installBtn'), ios = document.getElementById('iosHow');
    if (!sec) return;
    var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (standalone) return;
    var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) { sec.hidden = false; ios.hidden = false; return; }
    if (deferredInstall) { sec.hidden = false; btn.hidden = false; }
    btn.addEventListener('click', function () {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      deferredInstall.userChoice.then(function () { deferredInstall = null; sec.hidden = true; });
    });
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstall = e;
    var sec = document.getElementById('install'), btn = document.getElementById('installBtn');
    if (sec && btn && !app.hidden) { sec.hidden = false; btn.hidden = false; }
  });
  window.addEventListener('appinstalled', function () { var sec = document.getElementById('install'); if (sec) sec.hidden = true; });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
