(function () {
  'use strict';

  var D = window.DIMA || {};
  var META = D.meta || {};
  var VIDEO = D.tiktok || [];
  var SAD = D.sad || [];
  var DAYS = VIDEO; // дни текущей вкладки роликов: «Видео» или «Грустное»
  var ADS = D.ads || { items: [], moods: [] };
  var TG = D.tg || { channels: [], stories: [] };
  var TASKS = D.tasks || { sections: [], tasks: [] };
  var INSPO = D.inspo || { authors: [] };
  var BOARD = D.board || { sections: [], items: [] };
  var TZ = META.tz || { label: 'Астана', offsetFromMsk: 2 };
  var TABS = ['tasks', 'inspo', 'tiktok', 'sad', 'tg'];

  var SOUNDS = {
    'заботливый': ['🤍', 'тёплый, спокойный', '#ffb36b'],
    'нежный': ['🌙', 'тихий, мягкий', '#f9a8d4'],
    'грустный': ['🌧', 'медленный, пиано', '#7aa7ff'],
    'весёлый': ['☀️', 'лёгкий, бодрый', '#ffd84d'],
    'тревожный': ['⚡', 'напряжённый, с паузой', '#ff7b7b'],
    'ностальгия': ['📼', 'старый хит, ламповый', '#c9a8ff'],
    'дерзкий': ['🔥', 'уверенный бит', '#ff8a3d'],
    'клубный': ['🪩', 'бит, дубайский вайб', '#2fe0a6'],
    'романтичный': ['💗', 'мягкий, про любовь', '#f9a8d4']
  };
  var WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var WD_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  var MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var MON_S = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  // ---------- хранилище (только на этом телефоне) ----------
  var KEY = 'dimaApp.v1';
  var store = {};
  try { store = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { store = {}; }
  if (!store.done) store.done = {};
  if (!store.copied) store.copied = {};
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* приватный режим */ } }
  // галочки задач — тот же ключ, что у старой страницы zadachi.html, чтобы отметки не пропали
  var TKEY = 'dimaTasks.v1';
  var tdone = {};
  try { tdone = JSON.parse(localStorage.getItem(TKEY)) || {}; } catch (e) { tdone = {}; }
  function saveTasks() { try { localStorage.setItem(TKEY, JSON.stringify(tdone)); } catch (e) { /* приватный режим */ } }
  // правки Димы: переименовал, удалил, добавил своё. Пока живут на этом телефоне, потом уедут в Supabase
  var EKEY = 'dimaTasksEdit.v1';
  var tedit = {};
  try { tedit = JSON.parse(localStorage.getItem(EKEY)) || {}; } catch (e) { tedit = {}; }
  tedit.edits = tedit.edits || {};
  tedit.added = tedit.added || [];
  tedit.removed = tedit.removed || {};
  function saveEdits() { try { localStorage.setItem(EKEY, JSON.stringify(tedit)); } catch (e) { /* приватный режим */ } }
  function allTasks() {
    return (TASKS.tasks || []).filter(function (t) { return !tedit.removed[t.id]; })
      .map(function (t) { var e = tedit.edits[t.id]; return e ? Object.assign({}, t, e) : t; })
      .concat(tedit.added);
  }

  // ---------- галочки в базе (Supabase, проект dima-app) ----------
  // Читать может любой (это только отметки, что вышло), писать — только Дима после входа.
  // store.mt — когда менялась отметка, store.pend — что еще не ушло в базу. Побеждает более позднее нажатие.
  var SB = { url: 'https://jerqbsajjpcevzizawso.supabase.co', key: 'sb_publishable_SFH8mGmM6tqR4VRv-eNccg_TbBDbY89' };
  var SKEY = 'dimaSb.v1';
  var sess = null;
  try { sess = JSON.parse(localStorage.getItem(SKEY)); } catch (e) { sess = null; }
  if (!store.mt) store.mt = {};
  if (!store.pend) store.pend = {};
  var sync = { state: sess ? 'on' : 'off', msg: '' };
  function saveSess() { try { sess ? localStorage.setItem(SKEY, JSON.stringify(sess)) : localStorage.removeItem(SKEY); } catch (e) { /* приватный режим */ } }
  function sbFetch(path, opt) {
    opt = opt || {};
    var h = Object.assign({ apikey: SB.key, 'Content-Type': 'application/json' }, opt.headers || {});
    if (opt.auth && sess) h.Authorization = 'Bearer ' + sess.access_token;
    return fetch(SB.url + path, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined })
      .then(function (r) { return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; } return { ok: r.ok, status: r.status, data: j }; }); });
  }
  function setSess(d) {
    sess = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in || 3600) * 1000, email: d.user && d.user.email || (sess && sess.email) || '' };
    saveSess();
    sync.state = 'on';
  }
  function freshToken() {
    if (!sess) return Promise.resolve(false);
    if (sess.expires_at - 60000 > Date.now()) return Promise.resolve(true);
    return sbFetch('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: sess.refresh_token } }).then(function (r) {
      if (r.ok) { setSess(r.data); return true; }
      if (r.status === 400 || r.status === 401) { sess = null; saveSess(); sync.state = 'off'; sync.msg = 'Вход слетел, войди еще раз.'; }
      return false;
    });
  }
  // старые галочки, поставленные до базы: при первом входе отправляем и их
  function adoptLocal() {
    Object.keys(store.done).concat(Object.keys(store.copied)).forEach(function (id) {
      if (!store.mt[id]) { store.mt[id] = store.done[id] || store.copied[id] || Date.now(); store.pend[id] = 1; }
    });
    save();
  }
  function markChanged(id) {
    store.mt[id] = Date.now();
    store.pend[id] = 1;
    save();
    pushMarks();
  }
  var pushing = false;
  function pushMarks() {
    var ids = Object.keys(store.pend);
    if (!sess || pushing || !ids.length) return;
    pushing = true;
    var iso = function (t) { return t ? new Date(t).toISOString() : null; };
    var rows = ids.map(function (id) {
      return { id: id, done_at: iso(store.done[id]), copied_at: iso(store.copied[id]), updated_at: iso(store.mt[id] || Date.now()) };
    });
    freshToken().then(function (ok) {
      if (!ok) return null;
      return sbFetch('/rest/v1/marks?on_conflict=id', { method: 'POST', auth: true, body: rows, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
    }).then(function (r) {
      pushing = false;
      if (!r) return;
      if (r.ok) {
        ids.forEach(function (id) { if (store.mt[id] <= Date.parse(rows.filter(function (x) { return x.id === id; })[0].updated_at)) delete store.pend[id]; });
        save();
        if (sync.msg) { sync.msg = ''; if (ui.tab === 'tasks') render(); }
      } else {
        sync.msg = r.status === 401 || r.status === 403 ? 'База не пускает эту почту: писать может только Димина.' : 'Не достучался до базы, отправлю позже.';
        if (ui.tab === 'tasks') render();
      }
    }, function () { pushing = false; });
  }
  function pullMarks() {
    return sbFetch('/rest/v1/marks?select=id,done_at,copied_at,updated_at').then(function (r) {
      if (!r.ok || !r.data) return;
      var changed = false;
      r.data.forEach(function (row) {
        var rt = Date.parse(row.updated_at);
        if (store.pend[row.id] || rt <= (store.mt[row.id] || 0)) return;
        if (row.done_at) store.done[row.id] = Date.parse(row.done_at); else delete store.done[row.id];
        if (row.copied_at) store.copied[row.id] = Date.parse(row.copied_at);
        store.mt[row.id] = rt;
        changed = true;
      });
      if (changed) { save(); render(); }
    }, function () { /* нет сети — живем на локальных */ });
  }
  function signIn(email, pass) {
    sync.msg = 'Вхожу…';
    render();
    return sbFetch('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email, password: pass } }).then(function (r) {
      if (r.ok) { setSess(r.data); sync.msg = ''; adoptLocal(); pushMarks(); pullMarks(); toast('вошел ✓ галочки теперь в базе'); return; }
      var code = r.data && (r.data.error_code || r.data.code || r.data.error);
      if (code === 'email_not_confirmed') { sync.msg = 'Подтверди почту: нажми ссылку в письме от Supabase.'; return; }
      // такого пользователя нет — регистрируем; Supabase пришлет письмо со ссылкой
      return sbFetch('/auth/v1/signup', { method: 'POST', body: { email: email, password: pass } }).then(function (s) {
        if (s.ok && s.data && s.data.access_token) { setSess(s.data); sync.msg = ''; adoptLocal(); pushMarks(); return; }
        var sc = s.data && (s.data.error_code || s.data.code);
        if (s.ok) sync.msg = 'Готово. Пришло письмо от Supabase: нажми ссылку в нем, и вход случится сам.';
        else if (sc === 'user_already_exists') sync.msg = 'Пароль не подошел.';
        else if (sc === 'weak_password') sync.msg = 'Пароль слишком простой: нужно от 6 знаков.';
        else sync.msg = 'Не вышло: ' + ((s.data && (s.data.msg || s.data.message)) || s.status);
      });
    }, function () { sync.msg = 'Нет сети.'; }).then(function () { render(); });
  }
  function signOut() { sess = null; saveSess(); sync.state = 'off'; sync.msg = ''; render(); }
  // ссылка из письма Supabase открывает сайт с #access_token=… — забираем вход и возвращаем вкладку
  (function takeLinkSession() {
    var h = location.hash.slice(1);
    if (h.indexOf('access_token=') < 0) return;
    var p = {};
    h.split('&').forEach(function (kv) { var i = kv.indexOf('='); p[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
    setSess({ access_token: p.access_token, refresh_token: p.refresh_token, expires_in: +p.expires_in || 3600 });
    try { sess.email = JSON.parse(atob(p.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email || ''; saveSess(); } catch (e) { /* без почты */ }
    adoptLocal();
    history.replaceState(null, '', location.pathname + location.search + '#tasks');
  })();
  function renderSync() {
    if (sync.state === 'on') {
      return '<div class="card sync on"><div class="task-title">☁ Галочки в базе</div>' +
        '<div class="task-sub b-sub">«Выложил» и «скопировал» видны на всех устройствах и мне.' + (sess && sess.email ? ' Вошел: ' + esc(sess.email) + '.' : '') + '</div>' +
        (sync.msg ? '<div class="hint t-note">' + esc(sync.msg) + '</div>' : '') +
        '<div class="actions"><button class="btn ghost" type="button" data-sbout>выйти</button></div></div>';
    }
    return '<div class="card sync"><div class="task-title">☁ Галочки только на этом телефоне</div>' +
      '<div class="task-sub b-sub">Войди один раз — будут на всех устройствах, и я буду видеть, что ты выложил. Первый раз придет письмо со ссылкой.</div>' +
      '<form class="task-form" data-sbform>' +
      '<input type="email" name="email" placeholder="почта" autocomplete="username" required>' +
      '<input type="password" name="pass" placeholder="пароль (придумай, от 6 знаков)" autocomplete="current-password" required minlength="6">' +
      (sync.msg ? '<div class="hint t-note">' + esc(sync.msg) + '</div>' : '') +
      '<div class="actions"><button class="btn primary" type="submit">войти</button></div></form></div>';
  }

  var ui = {
    tab: 'tiktok',
    author: null,
    day: null,
    filter: 'все',
    adMood: store.adMood || 'все',
    hideUsed: !!store.hideUsed,
    tgSeg: store.tgSeg || 'osnova',
    vid: { tiktok: { day: null, filter: 'все' }, sad: { day: null, filter: 'все' } }
  };

  // ---------- время: всё считаем по Москве ----------
  function mskNow() {
    var d = new Date();
    return new Date(d.getTime() + (d.getTimezoneOffset() + 180) * 60000);
  }
  function ymd(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parseDate(s) {
    var p = s.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  }
  function shiftDate(s, n) {
    return new Date(parseDate(s).getTime() + n * 864e5).toISOString().slice(0, 10);
  }
  // ночь после полуночи относится к прошлому дню: ролики до 6 утра — это ещё «вчера»
  function contentToday() { return ymd(new Date(mskNow().getTime() - 6 * 3600e3)); }
  function calendarToday() { return ymd(mskNow()); }
  function slotMin(slot) {
    var p = slot.split(':'), h = +p[0], m = +p[1] || 0;
    return h * 60 + m + (h < 12 ? 1440 : 0);
  }
  function nowMin() {
    var n = mskNow(), h = n.getHours();
    return h * 60 + n.getMinutes() + (h < 6 ? 1440 : 0);
  }
  function altTime(slot) {
    var p = slot.split(':');
    return pad((+p[0] + TZ.offsetFromMsk + 24) % 24) + ':' + p[1];
  }
  function dateLong(s) { var d = parseDate(s); return WD_FULL[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
  function dateShort(s) { var d = parseDate(s); return WD[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MON_S[d.getUTCMonth()]; }

  // ---------- мелочи ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function marks(s) { return esc(s).replace(/\[([^\]\n]+)\]/g, '<mark>[$1]</mark>'); }
  function num(n) { return Number(n).toLocaleString('ru-RU'); }
  function plural(n, a, b, c) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return a;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b;
    return c;
  }
  function themeClass(t) {
    t = (t || '').toLowerCase();
    if (t.indexOf('заботлив') >= 0) return 't-care';
    if (t.indexOf('бывш') >= 0) return 't-ex';
    if (t.indexOf('жиза') >= 0) return 't-zhiza';
    if (/семь|школ|детств|мама|папа/.test(t)) return 't-family';
    if (/остывает/.test(t)) return 't-serial';
    if (/признан/.test(t)) return 't-hot';
    return '';
  }

  // тексты для копирования регистрируем при рендере, кнопка хранит только ключ
  var COPY = {};
  var copyN = 0;
  function reg(text) { var k = 'c' + (copyN++); COPY[k] = text; return k; }

  // ---------- копирование ----------
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { ta.setSelectionRange(0, text.length); } catch (e) { /* старые браузеры */ }
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  function openSheet(text) {
    var sheet = document.getElementById('sheet');
    var ta = document.getElementById('sheetText');
    ta.value = text;
    sheet.hidden = false;
    setTimeout(function () { ta.focus(); ta.select(); }, 50);
  }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1500);
  }

  // ---------- шапка ----------
  var heroAnimated = false;
  function renderHero() {
    var n = mskNow();
    document.getElementById('heroDate').textContent = WD[n.getDay()] + ', ' + n.getDate() + ' ' + MON[n.getMonth()];
    var tt = META.tiktok;
    var el = document.getElementById('ttFollowers');
    if (tt && tt.followers) {
      // tt.now — точная цифра с профиля (раз в день), tt.followers/net — история из Studio, отстаёт на 1–2 дня
      var cur = tt.now && tt.now.followers > 0 ? tt.now.followers : tt.followers;
      if (heroAnimated) el.textContent = num(cur);
      else { countUp(el, cur); heroAnimated = true; }
      var sub = '';
      if (tt.now && tt.now.followers > tt.followers) {
        var at = new Date(new Date(tt.now.at).getTime() + 3 * 3600e3);
        sub += '▲ +' + num(tt.now.followers - tt.followers) + ' с ' + parseDate(tt.date).getUTCDate() + ' ' + MON_S[parseDate(tt.date).getUTCMonth()] + ' ' +
          '<small>· ' + at.getUTCDate() + ' ' + MON_S[at.getUTCMonth()] + ' ' + pad(at.getUTCHours()) + ':' + pad(at.getUTCMinutes()) + '</small>';
      } else {
        if (tt.net) sub += '▲ +' + num(tt.net) + ' за день ';
        if (tt.date) sub += '<small>· на ' + parseDate(tt.date).getUTCDate() + ' ' + MON_S[parseDate(tt.date).getUTCMonth()] + '</small>';
      }
      document.getElementById('ttNet').innerHTML = sub;
      renderGoal(Object.assign({}, tt, { followers: cur }));
    }
    var tg = META.tg;
    document.getElementById('tgFollowers').textContent = tg && tg.followers ? num(tg.followers) : '—';
  }
  function renderGoal(tt) {
    var steps = [150000, 200000, 250000, 300000, 400000, 500000, 750000, 1000000];
    var goal = steps.filter(function (s) { return s > tt.followers; })[0];
    if (!goal) return;
    var prev = steps[steps.indexOf(goal) - 1] || 100000;
    if (prev > tt.followers) prev = 100000;
    var pct = Math.max(2, Math.min(100, (tt.followers - prev) / (goal - prev) * 100));
    var left = goal - tt.followers;
    var pace = tt.avg7 || tt.net || 0;
    var eta = pace > 0 ? ' · ~' + Math.ceil(left / pace) + ' ' + plural(Math.ceil(left / pace), 'день', 'дня', 'дней') : '';
    var label = goal >= 1000000 ? '1M' : (goal / 1000) + 'K';
    document.getElementById('goal').innerHTML =
      '<div class="goal-row"><span>до <b>' + label + '</b></span><span>осталось ' + num(left) + eta + '</span></div>' +
      '<div class="bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>';
  }
  function countUp(el, to) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = num(to); return; }
    var from = Math.round(to * 0.94), start = null, dur = 900;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = num(Math.round(from + (to - from) * e));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ---------- общие куски карточки ----------
  function soundRow(mood, prefix) {
    if (!mood) return '';
    var s = SOUNDS[mood] || ['🎧', '', ''];
    return '<div class="sound" style="--sc:' + (s[2] || 'inherit') + '">' +
      '<span class="ico">' + s[0] + '</span>' +
      '<span><span class="lbl">' + (prefix || 'звук') + ':</span> <b>' + esc(mood) + '</b>' +
      (s[1] ? '<span class="desc">' + esc(s[1]) + '</span>' : '') + '</span></div>';
  }
  function captionRow(caption, tags) {
    if (!caption && !tags) return '';
    return '<div class="caption"><span class="lbl">подпись</span>' + esc(caption) +
      (tags ? ' <span class="tags">' + esc(tags) + '</span>' : '') + '</div>';
  }
  function fullCaption(caption, tags) { return [caption, tags].filter(Boolean).join(' '); }
  // главная кнопка: после копирования помнит это, но не двигает карточку
  function copyMain(text, id, what, label) {
    var was = store.copied[id];
    return '<button class="btn primary' + (was ? ' was' : '') + '" type="button" data-copy="' + reg(text) + '" data-item="' + id +
      '" data-what="' + what + '">' + (was ? 'скопировано ✓' : label.replace('скопировать ', '<span class="long">скопировать </span>')) + '</button>';
  }
  function soon() {
    var s = META.soon || [];
    return s.length ? '<div class="soon">скоро тут: <b>' + s.map(esc).join(' · ') + '</b></div>' : '';
  }

  // ---------- TikTok ----------
  function pickDay() {
    if (!DAYS.length) return null;
    var dates = DAYS.map(function (d) { return d.date; });
    if (ui.day && dates.indexOf(ui.day) >= 0) return ui.day;
    var t = contentToday();
    if (dates.indexOf(t) >= 0) return t;
    var future = dates.filter(function (d) { return d > t; });
    return future.length ? future[0] : dates[dates.length - 1];
  }
  function dayTag(date) {
    var t = contentToday();
    if (date === t) return 'сегодня';
    if (date === shiftDate(t, 1)) return 'завтра';
    if (date === shiftDate(t, -1)) return 'вчера';
    return '';
  }

  // следующий слот — только для сегодняшнего дня
  function nextSlotId(day) {
    if (!day || day.date !== contentToday()) return null;
    var nm = nowMin();
    var cand = day.items.filter(function (it) { return it.slot && !store.done[it.id] && slotMin(it.slot) >= nm - 10; })
      .sort(function (a, b) { return slotMin(a.slot) - slotMin(b.slot); })[0];
    return cand ? cand.id : null;
  }

  function renderTiktok() {
    if (!DAYS.length) return '<div class="empty">' + (ui.tab === 'sad' ? 'Грустных' : 'Текстов') + ' пока нет. Скоро подгружу.</div>' + soon();
    var date = pickDay();
    ui.day = date;
    var day = DAYS.filter(function (d) { return d.date === date; })[0];
    var today = contentToday();

    var chips = DAYS.map(function (d) {
      var tag = dayTag(d.date);
      var pd = parseDate(d.date);
      return '<button class="day' + (d.date === date ? ' on' : '') + (d.date < today ? ' past' : '') + '" data-day="' + d.date + '" type="button">' +
        '<span class="wd">' + WD[pd.getUTCDay()] + '</span>' +
        '<span class="dn">' + pd.getUTCDate() + ' ' + MON_S[pd.getUTCMonth()] + '</span>' +
        '<span class="tag">' + (tag || '&nbsp;') + '</span></button>';
    }).join('');

    // темы для фильтра
    var themes = [];
    day.items.forEach(function (it) { if (themes.indexOf(it.theme) < 0) themes.push(it.theme); });
    if (ui.filter !== 'все' && themes.indexOf(ui.filter) < 0) ui.filter = 'все';
    var filters = ['все'].concat(themes).map(function (t) {
      var cnt = t === 'все' ? day.items.length : day.items.filter(function (it) { return it.theme === t; }).length;
      return '<button class="fchip' + (ui.filter === t ? ' on' : '') + '" data-filter="' + esc(t) + '" type="button">' +
        esc(t.toLowerCase()) + '<span class="cnt">' + cnt + '</span></button>';
    }).join('');

    // Дима заливает пачкой и ставит каждому ролику время в Studio (по Астане), поэтому время показываем, «следующий» — нет
    var nextId = null;

    var doneCount = day.items.filter(function (it) { return store.done[it.id]; }).length;
    var items = day.items.filter(function (it) { return ui.filter === 'все' || it.theme === ui.filter; });

    var cards = items.map(function (it) {
      var test = it.test ? '<span class="chip test">' + (/^(тест|тренд|охват|свобод)/i.test(it.test) ? '' : 'тест: ') + esc(it.test) + '</span>' : '';
      var time = it.slot ? '<span class="time">' + altTime(it.slot) + ' <span class="alt">· ' + esc(it.slot) + ' мск</span></span>' : '';
      return '<article class="card' + (store.done[it.id] ? ' done' : '') + (it.id === nextId ? ' next' : '') + (it.hot ? ' hot' : '') + '" data-card="' + it.id + '">' +
        (it.hot ? '<div class="hot-badge">🔥 самое горячее</div>' : '') +
        '<div class="card-top"><span class="num">' + it.n + '</span>' +
        '<span class="chip theme ' + themeClass(it.theme) + '">' + esc(it.theme.toLowerCase()) + '</span>' + test +
        (it.id === nextId ? '<span class="chip next-badge">следующий</span>' : '') + time + '</div>' +
        '<div class="screen" data-copy="' + reg(it.text) + '" data-item="' + it.id + '" data-what="текст">' + esc(it.text) + '</div>' +
        captionRow(it.caption, it.tags) +
        soundRow(it.sound, 'музыка') +
        '<div class="actions">' +
        copyMain(it.text, it.id, 'текст', 'скопировать текст') +
        '<button class="btn" type="button" data-copy="' + reg(fullCaption(it.caption, it.tags)) + '" data-item="' + it.id + '" data-what="подпись">подпись</button>' +
        '<button class="btn toggle" type="button" data-mark="' + it.id + '" aria-pressed="' + !!store.done[it.id] + '" aria-label="выложил">✓</button>' +
        '</div>' +
        (it.why ? '<details class="why"><summary>почему зайдёт</summary><p>' + esc(it.why) + '</p></details>' : '') +
        '</article>';
    }).join('');

    var isSad = ui.tab === 'sad';
    return '<div class="section-title">' + (isSad ? 'Грустное' : 'Мои видео') + '</div>' +
      (isSad ? '<div class="note">Для 15–18: в каждом тексте боль и маленький выход в конце. 🔥 одно признание как «читаю всё» (500 подписок на 100K): 11.11 в 23:10.</div>' : '') +
      '<div class="days-wrap" id="daysWrap"><div class="days" id="days">' + chips + '</div></div>' +
      '<div class="day-head"><div><div class="day-title">' + dateLong(date) + '</div>' +
      '<div class="day-sub">' + day.items.length + ' ' + plural(day.items.length, 'текст', 'текста', 'текстов') + (date >= calendarToday() ? ' · время ставь в Studio' : '') + '</div></div>' +
      '<div class="progress' + (doneCount >= 5 ? ' ok' : '') + '"><b>' + doneCount + '</b><span>выложено</span></div></div>' +
      '<div class="chips filters">' + filters + '</div>' +
      '<div class="list">' + (cards || '<div class="empty">В этой теме пусто</div>') + '</div>' + soon();
  }

  // ---------- реклама ----------
  function renderAds() {
    var items = ADS.items || [];
    var moods = ADS.moods && ADS.moods.length ? ADS.moods : [];
    if (ui.adMood !== 'все' && moods.indexOf(ui.adMood) < 0) ui.adMood = 'все';
    var used = items.filter(function (it) { return store.done[it.id]; }).length;
    var filters = ['все'].concat(moods).map(function (m) {
      var cnt = m === 'все' ? items.length : items.filter(function (it) { return it.mood === m; }).length;
      var ico = SOUNDS[m] ? SOUNDS[m][0] + ' ' : '';
      return '<button class="fchip' + (ui.adMood === m ? ' on' : '') + '" data-mood="' + esc(m) + '" type="button">' + ico + esc(m) + '<span class="cnt">' + cnt + '</span></button>';
    }).join('') +
      '<button class="fchip' + (ui.hideUsed ? ' on' : '') + '" data-hideused="1" type="button">скрыть использованные</button>';

    var list = items.filter(function (it) {
      return (ui.adMood === 'все' || it.mood === ui.adMood) && !(ui.hideUsed && store.done[it.id]);
    });
    var cards = list.map(function (it, i) {
      return '<article class="card' + (store.done[it.id] ? ' done' : '') + '" data-card="' + it.id + '">' +
        '<div class="card-top"><span class="num">' + (i + 1) + '</span>' +
        '<span class="chip theme t-zhiza">реклама</span>' + '</div>' +
        '<div class="screen" data-copy="' + reg(it.text) + '" data-item="' + it.id + '" data-what="текст">' + esc(it.text) + '</div>' +
        captionRow(it.caption, it.tags) +
        soundRow(it.mood, 'под трек') +
        '<div class="actions">' +
        copyMain(it.text, it.id, 'текст', 'скопировать текст') +
        '<button class="btn" type="button" data-copy="' + reg(fullCaption(it.caption, it.tags)) + '" data-item="' + it.id + '" data-what="подпись">подпись</button>' +
        '<button class="btn toggle" type="button" data-mark="' + it.id + '" aria-pressed="' + !!store.done[it.id] + '" aria-label="использовал">✓</button>' +
        '</div></article>';
    }).join('');

    return '<div class="section-title">Рекламные треки</div>' +
      (ADS.note ? '<div class="note">' + esc(ADS.note) + '</div>' : '') +
      '<div class="hint" style="margin-bottom:10px">Выбери настроение трека · использовано ' + used + ' из ' + items.length + '</div>' +
      '<div class="chips filters">' + filters + '</div>' +
      '<div class="list">' + (cards || '<div class="empty">Тут пусто. Сними фильтр или «скрыть использованные».</div>') + '</div>' + soon();
  }

  // ---------- Telegram ----------
  function renderTg() {
    var channels = TG.channels || [];
    var segs = channels.map(function (c) { return [c.key, c.title]; }).concat([['stories', 'Сторис TT']]);
    var today0 = calendarToday();
    // прошлые дни прячем: открыл в понедельник — сверху понедельник
    var pastBtn = function (n) {
      return n ? '<button class="btn wide ghost past-btn" type="button" data-showpast="1">' +
        (ui.showPast ? 'скрыть прошлые' : 'показать прошлые · ' + n) + '</button>' : '';
    };
    var visible = function (x) { return !x.date || x.date >= today0 || ui.showPast; };
    if (!segs.some(function (s) { return s[0] === ui.tgSeg; })) ui.tgSeg = segs[0][0];
    var seg = '<div class="seg">' + segs.map(function (s) {
      return '<button class="' + (ui.tgSeg === s[0] ? 'on' : '') + '" data-seg="' + s[0] + '" type="button">' + esc(s[1]) + '</button>';
    }).join('') + '</div>';

    var body;
    if (ui.tgSeg === 'stories') {
      var allSt = TG.stories || [];
      var pastSt = allSt.filter(function (st) { return st.date && st.date < today0; }).length;
      body = allSt.filter(visible).map(function (st) {
        var slides = st.slides.map(function (sl, i) {
          return '<div class="slide"><span class="slide-n">' + (i + 1) + '</span><div class="slide-body">' +
            '<div class="slide-text" data-copy="' + reg(sl.text) + '" data-what="текст">' + marks(sl.text) + '</div>' +
            (sl.sticker && sl.sticker !== '—' ? '<div class="slide-sticker">стикер: ' + esc(sl.sticker) + '</div>' : '') +
            '</div><button class="btn" type="button" data-copy="' + reg(sl.text) + '" data-what="текст">копия</button></div>';
        }).join('');
        var stToday = st.date === today0;
        return '<article class="card' + (stToday ? ' next' : '') + '"><div class="post-head"><span class="post-date">' +
          (st.date ? dateShort(st.date) + ' · ' : '') + esc(st.title) + '</span>' +
          '<span class="chip rubric">' + st.slides.length + ' ' + plural(st.slides.length, 'сторис', 'сторис', 'сторис') + '</span>' +
          (stToday ? '<span class="chip next-badge">сегодня</span>' : '') + '</div>' +
          '<div class="story-when">' + esc(st.when) + '</div><div class="slides">' + slides + '</div></article>';
      }).join('');
      return '<div class="section-title">Telegram</div>' + seg +
        (TG.storiesNote ? '<div class="note">' + marks(TG.storiesNote) + '</div>' : '') +
        pastBtn(pastSt) + '<div class="list">' + (body || '<div class="empty">Сторис пока нет</div>') + '</div>' + soon();
    }

    var ch = channels.filter(function (c) { return c.key === ui.tgSeg; })[0];
    var today = calendarToday();
    var pastP = (ch.posts || []).filter(function (p) { return p.date && p.date < today; }).length;
    body = (ch.posts || []).filter(visible).map(function (p) {
      var isToday = p.date === today;
      var head = p.date
        ? '<span class="post-date">' + dateShort(p.date) + (p.time ? ' <small>· ' + esc(p.time) + ' мск</small>' : '') + '</span>'
        : '';
      var poll = p.poll ? '<div class="poll"><div class="poll-q"><small>опрос</small>' + esc(p.poll.question) + '</div>' +
        p.poll.options.map(function (o) { return '<div class="poll-opt">' + esc(o) + '</div>'; }).join('') + '</div>' : '';
      var pollBtn = p.poll ? '<button class="btn" type="button" data-copy="' + reg(p.poll.question + '\n' + p.poll.options.join('\n')) + '" data-what="опрос">опрос</button>' : '';
      return '<article class="card' + (store.done[p.id] ? ' done' : '') + (isToday && !store.done[p.id] ? ' next' : '') + '" data-card="' + p.id + '">' +
        '<div class="post-head">' + head + '<span class="chip rubric">' + esc(p.emoji || '') + ' ' + esc(p.rubric) + '</span>' +
        (isToday ? '<span class="chip next-badge">сегодня</span>' : '') + '</div>' +
        '<div class="post-text" data-copy="' + reg(p.text) + '" data-item="' + p.id + '" data-what="пост">' + marks(p.text) + '</div>' + poll +
        '<div class="actions">' + copyMain(p.text, p.id, 'пост', 'скопировать пост') +
        pollBtn +
        '<button class="btn toggle" type="button" data-mark="' + p.id + '" aria-pressed="' + !!store.done[p.id] + '" aria-label="выложил">✓</button></div>' +
        '</article>';
    }).join('');

    return '<div class="section-title">Telegram · <span class="hint">t.me/' + esc(ch.handle) + '</span></div>' + seg +
      (TG.note && ch.key === 'osnova' ? '<div class="note">' + marks(TG.note) + '</div>' : '') +
      (ch.key === 'lichnoe' ? '<div class="note">Идеи на всякий случай. Ведёшь сам, бери что нравится.</div>' : '') +
      pastBtn(pastP) + '<div class="list">' + (body || '<div class="empty">Постов пока нет</div>') + '</div>' + soon();
  }

  // ---------- сводка: правила, готово, не готово, идеи ----------
  // Дима задачи не ведёт (выгорание) — здесь только то, что есть, чего нет и что придумали.
  // details в board.json — HTML, который пишу я сам (data/app/board.json), поэтому вставляется как есть
  function renderBoard() {
    var secs = BOARD.sections || [];
    var items = BOARD.items || [];
    var fresh = shiftDate(calendarToday(), -3);
    var count = function (id) { return items.filter(function (x) { return x.sec === id; }).length; };
    var head = '<div class="section-title">Сводка</div>' +
      '<div class="hint t-note">Коротко — что у нас есть, чего нет и что придумали. Нажми «подробнее», там зачем и почему.' +
      (BOARD.updated ? ' Обновлено ' + esc(dateShort(BOARD.updated)) + '.' : '') + '</div>' + renderSync() +
      '<div class="chips filters">' + secs.map(function (s) {
        return '<a class="fchip" href="#b-' + s.id + '" data-jump="b-' + s.id + '">' + esc(s.title.toLowerCase()) + ' ' + count(s.id) + '</a>';
      }).join('') + '</div>';
    var body = secs.map(function (s) {
      var list = items.filter(function (x) { return x.sec === s.id; });
      if (!list.length) return '';
      list = list.filter(function (x) { return x.hot; }).concat(list.filter(function (x) { return !x.hot; }));
      return '<section class="t-sec" id="b-' + s.id + '">' +
        '<div class="t-sec-head"><h2>' + esc(s.title) + '</h2><span class="hint">' + list.length + '</span></div>' +
        (s.note ? '<div class="hint t-note">' + esc(s.note) + '</div>' : '') +
        '<div class="list">' + list.map(function (x) {
          var isNew = x.date && x.date >= fresh;
          return '<article class="card task k-' + esc(s.id) + (x.hot ? ' hot' : '') + '">' +
            '<div class="task-title">' + esc(x.title) + '</div>' +
            (x.short ? '<div class="task-sub b-sub">' + esc(x.short) + '</div>' : '') +
            '<div class="task-chips b-chips">' + (x.hot ? '<span class="chip hot">🔥 самое горячее</span>' : '') + (isNew ? '<span class="chip k">новое</span>' : '') +
            (x.tag ? '<span class="chip">' + esc(x.tag) + '</span>' : '') + '</div>' +
            (x.details ? '<details class="why b-why"><summary>подробнее</summary><div class="more">' + x.details + '</div></details>' : '') +
            '</article>';
        }).join('') + '</div></section>';
    }).join('');
    return head + body;
  }

  // ---------- вдохновение ----------
  function renderInspo() {
    var authors = INSPO.authors || [];
    var a = ui.author && authors.filter(function (x) { return x.handle === ui.author; })[0];
    if (a) return renderAuthor(a);
    ui.author = null;
    var cards = authors.map(function (x) {
      return '<button class="card author" type="button" data-author="' + esc(x.handle) + '">' +
        '<span class="avatar">' + esc((x.handle[0] || '?').toUpperCase()) + '</span>' +
        '<span class="author-body"><span class="author-name">@' + esc(x.handle) + '</span>' +
        '<span class="hint">' + esc([x.name, x.followers && x.followers + ' подписчиков'].filter(Boolean).join(' · ')) + '</span>' +
        (x.hook ? '<span class="author-hook">' + esc(x.hook) + '</span>' : '') +
        '<span class="task-chips">' + (x.status ? '<span class="chip k">' + esc(x.status) + '</span>' : '') +
        '<span class="chip">' + (x.texts || []).length + ' ' + plural((x.texts || []).length, 'текст', 'текста', 'текстов') + '</span></span>' +
        '</span><span class="author-go" aria-hidden="true">›</span></button>';
    }).join('');
    return '<div class="section-title">Вдохновение</div>' +
      (INSPO.note ? '<div class="note">' + esc(INSPO.note) + '</div>' : '') +
      '<div class="list">' + (cards || '<div class="empty">Кинь мне автора — разберу</div>') + '</div>' +
      '<div class="soon">новый автор: кинь ссылку или ник в чат</div>';
  }
  function renderAuthor(a) {
    var kpis = (a.kpis || []).map(function (k) {
      return '<div class="kpi"><b>' + esc(k[0]) + '</b><small>' + esc(k[1]) + (k[2] ? '<br>' + esc(k[2]) : '') + '</small></div>';
    }).join('');
    var cmp = (a.compare || []).length ? '<div class="tbl-wrap"><table><thead><tr><th></th><th>он</th><th>ты</th></tr></thead><tbody>' +
      a.compare.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' : '';
    var top = (a.top || []).map(function (r) {
      return '<li><div class="views">' + esc(r[0]) + '<small>' + esc(r[1]) + '</small></div><div><div class="q">' + esc(r[2]) + '</div>' +
        '<div class="hint">' + esc(r[3]) + '</div></div></li>';
    }).join('');
    var col = function (cls, title, items) {
      return (items || []).length ? '<div class="col ' + cls + '"><h4>' + title + '</h4><ul>' +
        items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '';
    };
    var texts = (a.texts || []).map(function (it, i) {
      var id = 'inspo-' + a.handle + '-' + (i + 1);
      return '<article class="card' + (store.done[id] ? ' done' : '') + '" data-card="' + id + '">' +
        '<div class="card-top"><span class="num">' + (i + 1) + '</span>' +
        (it.theme ? '<span class="chip theme ' + themeClass(it.theme) + '">' + esc(it.theme.toLowerCase()) + '</span>' : '') + '</div>' +
        '<div class="screen" data-copy="' + reg(it.text) + '" data-item="' + id + '" data-what="текст">' + esc(it.text) + '</div>' +
        captionRow(it.caption, it.tags) + soundRow(it.sound, 'музыка') +
        '<div class="actions">' + copyMain(it.text, id, 'текст', 'скопировать текст') +
        '<button class="btn" type="button" data-copy="' + reg(fullCaption(it.caption, it.tags)) + '" data-item="' + id + '" data-what="подпись">подпись</button>' +
        '<button class="btn toggle" type="button" data-mark="' + id + '" aria-pressed="' + !!store.done[id] + '" aria-label="выложил">✓</button></div>' +
        (it.from ? '<details class="why"><summary>откуда приём</summary><p>' + esc(it.from) + '</p></details>' : '') +
        '</article>';
    }).join('');
    return '<button class="back" type="button" data-back="1">‹ все авторы</button>' +
      '<div class="author-head"><span class="avatar big">' + esc(a.handle[0].toUpperCase()) + '</span><div>' +
      '<div class="section-title" style="margin:0">@' + esc(a.handle) + '</div>' +
      '<div class="hint">' + esc([a.name, a.followers && a.followers + ' подписчиков', a.likes && a.likes + ' лайков'].filter(Boolean).join(' · ')) +
      (a.url ? ' · <a href="' + esc(a.url) + '" target="_blank" rel="noopener">профиль</a>' : '') + '</div>' +
      (a.videos ? '<div class="hint">' + esc(a.videos) + (a.date ? ' · разбор ' + dateShort(a.date) : '') + '</div>' : '') +
      '</div></div>' +
      (a.hook ? '<div class="note"><b>Главное:</b> ' + esc(a.hook) + '</div>' : '') +
      (kpis ? '<div class="kpis">' + kpis + '</div>' : '') + cmp +
      (a.who ? '<h3 class="sub-h">Кто он</h3><p class="hint para">' + esc(a.who) + '</p>' : '') +
      (top ? '<h3 class="sub-h">Топ роликов и на чём держится</h3><ol class="top8">' + top + '</ol>' : '') +
      (a.extra ? '<p class="hint para">' + esc(a.extra) + '</p>' : '') +
      ((a.take || a.skip) ? '<div class="cols">' + col('yes', 'Берём', a.take) + col('no', 'Не берём', a.skip) + '</div>' : '') +
      '<h3 class="sub-h">Мои тексты по нему</h3>' +
      (texts ? '<div class="list">' + texts + '</div>' : '<div class="empty">' + esc(a.textsNote || 'Текстов пока нет') + '</div>');
  }

  // ---------- рендер ----------
  var view = document.getElementById('view');
  function render() {
    COPY = {};
    copyN = 0;
    var daysEl = document.getElementById('days');
    var keepScroll = daysEl ? daysEl.scrollLeft : null;
    DAYS = ui.tab === 'sad' ? SAD : VIDEO;
    var html = ui.tab === 'tg' ? renderTg() : ui.tab === 'tasks' ? renderBoard() :
      ui.tab === 'inspo' ? renderInspo() : renderTiktok();
    view.innerHTML = html;
    document.querySelectorAll('.tab').forEach(function (b) {
      var on = b.getAttribute('data-tab') === ui.tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    daysEl = document.getElementById('days');
    if (daysEl) {
      if (keepScroll !== null) daysEl.scrollLeft = keepScroll;
      centerDay(keepScroll === null);
    }
    onScroll();
  }
  function centerDay(instant) {
    var daysEl = document.getElementById('days');
    var on = daysEl && daysEl.querySelector('.day.on');
    if (!on) return;
    var target = on.offsetLeft - (daysEl.clientWidth - on.offsetWidth) / 2;
    if (instant) {
      daysEl.style.scrollBehavior = 'auto';
      daysEl.scrollLeft = target;
      daysEl.style.scrollBehavior = '';
    } else {
      daysEl.scrollLeft = target;
    }
  }
  function scrollToList() {
    var wrap = document.getElementById('daysWrap');
    if (!wrap) return;
    var top = wrap.getBoundingClientRect().top + window.pageYOffset;
    if (window.pageYOffset > top) window.scrollTo(0, top);
  }

  // ---------- события ----------
  function setTab(tab) {
    if (TABS.indexOf(tab) < 0) tab = 'tiktok';
    if (tab !== 'inspo') ui.author = null;
    var changed = ui.tab !== tab;
    // у «Видео» и «Грустного» свой выбранный день и фильтр
    if (ui.vid[ui.tab]) ui.vid[ui.tab] = { day: ui.day, filter: ui.filter };
    if (changed && ui.vid[tab]) { ui.day = ui.vid[tab].day; ui.filter = ui.vid[tab].filter; }
    ui.tab = tab;
    store.tab = tab;
    save();
    render();
    if (changed) window.scrollTo(0, 0);
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab],[data-copy],[data-mark],[data-day],[data-filter],[data-mood],[data-hideused],[data-seg],[data-author],[data-back],[data-jump],[data-showpast],[data-sbout],' +
      '[data-tedit],[data-tnew],[data-tsave],[data-tcancel],[data-tdel]');
    if (!t) return;

    if (t.matches('[data-tedit],[data-tnew],[data-tsave],[data-tcancel],[data-tdel]')) { taskAction(t); return; }

    if (t.hasAttribute('data-author')) { ui.author = t.getAttribute('data-author'); render(); window.scrollTo(0, 0); return; }
    if (t.hasAttribute('data-back')) { ui.author = null; render(); window.scrollTo(0, 0); return; }
    if (t.hasAttribute('data-jump')) {
      // якорь без смены hash: hash у нас — это вкладка
      e.preventDefault();
      var sec = document.getElementById(t.getAttribute('data-jump'));
      if (sec) window.scrollTo(0, sec.getBoundingClientRect().top + window.pageYOffset - 10);
      return;
    }

    if (t.hasAttribute('data-tab')) {
      var tab = t.getAttribute('data-tab');
      if (location.hash !== '#' + tab) location.hash = tab;
      else { setTab(tab); window.scrollTo(0, 0); }
      return;
    }
    if (t.hasAttribute('data-copy')) {
      // не мешаем выделять текст вручную
      var sel = window.getSelection && String(window.getSelection());
      if (sel && t.contains(window.getSelection().anchorNode) && !t.matches('button')) return;
      var text = COPY[t.getAttribute('data-copy')];
      if (text == null) return;
      var item = t.getAttribute('data-item');
      var what = t.getAttribute('data-what') || 'текст';
      copyText(text).then(function (ok) {
        if (!ok) { openSheet(text); return; }
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) { /* нет вибро */ } }
        toast((what === 'подпись' ? 'подпись' : what) + ' скопирован' + (what === 'подпись' ? 'а' : '') + ' ✓');
        if (item && what !== 'подпись' && !store.copied[item]) {
          store.copied[item] = Date.now();
          markChanged(item);
          markCopied(item);
        }
      });
      return;
    }
    if (t.hasAttribute('data-mark')) {
      var id = t.getAttribute('data-mark');
      if (store.done[id]) delete store.done[id];
      else store.done[id] = Date.now();
      markChanged(id);
      render();
      return;
    }
    if (t.hasAttribute('data-day')) {
      ui.day = t.getAttribute('data-day');
      ui.filter = 'все';
      render();
      centerDay(false);
      scrollToList();
      return;
    }
    if (t.hasAttribute('data-filter')) { ui.filter = t.getAttribute('data-filter'); render(); scrollToList(); return; }
    if (t.hasAttribute('data-mood')) { ui.adMood = t.getAttribute('data-mood'); store.adMood = ui.adMood; save(); render(); return; }
    if (t.hasAttribute('data-hideused')) { ui.hideUsed = !ui.hideUsed; store.hideUsed = ui.hideUsed; save(); render(); return; }
    if (t.hasAttribute('data-seg')) { ui.tgSeg = t.getAttribute('data-seg'); store.tgSeg = ui.tgSeg; save(); render(); return; }
    if (t.hasAttribute('data-sbout')) { signOut(); return; }
    if (t.hasAttribute('data-showpast')) { ui.showPast = !ui.showPast; render(); return; }
  });

  function taskAction(t) {
    var y = window.pageYOffset;
    if (t.hasAttribute('data-tedit')) ui.editTask = t.getAttribute('data-tedit');
    else if (t.hasAttribute('data-tnew')) { ui.editTask = 'new'; y = 0; }
    else if (t.hasAttribute('data-tcancel')) ui.editTask = null;
    else if (t.hasAttribute('data-tsave')) {
      var form = t.closest('[data-tform]');
      var id = t.getAttribute('data-tsave');
      var v = {
        title: form.querySelector('.tf-title').value.trim(),
        sub: form.querySelector('.tf-sub').value.trim(),
        section: form.querySelector('.tf-sec').value
      };
      if (!v.title) { toast('напиши, что сделать'); return; }
      var mine = tedit.added.filter(function (x) { return x.id === id; })[0];
      if (id === 'new') tedit.added.push(Object.assign({ id: 'my-' + Date.now().toString(36), owner: 'dima', chips: ['моё'] }, v));
      else if (mine) Object.assign(mine, v);
      else tedit.edits[id] = v;
      saveEdits();
      ui.editTask = null;
      toast('сохранено ✓');
    } else if (t.hasAttribute('data-tdel')) {
      var did = t.getAttribute('data-tdel');
      if (!window.confirm('Удалить задачу?')) return;
      var before = tedit.added.length;
      tedit.added = tedit.added.filter(function (x) { return x.id !== did; });
      if (tedit.added.length === before) tedit.removed[did] = Date.now();
      delete tdone[did];
      saveEdits();
      saveTasks();
      ui.editTask = null;
      toast('удалено');
    }
    render();
    window.scrollTo(0, y);
    var f = document.querySelector('[data-tform] .tf-title');
    if (f && (t.hasAttribute('data-tedit') || t.hasAttribute('data-tnew'))) f.focus();
  }

  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-sbform]');
    if (!f) return;
    e.preventDefault();
    signIn(f.elements.email.value.trim(), f.elements.pass.value);
  });

  document.addEventListener('change', function (e) {
    var id = e.target.getAttribute && e.target.getAttribute('data-task');
    if (!id) return;
    if (e.target.checked) tdone[id] = Date.now(); else delete tdone[id];
    saveTasks();
    var y = window.pageYOffset;
    render();
    window.scrollTo(0, y);
    if (e.target.checked) toast('готово ✓');
  });

  function markCopied(id) {
    var btn = view.querySelector('[data-card="' + id + '"] .btn.primary');
    if (!btn) return;
    btn.classList.add('was');
    btn.textContent = 'скопировано ✓';
  }

  document.getElementById('sheetClose').addEventListener('click', function () { document.getElementById('sheet').hidden = true; });
  document.getElementById('sheet').addEventListener('click', function (e) { if (e.target.id === 'sheet') e.currentTarget.hidden = true; });

  var ticking = false;
  function onScroll() {
    var wrap = document.getElementById('daysWrap');
    if (wrap) wrap.classList.toggle('stuck', wrap.getBoundingClientRect().top <= 0);
  }
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; onScroll(); });
  }, { passive: true });

  window.addEventListener('hashchange', function () { setTab(location.hash.slice(1)); });

  // приложение долго открыто: обновляем «сегодня», дату и следующий ролик
  var lastDay = contentToday();
  var lastSig = '';
  function timeSig() {
    var day = DAYS.filter(function (d) { return d.date === ui.day; })[0];
    return contentToday() + '|' + calendarToday() + '|' + nextSlotId(day);
  }
  function refreshTime(force) {
    if (contentToday() !== lastDay) {
      lastDay = contentToday();
      ui.day = null;
      ui.vid.tiktok.day = ui.vid.sad.day = null;
    }
    var sig = timeSig();
    if (!force && sig === lastSig) return;
    lastSig = sig;
    renderHero();
    render();
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { refreshTime(false); pullMarks(); pushMarks(); }
  });
  setInterval(function () {
    if (document.visibilityState === 'visible') refreshTime(false);
  }, 60000);

  renderHero();
  var initial = location.hash.slice(1) || store.tab || 'tiktok';
  ui.tab = TABS.indexOf(initial) >= 0 ? initial : 'tiktok';
  render();
  lastSig = timeSig();
  pullMarks();
  pushMarks();
})();
