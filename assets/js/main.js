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
     Kto co widzi przy jednym przyjęciu — według tabeli uprawnień programu. */
  var tabs = document.querySelectorAll('#roleTabs [role="tab"]');
  if (tabs.length) {
    var SECTIONS = [
      ['Ankieta', 'i-note'], ['Lista gości i rozsadzenie', 'i-users'], ['Menu i wycena', 'i-fork'],
      ['Płatności', 'i-cash'], ['Harmonogram dnia', 'i-clock'], ['Pliki', 'i-doc'],
      ['Notatka wewnętrzna i obsada', 'i-lock']
    ];
    // poziom: e = działa, v = widzi część, h = nie widzi; obok etykieta z programu
    var ROLES = [
      { av: 'MN', c: 'av-b', name: 'Magdalena Nowak', role: 'Manager · zespół sali',
        a: [['e', 'Zatwierdza'], ['e', 'Pełny dostęp'], ['e', 'Wystawia wycenę'], ['e', 'Potwierdza wpłaty'], ['e', 'Układa'], ['e', 'Udostępnia'], ['e', 'Tylko zespół sali']],
        foot: 'Zatwierdza ustalenia, wystawia wycenę i potwierdza wpłaty. Każda zmiana zostaje w historii.' },
      { av: 'AK', c: 'av-g', name: 'Anna Kowalska', role: 'Zamawiająca',
        a: [['e', 'Odpowiada'], ['e', 'Prowadzi'], ['e', 'Wybiera i akceptuje'], ['e', 'Zgłasza przelewy'], ['v', 'Swoja część'], ['v', 'Udostępnione'], ['h', 'Nie widzi']],
        foot: 'Ma swoje wydarzenie na komputerze i w telefonie. Zmianę po terminie wysyła jako prośbę.' },
      { av: 'KW', c: 'av-w', name: 'Karolina Wiśniewska', role: 'Współorganizatorka · świadkowa',
        a: [['e', 'Odpowiada'], ['e', 'Prowadzi'], ['v', 'Tylko do wglądu'], ['h', 'Nie widzi'], ['v', 'Swoja część'], ['v', 'Udostępnione'], ['h', 'Nie widzi']],
        foot: 'Pomaga przy ankiecie i liście gości. Płatności zostają po stronie zamawiającej.' },
      { av: 'DJ', c: 'av-c', name: 'DJ Tomasz', role: 'Usługodawca · oprawa muzyczna',
        a: [['v', 'Swoje pytania'], ['h', 'Tylko liczby gości'], ['h', 'Nie widzi'], ['h', 'Nie widzi'], ['v', 'Swoje punkty'], ['v', 'Udostępnione'], ['h', 'Nie widzi']],
        foot: 'Widzi swoje pytania, swoje punkty dnia i swoją Kartę Realizacji. Listy gości i pieniędzy nie widzi.' },
      { av: 'PS', c: 'av-b', name: 'Personel sali', role: 'Zespół sali',
        a: [['v', 'Według roli'], ['v', 'Według roli'], ['v', 'Według roli'], ['v', 'Według roli'], ['v', 'Według roli'], ['v', 'Według roli'], ['v', 'Według roli']],
        foot: 'Widzi tyle, ile daje mu rola w zespole. W dniu przyjęcia ma tryb dnia w telefonie.' }
    ];
    var LV = { e: 'lv-e', v: 'lv-v', h: 'lv-h' };
    var COLOR = { e: 'var(--brand)', v: 'var(--ink-2)', h: 'var(--ink-3)' };
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
        var lvl = r.a[k][0];
        return '<li class="' + (lvl === 'h' ? 'hidden ' : '') + 'tick" style="animation-delay:' + (k * 30) + 'ms">' +
          '<svg style="color:' + COLOR[lvl] + '"><use href="#' + s[1] + '"/></svg>' +
          '<span class="nm">' + s[0] + '</span>' +
          '<span class="lv ' + LV[lvl] + '">' + r.a[k][1] + '</span></li>';
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
