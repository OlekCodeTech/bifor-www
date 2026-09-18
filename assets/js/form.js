/* BIFOR — formularz „Rozpocznij z BIFOR”
   Na razie tylko front: walidacja, antyspam, źródło wejścia, zdarzenia analityczne.
   Wysyłka: ustaw FORM_ENDPOINT (POST JSON). Dopóki jest pusty, zgłoszenie
   jest tylko wypisywane w konsoli, a użytkownik widzi komunikat o przyjęciu. */
(function () {
  'use strict';

  var FORM_ENDPOINT = ''; // np. 'https://api.bifor.pl/leads' — do podpięcia
  var MIN_FILL_MS = 3000; // szybciej wysyła tylko bot

  var form = document.getElementById('joinForm');
  if (!form) return;
  var track = window.biforTrack || function () {};
  var startedAt = Date.now();
  var started = false, submitted = false, lastField = '';

  /* ---------- źródło wejścia ---------- */
  var src = {};
  try { src = JSON.parse(sessionStorage.getItem('bifor_source') || '{}'); } catch (e) { src = {}; }
  var q = new URLSearchParams(location.search);
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) {
    form.elements[k].value = src[k] || q.get(k) || '';
  });
  form.elements.referrer.value = src.referrer || document.referrer || '';
  form.elements.landing_page.value = src.landing_page || location.pathname;
  track('join_page_view', { source: form.elements.utm_source.value || form.elements.referrer.value || 'direct' });

  /* ---------- reguły ---------- */
  var rules = {
    first_name: function (v) { return v.trim().length >= 2; },
    last_name: function (v) { return v.trim().length >= 2; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
    phone: function (v) { return v.replace(/\D/g, '').length >= 9 && /^[\d\s+()-]+$/.test(v.trim()); },
    company: function (v) { return v.trim().length >= 2; },
    street: function (v) { return v.trim().length >= 3; },
    postal_code: function (v) { return /^\d{2}-\d{3}$/.test(v.trim()); },
    city: function (v) { return v.trim().length >= 2; },
    website: function (v) { v = v.trim(); return !v || /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v); },
    role: function () { return !!form.querySelector('input[name="role"]:checked'); },
    consent_rodo: function () { return form.elements.consent_rodo.checked; }
  };

  function wrap(name) {
    if (name === 'role') return document.getElementById('role-field');
    if (name === 'consent_rodo') return document.getElementById('consent-field');
    return form.elements[name].closest('.f');
  }

  function check(name) {
    var el = form.elements[name];
    var ok = rules[name](el && el.value !== undefined ? el.value : '');
    var box = wrap(name);
    box.classList.toggle('bad', !ok);
    var inputs = name === 'role' ? form.querySelectorAll('input[name="role"]') : [el];
    Array.prototype.forEach.call(inputs, function (i) {
      if (ok) { i.removeAttribute('aria-invalid'); }
      else { i.setAttribute('aria-invalid', 'true'); i.setAttribute('aria-describedby', name + '-err'); }
    });
    return ok;
  }

  /* ---------- zachowanie pól ---------- */
  var touched = {};
  Object.keys(rules).forEach(function (name) {
    if (name === 'role' || name === 'consent_rodo') return;
    var el = form.elements[name];
    el.addEventListener('blur', function () { if (el.value.trim() !== '' || touched[name]) { touched[name] = true; check(name); } });
    el.addEventListener('input', function () { if (wrap(name).classList.contains('bad')) check(name); });
  });

  // kod pocztowy: automatyczny myślnik
  var zip = form.elements.postal_code;
  zip.addEventListener('input', function () {
    var d = zip.value.replace(/\D/g, '').slice(0, 5);
    zip.value = d.length > 2 ? d.slice(0, 2) + '-' + d.slice(2) : d;
  });

  form.querySelectorAll('input[name="role"]').forEach(function (r) {
    r.addEventListener('change', function () {
      check('role');
      track('join_role_selected', { role: r.value });
    });
  });
  form.elements.consent_rodo.addEventListener('change', function () { check('consent_rodo'); });

  var msg = form.elements.message, msgCount = document.getElementById('msgCount');
  msg.addEventListener('input', function () { msgCount.textContent = msg.value.length + ' / 1000'; });

  form.addEventListener('focusin', function (e) {
    if (e.target.name) lastField = e.target.name;
    if (!started && e.target.name && e.target.name !== 'company_website') {
      started = true;
      track('join_form_start', { first_field: e.target.name });
    }
  });

  /* porzucenie formularza */
  function abandon() {
    if (started && !submitted) {
      track('join_form_abandon', { last_field: lastField, seconds: Math.round((Date.now() - startedAt) / 1000) });
      started = false;
    }
  }
  window.addEventListener('pagehide', abandon);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') abandon(); });

  /* ---------- wysyłka ---------- */
  var btn = document.getElementById('submitBtn');
  var lbl = document.getElementById('submitLbl');
  var alertBox = document.getElementById('formAlert');

  function payload() {
    var data = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.name === 'company_website') return;
      if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; return; }
      if (el.type === 'checkbox') { data[el.name] = el.checked; return; }
      data[el.name] = el.value.trim();
    });
    data.submitted_at = new Date().toISOString();
    data.fill_seconds = Math.round((Date.now() - startedAt) / 1000);
    return data;
  }

  function busy(on) {
    btn.disabled = on;
    btn.classList.toggle('busy', on);
    lbl.textContent = on ? 'Wysyłanie…' : 'Wyślij zgłoszenie';
  }

  function success() {
    submitted = true;
    form.hidden = true;
    var done = document.getElementById('done');
    done.hidden = false;
    done.focus({ preventScroll: true });
    window.scrollTo({ top: done.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    alertBox.hidden = true;
    track('join_form_submit_attempt', {});

    var invalid = Object.keys(rules).filter(function (n) { return !check(n); });
    if (invalid.length) {
      alertBox.textContent = invalid.length === 1
        ? 'Uzupełnij jedno pole zaznaczone na czerwono.'
        : 'Uzupełnij pola zaznaczone na czerwono (' + invalid.length + ').';
      alertBox.hidden = false;
      var first = invalid[0] === 'role' ? form.querySelector('input[name="role"]') : form.elements[invalid[0]];
      first.focus();
      track('join_form_error', { fields: invalid.join(',') });
      return;
    }

    // bot: wypełnione pole-pułapka albo formularz wysłany nienaturalnie szybko
    if (form.elements.company_website.value || Date.now() - startedAt < MIN_FILL_MS) {
      success();
      return;
    }

    var data = payload();
    busy(true);

    var send = FORM_ENDPOINT
      ? fetch(FORM_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); })
      : new Promise(function (res) { console.info('[BIFOR] Zgłoszenie (brak FORM_ENDPOINT — nic nie wysłano):', data); setTimeout(res, 900); });

    send.then(function () {
      track('join_form_submit_success', { role: data.role, source: data.utm_source || data.referrer || 'direct', events_per_year: data.events_per_year || '' });
      success();
    }).catch(function (err) {
      busy(false);
      alertBox.textContent = 'Nie udało się wysłać zgłoszenia. Sprawdź połączenie z internetem i spróbuj ponownie.';
      alertBox.hidden = false;
      track('join_form_submit_failed', { reason: String(err && err.message || err) });
    });
  });
})();
