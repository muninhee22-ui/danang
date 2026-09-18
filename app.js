/* 문패밀리 다낭 여행 - 잠금 해제(AES-GCM) + 토스형 탭 앱 */
(function () {
  'use strict';
  var KEY_STORE = 'mf_danang_key', CHK_STORE = 'mf_danang_chk', DAY_STORE = 'mf_danang_day', BAN_STORE = 'mf_danang_banner';
  var enc = JSON.parse(document.getElementById('enc').textContent);
  var lock = document.getElementById('lock'), form = document.getElementById('lockForm'), msg = document.getElementById('lockMsg'), app = document.getElementById('app');
  var D = null, state = { tab: 'days', day: 1, todayN: 0 }, deferredInstall = null;

  function b64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function drop(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(sel, root) { return (root || app).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || app).querySelectorAll(sel)); }

  if (!window.crypto || !crypto.subtle) { msg.textContent = '이 브라우저에서는 열 수 없어요. 크롬이나 사파리로 열어 주세요.'; return; }

  function deriveKey(pin) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pin.normalize('NFKC')), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) { return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(enc.salt), iterations: enc.it, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']); });
  }
  function decrypt(key) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(enc.iv) }, key, b64(enc.ct)).then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); }); }
  function open(data) { D = data; lock.hidden = true; app.hidden = false; boot(); }

  var saved = load(KEY_STORE);
  if (saved) { try { crypto.subtle.importKey('jwk', JSON.parse(saved), { name: 'AES-GCM' }, true, ['decrypt']).then(decrypt).then(open).catch(function () { drop(KEY_STORE); }); } catch (e) { drop(KEY_STORE); } }
  form.pin.setAttribute('enterkeyhint', 'go');
  form.pin.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.keyCode === 13) { ev.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.querySelector('button').click(); } });
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var pin = form.pin.value.trim(); if (!pin) return;
    msg.textContent = '확인 중…'; form.querySelector('button').disabled = true;
    deriveKey(pin).then(function (key) { return decrypt(key).then(function (data) { return crypto.subtle.exportKey('jwk', key).then(function (jwk) { store(KEY_STORE, JSON.stringify(jwk)); open(data); }); }); })
      .catch(function () { msg.textContent = '비밀번호가 맞지 않아요.'; form.pin.value = ''; form.pin.focus(); })
      .then(function () { form.querySelector('button').disabled = false; });
  });

  /* ---------- 날짜 ---------- */
  function todayKST() { var n = new Date(), k = new Date(n.getTime() + (n.getTimezoneOffset() + 540) * 60000); return new Date(k.getFullYear(), k.getMonth(), k.getDate()); }
  function ymd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function ddayText() {
    var t = todayKST(), d = Math.round((ymd(D.trip.start) - t) / 86400000), e = Math.round((ymd(D.trip.end) - t) / 86400000);
    if (d > 0) return 'D-' + d;
    if (d === 0) return '오늘 출발';
    if (e >= 0) return (1 - d) + '일째 여행 중';
    return '다녀왔어요';
  }

  /* ---------- 뼈대 ---------- */
  function boot() {
    var t = todayKST();
    D.days.forEach(function (d) { if (ymd(d.date).getTime() === t.getTime()) state.todayN = d.n; });
    var h = location.hash.replace('#', '');
    var m = /^d(\d)$/.exec(h);
    if (m) { state.tab = 'days'; state.day = +m[1]; }
    else if (['stay', 'flight', 'memo', 'check'].indexOf(h) >= 0) state.tab = h;
    else { state.day = state.todayN || +(load(DAY_STORE) || 1) || 1; }
    if (!m && state.todayN) state.day = state.todayN;
    app.innerHTML =
      '<header class="top"><h1>' + esc(D.trip.title) + '</h1><span class="dday">' + esc(ddayText()) + '</span></header>' +
      '<div id="banner"></div>' +
      '<div class="view" id="now"></div>' +
      '<section class="view" id="v-days"></section><section class="view" id="v-stay" hidden></section><section class="view" id="v-flight" hidden></section><section class="view" id="v-memo" hidden></section><section class="view" id="v-check" hidden></section>' +
      '<footer class="foot"><p>' + esc(D.trip.sub) + '</p><button type="button" class="link" id="lockBtn">이 폰에서 잠그기</button><details class="credits"><summary>사진 출처</summary><ul>' + D.credits.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></details></footer>' +
      '<nav class="tabbar" aria-label="메뉴"><div>' +
      [['days', 'calendar-blank', '일정'], ['stay', 'bed', '숙소'], ['flight', 'airplane-tilt', '항공'], ['memo', 'note', '메모'], ['check', 'check-square', '체크']].map(function (t) {
        return '<button type="button" data-tab="' + t[0] + '"><i class="ph ph-' + t[1] + '" aria-hidden="true"></i>' + t[2] + '</button>';
      }).join('') + '</div></nav>' +
      '<div class="dim" id="dim" hidden></div><div class="sheet" id="sheet" role="dialog" aria-modal="true" hidden></div>';
    renderDays(); renderStay(); renderFlight(); renderMemo(); renderCheck(); banner();
    paintNow(); setInterval(paintNow, 30000); loadWeather();
    $$('.tabbar button').forEach(function (b) { b.addEventListener('click', function () { showTab(b.dataset.tab); }); });
    $('#lockBtn').addEventListener('click', function () { drop(KEY_STORE); location.reload(); });
    $('#dim').addEventListener('click', closeSheet);
    showTab(state.tab, true);
    window.addEventListener('hashchange', function () {
      var h = location.hash.replace('#', ''), m = /^d(\d)$/.exec(h);
      if (m) { state.day = +m[1]; showTab('days', true); renderDay(); } else if (['stay', 'flight', 'memo', 'check', 'days'].indexOf(h) >= 0) showTab(h, true);
    });
  }
  function showTab(tab, silent) {
    state.tab = tab;
    ['days', 'stay', 'flight', 'memo', 'check'].forEach(function (t) { $('#v-' + t).hidden = (t !== tab); });
    $$('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
    if (!silent) { history.replaceState(null, '', '#' + (tab === 'days' ? 'd' + state.day : tab)); window.scrollTo(0, 0); }
    else if (!location.hash) history.replaceState(null, '', '#' + (tab === 'days' ? 'd' + state.day : tab));
  }

  /* ---------- 일정: 누른 날짜만 ---------- */
  var ICON_C = { blue: 'blue', green: 'green', orange: 'orange', purple: 'purple' };
  function renderDays() {
    var v = $('#v-days');
    v.innerHTML = '<div class="dates" id="dates">' + D.days.map(function (d) {
      var dt = ymd(d.date), wd = '일월화수목금토'[dt.getDay()];
      return '<button type="button" data-n="' + d.n + '" class="' + (d.n === state.todayN ? 'today' : '') + '"><small>' + wd + '</small><b>' + dt.getDate() + '</b></button>';
    }).join('') + '</div><div id="dayBody"></div>';
    $$('#dates button').forEach(function (b) { b.addEventListener('click', function () { state.day = +b.dataset.n; store(DAY_STORE, state.day); history.replaceState(null, '', '#d' + state.day); renderDay(); window.scrollTo({ top: 0, behavior: 'smooth' }); }); });
    renderDay();
  }
  function placeLink(it) {
    var ids = it.places || (it.place ? [it.place] : []);
    if (!ids.length) return '';
    return '<span class="loc"><i class="ph ph-map-pin" aria-hidden="true"></i>' + (ids.length > 1 ? '지도 · 주소 ' + ids.length + '곳' : '지도 · 주소') + '</span>';
  }
  function renderDay() {
    var d = D.days.filter(function (x) { return x.n === state.day; })[0] || D.days[0];
    $$('#dates button').forEach(function (b) { b.classList.toggle('on', +b.dataset.n === d.n); if (+b.dataset.n === d.n) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); });
    var i = D.days.indexOf(d);
    $('#dayBody').innerHTML =
      '<h2 class="h"><small>' + esc(d.label) + (d.n === state.todayN ? ' · 오늘' : '') + ' · ' + esc(d.where) + '</small>' + esc(d.title) + '</h2>' +
      '<div class="wx" id="wxDay" hidden></div>' +
      (d.photo ? '<div class="photo"><img src="' + esc(d.photo) + '" alt="' + esc(d.alt) + '"></div>' : '') +
      '<div class="card">' + d.items.map(function (it, k) {
        var tap = it.place || it.places;
        return '<' + (tap ? 'button type="button"' : 'div') + ' class="row' + (tap ? ' tap' : '') + '" data-i="' + k + '">' +
          '<span class="ico ' + (ICON_C[it.c] || 'blue') + '"><i class="ph ph-' + esc(it.icon) + '" aria-hidden="true"></i></span>' +
          '<span class="tx"><b>' + esc(it.title) + '</b>' + (it.sub ? '<span>' + esc(it.sub) + '</span>' : '') + placeLink(it) + '</span>' +
          (it.time ? '<span class="tm">' + esc(it.time) + '</span>' : '') +
          '</' + (tap ? 'button' : 'div') + '>';
      }).join('') + '</div>' +
      (d.tip ? '<p class="tip"><i class="ph ph-lightbulb" aria-hidden="true"></i><span>' + esc(d.tip) + '</span></p>' : '') +
      '<div class="nav2">' + (i > 0 ? '<button type="button" class="btn sub" data-go="' + D.days[i - 1].n + '">← ' + (i) + '일차</button>' : '') + (i < D.days.length - 1 ? '<button type="button" class="btn sub" data-go="' + D.days[i + 1].n + '">' + (i + 2) + '일차 →</button>' : '') + '</div>';
    $$('#dayBody .row.tap').forEach(function (b) { b.addEventListener('click', function () { var it = d.items[+b.dataset.i]; openPlaces(it.places || [it.place], it.title); }); });
    $$('#dayBody [data-go]').forEach(function (b) { b.addEventListener('click', function () { state.day = +b.dataset.go; store(DAY_STORE, state.day); history.replaceState(null, '', '#d' + state.day); renderDay(); window.scrollTo({ top: 0, behavior: 'smooth' }); }); });
    paintWx();
  }

  /* ---------- 시계 + 날씨 (Open-Meteo, 키 없음) ---------- */
  var WX = null, WX_STORE = 'mf_danang_wx';
  var WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude=16.0678&longitude=108.2208&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&current=temperature_2m,weather_code,relative_humidity_2m,apparent_temperature&timezone=Asia%2FBangkok&forecast_days=16';
  var WXT = { 0: ['☀️', '맑음'], 1: ['🌤️', '대체로 맑음'], 2: ['⛅', '구름 조금'], 3: ['☁️', '흐림'], 45: ['🌫️', '안개'], 48: ['🌫️', '안개'], 51: ['🌦️', '이슬비'], 53: ['🌦️', '이슬비'], 55: ['🌧️', '이슬비'], 56: ['🌧️', '이슬비'], 57: ['🌧️', '이슬비'], 61: ['🌧️', '비'], 63: ['🌧️', '비'], 65: ['🌧️', '강한 비'], 66: ['🌧️', '비'], 67: ['🌧️', '비'], 71: ['🌨️', '눈'], 73: ['🌨️', '눈'], 75: ['🌨️', '눈'], 77: ['🌨️', '눈'], 80: ['🌦️', '소나기'], 81: ['🌧️', '소나기'], 82: ['⛈️', '강한 소나기'], 95: ['⛈️', '뇌우'], 96: ['⛈️', '뇌우'], 99: ['⛈️', '뇌우'] };
  function wxOf(code) { return WXT[code] || ['🌤️', '']; }
  function clock(tz) { try { return new Intl.DateTimeFormat('ko-KR', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date()); } catch (e) { return ''; } }
  function paintNow() {
    var el = $('#now'); if (!el) return;
    var cur = WX && WX.current, w = cur ? wxOf(cur.weather_code) : null;
    el.innerHTML = '<div class="now"><div class="clocks"><div><small>한국</small><b>' + esc(clock('Asia/Seoul')) + '</b></div><div class="sep"></div><div><small>베트남 (2시간 느림)</small><b>' + esc(clock('Asia/Ho_Chi_Minh')) + '</b></div></div>' +
      (cur ? '<div class="nowwx"><span class="tf">' + w[0] + '</span><b>' + Math.round(cur.temperature_2m) + '°</b><span>지금 다낭 · ' + esc(w[1]) + ' · 체감 ' + Math.round(cur.apparent_temperature) + '° · 습도 ' + cur.relative_humidity_2m + '%</span></div>' : '<div class="nowwx"><span class="tf">🌤️</span><span>다낭 날씨 불러오는 중…</span></div>') + '</div>';
  }
  function loadWeather() {
    var c = load(WX_STORE);
    try { if (c) { var o = JSON.parse(c); if (Date.now() - o.t < 3600000) { WX = o.d; paintNow(); paintWx(); return; } } } catch (e) {}
    if (!window.fetch) return;
    fetch(WX_URL).then(function (r) { return r.json(); }).then(function (d) { WX = d; store(WX_STORE, JSON.stringify({ t: Date.now(), d: d })); paintNow(); paintWx(); })
      .catch(function () { var n = $('#now .nowwx span:last-child'); if (n) n.textContent = '날씨는 인터넷이 연결되면 나와요'; });
  }
  function dayWx(date) {
    if (!WX || !WX.daily) return null;
    var i = WX.daily.time.indexOf(date); if (i < 0) return null;
    return { w: wxOf(WX.daily.weather_code[i]), max: Math.round(WX.daily.temperature_2m_max[i]), min: Math.round(WX.daily.temperature_2m_min[i]), rain: WX.daily.precipitation_probability_max[i] };
  }
  function paintWx() {
    var el = $('#wxDay');
    if (el) {
      var d = D.days.filter(function (x) { return x.n === state.day; })[0], f = d && dayWx(d.date);
      if (f) { el.hidden = false; el.innerHTML = '<span class="tf">' + f.w[0] + '</span><b>' + esc(f.w[1]) + '</b><span>최고 ' + f.max + '° · 최저 ' + f.min + '° · 비 올 확률 ' + f.rain + '%</span>'; }
      else el.hidden = true;
    }
    var m = $('#wxMemo');
    if (m) {
      var rows = D.days.map(function (d) {
        var f = dayWx(d.date), dt = ymd(d.date), wd = '일월화수목금토'[dt.getDay()];
        return '<div class="wxrow"><b>' + dt.getDate() + ' ' + wd + '</b>' + (f ? '<span class="tf">' + f.w[0] + '</span><span class="t">' + esc(f.w[1]) + '</span><span class="tmp">' + f.max + '° / ' + f.min + '°</span><span class="rain">' + f.rain + '%</span>' : '<span class="t">예보 없음</span>') + '</div>';
      }).join('');
      m.innerHTML = '<div class="memo wxcard"><div class="full"><b>다낭 일기예보</b><p>' + (WX ? '9월 21일 ~ 28일. 오른쪽은 비 올 확률. 매시간 갱신' : '인터넷이 연결되면 나와요') + '</p>' + (WX ? '<div class="wxlist">' + rows + '</div>' : '') + '</div></div>';
    }
  }

  /* ---------- 숙소 ---------- */
  function renderStay() {
    $('#v-stay').innerHTML = '<h2 class="h"><small>호이안 2박, 다낭 시내 4박, 마지막 1박</small>숙소</h2><div class="card stay">' + D.stays.map(function (s, k) {
      var p = D.places[s.place];
      return '<button type="button" class="row tap" data-k="' + k + '"><span class="ico ' + s.color + '"><i class="ph ph-bed" aria-hidden="true"></i></span><span class="tx"><b>' + esc(p.ko) + '</b><span>' + esc(s.range) + ' · ' + esc(s.city) + '</span><span>' + esc(s.memo) + '</span><span class="loc"><i class="ph ph-map-pin" aria-hidden="true"></i>지도 · 주소</span></span><span class="nights">' + s.nights + '박</span></button>';
    }).join('') + '</div>';
    $$('#v-stay .row').forEach(function (b) { b.addEventListener('click', function () { openPlaces([D.stays[+b.dataset.k].place]); }); });
  }

  /* ---------- 항공 ---------- */
  function renderFlight() {
    $('#v-flight').innerHTML = '<h2 class="h"><small>제주항공 직항</small>항공</h2>' + D.flights.map(function (f) {
      return '<div class="fl"><div class="fl-top"><span>' + esc(f.dir) + '</span><span>' + esc(f.date) + '</span></div>' +
        '<div class="fl-route"><div><b>' + esc(f.dep) + '</b><span>' + esc(f.depCode) + ' ' + esc(f.depName) + '</span></div><div class="fl-mid">' + esc(f.dur) + '<i></i>직항</div><div class="r"><b>' + esc(f.arr) + '</b><span>' + esc(f.arrCode) + ' ' + esc(f.arrName) + '</span></div></div>' +
        '<div class="fl-foot"><span>' + esc(f.no) + '</span><span>' + esc(f.bag) + '</span></div>' +
        '<button type="button" class="row tap" data-p="' + esc(f.place) + '"><span class="ico blue"><i class="ph ph-map-pin" aria-hidden="true"></i></span><span class="tx"><b>' + esc(f.placeLabel) + '</b><span class="loc">지도 · 주소</span></span></button></div>';
    }).join('') + '<p class="note">' + esc(D.flightNote) + '</p>';
    $$('#v-flight .row').forEach(function (b) { b.addEventListener('click', function () { openPlaces([b.dataset.p]); }); });
  }

  /* ---------- 메모 ---------- */
  function renderMemo() {
    $('#v-memo').innerHTML = '<h2 class="h"><small>알아두면 편한 것</small>여행 메모</h2><div id="wxMemo"></div>' + D.memos.map(function (m) {
      return '<div class="memo"><span class="ico ' + m.c + '"><i class="ph ph-' + esc(m.icon) + '" aria-hidden="true"></i></span><div><b>' + esc(m.title) + '</b><p>' + esc(m.body) + '</p></div></div>';
    }).join('');
  }

  /* ---------- 체크 ---------- */
  function renderCheck() {
    var st = {}; try { st = JSON.parse(load(CHK_STORE) || '{}') || {}; } catch (e) { st = {}; }
    var v = $('#v-check');
    v.innerHTML = '<h2 class="h"><small>출발 전 확인</small>체크리스트</h2><p class="progress" id="prog"></p><div class="card check">' + D.checks.map(function (c) {
      return '<label><input type="checkbox" data-k="' + esc(c.k) + '"' + (st[c.k] ? ' checked' : '') + '><span class="tx"><b>' + esc(c.t) + '</b><span>' + esc(c.s) + '</span></span></label>';
    }).join('') + '</div><p class="note">체크 표시는 지금 쓰는 폰에만 저장돼요.</p>';
    function prog() { var n = $$('.check input:checked').length; $('#prog').innerHTML = '<b>' + n + '</b> / ' + D.checks.length + ' 완료'; }
    $$('.check input').forEach(function (b) { b.addEventListener('change', function () { st[b.dataset.k] = b.checked; store(CHK_STORE, JSON.stringify(st)); prog(); }); });
    prog();
  }

  /* ---------- 장소 시트: 주소 + 지도 ---------- */
  function mapQuery(p) { return (p.lat != null && p.lng != null) ? (p.lat + ',' + p.lng) : (p.en + (p.address ? ', ' + p.address : '')); }
  function openPlaces(ids, title) {
    var sheet = $('#sheet'), dim = $('#dim');
    var list = ids.map(function (id) { return D.places[id]; }).filter(Boolean);
    if (!list.length) return;
    sheet.innerHTML = '<div class="grip"></div>' + (list.length > 1 ? '<h2>' + esc(title || '장소') + '</h2><p class="en">아래에서 골라 누르세요</p><div class="card mt12">' + list.map(function (p, k) {
      return '<button type="button" class="row tap" data-k="' + k + '"><span class="ico blue"><i class="ph ph-map-pin" aria-hidden="true"></i></span><span class="tx"><b>' + esc(p.ko) + '</b><span>' + esc(p.address || p.en) + '</span></span></button>';
    }).join('') + '</div>' : placeHtml(list[0]));
    sheet.hidden = false; dim.hidden = false;
    requestAnimationFrame(function () { sheet.classList.add('in'); dim.classList.add('in'); });
    document.body.style.overflow = 'hidden';
    bindSheet(list);
  }
  function placeHtml(p) {
    var q = mapQuery(p), gm = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
    return '<h2>' + esc(p.ko) + '</h2><p class="en">' + esc(p.en) + '</p>' +
      '<div class="addr"><i class="ph ph-map-pin" aria-hidden="true"></i><div class="tx">' + (p.address ? esc(p.address) : '주소 확인 중. 아래 지도는 이름으로 찾은 위치예요') + '<small>기사님이나 그랩에 이 주소를 보여 주세요</small></div></div>' +
      '<div class="map"><iframe title="' + esc(p.ko) + ' 지도" loading="lazy" referrerpolicy="no-referrer" src="https://www.google.com/maps?q=' + encodeURIComponent(q) + '&z=16&hl=ko&output=embed"></iframe></div>' +
      '<div class="acts"><a class="btn" href="' + gm + '" target="_blank" rel="noopener noreferrer">구글 지도 열기</a><button type="button" class="btn sub" data-copy="' + esc(p.address || p.en) + '">주소 복사</button></div>';
  }
  function bindSheet(list) {
    var sheet = $('#sheet');
    $$('.row[data-k]', sheet).forEach(function (b) { b.addEventListener('click', function () { sheet.innerHTML = '<div class="grip"></div>' + placeHtml(list[+b.dataset.k]); bindSheet(list); }); });
    var cp = $('[data-copy]', sheet);
    if (cp) cp.addEventListener('click', function () {
      var t = cp.dataset.copy;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { cp.textContent = '복사됐어요'; setTimeout(function () { cp.textContent = '주소 복사'; }, 1500); }).catch(function () { window.prompt('길게 눌러 복사하세요', t); });
    });
  }
  function closeSheet() {
    var sheet = $('#sheet'), dim = $('#dim');
    sheet.classList.remove('in'); dim.classList.remove('in'); document.body.style.overflow = '';
    setTimeout(function () { sheet.hidden = true; dim.hidden = true; sheet.innerHTML = ''; }, 300);
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

  /* ---------- 설치 배너 ---------- */
  function banner() {
    var box = $('#banner'); if (!box) return;
    var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (standalone || load(BAN_STORE) === 'x') { box.innerHTML = ''; return; }
    var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!isIOS && !deferredInstall) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="view"><div class="banner"><i class="ph ph-device-mobile" aria-hidden="true"></i><span class="tx">홈 화면에 앱처럼 두기' + (isIOS ? '<small>사파리 공유 버튼 → 「홈 화면에 추가」</small>' : '<small>다음부턴 비밀번호 없이 바로 열려요</small>') + '</span>' + (isIOS ? '' : '<button type="button" id="installBtn">추가</button>') + '<button type="button" class="x" id="banX" aria-label="닫기"><i class="ph ph-x"></i></button></div></div>';
    var ib = $('#installBtn'); if (ib) ib.addEventListener('click', function () { if (!deferredInstall) return; deferredInstall.prompt(); deferredInstall.userChoice.then(function () { deferredInstall = null; box.innerHTML = ''; }); });
    $('#banX').addEventListener('click', function () { store(BAN_STORE, 'x'); box.innerHTML = ''; });
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; if (D) banner(); });
  window.addEventListener('appinstalled', function () { var b = $('#banner'); if (b) b.innerHTML = ''; });
  if ('serviceWorker' in navigator && location.protocol === 'https:') { window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); }); }
})();
