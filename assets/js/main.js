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

  /* ---------- „Informację wpisujesz raz” ---------- */
  var range = document.getElementById('gRange');
  if (range) {
    var out = document.getElementById('gOut');
    var BASE = 118, PRICE = 360, EXTRAS = 2124, PER_TABLE = 10;
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
      var tables = Math.ceil(n / PER_TABLE);
      document.getElementById('vT').textContent = tables + ' ' + plural(tables, 'stół', 'stoły', 'stołów') + ' po ' + PER_TABLE + ' osób';
      document.getElementById('vP').textContent = n + ' ' + plural(n, 'porcja', 'porcje', 'porcji');
      document.getElementById('vC').textContent = fmt.format(n * PRICE + EXTRAS) + ' zł';
      document.getElementById('vK').innerHTML = n === BASE
        ? '<em class="st st-good">aktualna · wersja 3</em>'
        : '<em class="st st-crit">do aktualizacji · wersja 4</em>';
      if (prev !== null && prev !== n) ['oT', 'oP', 'oC', 'oK'].forEach(flash);
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

  /* ---------- role ---------- */
  var tabs = document.querySelectorAll('#roleTabs [role="tab"]');
  if (tabs.length) {
    var SECTIONS = [
      ['Dane wydarzenia', 'i-cal'], ['Lista gości i RSVP', 'i-users'], ['Stoły', 'i-grid'], ['Menu, diety i alergie', 'i-fork'],
      ['Dodatki i atrakcje', 'i-gift'], ['Harmonogram', 'i-clock'], ['Finanse', 'i-cash'], ['Dokumenty', 'i-doc'], ['Karta Realizacji', 'i-note']
    ];
    // e = edycja, v = podgląd, h = niewidoczne
    var ROLES = [
      { av: 'KN', c: 'av-b', name: 'Katarzyna Nowak', role: 'Organizator · manager obiektu', a: 'eeeeeeeee',
        foot: 'Pełna kontrola nad wydarzeniem, zaproszeniami i uprawnieniami.' },
      { av: 'AW', c: 'av-g', name: 'Anna Wójcik', role: 'Zamawiający · Para Młoda', a: 'veeeevvvh',
        foot: 'Uzupełnia to, co udostępnił organizator. Dane trafiają prosto do wydarzenia.' },
      { av: 'JL', c: 'av-w', name: 'Julia Lis', role: 'Wedding planner', a: 'eeeveehev',
        foot: 'Współprowadzi wydarzenie razem z obiektem i Parą — bez osobnych plików.' },
      { av: 'DJ', c: 'av-c', name: 'DJ Marcin', role: 'Usługodawca · oprawa muzyczna', a: 'vhhhhvhvh',
        foot: 'Widzi tylko harmonogram, dane kontaktowe i swoje dokumenty.' },
      { av: 'KU', c: 'av-b', name: 'Kuchnia', role: 'Zespół realizacyjny', a: 'vvvvhvhhv',
        foot: 'Dostaje liczby, diety, alergie i godziny serwisu — gotowe do pracy.' }
    ];
    var LV = { e: ['lv-e', 'Edycja', 'i-pen'], v: ['lv-v', 'Podgląd', 'i-eye'], h: ['lv-h', 'Niewidoczne', 'i-lock'] };
    var acc = document.getElementById('rAcc');
    var av = document.getElementById('rAv');

    function showRole(i, focus) {
      var r = ROLES[i];
      tabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) tabs[i].focus();
      document.getElementById('rolePanel').setAttribute('aria-labelledby', 'rt' + i);
      av.className = 'av ' + r.c; av.textContent = r.av;
      document.getElementById('rName').textContent = r.name;
      document.getElementById('rRole').textContent = r.role;
      document.getElementById('rFoot').textContent = r.foot;
      acc.innerHTML = SECTIONS.map(function (s, k) {
        var l = LV[r.a[k]];
        var color = r.a[k] === 'h' ? 'var(--ink-3)' : (r.a[k] === 'e' ? 'var(--brand)' : 'var(--ink-2)');
        return '<li class="' + (r.a[k] === 'h' ? 'hidden ' : '') + 'tick" style="animation-delay:' + (k * 30) + 'ms">' +
          '<svg style="color:' + color + '"><use href="#' + s[1] + '"/></svg>' +
          '<span class="nm">' + s[0] + '</span>' +
          '<span class="lv ' + l[0] + '">' + l[1] + '</span></li>';
      }).join('');
    }
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
    showRole(0);
  }

  /* ---------- FAQ: zdarzenie otwarcia ---------- */
  document.querySelectorAll('.qa details').forEach(function (d) {
    var initial = d.open; // przeglądarka wysyła „toggle” także dla pytań otwartych w HTML
    d.addEventListener('toggle', function () {
      if (initial) { initial = false; return; }
      if (d.open) track('faq_open', { question: d.querySelector('summary').textContent.trim() });
    });
  });
})();
