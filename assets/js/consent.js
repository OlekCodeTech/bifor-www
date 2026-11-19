/* BIFOR — zgoda na piksel Meta
   Piksel reklamowy (Meta Pixel) zapisuje pliki cookies i wysyła Mecie informacje
   o odwiedzinach, dlatego uruchamiamy go dopiero po wyraźnej zgodzie.
   - brak decyzji  -> pokazujemy baner, piksel nie jest ładowany,
   - „Zgadzam się” -> ładujemy piksel (PageView, a po wysłaniu formularza Lead),
   - „Nie zgadzam się” -> nic nie ładujemy; pytamy ponownie po pół roku.
   Decyzję można zmienić w stopce: „Ustawienia cookies”.
   Piksel działa tylko na bifor.pl — na podglądzie i lokalnie baner widać, ale nic nie jest wysyłane. */
(function () {
  'use strict';

  var PIXEL_ID = '1791908205434465';
  var KEY = 'bifor_zgoda_marketing';
  var DAY = 24 * 3600 * 1000;
  var KEEP = { tak: 365 * DAY, nie: 180 * DAY };
  var LIVE = /(^|\.)bifor\.pl$/.test(location.hostname);

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && KEEP[v.d] && Date.now() - v.t < KEEP[v.d]) return v.d;
    } catch (e) { /* brak dostępu do pamięci przeglądarki — traktujemy jak brak decyzji */ }
    return null;
  }
  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify({ d: d, t: Date.now() })); } catch (e) { /* jw. */ }
  }

  /* ---------- piksel ---------- */
  var loaded = false;
  function loadPixel() {
    if (loaded) { if (window.fbq) window.fbq('consent', 'grant'); return; }
    loaded = true;
    if (!LIVE) { console.info('[BIFOR] Podgląd: piksel Meta nie jest ładowany poza bifor.pl.'); return; }
    /* standardowy kod Meta Pixel */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
  }
  function stopPixel() {
    if (window.fbq) window.fbq('consent', 'revoke');
    ['_fbp', '_fbc'].forEach(function (name) {
      document.cookie = name + '=; Max-Age=0; path=/';
      document.cookie = name + '=; Max-Age=0; path=/; domain=.bifor.pl';
    });
  }

  /* wywołuje formularz po rzeczywistym wysłaniu zgłoszenia */
  window.biforLead = function () {
    if (LIVE && loaded && read() === 'tak' && window.fbq) window.fbq('track', 'Lead');
  };

  /* ---------- baner ---------- */
  var banner = null;
  function closeBanner() {
    if (banner) { banner.remove(); banner = null; }
  }
  function openBanner(focus) {
    if (banner) { if (focus) banner.querySelector('button').focus(); return; }
    banner = document.createElement('section');
    banner.className = 'cb';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Zgoda na pliki cookies');
    banner.innerHTML =
      '<div><b>Cookies reklamowe</b>' +
      '<p>Chcemy używać piksela Meta (Facebook i Instagram), żeby mierzyć skuteczność reklam BIFOR. ' +
      'Piksel zapisuje pliki cookies i przekazuje Mecie informacje o odwiedzinach tej strony. ' +
      'Włączymy go tylko za Twoją zgodą; możesz ją cofnąć w stopce, w „Ustawieniach cookies”. ' +
      '<a href="polityka-prywatnosci.html#cookies">Więcej o cookies</a></p></div>' +
      '<div class="cb-btns">' +
      '<button type="button" class="btn btn-line btn-sm" data-consent="nie">Nie zgadzam się</button>' +
      '<button type="button" class="btn btn-primary btn-sm" data-consent="tak">Zgadzam się</button>' +
      '</div>';
    banner.addEventListener('click', function (e) {
      var b = e.target.closest('[data-consent]');
      if (!b) return;
      var d = b.getAttribute('data-consent');
      save(d);
      if (d === 'tak') loadPixel(); else stopPixel();
      if (window.biforTrack) window.biforTrack('cookie_consent', { decision: d });
      closeBanner();
    });
    document.body.appendChild(banner);
    if (focus) banner.querySelector('button').focus();
  }

  /* „Ustawienia cookies” w stopce — ponowne otwarcie banera */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-consent-open]');
    if (!a) return;
    e.preventDefault();
    openBanner(true);
  });

  var decision = read();
  if (decision === 'tak') loadPixel();
  else if (decision === null) openBanner(false);
})();
