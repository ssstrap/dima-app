/* «понимать её» — минутные уроки. ванильный JS, прогресс в localStorage (dimaPonimat.v1). */
(function () {
  'use strict';

  var P = window.PONIMAT || { modules: [], glossary: [], sources: [] };
  var KEY = 'dimaPonimat.v1';
  var INTERVALS = [1, 3, 7, 14, 30]; // дни до повторения по «коробкам»
  var view = document.getElementById('view');

  // ---------- данные ----------
  var ALL = [];
  var BY_ID = {};
  P.modules.forEach(function (m, mi) {
    m.lessons.forEach(function (l, li) {
      l._m = m; l._mi = mi; l._li = li;
      ALL.push(l); BY_ID[l.id] = l;
    });
  });

  // ---------- хранилище ----------
  var mem = null;
  function blank() { return { v: 1, done: {}, days: [] }; }
  function load() {
    if (mem) return mem;
    var s = null;
    try { s = JSON.parse(window.localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    if (!s || typeof s !== 'object' || !s.done) s = blank();
    if (!Array.isArray(s.days)) s.days = [];
    mem = s;
    return s;
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* приватный режим — живём в памяти */ }
  }

  // ---------- даты ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return ymd(new Date()); }
  function addDays(str, n) {
    var p = str.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + n);
    return ymd(d);
  }
  function markActive() {
    var s = load(), t = today();
    if (s.days.indexOf(t) === -1) { s.days.push(t); if (s.days.length > 400) s.days = s.days.slice(-400); }
  }
  function streak() {
    var s = load(), set = {};
    s.days.forEach(function (d) { set[d] = 1; });
    var d = today();
    if (!set[d]) d = addDays(d, -1); // стрик живёт, пока сегодня ещё не прошёл
    var n = 0;
    while (set[d]) { n++; d = addDays(d, -1); }
    return n;
  }
  function doneToday() { return load().days.indexOf(today()) !== -1; }

  // ---------- прогресс ----------
  function isDone(id) { return !!load().done[id]; }
  function doneCount(m) {
    var list = m ? m.lessons : ALL;
    return list.filter(function (l) { return isDone(l.id); }).length;
  }
  function dueList() {
    var s = load(), t = today();
    return ALL.filter(function (l) { var r = s.done[l.id]; return r && r.due && r.due <= t; });
  }
  function lessonOfDay() {
    for (var i = 0; i < ALL.length; i++) if (!isDone(ALL[i].id)) return ALL[i];
    // всё пройдено — крутим по дню года
    var d = new Date(), start = new Date(d.getFullYear(), 0, 0);
    var idx = Math.floor((d - start) / 864e5) % ALL.length;
    return ALL[idx];
  }
  function nextAfter(l) {
    var i = ALL.indexOf(l);
    for (var k = 1; k <= ALL.length; k++) {
      var c = ALL[(i + k) % ALL.length];
      if (!isDone(c.id)) return c;
    }
    return ALL[(i + 1) % ALL.length];
  }
  function completeLesson(l, firstOk) {
    var s = load(), t = today(), prev = s.done[l.id];
    if (!prev) s.done[l.id] = { d: t, box: firstOk ? 1 : 0, due: addDays(t, firstOk ? INTERVALS[1] : INTERVALS[0]) };
    else prev.last = t;
    markActive();
    save();
  }
  function reviewAnswer(l, ok) {
    var s = load(), r = s.done[l.id], t = today();
    if (!r) return;
    r.box = ok ? Math.min((r.box || 0) + 1, INTERVALS.length - 1) : 0;
    r.due = addDays(t, INTERVALS[r.box]);
    markActive();
    save();
  }

  // ---------- утилиты ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function plural(n, one, few, many) {
    var a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return one;
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
    return many;
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  function copy(text) {
    function done(ok) {
      if (ok) { toast('скопировано'); return; }
      var sh = document.getElementById('sheet');
      document.getElementById('sheetText').value = text;
      sh.hidden = false;
      setTimeout(function () { var t = document.getElementById('sheetText'); t.focus(); t.select(); }, 50);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(legacyCopy(text)); });
    } else {
      done(legacyCopy(text));
    }
  }
  document.getElementById('sheetClose').addEventListener('click', function () { document.getElementById('sheet').hidden = true; });

  function setTab(name) {
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i].getAttribute('data-go') === name);
    var n = dueList().length, b = document.getElementById('dueBadge');
    b.hidden = !n; b.textContent = n;
  }
  function lessonMinutes(l) { return l.cards.length + 3 > 7 ? '~2 мин' : '~1 мин'; }

  // ---------- главная ----------
  function renderHome() {
    document.body.classList.remove('in-lesson');
    setTab('home');
    var l = lessonOfDay(), st = streak(), due = dueList().length, total = ALL.length, dc = doneCount();
    var allDone = dc === total;
    var h = '';
    h += '<div class="top"><a class="back" href="index.html">← приложение</a><span class="hint">' + esc(doneToday() ? 'сегодня уже было ✓' : 'одна минута в день') + '</span></div>';
    h += '<div class="logo">понимать <span>её</span></div>';
    h += '<div class="stats">';
    h += '<div class="stat fire"><b>🔥 ' + st + '</b><span>' + plural(st, 'день', 'дня', 'дней') + ' подряд</span></div>';
    h += '<div class="stat"><b>' + dc + '/' + total + '</b><span>уроков</span></div>';
    h += '<div class="stat"><b>' + due + '</b><span>на повтор</span></div>';
    h += '</div>';

    h += '<div class="today">';
    h += '<div class="lbl">' + (allDone ? 'освежить' : (isDone(l.id) ? 'повторить' : 'урок дня')) + ' · ' + esc(l._m.icon) + ' ' + esc(l._m.title) + '</div>';
    h += '<h2>' + esc(l.title) + '</h2>';
    h += '<p>' + l.cards.length + ' ' + plural(l.cards.length, 'карточка', 'карточки', 'карточек') + ' · ситуация · текст для ролика · ' + lessonMinutes(l) + '</p>';
    h += '<button class="btn primary wide" type="button" data-lesson="' + esc(l.id) + '">начать</button>';
    h += '</div>';

    if (due) {
      h += '<button class="review" type="button" data-go="review"><span class="ico">🔁</span><span><b>повторить ' + due + ' ' + plural(due, 'ситуацию', 'ситуации', 'ситуаций') + '</b>';
      h += '<span>интервальные повторения: чтобы не забылось через неделю</span></span></button>';
    }

    h += '<div class="section-title">модули</div><div class="mods">';
    P.modules.forEach(function (m) {
      var c = doneCount(m), n = m.lessons.length;
      h += '<button class="mod' + (c === n ? ' full' : '') + '" type="button" data-mod="' + esc(m.id) + '">';
      h += '<span class="ico">' + esc(m.icon) + '</span><span class="body"><span class="t">' + esc(m.title) + '</span>';
      h += '<span class="s">' + esc(m.sub) + '</span><span class="bar"><i style="width:' + Math.round(c / n * 100) + '%"></i></span></span>';
      h += '<span class="cnt">' + c + '/' + n + '</span></button>';
    });
    h += '</div>';

    h += '<details class="src"><summary>откуда это</summary><ul>';
    P.sources.forEach(function (s) {
      h += '<li>' + (s.url ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.t) + '</a>' : esc(s.t)) + '</li>';
    });
    h += '</ul><p>цель — понимать и уважать, а не «управлять». никакого пикапа.</p></details>';
    view.innerHTML = h;
    window.scrollTo(0, 0);
  }

  // ---------- модуль ----------
  function renderModule(id) {
    var m = null;
    P.modules.forEach(function (x) { if (x.id === id) m = x; });
    if (!m) { go('home'); return; }
    document.body.classList.remove('in-lesson');
    setTab('home');
    var c = doneCount(m), n = m.lessons.length;
    var h = '<div class="top"><a class="back" href="#home">← модули</a><span class="hint">' + c + '/' + n + ' пройдено</span></div>';
    h += '<div class="mod-head"><div style="font-size:30px">' + esc(m.icon) + '</div><h1>' + esc(m.title) + '</h1><div class="hint">' + esc(m.sub) + '</div>';
    h += '<div class="bar"><i style="width:' + Math.round(c / n * 100) + '%"></i></div></div>';
    h += '<div class="lessons">';
    m.lessons.forEach(function (l, i) {
      var d = isDone(l.id);
      h += '<button class="les' + (d ? ' done' : '') + '" type="button" data-lesson="' + esc(l.id) + '">';
      h += '<span class="n">' + (d ? '✓' : (i + 1)) + '</span><span class="t">' + esc(l.title) + '</span><span class="m">' + lessonMinutes(l) + '</span></button>';
    });
    h += '</div>';
    view.innerHTML = h;
    window.scrollTo(0, 0);
  }

  // ---------- урок ----------
  var L = null; // состояние открытого урока

  function startLesson(id) {
    var l = BY_ID[id];
    if (!l) { go('home'); return; }
    var steps = [];
    l.cards.forEach(function (c, i) { steps.push({ type: 'card', text: c, i: i }); });
    steps.push({ type: 'q' });
    steps.push({ type: 'tip' });
    steps.push({ type: 'end' });
    L = { l: l, steps: steps, i: 0, answer: null, firstOk: null, saved: false, dir: 1 };
    document.body.classList.add('in-lesson');
    renderStep();
  }

  function canNext() {
    var st = L.steps[L.i];
    return !(st.type === 'q' && L.answer === null);
  }

  function renderStep() {
    var l = L.l, st = L.steps[L.i], h = '';
    var progSteps = L.steps.length - 1; // финал без сегмента
    h += '<div class="player"><div class="p-top"><button class="x" type="button" data-act="close" aria-label="закрыть">✕</button><div class="segs">';
    for (var k = 0; k < progSteps; k++) h += '<i class="' + (k <= L.i ? 'on' : '') + '"></i>';
    h += '</div></div>';
    h += '<div class="p-title">' + esc(l._m.icon + ' ' + l.title) + '</div>';
    h += '<div class="stage" id="stage">';

    var anim = L.dir < 0 ? ' back-anim' : '';
    if (st.type === 'card') {
      h += '<div class="p-card' + anim + '"><div class="kicker">' + (st.i + 1) + ' из ' + l.cards.length + '</div><div class="big">' + esc(st.text) + '</div></div>';
      if (L.i === 0) h += '<div class="swipe-hint">листай влево или жми «дальше»</div>';
    } else if (st.type === 'q') {
      h += renderQuestion(l.q, L.answer, 'p-card left' + anim);
    } else if (st.type === 'tip') {
      var t = l.tip;
      h += '<div class="p-card left' + anim + '"><div class="kicker">фишка для текста</div>';
      h += '<div class="idea">' + esc(t.idea) + '</div>';
      h += '<div class="screen">' + esc(t.lines.join('\n')) + '</div>';
      h += '<div class="cap"><span class="l">эпилог</span>' + esc(t.cap) + '</div>';
      h += '<div class="row" style="margin-top:12px"><button class="btn wide" type="button" data-act="copy">скопировать текст для ролика</button></div></div>';
    } else {
      if (!L.saved) { completeLesson(l, L.firstOk === true); L.saved = true; }
      var s = streak(), nx = nextAfter(l);
      h += '<div class="p-card finish' + anim + '"><div class="emoji">' + (L.firstOk ? '🎯' : '💚') + '</div>';
      h += '<h2>урок пройден</h2>';
      h += '<p>' + (L.firstOk ? 'ситуацию решил с первого раза' : 'ситуация вернётся завтра в повторе') + '</p>';
      h += '<p class="streak">🔥 ' + s + ' ' + plural(s, 'день', 'дня', 'дней') + ' подряд</p>';
      h += '<p class="hint" style="margin-top:10px">всего ' + doneCount() + ' из ' + ALL.length + '</p></div>';
    }
    h += '</div>';

    h += '<div class="p-nav">';
    if (st.type === 'end') {
      h += '<div class="row"><button class="btn" type="button" data-act="home">к модулям</button>';
      h += '<button class="btn primary" type="button" data-lesson="' + esc(nextAfter(l).id) + '">следующий урок</button></div>';
    } else {
      h += '<div class="row">';
      if (L.i > 0) h += '<button class="btn small ghost" type="button" data-act="prev" aria-label="назад">←</button>';
      h += '<button class="btn primary" type="button" data-act="next"' + (canNext() ? '' : ' disabled') + '>' + (st.type === 'tip' ? 'завершить урок' : (st.type === 'q' && L.answer === null ? 'выбери ответ' : 'дальше')) + '</button></div>';
    }
    h += '</div></div>';
    view.innerHTML = h;
    window.scrollTo(0, 0);
    bindSwipe(document.getElementById('stage'));
  }

  function renderQuestion(q, answer, cls) {
    var h = '<div class="' + cls + (answer !== null ? ' answered' : '') + '"><div class="kicker">ситуация</div>';
    h += '<div class="sit">' + esc(q.s) + '</div><div class="opts">';
    q.o.forEach(function (o, i) {
      var c = '';
      if (answer !== null) { if (o.ok) c = ' good'; else if (i === answer) c = ' wrong'; }
      h += '<button class="opt' + c + '" type="button" data-opt="' + i + '"' + (answer !== null ? ' tabindex="-1"' : '') + '>' + esc(o.t) + '<span class="why">' + esc(o.why) + '</span></button>';
    });
    h += '</div>';
    if (answer !== null) {
      var ok = q.o[answer] && q.o[answer].ok;
      h += '<div class="verdict ' + (ok ? 'ok' : 'no') + '">' + (ok ? 'точно. так и надо' : 'не совсем — смотри, почему зелёный лучше') + '</div>';
    }
    h += '</div>';
    return h;
  }

  function step(d) {
    if (!L) return;
    if (d > 0 && !canNext()) return;
    var ni = L.i + d;
    if (ni < 0 || ni >= L.steps.length) return;
    if (L.steps[L.i].type === 'end') return;
    L.dir = d; L.i = ni;
    renderStep();
  }

  // свайп
  function bindSwipe(el) {
    if (!el) return;
    var x0 = null, y0 = null;
    el.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY;
    }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      if (dx < 0) { if (L && L.r) reviewNext(); else step(1); } else if (L && !L.r) step(-1);
    }, { passive: true });
  }

  // ---------- повторение ----------
  function startReview() {
    document.body.classList.add('in-lesson');
    setTab('review');
    var due = shuffle(dueList()).slice(0, 5);
    if (!due.length) { renderNoReview(); return; }
    L = { r: true, list: due, i: 0, answer: null, ok: 0, order: null };
    renderReview();
  }
  function renderNoReview() {
    document.body.classList.remove('in-lesson');
    L = null;
    var n = doneCount();
    var h = '<div class="top"><a class="back" href="index.html">← приложение</a></div>';
    h += '<div class="logo">повтор<span>ение</span></div>';
    h += '<div class="p-card finish" style="min-height:260px"><div class="emoji">🌿</div><h2>' + (n ? 'на сегодня всё' : 'пока нечего повторять') + '</h2>';
    h += '<p>' + (n ? 'ситуации из пройденных уроков вернутся через 1, 3, 7, 14 и 30 дней — так они остаются в голове.' : 'пройди первый урок — его ситуация появится тут завтра.') + '</p></div>';
    h += '<div style="margin-top:12px"><button class="btn primary wide" type="button" data-lesson="' + esc(lessonOfDay().id) + '">урок дня</button></div>';
    view.innerHTML = h;
    window.scrollTo(0, 0);
  }
  function renderReview() {
    var item = L.list[L.i], h = '';
    if (!L.order) L.order = shuffle([0, 1, 2].slice(0, item.q.o.length));
    var q = { s: item.q.s, o: L.order.map(function (k) { return item.q.o[k]; }) };
    h += '<div class="player"><div class="p-top"><button class="x" type="button" data-act="close" aria-label="закрыть">✕</button><div class="segs">';
    for (var k = 0; k < L.list.length; k++) h += '<i class="' + (k <= L.i ? 'on' : '') + '"></i>';
    h += '</div></div><div class="p-title">🔁 повтор · ' + esc(item.title) + '</div><div class="stage" id="stage">';
    h += renderQuestion(q, L.answer, 'p-card left');
    h += '</div><div class="p-nav"><button class="btn primary wide" type="button" data-act="rnext"' + (L.answer === null ? ' disabled' : '') + '>' + (L.answer === null ? 'выбери ответ' : (L.i === L.list.length - 1 ? 'готово' : 'дальше')) + '</button></div></div>';
    view.innerHTML = h;
    window.scrollTo(0, 0);
    bindSwipe(document.getElementById('stage'));
  }
  function reviewNext() {
    if (!L || !L.r || L.answer === null) return;
    if (L.i < L.list.length - 1) { L.i++; L.answer = null; L.order = null; renderReview(); return; }
    var ok = L.ok, n = L.list.length, s = streak();
    var h = '<div class="player"><div class="stage"><div class="p-card finish"><div class="emoji">🔁</div><h2>повтор готов</h2>';
    h += '<p>' + ok + ' из ' + n + ' с первого раза</p><p class="streak">🔥 ' + s + ' ' + plural(s, 'день', 'дня', 'дней') + ' подряд</p></div></div>';
    h += '<div class="p-nav"><button class="btn primary wide" type="button" data-act="home">на главную</button></div></div>';
    L = null;
    view.innerHTML = h;
  }

  // ---------- словарик ----------
  var dictQuery = '';
  function renderDict() {
    document.body.classList.remove('in-lesson');
    setTab('dict');
    L = null;
    var h = '<div class="top"><a class="back" href="index.html">← приложение</a><span class="hint">' + P.glossary.length + ' фраз</span></div>';
    h += '<div class="logo">она говорит → <span>чувствует</span></div>';
    h += '<input class="search" id="dictSearch" type="search" placeholder="поиск: «ясно», «забей», «ревную»…" autocomplete="off" value="' + esc(dictQuery) + '">';
    h += '<div class="dict" id="dictList"></div>';
    h += '<p class="hint" style="margin-top:14px">это подсказки, а не шифр. у каждой свой смысл — если не уверен, мягко спроси.</p>';
    view.innerHTML = h;
    var inp = document.getElementById('dictSearch');
    inp.addEventListener('input', function () { dictQuery = inp.value; fillDict(); });
    fillDict();
    window.scrollTo(0, 0);
  }
  function norm(s) { return String(s).toLowerCase().replace(/ё/g, 'е'); }
  function fillDict() {
    var q = norm(dictQuery.trim()), h = '';
    var list = P.glossary.filter(function (g) { return !q || norm(g.say + ' ' + g.feel + ' ' + g.reply).indexOf(q) !== -1; });
    list.forEach(function (g) {
      h += '<div class="word"><div class="say">' + esc(g.say) + '</div>';
      h += '<div class="feel"><b>чувствует</b>' + esc(g.feel) + '</div>';
      h += '<div class="reply"><b>ответ</b>' + esc(g.reply) + '</div></div>';
    });
    document.getElementById('dictList').innerHTML = h || '<div class="empty">ничего не нашлось</div>';
  }

  // ---------- клики ----------
  view.addEventListener('click', function (e) {
    var b = e.target.closest('button, a');
    if (!b) return;
    var les = b.getAttribute('data-lesson');
    if (les) { go('l/' + les); return; }
    var mod = b.getAttribute('data-mod');
    if (mod) { go('m/' + mod); return; }
    if (b.getAttribute('data-go')) { go(b.getAttribute('data-go')); return; }
    var opt = b.getAttribute('data-opt');
    if (opt !== null && L && L.answer === null) {
      var i = +opt;
      L.answer = i;
      if (L.r) {
        var item = L.list[L.i], ok = item.q.o[L.order[i]].ok;
        if (ok) L.ok++;
        reviewAnswer(item, ok);
        renderReview();
      } else {
        L.firstOk = !!L.l.q.o[i].ok;
        renderStep();
      }
      return;
    }
    var act = b.getAttribute('data-act');
    if (act === 'next') step(1);
    else if (act === 'prev') step(-1);
    else if (act === 'rnext') reviewNext();
    else if (act === 'copy' && L && L.l) copy(L.l.tip.lines.join('\n') + '\n\n' + L.l.tip.cap);
    else if (act === 'close' || act === 'home') {
      var back = (act === 'close' && L && L.l) ? 'm/' + L.l._m.id : 'home';
      L = null;
      go(back);
    }
  });

  document.querySelector('.tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-go]');
    if (b) go(b.getAttribute('data-go'));
  });

  document.addEventListener('keydown', function (e) {
    if (!L || e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') { if (L.r) reviewNext(); else step(1); }
    else if (e.key === 'ArrowLeft' && !L.r) step(-1);
    else if (e.key === 'Escape') go('home');
  });

  // ---------- роутинг ----------
  function go(hash) {
    if (location.hash === '#' + hash) route();
    else location.hash = hash;
  }
  function route() {
    var h = (location.hash || '#home').slice(1);
    if (h.indexOf('l/') === 0) startLesson(h.slice(2));
    else if (h.indexOf('m/') === 0) { L = null; renderModule(h.slice(2)); }
    else if (h === 'dict') renderDict();
    else if (h === 'review') startReview();
    else { L = null; renderHome(); }
  }
  window.addEventListener('hashchange', route);
  route();
})();
