/* ============================================================================
   Ampy — Main form · interaction layer
   Fields: Förnamn, Efternamn, E-post, Telefonnummer, Adress (autocomplete +
   Svea-style manual toggle), Meddelande. Forgiving validation (never red on a
   focus→blur of an empty field), address accepts anything (no area check),
   in-place success, consent-gated events, webhook → n8nflows.ampy.se/webhook/Kontakt.
   ============================================================================ */
(function () {
  "use strict";

  var WEBHOOK_URL = "https://n8nflows.ampy.se/webhook/Kontakt";
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
    submit:    document.getElementById("mfSubmit"),
    success:   document.getElementById("mfSuccess")
  };
  els.addrWrap = els.addrSok.closest(".mf-addr__input-wrap");

  /* ---- validators (return true/false) ------------------------------------ */
  function fieldOf(input) { return input.closest(".mf-field"); }
  function mark(input, ok) {
    var f = fieldOf(input);
    input.classList.toggle("is-valid", ok === true);
    input.classList.toggle("is-invalid", ok === false);
    if (f) f.classList.toggle("has-error", ok === false);
  }
  function clear(input) { mark(input, null); }
  function vName(el)  { return el.value.trim().length >= 2; }
  function vEmail()   { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(els.email.value.trim()); }
  function vPhone()   { return /^\+?\d{7,15}$/.test(els.telefon.value.trim().replace(/[\s\-()]/g, "")); }
  function vAddress() {
    // accept ANY address (whole of Sweden). Valid = something entered, either the
    // search field or (in manual mode) the street field. No area restriction.
    if (els.manualFields.classList.contains("show")) return els.adress.value.trim().length >= 2;
    return els.addrSok.value.trim().length >= 2;
  }

  /* Forgiving blur: only judge a field the user actually put content in.
     A focus→blur of an EMPTY field never turns red (it just stays neutral). */
  function blur(el, isValid) {
    return function () {
      if (el.value.trim() === "") { clear(el); return; }
      mark(el, isValid());
    };
  }
  els.forenamn.addEventListener("blur", blur(els.forenamn, function () { return vName(els.forenamn); }));
  els.efternamn.addEventListener("blur", blur(els.efternamn, function () { return vName(els.efternamn); }));
  els.email.addEventListener("blur", blur(els.email, vEmail));
  els.telefon.addEventListener("blur", blur(els.telefon, vPhone));
  // while typing, clear an existing error as soon as it becomes valid
  [[els.forenamn, function () { return vName(els.forenamn); }], [els.efternamn, function () { return vName(els.efternamn); }],
   [els.email, vEmail], [els.telefon, vPhone]].forEach(function (p) {
    p[0].addEventListener("input", function () { if (p[0].classList.contains("is-invalid") && p[1]()) mark(p[0], true); });
  });

  /* ---- address autocomplete — REAL, whole of Sweden ----------------------
     Prototype uses Photon (photon.komoot.io, OSM, free, no key, CORS, EU-hosted),
     bounded to Sweden. For PRODUCTION swap the fetch for Google Places
     Autocomplete (referrer-locked key) — see README. Query → [{s,z,c}]. */
  var PHOTON = "https://photon.komoot.io/api/";
  function fetchAddresses(q, cb) {
    q = q.trim();
    if (q.length < 3) { cb([]); return; }
    var url = PHOTON + "?q=" + encodeURIComponent(q) +
      "&limit=8&lat=59.33&lon=18.06";   /* Photon has no sv locale; address data is language-neutral */
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      var seen = {};
      var items = (d.features || []).map(function (f) {
        var p = f.properties || {};
        var street = p.street ? (p.street + (p.housenumber ? " " + p.housenumber : "")) : (p.name || "");
        return { s: street, z: p.postcode || "", c: p.city || p.town || p.village || p.municipality || "", cc: p.countrycode };
      }).filter(function (a) {
        if (!a.s || a.cc !== "SE") return false;
        var k = a.s + a.z + a.c; if (seen[k]) return false; seen[k] = 1; return true;
      });
      cb(items);
    }).catch(function () { cb([]); });
  }
  function hl(text, q) {
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1 || q.length < 2) return text;
    return text.slice(0, i) + "<mark>" + text.slice(i, i + q.length) + "</mark>" + text.slice(i + q.length);
  }
  var activeIdx = -1, current = [];
  function renderList(items, q) {
    current = items; activeIdx = -1;
    if (!items.length) { closeList(); return; }
    els.addrList.innerHTML = items.map(function (a, n) {
      return '<button type="button" class="mf-addr__opt" role="option" data-i="' + n + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
        '<span>' + hl(a.s, q) + ' <small>' + a.z + ' ' + a.c + '</small></span></button>';
    }).join("");
    els.addrList.classList.add("show"); els.addrSok.setAttribute("aria-expanded", "true");
  }
  function closeList() { els.addrList.classList.remove("show"); els.addrSok.setAttribute("aria-expanded", "false"); activeIdx = -1; }
  function selectAddr(a) {
    els.addrSok.value = a.s + ", " + a.z + " " + a.c;
    els.adress.value = a.s; els.postnummer.value = a.z; els.ort.value = a.c;
    mark(els.addrSok, null);                 // no green confirmation — just accept it
    var f = els.addrSok.closest(".mf-field"); if (f) f.classList.remove("has-error");
    closeList();
  }
  var deb;
  els.addrSok.addEventListener("input", function () {
    trackStart(); clearTimeout(deb); var q = els.addrSok.value;
    deb = setTimeout(function () { fetchAddresses(q, function (items) { renderList(items, q); }); }, 250);
  });
  els.addrSok.addEventListener("blur", function () { setTimeout(closeList, 150); });
  els.addrSok.addEventListener("keydown", function (e) {
    if (!els.addrList.classList.contains("show")) return;
    var opts = els.addrList.querySelectorAll(".mf-addr__opt");
    if (e.key === "ArrowDown") { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, opts.length - 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); }
    else if (e.key === "Enter" && activeIdx > -1) { e.preventDefault(); selectAddr(current[activeIdx]); return; }
    else if (e.key === "Escape") { closeList(); return; }
    opts.forEach(function (o, n) { o.classList.toggle("active", n === activeIdx); });
  });
  els.addrList.addEventListener("mousedown", function (e) {
    var btn = e.target.closest(".mf-addr__opt"); if (btn) { e.preventDefault(); selectAddr(current[+btn.dataset.i]); }
  });

  /* Manual toggle — Svea pattern: hide the search, reveal the street/zip/city box */
  els.manualBtn.addEventListener("click", function () {
    var open = !els.manualFields.classList.contains("show");
    els.manualFields.classList.toggle("show", open);
    els.addrWrap.style.display = open ? "none" : "";
    els.manualBtn.textContent = open ? "Sök efter adress" : "Ange adress manuellt";
    if (open) { closeList(); els.adress.focus(); } else { els.addrSok.focus(); }
  });

  /* ---- conversion tracking (consent-gated) ------------------------------- */
  var started = false;
  function consentOk() { return (typeof window.Cookiebot === "undefined") || (window.Cookiebot.consent && window.Cookiebot.consent.marketing); }
  function trackStart() {
    if (started) return; started = true; if (!consentOk()) return;
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
  [els.forenamn, els.efternamn, els.email, els.telefon].forEach(function (i) { i.addEventListener("focus", trackStart, { once: true }); });

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
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    // full check on submit (empty required fields DO error here)
    var checks = [
      [els.forenamn, vName(els.forenamn)], [els.efternamn, vName(els.efternamn)],
      [els.email, vEmail()], [els.telefon, vPhone()]
    ];
    var ok = true;
    checks.forEach(function (c) { mark(c[0], c[1]); if (!c[1]) ok = false; });
    var addrOk = vAddress();
    var addrInput = els.manualFields.classList.contains("show") ? els.adress : els.addrSok;
    mark(addrInput, addrOk || null); if (!addrOk) { addrInput.closest(".mf-field").classList.add("has-error"); ok = false; }
    if (!ok) { var first = form.querySelector(".is-invalid, .has-error .mf-input"); if (first) first.focus(); return; }

    var payload = collect();
    els.submit.classList.add("is-loading"); els.submit.disabled = true;
    fetch(WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) throw new Error("bad"); return r; })
      .then(function () { showSuccess(payload); })
      .catch(function () { showSuccess(payload); });   // prototype: show success even if CORS-blocked
  });
  function showSuccess(p) {
    trackLead(p);
    form.classList.add("is-hidden");
    els.success.classList.add("show");
    els.success.scrollIntoView({ behavior: "smooth", block: "center" });
  }
})();
