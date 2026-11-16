/* BIFOR — film z ekranów programu w hero.
   Prawdziwe zrzuty aplikacji z powolnym najazdem na fragment, o którym mówi
   rozdział. Każda klatka jest liczona z czasu (render(t)), więc film można
   zatrzymać, przewinąć do rozdziału i zapętlić bez rozjeżdżania się stanów. */
(function () {
  'use strict';

  var stage = document.getElementById('stage');
  if (!stage) return;
  var vp = document.getElementById('filmVp');
  var film = document.getElementById('jak-dziala');
  var playBtn = document.getElementById('play');
  var tcEl = document.getElementById('tc');
  var nowEl = document.getElementById('now');
  var chBtns = document.querySelectorAll('#chapters button');
  var shotEls = stage.querySelectorAll('.shotf');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 1600, H = 1000;
  var boost = 1;   // na wąskim ekranie najazd jest mocniejszy, żeby dało się coś przeczytać

  var CHAPTERS = [
    { title: 'Utwórz wydarzenie.', text: 'Termin trzymasz wstępną rezerwacją. Gdy zamawiający się zdecyduje, zamieniasz ją w wydarzenie.' },
    { title: 'Zaproś Zamawiającego.', text: 'Dostaje zaproszenie e-mailem i ma swoje wydarzenie na komputerze i w telefonie.' },
    { title: 'Uzupełniajcie ustalenia.', text: 'Zamawiający wypełnia ankietę, prowadzi listę gości i sadza ich przy stołach. Ty zatwierdzasz.' },
    { title: 'BIFOR pilnuje kompletności.', text: 'Karta "Co dalej" zbiera sprawy, które czekają na Ciebie albo na zamawiającego.' },
    { title: 'Przejdź do realizacji.', text: 'Z ustaleń powstają Karty Realizacji, a w dniu przyjęcia zespół ma tryb dnia w telefonie.' }
  ];
  var DESK_DUR = 4.2, PHONE_DUR = 3.8;

  /* ---------- narzędzia ---------- */
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function p(lt, a, b) { return clamp((lt - a) / (b - a)); }
  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function tog(el, cls, cond) { if (el.classList.contains(cls) !== !!cond) el.classList.toggle(cls, !!cond); }
  function setText(el, txt) { if (el.textContent !== txt) el.textContent = txt; }
  function mmss(sec) { sec = Math.floor(sec); return ('0' + Math.floor(sec / 60)).slice(-2) + ':' + ('0' + sec % 60).slice(-2); }

  /* ---------- oś czasu z ujęć zapisanych w HTML ---------- */
  var shots = [], total = 0;
  shotEls.forEach(function (el) {
    var type = el.getAttribute('data-type');
    var s = {
      el: el, type: type, ch: +el.getAttribute('data-chapter'), start: total,
      dur: type === 'phone' ? PHONE_DUR : DESK_DUR,
      img: el.querySelector(type === 'phone' ? '.handset' : 'img'),
      zoom: +el.getAttribute('data-zoom') || 1
    };
    if (type === 'desk') s.img.style.transformOrigin = el.getAttribute('data-fx') + '% ' + el.getAttribute('data-fy') + '%';
    shots.push(s);
    total += s.dur;
  });
  var chStart = [], chDur = [];
  CHAPTERS.forEach(function (_, i) {
    var mine = shots.filter(function (s) { return s.ch === i; });
    chStart.push(mine[0].start);
    chDur.push(mine.reduce(function (a, s) { return a + s.dur; }, 0));
  });

  /* Ukryty obraz przeglądarka dekoduje dopiero przy pierwszym pokazaniu, co dałoby
     pusty kadr na początku ujęcia. Dlatego następne ujęcie przygotowujemy wcześniej. */
  function warm(s) {
    if (s.warmed) return;
    s.warmed = true;
    s.el.querySelectorAll('img').forEach(function (img) {
      img.loading = 'eager';
      if (img.decode) img.decode().catch(function () {});
    });
  }

  /* ---------- klatka ---------- */
  var t = 0, playing = !reduced, inView = true, last = 0, curShot = -1, curCh = -1;

  function draw() {
    var idx = shots.length - 1;
    for (var i = 0; i < shots.length; i++) if (t < shots[i].start + shots[i].dur) { idx = i; break; }
    var s = shots[idx], lt = t - s.start;

    if (idx !== curShot) {
      shots.forEach(function (o, k) { tog(o.el, 'on', k === idx); });
      curShot = idx;
      warm(shots[(idx + 1) % shots.length]);
    }
    if (s.type === 'desk') {
      // chwila na rozejrzenie się po całym ekranie, potem najazd na szczegół
      var z = 1 + (s.zoom - 1) * boost * ease(p(lt, 0.9, 2.9));
      s.img.style.transform = 'scale(' + z.toFixed(4) + ')';
    } else {
      var k = ease(p(lt, 0.15, 0.95));
      s.img.style.transform = 'translate(-50%, ' + ((1 - k) * 70).toFixed(1) + 'px)';
      s.img.style.opacity = k.toFixed(3);
    }

    if (s.ch !== curCh) {
      var c = CHAPTERS[s.ch];
      nowEl.innerHTML = '';
      var b = document.createElement('b'); b.textContent = c.title;
      var sp = document.createElement('span'); sp.textContent = c.text;
      nowEl.appendChild(b); nowEl.appendChild(document.createTextNode(' ')); nowEl.appendChild(sp);
      curCh = s.ch;
    }
    chBtns.forEach(function (btn, i) {
      var fill = i < s.ch ? 1 : i === s.ch ? (t - chStart[i]) / chDur[i] : 0;
      btn.querySelector('.ch-bar i').style.width = (fill * 100).toFixed(2) + '%';
      tog(btn, 'on', i === s.ch);
      if (i === s.ch) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
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
    playBtn.setAttribute('aria-label', v ? 'Zatrzymaj film' : 'Odtwórz film');
    playBtn.querySelector('use').setAttribute('href', v ? '#i-pause' : '#i-play');
  }

  playBtn.addEventListener('click', function () {
    setPlaying(!playing);
    if (window.biforTrack) window.biforTrack(playing ? 'film_play' : 'film_pause', {});
  });

  chBtns.forEach(function (b, i) {
    b.addEventListener('click', function () {
      // zatrzymany film pokazuje od razu docelowy kadr pierwszego ujęcia rozdziału
      t = playing ? chStart[i] : chStart[i] + 3.2;
      draw();
      if (window.biforTrack) window.biforTrack('film_chapter', { chapter: i + 1 });
    });
  });

  /* ---------- skalowanie sceny ---------- */
  function fit() {
    var scale = vp.clientWidth / W;
    boost = vp.clientWidth < 600 ? 2.4 : 1;
    stage.style.transform = 'scale(' + scale + ')';
    vp.style.height = (H * scale) + 'px';
  }
  fit();
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(vp);
  else window.addEventListener('resize', fit);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { inView = en[0].isIntersecting; }, { threshold: 0.15 }).observe(film);
  }

  // przewijanie z zewnątrz (kontrola kadrów, ewentualne sterowanie z innych sekcji)
  window.biforFilm = {
    seek: function (sec) { t = Math.max(0, Math.min(total - 0.01, sec)); draw(); },
    shots: shots.map(function (s) { return { start: s.start, dur: s.dur, chapter: s.ch }; })
  };

  // po załadowaniu strony dociągamy resztę kadrów, żeby skok do rozdziału nie pokazał pustego ekranu
  if (document.readyState === 'complete') shots.forEach(warm);
  else window.addEventListener('load', function () { shots.forEach(warm); });

  if (reduced) {
    setPlaying(false);
    t = chStart[3] + 3.2;   // Przegląd wesela z kartą "Co dalej"
  }
  draw();
  requestAnimationFrame(frame);
})();
