/* BIFOR — formularz „Umów prezentację”
   Walidacja, antyspam, źródło wejścia, zdarzenia analityczne i wysyłka.
   Na bifor.pl zgłoszenie odbiera send.php i wysyła je e-mailem na kontakt@bifor.pl.
   Na podglądzie (GitHub Pages, localhost, plik z dysku) PHP nie działa, więc
   formularz pracuje w trybie pokazowym: niczego nie wysyła i mówi o tym wprost. */
(function () {
  'use strict';

  var LIVE = /(^|\.)bifor\.pl$/.test(location.hostname);
  try { if (sessionStorage.getItem('bifor_force_send') === '1') LIVE = true; } catch (e) { /* test lokalny z PHP */ }
  var FORM_ENDPOINT = LIVE ? 'send.php' : '';
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
    // pola opcjonalne: puste przechodzą, wypełnione muszą mieć sens
    phone: function (v) { v = v.trim(); return !v || (v.replace(/\D/g, '').length >= 9 && /^[\d\s+()-]+$/.test(v)); },
    company: function (v) { return v.trim().length >= 2; },
    postal_code: function (v) { v = v.trim(); return !v || /^\d{2}-\d{3}$/.test(v); },
    website: function (v) { v = v.trim(); return !v || /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v); },
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
      if (!el.name) return;
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
    var demo = document.getElementById('demoNote');
    if (demo) demo.hidden = !!FORM_ENDPOINT;
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
          .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          })
          .then(function (res) { if (!res || res.ok !== true) throw new Error('odpowiedź serwera'); })
      : new Promise(function (res) { console.info('[BIFOR] Zgłoszenie (brak FORM_ENDPOINT — nic nie wysłano):', data); setTimeout(res, 900); });

    send.then(function () {
      track('join_form_submit_success', { role: data.role, source: data.utm_source || data.referrer || 'direct', events_per_year: data.events_per_year || '' });
      if (FORM_ENDPOINT && window.biforLead) window.biforLead(); // piksel Meta: tylko po zgodzie i po prawdziwej wysyłce
      success();
    }).catch(function (err) {
      busy(false);
      alertBox.textContent = /HTTP 429/.test(String(err && err.message))
        ? 'Z tego adresu przyszło już kilka zgłoszeń. Spróbuj za godzinę albo zadzwoń: 510 400 388.'
        : 'Nie udało się wysłać zgłoszenia. Spróbuj ponownie, napisz na kontakt@bifor.pl albo zadzwoń: 510 400 388.';
      alertBox.hidden = false;
      track('join_form_submit_failed', { reason: String(err && err.message || err) });
    });
  });
})();
