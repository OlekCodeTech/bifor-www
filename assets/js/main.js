/* BIFOR — interakcje strony */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- analityka ----------
     Zdarzenia trafiają do window.dataLayer (GTM / GA4 podłącza się później,
     razem z banerem zgód). */
  window.dataLayer = window.dataLayer || [];
  function track(event, params) {
    var payload = { event: event };
    for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) payload[k] = params[k];
    window.dataLayer.push(payload);
  }
  window.biforTrack = track;

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-track]');
    if (el) track(el.getAttribute('data-track'), { place: el.getAttribute('data-place') || '' });
  });

  /* źródło wejścia (first touch w obrębie sesji) — odczytuje je formularz */
  try {
    if (!sessionStorage.getItem('bifor_source')) {
      var q = new URLSearchParams(location.search);
      sessionStorage.setItem('bifor_source', JSON.stringify({
        utm_source: q.get('utm_source') || '',
        utm_medium: q.get('utm_medium') || '',
        utm_campaign: q.get('utm_campaign') || '',
        utm_content: q.get('utm_content') || '',
        referrer: document.referrer || '',
        landing_page: location.pathname + location.search
      }));
    }
  } catch (err) { /* brak storage — formularz uzupełni dane na bieżąco */ }

  /* ---------- wejście strony ---------- */
  // timer zamiast samego rAF — rAF nie rusza w kartach w tle, a treść nie może zostać ukryta
  setTimeout(function () { document.documentElement.classList.add('loaded'); }, 40);

  /* ---------- nawigacja ---------- */
  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  var burger = document.querySelector('.burger');
  var mnav = document.getElementById('mnav');
  if (burger && mnav) {
    burger.addEventListener('click', function () {
      var open = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!open));
      burger.setAttribute('aria-label', open ? 'Otwórz menu' : 'Zamknij menu');
      mnav.hidden = open;
    });
    mnav.addEventListener('click', function (e) {
      if (e.target.closest('a')) { burger.setAttribute('aria-expanded', 'false'); mnav.hidden = true; }
    });
  }

  /* ---------- pojawianie się przy przewijaniu ---------- */
  var watched = document.querySelectorAll('.rv, .ph, #sources, #flow');
  if (reduced || !('IntersectionObserver' in window)) {
    watched.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    watched.forEach(function (el) { io.observe(el); });
  }

  /* ---------- „Informację wpisujesz raz” ----------
     Pokazuje, co program robi po zmianie liczby gości: wycena robocza liczy
     się od razu, a zaakceptowana wycena i Karty Realizacji czekają na salę. */
  var range = document.getElementById('gRange');
  if (range) {
    var out = document.getElementById('gOut');
    var BASE = 120, PRICE = 420;
    var fmt = new Intl.NumberFormat('pl-PL');
    var interacted = false;
    var prev = null;

    function plural(n, one, few, many) {
      if (n === 1) return one;
      var d = n % 10, t = n % 100;
      return (d >= 2 && d <= 4 && (t < 12 || t > 14)) ? few : many;
    }
    function flash(id) {
      var li = document.getElementById(id);
      li.classList.remove('flash'); void li.offsetWidth; li.classList.add('flash');
      setTimeout(function () { li.classList.remove('flash'); }, 60);
    }
    function render(n) {
      out.textContent = n;
      range.value = n;
      var diff = n - BASE, k = Math.abs(diff);
      document.getElementById('vC').textContent = fmt.format(n * PRICE) + ' zł';
      document.getElementById('vT').textContent = diff === 0 ? 'wszyscy przy stołach'
        : diff > 0 ? k + ' ' + plural(k, 'gość', 'gości', 'gości') + ' bez miejsca'
        : k + ' ' + plural(k, 'wolne miejsce', 'wolne miejsca', 'wolnych miejsc');
      document.getElementById('vP').innerHTML = diff === 0 ? 'bez zmian'
        : '<em class="st st-warn">czeka na nową wersję</em>';
      document.getElementById('vK').innerHTML = diff === 0
        ? '<em class="st st-good">Aktualna</em>'
        : '<em class="st st-crit">Nieaktualna</em>';
      if (prev !== null && prev !== n) ['oC', 'oT', 'oP', 'oK'].forEach(flash);
      prev = n;
    }
    function set(n) {
      n = Math.max(+range.min, Math.min(+range.max, n));
      render(n);
      if (!interacted) { interacted = true; track('guests_calc_used', {}); }
    }
    range.addEventListener('input', function () { set(+range.value); });
    document.querySelectorAll('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () { set(+range.value + +b.getAttribute('data-step')); });
    });
    render(BASE);
  }

  /* ---------- role ----------
     Zakładki przełączają gotowe panele z ekranami programu (są w HTML). */
  var tabs = document.querySelectorAll('#roleTabs [role="tab"]');
  if (tabs.length) {
    var showRole = function (i, focus) {
      tabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tabs[i].focus();
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { showRole(i); track('role_view', { role: t.querySelector('b').textContent }); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (i + 1) % tabs.length;
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
        if (e.key === 'Home') n = 0;
        if (e.key === 'End') n = tabs.length - 1;
        if (n !== null) { e.preventDefault(); showRole(n, true); }
      });
    });
  }

  /* ---------- powiększanie ekranów programu ---------- */
  var lb = null;
  function openShot(src, alt, mobileWidth) {
    if (!window.HTMLDialogElement) { window.open(src, '_blank'); return; }
    if (!lb) {
      lb = document.createElement('dialog');
      lb.className = 'lb';
      lb.innerHTML = '<button class="lb-x" type="button" aria-label="Zamknij powiększenie">×</button>' +
        '<p class="lb-hint" aria-hidden="true">Przesuwaj palcem, żeby zobaczyć cały ekran</p>' +
        '<div class="lb-in"><img alt=""></div>';
      document.body.appendChild(lb);
      lb.addEventListener('click', function (e) { if (e.target.tagName !== 'IMG') lb.close(); });
    }
    var im = lb.querySelector('img');
    im.src = src; im.alt = alt || '';
    im.style.setProperty('--zw', (mobileWidth || 920) + 'px'); // szerokość na telefonie: tyle, żeby tekst dało się czytać
    lb.showModal();
    lb.querySelector('.lb-in').scrollTo(0, 0);
  }
  document.querySelectorAll('.shot[data-zoom]').forEach(function (b) {
    b.addEventListener('click', function () {
      var img = b.querySelector('img');
      openShot(b.getAttribute('data-zoom'), img ? img.alt : '', +b.getAttribute('data-zoom-w') || 0);
      track('screen_zoom', { screen: b.getAttribute('data-zoom').split('/').pop() });
    });
  });

  /* ---------- FAQ: zdarzenie otwarcia ---------- */
  document.querySelectorAll('.qa details').forEach(function (d) {
    var initial = d.open; // przeglądarka wysyła „toggle” także dla pytań otwartych w HTML
    d.addEventListener('toggle', function () {
      if (initial) { initial = false; return; }
      if (d.open) track('faq_open', { question: d.querySelector('summary').textContent.trim() });
    });
  });
})();
