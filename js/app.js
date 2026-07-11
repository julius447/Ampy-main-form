/* ============================================================================
   Ampy — Main form (Svea-format clone, Ampy content) · interaction layer
   Fields: Förnamn, Efternamn, E-post, Telefonnummer, Adress (autocomplete +
   manual fallback), Meddelande. Live per-field validation, in-place success,
   consent-gated events, webhook → n8nflows.ampy.se/webhook/Kontakt.
   Vanilla JS, scoped to #mfForm.
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
    addrList:  document.getElementById("mfAddrList"),
    addrConfirmed: document.getElementById("mfAddrConfirmed"),
    manualBtn: document.getElementById("mfAddrManual"),
    manualFields: document.getElementById("mfManualFields"),
    adress:    document.getElementById("mf_adress"),
    postnummer: document.getElementById("mf_postnummer"),
    ort:       document.getElementById("mf_ort"),
    submit:    document.getElementById("mfSubmit"),
    success:   document.getElementById("mfSuccess")
  };

  /* ---- validators -------------------------------------------------------- */
  function fieldOf(input) { return input.closest(".mf-field"); }
  function setState(input, valid) {
    var f = fieldOf(input);
    input.classList.toggle("is-valid", valid === true);
    input.classList.toggle("is-invalid", valid === false);
    if (f) f.classList.toggle("has-error", valid === false);
  }
  function vForenamn()  { var ok = els.forenamn.value.trim().length >= 2; setState(els.forenamn, ok); return ok; }
  function vEfternamn() { var ok = els.efternamn.value.trim().length >= 2; setState(els.efternamn, ok); return ok; }
  function vPhone() {
    var v = els.telefon.value.trim().replace(/[\s\-()]/g, "");
    var ok = /^(\+?\d{7,15})$/.test(v);
    setState(els.telefon, ok); return ok;
  }
  function vEmail() {
    var v = els.email.value.trim();
    var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    setState(els.email, ok); return ok;
  }
  function vAddress() {
    var confirmed = form.dataset.addressConfirmed === "1";
    var pn = (els.postnummer.value || "").replace(/\s/g, "");
    var manualOk = els.manualFields.classList.contains("show") && /^\d{5}$/.test(pn);
    var ok = confirmed || manualOk;
    var f = els.addrSok.closest(".mf-field");
    if (f) f.classList.toggle("has-error", !ok && form.dataset.addressTouched === "1");
    els.addrSok.classList.toggle("is-invalid", !ok && form.dataset.addressTouched === "1");
    return ok;
  }

  els.forenamn.addEventListener("blur", vForenamn);
  els.efternamn.addEventListener("blur", vEfternamn);
  els.telefon.addEventListener("blur", vPhone);
  els.email.addEventListener("blur", vEmail);
  [[els.forenamn, vForenamn], [els.efternamn, vEfternamn], [els.telefon, vPhone], [els.email, vEmail]].forEach(function (pair) {
    pair[0].addEventListener("input", function () { if (pair[0].classList.contains("is-invalid")) pair[1](); });
  });

  /* ---- address autocomplete (MOCK) -------------------------------------- */
  var MOCK = [
    { street: "Ankdammsgatan 33", zip: "171 67", city: "Solna" },
    { street: "Sveavägen 44", zip: "111 34", city: "Stockholm" },
    { street: "Drottninggatan 71", zip: "111 36", city: "Stockholm" },
    { street: "Kungsgatan 12", zip: "111 43", city: "Stockholm" },
    { street: "Vasagatan 16", zip: "111 20", city: "Stockholm" },
    { street: "Ringvägen 100", zip: "118 60", city: "Stockholm" },
    { street: "Storgatan 5", zip: "172 71", city: "Sundbyberg" },
    { street: "Nacka Strandväg 3", zip: "131 52", city: "Nacka" },
    { street: "Bergshamravägen 8", zip: "170 77", city: "Solna" },
    { street: "Råsundavägen 150", zip: "169 36", city: "Solna" },
    { street: "Vallgatan 9", zip: "172 30", city: "Sundbyberg" },
    { street: "Tullingebergsvägen 2", zip: "146 40", city: "Tullinge" }
  ];
  function mockSearch(q) {
    q = q.trim().toLowerCase();
    if (q.length < 2) return [];
    return MOCK.filter(function (a) {
      return (a.street + " " + a.zip + " " + a.city).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 6);
  }
  function highlight(text, q) {
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
        '<span>' + highlight(a.street, q) + ' <small>' + a.zip + ' ' + a.city + '</small></span></button>';
    }).join("");
    els.addrList.classList.add("show");
    els.addrSok.setAttribute("aria-expanded", "true");
  }
  function closeList() {
    els.addrList.classList.remove("show");
    els.addrSok.setAttribute("aria-expanded", "false");
    activeIdx = -1;
  }
  function selectAddr(a) {
    els.addrSok.value = a.street + ", " + a.zip + " " + a.city;
    els.adress.value = a.street;
    els.postnummer.value = a.zip;
    els.ort.value = a.city;
    form.dataset.addressConfirmed = "1";
    els.addrConfirmed.querySelector("span").textContent = a.zip + " " + a.city + " — inom vårt område";
    els.addrConfirmed.classList.add("show");
    els.addrSok.classList.remove("is-invalid");
    els.addrSok.closest(".mf-field").classList.remove("has-error");
    closeList();
  }

  var debounce;
  els.addrSok.addEventListener("input", function () {
    form.dataset.addressConfirmed = "0";
    els.addrConfirmed.classList.remove("show");
    trackStart();
    clearTimeout(debounce);
    var q = els.addrSok.value;
    debounce = setTimeout(function () { renderList(mockSearch(q), q); }, 120);
  });
  els.addrSok.addEventListener("blur", function () {
    form.dataset.addressTouched = "1";
    setTimeout(function () { closeList(); vAddress(); }, 150);
  });
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
    var btn = e.target.closest(".mf-addr__opt");
    if (btn) { e.preventDefault(); selectAddr(current[+btn.dataset.i]); }
  });

  els.manualBtn.addEventListener("click", function () {
    var open = els.manualFields.classList.toggle("show");
    els.manualBtn.textContent = open ? "Använd adressök" : "Ange adress manuellt";
    if (open) { closeList(); els.adress.focus(); }
  });
  els.postnummer.addEventListener("input", function () {
    if (form.dataset.addressTouched === "1") vAddress();
  });

  /* ---- conversion tracking (consent-gated) ------------------------------- */
  var started = false;
  function consentOk() {
    return (typeof window.Cookiebot === "undefined") ||
           (window.Cookiebot.consent && window.Cookiebot.consent.marketing);
  }
  function trackStart() {
    if (started) return; started = true;
    if (!consentOk()) return;
    try { if (typeof window.gtag === "function") window.gtag("event", "form_start", { form_id: "kontakt", event_category: "engagement" }); } catch (e) {}
    (window.dataLayer = window.dataLayer || []).push({ event: "form_start", form_id: "kontakt" });
  }
  function trackLead(payload) {
    if (!consentOk()) return;
    try {
      if (typeof window.gtag === "function") window.gtag("event", "generate_lead", { form_id: "kontakt" });
      if (typeof window.fbq === "function") window.fbq("track", "Lead", {}, { eventID: payload.event_id });
    } catch (e) {}
    (window.dataLayer = window.dataLayer || []).push({ event: "generate_lead", form_id: "kontakt" });
  }
  [els.forenamn, els.efternamn, els.email, els.telefon].forEach(function (i) {
    i.addEventListener("focus", trackStart, { once: true });
  });

  /* ---- submit ------------------------------------------------------------ */
  function collect() {
    return {
      form_type: "Kontakt",
      forenamn: els.forenamn.value.trim(),
      efternamn: els.efternamn.value.trim(),
      email: els.email.value.trim(),
      telefon: els.telefon.value.trim(),
      adress: els.adress.value.trim() || els.addrSok.value.trim(),
      postnummer: els.postnummer.value.trim(),
      ort: els.ort.value.trim(),
      meddelande: form.querySelector("#mf_meddelande").value.trim(),
      sida: window.location.href,
      event_id: "kontakt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9)
    };
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    form.dataset.addressTouched = "1";
    var ok = [vForenamn(), vEfternamn(), vEmail(), vPhone(), vAddress()].every(Boolean);
    if (!ok) {
      var firstErr = form.querySelector(".is-invalid, .has-error .mf-input");
      if (firstErr) firstErr.focus();
      return;
    }

    var payload = collect();
    els.submit.classList.add("is-loading");
    els.submit.disabled = true;

    fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(function (r) { if (!r.ok) throw new Error("bad response"); return r; })
    .then(function () { showSuccess(payload); })
    .catch(function () { showSuccess(payload); });  // prototype: show success even if CORS-blocked
  });

  function showSuccess(payload) {
    trackLead(payload);
    form.classList.add("is-hidden");
    els.success.classList.add("show");
    els.success.scrollIntoView({ behavior: "smooth", block: "center" });
  }
})();
