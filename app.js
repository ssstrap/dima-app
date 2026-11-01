(function () {
  'use strict';

  var D = window.DIMA || {};
  var META = D.meta || {};
  var DAYS = D.tiktok || [];
  var ADS = D.ads || { items: [], moods: [] };
  var TG = D.tg || { channels: [], stories: [] };
  var TASKS = D.tasks || { sections: [], tasks: [] };
  var INSPO = D.inspo || { authors: [] };
  var TZ = META.tz || { label: 'Астана', offsetFromMsk: 2 };
  var TABS = ['tasks', 'inspo', 'tiktok', 'ads', 'tg'];

  var SOUNDS = {
    'заботливый': ['🤍', 'тёплый, спокойный', '#ffb36b'],
    'нежный': ['🌙', 'тихий, мягкий', '#f9a8d4'],
    'грустный': ['🌧', 'медленный, пиано', '#7aa7ff'],
    'весёлый': ['☀️', 'лёгкий, бодрый', '#ffd84d'],
    'тревожный': ['⚡', 'напряжённый, с паузой', '#ff7b7b'],
    'ностальгия': ['📼', 'старый хит, ламповый', '#c9a8ff'],
    'дерзкий': ['🔥', 'уверенный бит', '#ff8a3d'],
    'клубный': ['🪩', 'бит, дубайский вайб', '#ff4f9a'],
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

  var ui = {
    tab: 'tiktok',
    author: null,
    day: null,
    filter: 'все',
    adMood: store.adMood || 'все',
    hideUsed: !!store.hideUsed,
    tgSeg: store.tgSeg || 'osnova'
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
      if (heroAnimated) el.textContent = num(tt.followers);
      else { countUp(el, tt.followers); heroAnimated = true; }
      var sub = '';
      if (tt.net) sub += '▲ +' + num(tt.net) + ' за день ';
      if (tt.date) sub += '<small>· на ' + parseDate(tt.date).getUTCDate() + ' ' + MON_S[parseDate(tt.date).getUTCMonth()] + '</small>';
      document.getElementById('ttNet').innerHTML = sub;
      renderGoal(tt);
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
    if (!DAYS.length) return '<div class="empty">Текстов пока нет. Скоро подгружу.</div>' + soon();
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

    var nextId = nextSlotId(day);

    var doneCount = day.items.filter(function (it) { return store.done[it.id]; }).length;
    var items = day.items.filter(function (it) { return ui.filter === 'все' || it.theme === ui.filter; });

    var cards = items.map(function (it) {
      var test = it.test ? '<span class="chip test">' + (/^(тест|тренд|охват|свобод)/i.test(it.test) ? '' : 'тест: ') + esc(it.test) + '</span>' : '';
      var time = it.slot ? '<span class="time">' + esc(it.slot) + ' <small>мск</small> <span class="alt">· ' + altTime(it.slot) + ' <small>' + esc(TZ.label.toLowerCase()) + '</small></span></span>' : '';
      return '<article class="card' + (store.done[it.id] ? ' done' : '') + (it.id === nextId ? ' next' : '') + '" data-card="' + it.id + '">' +
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

    return '<div class="section-title">Мои видео</div>' +
      '<div class="days-wrap" id="daysWrap"><div class="days" id="days">' + chips + '</div></div>' +
      '<div class="day-head"><div><div class="day-title">' + dateLong(date) + '</div>' +
      '<div class="day-sub">' + day.items.length + ' ' + plural(day.items.length, 'текст', 'текста', 'текстов') + ' · бери 5–7 · с 18:00 до 6:00 мск, раз в 40 мин</div></div>' +
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
    var segs = channels.map(function (c) { return [c.key, c.title]; }).concat([['stories', 'Сторис']]);
    if (!segs.some(function (s) { return s[0] === ui.tgSeg; })) ui.tgSeg = segs[0][0];
    var seg = '<div class="seg">' + segs.map(function (s) {
      return '<button class="' + (ui.tgSeg === s[0] ? 'on' : '') + '" data-seg="' + s[0] + '" type="button">' + esc(s[1]) + '</button>';
    }).join('') + '</div>';

    var body;
    if (ui.tgSeg === 'stories') {
      body = (TG.stories || []).map(function (st) {
        var slides = st.slides.map(function (sl, i) {
          return '<div class="slide"><span class="slide-n">' + (i + 1) + '</span><div class="slide-body">' +
            '<div class="slide-text" data-copy="' + reg(sl.text) + '" data-what="текст">' + marks(sl.text) + '</div>' +
            (sl.sticker && sl.sticker !== '—' ? '<div class="slide-sticker">стикер: ' + esc(sl.sticker) + '</div>' : '') +
            '</div><button class="btn" type="button" data-copy="' + reg(sl.text) + '" data-what="текст">копия</button></div>';
        }).join('');
        return '<article class="card"><div class="post-head"><span class="post-date">' + esc(st.title) + '</span>' +
          '<span class="chip rubric">' + st.slides.length + ' ' + plural(st.slides.length, 'сторис', 'сторис', 'сторис') + '</span></div>' +
          '<div class="story-when">' + esc(st.when) + '</div><div class="slides">' + slides + '</div></article>';
      }).join('');
      return '<div class="section-title">Telegram</div>' + seg + '<div class="list">' + (body || '<div class="empty">Сторис пока нет</div>') + '</div>' + soon();
    }

    var ch = channels.filter(function (c) { return c.key === ui.tgSeg; })[0];
    var today = calendarToday();
    body = (ch.posts || []).map(function (p) {
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
      (TG.note ? '<div class="note">' + marks(TG.note) + '</div>' : '') +
      '<div class="list">' + (body || '<div class="empty">Постов пока нет</div>') + '</div>' + soon();
  }

  // ---------- задачи ----------
  // details в tasks.json — HTML, который пишу я сам (data/app/tasks.json), поэтому вставляется как есть
  function renderTasks() {
    var all = TASKS.tasks || [];
    if (!all.length) return '<div class="section-title">Задачи</div><div class="empty">Задач пока нет</div>';
    var done = all.filter(function (t) { return tdone[t.id]; }).length;
    var head = '<div class="section-title">Задачи</div>' +
      '<div class="t-progress"><div class="goal-row"><span>сделано</span><span><b>' + done + '</b> из ' + all.length + '</span></div>' +
      '<div class="bar"><i style="width:' + (done / all.length * 100).toFixed(1) + '%"></i></div></div>' +
      '<div class="chips filters">' + (TASKS.sections || []).map(function (s) {
        return '<a class="fchip" href="#t-' + s.id + '" data-jump="t-' + s.id + '">' + esc(s.title.toLowerCase()) + '</a>';
      }).join('') + '</div>';
    var body = (TASKS.sections || []).map(function (s) {
      var list = all.filter(function (t) { return t.section === s.id; });
      if (!list.length) return '';
      var left = list.filter(function (t) { return !tdone[t.id]; }).length;
      return '<section class="t-sec" id="t-' + s.id + '">' +
        '<div class="t-sec-head"><h2>' + esc(s.title) + '</h2><span class="hint">' + (left ? 'осталось ' + left : 'всё сделано') + '</span></div>' +
        (s.note ? '<div class="hint t-note">' + esc(s.note) + '</div>' : '') +
        '<div class="list">' + list.map(function (t) {
          var on = !!tdone[t.id];
          return '<article class="card task k-' + s.id + (on ? ' done' : '') + '">' +
            '<label class="task-row"><input type="checkbox" class="task-check" data-task="' + esc(t.id) + '"' + (on ? ' checked' : '') +
            ' aria-label="' + (s.id === 'look' ? 'прочитано' : 'сделано') + '">' +
            '<span class="task-title">' + esc(t.title) + '</span></label>' +
            (t.sub ? '<div class="task-sub">' + esc(t.sub) + '</div>' : '') +
            ((t.chips || []).length ? '<div class="task-chips">' + t.chips.map(function (c, i) {
              return '<span class="chip' + (i ? '' : ' k') + '">' + esc(c) + '</span>';
            }).join('') + '</div>' : '') +
            (t.details ? '<details class="why"><summary>подробнее</summary><div class="more">' + t.details + '</div></details>' : '') +
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
    var html = ui.tab === 'ads' ? renderAds() : ui.tab === 'tg' ? renderTg() : ui.tab === 'tasks' ? renderTasks() :
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
    ui.tab = tab;
    store.tab = tab;
    save();
    render();
    if (changed) window.scrollTo(0, 0);
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab],[data-copy],[data-mark],[data-day],[data-filter],[data-mood],[data-hideused],[data-seg],[data-author],[data-back],[data-jump]');
    if (!t) return;

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
          save();
          markCopied(item);
        }
      });
      return;
    }
    if (t.hasAttribute('data-mark')) {
      var id = t.getAttribute('data-mark');
      if (store.done[id]) delete store.done[id];
      else store.done[id] = Date.now();
      save();
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
    }
    var sig = timeSig();
    if (!force && sig === lastSig) return;
    lastSig = sig;
    renderHero();
    render();
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') refreshTime(false);
  });
  setInterval(function () {
    if (document.visibilityState === 'visible') refreshTime(false);
  }, 60000);

  renderHero();
  var initial = location.hash.slice(1) || store.tab || 'tiktok';
  ui.tab = TABS.indexOf(initial) >= 0 ? initial : 'tiktok';
  render();
  lastSig = timeSig();
})();
