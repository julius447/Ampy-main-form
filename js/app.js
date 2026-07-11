/* ============================================================================
   Ampy — Main form · interaction layer (production-hardened)
   Fields: Förnamn, Efternamn, E-post, Telefonnummer, Adress (Photon autocomplete
   + manual fallback), Meddelande. Forgiving validation, whole-of-Sweden address
   search, in-place success ONLY on a delivered lead, consent-gated events.
   Webhook → n8nflows.ampy.se/webhook/Kontakt. Vanilla JS, scoped to #mfForm.
   ============================================================================ */
(function () {
  "use strict";

  var WEBHOOK_URL = "https://n8nflows.ampy.se/webhook/Kontakt";
  /* PROTOTYPE = the preview hosts where the webhook is cross-origin/CORS-blocked.
     There we tolerate a blocked POST so the demo can complete. On production
     (ampy.se) this is false → a lead is only "sent" on a real 2xx response. */
  var PROTOTYPE = /(^|\.)github\.io$/.test(location.hostname) ||
                  location.hostname === "localhost" || location.hostname === "127.0.0.1" ||
                  location.protocol === "file:";

  var form = document.getElementById("mfForm");
  if (!form) return;

  var els = {
    forenamn:  document.getElementById("mf_forenamn"),
    efternamn: document.getElementById("mf_efternamn"),
    email:     document.getElementById("mf_email"),
    telefon:   document.getElementById("mf_telefon"),
    addrSok:   document.getElementById("mf_adress_sok"),
    addrWrap:  null,
    addrList:  document.getElementById("mfAddrList"),
    manualBtn: document.getElementById("mfAddrManual"),
    manualFields: document.getElementById("mfManualFields"),
    adress:    document.getElementById("mf_adress"),
    postnummer: document.getElementById("mf_postnummer"),
    ort:       document.getElementById("mf_ort"),
    hp:        document.getElementById("mf_hp"),
    submit:    document.getElementById("mfSubmit"),
    error:     document.getElementById("mfError"),
    success:   document.getElementById("mfSuccess")
  };
  els.addrWrap = els.addrSok.closest(".mf-addr__input-wrap");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---- validation state -------------------------------------------------- */
  function fieldOf(input) { return input.closest(".mf-field"); }
  function mark(input, ok) {
    var f = fieldOf(input);
    input.classList.toggle("is-valid", ok === true);
    input.classList.toggle("is-invalid", ok === false);
    if (f) f.classList.toggle("has-error", ok === false);
    if (ok === null) input.removeAttribute("aria-invalid");
    else input.setAttribute("aria-invalid", ok === false ? "true" : "false");
  }
  function clear(input) { mark(input, null); }
  function vName(el)  { return el.value.trim().length >= 2; }
  function vEmail()   { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(els.email.value.trim()); }
  function vPhone()   { return /^\+?\d{7,15}$/.test(els.telefon.value.trim().replace(/[\s\-()]/g, "")); }
  function vAddress() {
    if (els.manualFields.classList.contains("show")) return els.adress.value.trim().length >= 2;
    return els.addrSok.value.trim().length >= 2;
  }

  /* wire ARIA: link each error message to its input + announce politely */
  form.querySelectorAll(".mf-field[data-validate]").forEach(function (f, i) {
    var input = f.querySelector(".mf-input");
    var fb = f.querySelector(".mf-feedback");
    if (input && fb) {
      var id = "mf-err-" + i;
      fb.id = id; fb.setAttribute("aria-live", "polite");
      input.setAttribute("aria-describedby", id);
    }
  });

  /* Forgiving blur: only judge a field the user actually put content in. */
  function blur(el, isValid) {
    return function () { if (el.value.trim() === "") { clear(el); return; } mark(el, isValid()); };
  }
  els.forenamn.addEventListener("blur", blur(els.forenamn, function () { return vName(els.forenamn); }));
  els.efternamn.addEventListener("blur", blur(els.efternamn, function () { return vName(els.efternamn); }));
  els.email.addEventListener("blur", blur(els.email, vEmail));
  els.telefon.addEventListener("blur", blur(els.telefon, vPhone));
  [[els.forenamn, function () { return vName(els.forenamn); }], [els.efternamn, function () { return vName(els.efternamn); }],
   [els.email, vEmail], [els.telefon, vPhone]].forEach(function (p) {
    p[0].addEventListener("input", function () { if (p[0].classList.contains("is-invalid") && p[1]()) mark(p[0], true); });
  });

  /* ---- address autocomplete — Photon (whole of Sweden, free, no key) ------
     Production recommendation: swap for Google Places Autocomplete (referrer-
     locked key). fetchAddresses is API-agnostic below the transport line. */
  var PHOTON = "https://photon.komoot.io/api/";
  var seq = 0, addrCtrl = null;
  function fetchAddresses(q, cb) {
    q = q.trim();
    if (q.length < 3) { cb([], "idle"); return; }
    var my = ++seq;
    if (addrCtrl) addrCtrl.abort();
    addrCtrl = ("AbortController" in window) ? new AbortController() : null;
    var to = setTimeout(function () { if (addrCtrl) addrCtrl.abort(); }, 6000);
    var url = PHOTON + "?q=" + encodeURIComponent(q) + "&limit=8&lat=59.33&lon=18.06";
    fetch(url, addrCtrl ? { signal: addrCtrl.signal } : undefined)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        clearTimeout(to);
        if (my !== seq) return;                 // stale response — a newer query won
        var seen = {};
        var items = (d.features || []).map(function (f) {
          var p = f.properties || {};
          var street = p.street ? (p.street + (p.housenumber ? " " + p.housenumber : "")) : (p.name || "");
          return { s: street, z: p.postcode || "", c: p.city || p.town || p.village || p.municipality || "", cc: p.countrycode };
        }).filter(function (a) {
          if (!a.s || a.cc !== "SE") return false;
          var k = a.s + a.z + a.c; if (seen[k]) return false; seen[k] = 1; return true;
        });
        cb(items, items.length ? "ok" : "empty");
      })
      .catch(function (e) {
        clearTimeout(to);
        if (my !== seq) return;
        cb([], (e && e.name === "AbortError") ? "abort" : "error");
      });
  }
  function hl(text, q) {
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1 || q.length < 2) return esc(text);
    return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
  }
  var activeIdx = -1, current = [];
  function setActive(n) {
    activeIdx = n;
    var opts = els.addrList.querySelectorAll(".mf-addr__opt");
    opts.forEach(function (o, k) {
      var on = k === n;
      o.classList.toggle("active", on);
      o.setAttribute("aria-selected", on ? "true" : "false");
    });
    els.addrSok.setAttribute("aria-activedescendant", n > -1 ? "mf-addr-opt-" + n : "");
  }
  function renderList(items, state, q) {
    current = items; activeIdx = -1; els.addrSok.setAttribute("aria-activedescendant", "");
    if (!items.length) {
      if (state === "error" || state === "abort") {
        els.addrList.innerHTML = '<div class="mf-addr__note">Adressökningen svarar inte just nu &ndash; skriv adressen eller välj &ldquo;Ange adress manuellt&rdquo;.</div>';
        els.addrList.classList.add("show"); els.addrSok.setAttribute("aria-expanded", "true");
      } else if (state === "empty") {
        els.addrList.innerHTML = '<div class="mf-addr__note">Inga träffar &ndash; kontrollera stavningen eller ange adressen manuellt.</div>';
        els.addrList.classList.add("show"); els.addrSok.setAttribute("aria-expanded", "true");
      } else { closeList(); }
      return;
    }
    els.addrList.innerHTML = items.map(function (a, n) {
      return '<button type="button" id="mf-addr-opt-' + n + '" class="mf-addr__opt" role="option" aria-selected="false" data-i="' + n + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
        '<span>' + hl(a.s, q) + ' <small>' + esc(a.z) + ' ' + esc(a.c) + '</small></span></button>';
    }).join("");
    els.addrList.classList.add("show");
    els.addrSok.setAttribute("aria-expanded", "true");
  }
  function closeList() {
    els.addrList.classList.remove("show");
    els.addrSok.setAttribute("aria-expanded", "false");
    els.addrSok.setAttribute("aria-activedescendant", "");
    activeIdx = -1;
  }
  function selectAddr(a) {
    els.addrSok.value = a.s + ", " + a.z + " " + a.c;
    els.adress.value = a.s; els.postnummer.value = a.z; els.ort.value = a.c;
    mark(els.addrSok, null);
    var f = els.addrSok.closest(".mf-field"); if (f) f.classList.remove("has-error");
    closeList();
  }
  var deb;
  els.addrSok.addEventListener("input", function () {
    // any prior pick is invalidated the moment the search text changes
    els.adress.value = ""; els.postnummer.value = ""; els.ort.value = "";
    trackStart(); clearTimeout(deb); var q = els.addrSok.value;
    deb = setTimeout(function () { fetchAddresses(q, function (items, state) { renderList(items, state, q); }); }, 250);
  });
  els.addrSok.addEventListener("blur", function () { setTimeout(closeList, 150); });
  els.addrSok.addEventListener("keydown", function (e) {
    if (!els.addrList.classList.contains("show")) return;
    var opts = els.addrList.querySelectorAll(".mf-addr__opt");
    if (e.key === "ArrowDown") { e.preventDefault(); if (opts.length) setActive(Math.min(activeIdx + 1, opts.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (opts.length) setActive(Math.max(activeIdx - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (activeIdx > -1 && current[activeIdx]) selectAddr(current[activeIdx]); }
    else if (e.key === "Escape") { closeList(); }
  });
  els.addrList.addEventListener("mousedown", function (e) {
    var btn = e.target.closest(".mf-addr__opt"); if (btn) { e.preventDefault(); selectAddr(current[+btn.dataset.i]); }
  });

  /* manual toggle — hides the search, reveals street/zip/city; exposes state */
  els.manualBtn.addEventListener("click", function () {
    var open = !els.manualFields.classList.contains("show");
    els.manualFields.classList.toggle("show", open);
    els.addrWrap.style.display = open ? "none" : "";
    els.manualBtn.textContent = open ? "Sök efter adress" : "Ange adress manuellt";
    els.manualBtn.setAttribute("aria-expanded", String(open));
    if (open) { closeList(); els.adress.focus(); } else { els.addrSok.focus(); }
  });

  /* ---- conservation-gated tracking (fail-CLOSED: no consent tool → no events) */
  var started = false;
  function consentOk() {
    // Only track when a consent tool is present AND marketing consent is granted.
    return (typeof window.Cookiebot !== "undefined") && !!(window.Cookiebot.consent && window.Cookiebot.consent.marketing);
  }
  function trackStart() {
    if (started) return;
    if (!consentOk()) return;         // latch only after a real emit
    started = true;
    try { if (typeof window.gtag === "function") window.gtag("event", "form_start", { form_id: "kontakt" }); } catch (e) {}
    (window.dataLayer = window.dataLayer || []).push({ event: "form_start", form_id: "kontakt" });
  }
  function trackLead(p) {
    if (!consentOk()) return;
    try {
      if (typeof window.gtag === "function") window.gtag("event", "generate_lead", { form_id: "kontakt" });
      if (typeof window.fbq === "function") window.fbq("track", "Lead", {}, { eventID: p.event_id });
    } catch (e) {}
    (window.dataLayer = window.dataLayer || []).push({ event: "generate_lead", form_id: "kontakt" });
  }
  [els.forenamn, els.efternamn, els.email, els.telefon].forEach(function (i) { i.addEventListener("focus", trackStart); });

  /* ---- submit ------------------------------------------------------------ */
  function collect() {
    return {
      form_type: "Kontakt",
      forenamn: els.forenamn.value.trim(), efternamn: els.efternamn.value.trim(),
      email: els.email.value.trim(), telefon: els.telefon.value.trim(),
      adress: els.adress.value.trim() || els.addrSok.value.trim(),
      postnummer: els.postnummer.value.trim(), ort: els.ort.value.trim(),
      meddelande: form.querySelector("#mf_meddelande").value.trim(),
      sida: window.location.href,
      event_id: "kontakt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9)
    };
  }
  function hideError() { els.error.classList.remove("show"); }
  function showError() {
    els.submit.classList.remove("is-loading"); els.submit.disabled = false;
    els.error.classList.add("show");
    els.error.focus && els.error.focus();
  }
  function showSuccess(payload, delivered) {
    if (delivered) trackLead(payload);   // only report a conversion for a truly delivered lead
    form.classList.add("is-hidden");
    els.success.classList.add("show");
    if (els.success.focus) els.success.focus();
    els.success.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideError();
    if (els.hp && els.hp.value) return;   // honeypot: silently drop bots

    var checks = [
      [els.forenamn, vName(els.forenamn)], [els.efternamn, vName(els.efternamn)],
      [els.email, vEmail()], [els.telefon, vPhone()]
    ];
    var ok = true;
    checks.forEach(function (c) { mark(c[0], c[1]); if (!c[1]) ok = false; });
    var addrOk = vAddress();
    var addrInput = els.manualFields.classList.contains("show") ? els.adress : els.addrSok;
    mark(addrInput, addrOk ? null : false); if (!addrOk) { addrInput.closest(".mf-field").classList.add("has-error"); ok = false; }
    if (!ok) { var first = form.querySelector(".is-invalid, .has-error .mf-input"); if (first) first.focus(); return; }

    var payload = collect();
    els.submit.classList.add("is-loading"); els.submit.disabled = true;

    var ctrl = ("AbortController" in window) ? new AbortController() : null;
    var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, 12000);
    fetch(WEBHOOK_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal: ctrl ? ctrl.signal : undefined
    })
    .then(function (r) { clearTimeout(to); if (!r.ok) throw new Error("http " + r.status); return r; })
    .then(function () { showSuccess(payload, true); })          // delivered
    .catch(function () {
      clearTimeout(to);
      // Preview hosts (github.io/localhost) CORS-block the POST → let the demo
      // complete, but do NOT count it as a delivered conversion. Production is
      // strict: surface an error and keep the form so the lead is never lost.
      if (PROTOTYPE) showSuccess(payload, false);
      else showError();
    });
  });
})();
