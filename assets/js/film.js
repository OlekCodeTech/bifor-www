/* BIFOR — animacja produktu w hero („film”)
   Każda klatka jest liczona z czasu (render(t)), więc animację można
   zatrzymać, przewinąć do rozdziału i zapętlić bez rozjeżdżania się stanów. */
(function () {
  'use strict';

  var stage = document.getElementById('stage');
  if (!stage) return;
  var vp = document.getElementById('filmVp');
  var film = document.getElementById('jak-dziala');
  var cursor = document.getElementById('cursor');
  var playBtn = document.getElementById('play');
  var tcEl = document.getElementById('tc');
  var nowEl = document.getElementById('now');
  var chBtns = document.querySelectorAll('#chapters button');
  var sceneEls = stage.querySelectorAll('.scene');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 1200, H = 720, scale = 1;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- narzędzia ---------- */
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function p(lt, a, b) { return clamp((lt - a) / (b - a)); }
  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function lerp(a, b, x) { return a + (b - a) * x; }
  function tog(el, cls, cond) { if (el.classList.contains(cls) !== !!cond) el.classList.toggle(cls, !!cond); }
  function setText(el, txt) { if (el.textContent !== txt) el.textContent = txt; }
  function typed(full, lt, a, b) { return full.slice(0, Math.round(full.length * p(lt, a, b))); }
  var nf = new Intl.NumberFormat('pl-PL');
  function zl(v) { return nf.format(Math.round(v)) + ' zł'; }
  function setIcon(svg, id, cls) {
    var use = svg.querySelector('use');
    if (use.getAttribute('href') !== '#' + id) use.setAttribute('href', '#' + id);
    if (svg.getAttribute('class') !== cls) svg.setAttribute('class', cls);
  }

  function center(sel) {
    var el = stage.querySelector(sel);
    var sr = stage.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    return [(r.left - sr.left + r.width / 2) / scale, (r.top - sr.top + r.height / 2) / scale];
  }
  function resolve(pos) { return typeof pos === 'string' ? center(pos) : pos; }

  /* ---------- sceny ---------- */
  var S0 = { fields: ['f0', 'f1', 'f2', 'f3', 'f4'].map($) };
  S0.fields.forEach(function (f) { f.span = f.querySelector('[data-text]'); f.full = f.span.getAttribute('data-text'); });

  var scenes = [
    { // 01 Utwórz wydarzenie
      dur: 5.4,
      title: 'Utwórz wydarzenie.', text: 'Manager dodaje wydarzenie i podstawowe informacje.',
      cursor: { start: [980, 640], path: [[0, 0.4, '#f0'], [1.85, 2.0, '#f1'], [2.5, 2.62, '#f2'], [2.85, 2.95, '#f3'], [3.02, 3.12, '#f4'], [3.35, 3.9, '#s0create'], [4.6, 5.3, [900, 560]]], clicks: [0.42, 1.98, 2.6, 2.93, 3.1, 3.98] },
      render: function (lt, el) {
        tog(el, 'open', lt < 4.3);
        var win = [[0.3, 0.5, 1.8, 1.9], [1.9, 1.95, 2.45, 2.55], [2.55, 2.58, 2.82, 2.88], [2.88, 2.9, 3.0, 3.05], [3.05, 3.08, 3.2, 3.5]];
        S0.fields.forEach(function (f, i) {
          var w = win[i];
          setText(f.span, typed(f.full, lt, w[1], w[2]));
          tog(f, 'focus', lt >= w[0] && lt < w[3]);
        });
        tog($('s0create'), 'press', lt >= 3.95 && lt < 4.15);
        tog($('s0row'), 'on', lt >= 4.45);
      }
    },
    { // 02 Zaproś Zamawiającego
      dur: 5.8,
      title: 'Zaproś Zamawiającego.', text: 'Klient otrzymuje dostęp do swojego wydarzenia — i widzi tylko to, co mu udostępnisz.',
      cursor: { start: [900, 560], path: [[0.1, 0.9, '#s1mail'], [3.4, 3.85, '#s1send'], [4.6, 5.5, [1040, 600]]], clicks: [0.95, 3.92] },
      render: function (lt) {
        [0.25, 0.4, 0.55, 0.7, 0.85].forEach(function (at, i) { tog($('t' + i), 'on', lt >= at); });
        var sent = lt >= 4.0;
        tog($('s1mail'), 'focus', lt >= 1.0 && lt < 3.9);
        tog($('s1chip1'), 'hid', !(lt >= 2.3 && !sent));
        tog($('s1chip2'), 'hid', !(lt >= 3.35 && !sent));
        var txt = '';
        if (lt < 2.3) txt = typed('anna.wojcik@gmail.com', lt, 1.1, 2.2);
        else if (lt < 3.35) txt = typed('michal.wojcik@gmail.com', lt, 2.35, 3.25);
        setText($('s1type'), txt);
        tog($('s1send'), 'press', lt >= 3.9 && lt < 4.1);
        tog($('s1toast'), 'on', lt >= 4.05 && lt < 5.6);
        tog($('s1p1'), 'on', lt >= 4.15);
        tog($('s1p2'), 'on', lt >= 4.3);
        setText($('s1count'), lt >= 4.3 ? '3 osoby' : '1 osoba');
        var st = $('s1p1st'), ok = lt >= 5.0;
        setText(st, ok ? 'Dostęp aktywny' : 'Zaproszenie wysłane');
        var c = ok ? 'st st-good' : 'st st-warn';
        if (st.className !== c) st.className = c;
      }
    },
    { // 03 Uzupełniajcie ustalenia
      dur: 6.0,
      title: 'Uzupełniajcie ustalenia.', text: 'Każda strona uzupełnia elementy zgodne ze swoim zakresem. Wszyscy widzą zmiany od razu.',
      cursor: null,
      render: function (lt) {
        var steps = [0.5, 1.9, 3.3, 4.6];
        steps.forEach(function (at, i) { tog($('s2f' + i), 'on', lt >= at); });
        var nav = [
          ['i-clock', 'ico-warn', '118 z 140'],
          ['i-clock', 'ico-warn', '6 z 9'],
          ['i-check', 'ico-good', '3 zamówione'],
          ['i-check', 'ico-good', '4 pliki']
        ];
        var idle = ['—', '—', '—', '1 plik'];
        nav.forEach(function (n, i) {
          var row = $('s2n' + i), done = lt >= steps[i] + 0.2;
          setIcon(row.querySelector('svg'), done ? n[0] : 'i-empty', done ? n[1] : 'ico-idle');
          setText(row.querySelector('em'), done ? n[2] : idle[i]);
        });
        var ready = 2 + (lt >= 3.5 ? 1 : 0) + (lt >= 4.8 ? 1 : 0);
        setText($('s2ready'), ready + ' z 8');
        setText($('s2prog'), ready + ' z 8 sekcji gotowe');
        $('s2bar').style.width = (ready / 8 * 100) + '%';

        var v = 0;
        if (lt >= 0.6) v = lerp(0, 42480, ease(p(lt, 0.6, 1.1)));
        if (lt >= 1.9) v = lerp(42480, 43404, ease(p(lt, 1.9, 2.3)));
        if (lt >= 3.3) v = lerp(43404, 44604, ease(p(lt, 3.3, 3.7)));
        setText($('s2val'), lt < 0.6 ? '— zł' : zl(v));
        tog($('s2val'), 'flash', (lt >= 0.6 && lt < 1.3) || (lt >= 1.9 && lt < 2.5) || (lt >= 3.3 && lt < 3.9));
        setText($('s2sub'), lt < 0.6 ? 'czeka na listę gości' : 'aktualizuje się przy każdej zmianie');
        tog($('s2q0'), 'on', lt >= 0.7);
        tog($('s2q1'), 'on', lt >= 2.0);
        tog($('s2q2'), 'on', lt >= 3.4);
      }
    },
    { // 04 BIFOR pilnuje kompletności
      dur: 5.4,
      title: 'BIFOR pilnuje kompletności.', text: 'System pokazuje braki, terminy i elementy wymagające uwagi.',
      cursor: { start: [1040, 600], path: [[2.3, 3.15, '#s3btn'], [4.3, 5.2, [1080, 640]]], clicks: [3.32] },
      render: function (lt, el) {
        var resolved = lt >= 3.6;
        el.querySelectorAll('[data-count]').forEach(function (b) {
          var n = +b.getAttribute('data-count');
          if (b.id === 's3dec' && resolved) n = 3;
          setText(b, String(Math.round(n * ease(p(lt, 0.15, 0.9)))));
        });
        setText($('s3badge'), resolved ? '3' : '4');
        [1.0, 1.25, 1.5, 1.75].forEach(function (at, i) { tog($('s3r' + i), 'on', lt >= at); });
        var btn = $('s3btn');
        tog(btn, 'press', lt >= 3.32 && lt < 3.52);
        tog(btn, 'done', resolved);
        setText(btn, resolved ? 'Wydano' : 'Wydaj wersję 3');
        tog($('s3r3'), 'resolved', resolved);
        setIcon($('s3r3ic'), resolved ? 'i-check' : 'i-doc', resolved ? 'ico-good' : 'ico-crit');
        setText($('s3r3t'), resolved ? 'Karta Realizacji aktualna' : 'Karta Realizacji nieaktualna');
        setText($('s3r3s'), resolved ? 'Jubileusz Terma · wersja 3 trafiła do kuchni, obsługi i baru' : 'Jubileusz Terma · menu zmieniono po zatwierdzeniu');
      }
    },
    { // 05 Przejdź do realizacji
      dur: 6.4,
      title: 'Przejdź do realizacji.', text: 'Z tych samych danych powstaje Karta Realizacji dla kuchni, obsługi i baru.',
      cursor: { start: [1080, 640], path: [[1.4, 2.1, '#s4t1'], [3.4, 4.1, '#s4t2'], [5.1, 6.2, [940, 620]]], clicks: [2.25, 4.25] },
      render: function (lt) {
        tog($('s4stamp'), 'on', lt >= 0.4);
        var tab = lt < 2.3 ? 0 : lt < 4.3 ? 1 : 2;
        for (var i = 0; i < 3; i++) { tog($('s4t' + i), 'on', i === tab); tog($('s4p' + i), 'on', i === tab); }
      }
    }
  ];

  var starts = [], total = 0;
  scenes.forEach(function (s) { starts.push(total); total += s.dur; });

  /* ---------- kursor ---------- */
  function renderCursor(sc, lt) {
    if (!sc.cursor) { tog(cursor, 'off', true); return; }
    tog(cursor, 'off', false);
    var c = sc.cursor, from = c.start, cur = c.start;
    for (var i = 0; i < c.path.length; i++) {
      var k = c.path[i];
      if (lt < k[0]) break;
      var to = resolve(k[2]);
      cur = [lerp(from[0], to[0], ease(p(lt, k[0], k[1]))), lerp(from[1], to[1], ease(p(lt, k[0], k[1])))];
      from = to;
    }
    cursor.style.transform = 'translate(' + (cur[0] - 4) + 'px,' + (cur[1] - 3) + 'px)';
    var clicking = c.clicks.some(function (at) { return lt >= at && lt < at + 0.45; });
    tog(cursor, 'click', clicking);
  }

  /* ---------- odtwarzanie ---------- */
  var t = 0, playing = !reduced, inView = true, current = -1, last = 0;

  function mmss(sec) { sec = Math.floor(sec); return ('0' + Math.floor(sec / 60)).slice(-2) + ':' + ('0' + sec % 60).slice(-2); }

  function draw() {
    var idx = scenes.length - 1;
    for (var i = 0; i < starts.length; i++) if (t < starts[i] + scenes[i].dur) { idx = i; break; }
    var lt = t - starts[idx];
    var sc = scenes[idx];

    if (idx !== current) {
      sceneEls.forEach(function (el, i) { tog(el, 'on', i === idx); });
      nowEl.innerHTML = '<b>' + sc.title + '</b> <span>' + sc.text + '</span>';
      current = idx;
    }
    sc.render(lt, sceneEls[idx]);
    renderCursor(sc, lt);

    chBtns.forEach(function (b, i) {
      var fill = i < idx ? 1 : i === idx ? lt / sc.dur : 0;
      b.querySelector('.ch-bar i').style.width = (fill * 100).toFixed(2) + '%';
      tog(b, 'on', i === idx);
      if (i === idx) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    setText(tcEl, mmss(t) + ' / ' + mmss(total));
  }

  function frame(now) {
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (playing && inView && !document.hidden) {
      t += dt;
      if (t >= total) t = 0;
      draw();
    }
    requestAnimationFrame(frame);
  }

  function setPlaying(v) {
    playing = v;
    playBtn.setAttribute('aria-label', v ? 'Zatrzymaj animację' : 'Odtwórz animację');
    playBtn.querySelector('use').setAttribute('href', v ? '#i-pause' : '#i-play');
  }

  playBtn.addEventListener('click', function () {
    setPlaying(!playing);
    if (window.biforTrack) window.biforTrack(playing ? 'film_play' : 'film_pause', {});
  });

  chBtns.forEach(function (b, i) {
    b.addEventListener('click', function () {
      // bez odtwarzania pokazujemy od razu końcowy stan rozdziału
      t = playing ? starts[i] : starts[i] + scenes[i].dur - 0.01;
      draw();
      if (window.biforTrack) window.biforTrack('film_chapter', { chapter: i + 1 });
    });
  });

  /* ---------- skalowanie sceny ---------- */
  function fit() {
    scale = vp.clientWidth / W;
    stage.style.transform = 'scale(' + scale + ')';
    vp.style.height = (H * scale) + 'px';
  }
  fit();
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(vp);
  else window.addEventListener('resize', fit);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { inView = en[0].isIntersecting; }, { threshold: 0.15 }).observe(film);
  }

  if (reduced) {
    setPlaying(false);
    t = starts[2] + scenes[2].dur - 0.01;
  }
  draw();
  requestAnimationFrame(frame);
})();
