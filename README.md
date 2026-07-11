# Ampy — Main form redesign (`/offert`)

A conversion-optimised redesign of Ampy's contact/offert form. Built end-to-end through the
**Ampy Design Engine** (`/ampy`): Ampy tokens, `ampy-rost` voice, the **candour gate**, and
`ampy-foretagsdata` facts have final say over every competitor idea (Svea, Evify).

**This is a self-contained design prototype for owner review — not the production build.** It renders
1:1 the layout, copy, states and flow that a developer then clones in Bricks/FluentSnippets. The
prototype's mock address-search and permissive submit-fallback are called out below.

- **Live preview:** open `index.html` (or the GitHub Pages URL once enabled — see bottom).
- **Files:** `index.html` · `css/styles.css` · `js/app.js`
- **Reference pack it was built from:** `../README.md`, `../ampy/`, `../svea/`, `../evify/`.

---

## What changed vs. the current form (and why)

| | Current (`ampy/`) | **Redesign** | Rationale |
|---|---|---|---|
| Layout | form left · testimonial photo right | **trust panel left · form right** | matches Svea + Evify; puts reassurance *before* the ask |
| Trust surface | stock photo + black overlay | **Ampy navy-aurora panel** (real tokens) | on-brand, no stock photo, premium two-tone |
| Heading | "Få en kostnadsfri konsultation**!**" | "Få en kostnadsfri **rådgivning**" (last word gradient) | `ampy-rost` bans `!`; keeps the brand last-word gradient |
| Paragraph | left-aligned "Alltid fasta priser…" | **centered**, candour-safe (no universal "spara") | Svea's centered treatment; survives stödtjänster=0 ∧ effektavgift=0 |
| Name | Förnamn + Efternamn (2 required) | **Ditt namn** (1 field) | Evify pattern; lower friction |
| Address | Adress + Postnummer (2 free-text) | **address search** (autocomplete → postnr) + manual fallback | Svea pattern; postnr comes free, cleaner data |
| Service | **required free-text "Tjänst"** | **multi-select chips** (icon + label) | kills messy lead data; Evify pattern |
| Customer type | — | **Kundtyp select** (Privat / Företag / BRF) | routes the lead (Evify) |
| Reassurance | none | **"Vad händer sen" 3-step ladder** (the signature device) | removes the "what happens after I submit / am I committing?" hesitation |
| Proof | static Google stars strip | **stars + Google (no number)** + honest facts | candour gate — no rights-cleared rating figure exists (see [GAP]) |
| Validation | Bricks server default | **live per-field on blur** + inline `ampy-rost` messages | Evify pattern; forgiving |
| Success | redirect `/thank-you/` | **in-place success card** (no navigation) | preserves momentum; still fires the conversion event |
| Submit | `Få ditt förslag` (bright green `#57f1a1`) | `Få ditt förslag` (**canonical teal `#00a991`**) | reconciled to the real token |

**Minimum lead (first-principles, kept):** namn + telefon + adress(→postnr) + GDPR. Everything else
(e-post, kundtyp, intresse, meddelande) is optional and must earn its place.

### Mobile
Columns stack via flex `order`: **compact trust strip (logo + quote + Google stars) → form →
"Vad händer sen" + proof**. Rationale: on mobile the visitor came to submit — a tall trust column
would bury the form. So we give a *compact* trust cue up top, the form immediately, then the
reassurance ladder lands right where the thumb is at the submit button. (E-post/telefon un-split to
one column under 560px.)

---

## Field → Bricks / webhook mapping

Webhook unchanged: **`POST https://n8nflows.ampy.se/webhook/Kontakt`** (JSON). New payload keys:

| # | Label (UI) | Bricks field `name` | Type | Required | Notes |
|---|---|---|---|---|---|
| — | (hidden) | `form_type` | hidden | — | value `Kontakt` (unchanged) |
| 1 | Kundtyp | `kundtyp` | select | ✅ (default Privatperson) | Privatperson / Företag / Bostadsrättsförening |
| 2 | Ditt namn | `namn` | text | ✅ | replaces `forenamn` + `efternamn` |
| 3 | E-postadress | `email` | email | ➖ optional | validated *if filled* |
| 4 | Telefonnummer | `telefon` | tel | ✅ | the required contact channel |
| 5 | Adress (sök) | `adress` | text | ✅ (via search or manual) | autocomplete fills 5–7 |
| 5b | Postnummer | `postnummer` | text | ✅ | auto-filled by search, or manual |
| 5c | Ort | `ort` | text | ➖ | auto-filled by search |
| 6 | Jag är intresserad av… | `intresse[]` | checkbox (multi) | ➖ | replaces free-text `tjanst` |
| 7 | Meddelande | `meddelande` | textarea | ➖ | unchanged |
| — | (page URL) | `sida` | hidden | — | analytics context |
| — | (dedupe id) | `event_id` | hidden | — | for Meta CAPI/GA4 dedupe |

**Bricks build notes.** Rebuild fields as native Bricks Form elements with the `name`s above; keep the
three actions **webhook + save-submission**, but **swap `redirect` for the in-place success** (Bricks
"Show success message" / custom JS). Bind the left-column rating to `{acf_google_rating}` /
`{acf_google_business_profile_url}` **only if the owner decides to surface a number** (see [GAP]).
Instrumentation: `form_start` on first field focus + `generate_lead` on success, **consent-gated**
(Consent Mode / Cookiebot) per the `ampy-webb-playbook` contract — already wired in `js/app.js`.

> Production packaging note: the final deliverable is the 3-file FluentSnippets bundle
> (`styles.css` scoped + px · `backend.php` shortcode + nonce-gated REST · `engine.js` IIFE) per
> `ampy-webb-playbook/fluentsnippets-delivery.md`. This prototype is the design/behaviour source of
> truth that bundle must match 1:1; the CSS here is already scoped under `.mf-*` and uses no globals.

---

## Candour ledger (what shipped, and what we refused to invent)

- ✅ **Rating:** 5 stars + Google wordmark, **no number, no review count.** `ampy-foretagsdata` §5:
  *"there is NO rights-cleared social proof"* and CLAUDE.md forbids asserting "5.0 på Google". We do
  **not** print Svea's 4.2/3 888 or any figure.
- ✅ **Honest proof instead:** "3000+ installationer per år" (owner-confirmed 2026-07-10) +
  "Registrerat hos Elsäkerhetsverket" (verifiable via Kolla elföretaget, `foretag=12047521`).
- ✅ **No callback SLA:** step 2 promises a call but **no time** — Svea's "48 timmar" was not copied.
- ✅ **Footprint:** "Vi arbetar i Stockholm med omnejd" — never "hela Sverige" (national = future).
- ✅ **Voice:** no `!`, no superlatives, du-tilltal; the quote's `!` was dropped.
- ✅ **Tokens:** teal `#00a991` / midnight `#090b32` / Outfit only. No Svea green, no Evify purple.
- ⓘ **Icons:** the "Vad händer sen" and chip icons are **clean Ampy-stroke line icons**, not Svea's
  proprietary SVGs (on-brand + avoids lifting a competitor asset). Swap chip glyphs for Ampy's own
  menu SVGs (`Elinstallation_icon.svg`, `Laddbox_icon.svg`, `batteri_icon.svg`) in production if wanted.

---

## [GAP] — owner inputs required before go-live

1. **[GAP] Google rating display.** No rights-cleared rating/count exists in `ampy-foretagsdata`.
   Decide: (a) keep **stars + "Betyg på Google" with no number** (current, safest), or (b) surface the
   live ACF value (`{acf_google_rating}`, e.g. "5,0 · 16 omdömen") — owner must confirm it's current
   and independently defensible before we print a figure.
2. **[GAP] Callback time (step 2).** We deliberately promise a call with **no time**. Give the real,
   defensible återkopplingstid (e.g. "Vi hör av oss inom X") and we'll add it — do not copy "48h/24h".
3. **[GAP] Address API.** The prototype uses a clearly-tagged **`mock-sök`** (curated Stockholm-region
   list). Pick one for production:
   - **Google Places Autocomplete** — best coverage; ~US$2.83 / 1 000 Autocomplete sessions + details;
     needs a billed API key with HTTP-referrer restriction; geo-bias to the Stockholm region.
   - **Swedish provider** (e.g. a Lantmäteriet / PostNord address+postnr lookup) — keeps data in-country,
     often cheaper for postnr-only needs, but more integration work.
   - Fallback "Ange adress manuellt" (adress + postnr + ort) is already built and always available.
4. **[GAP] Chip set — sign-off.** Proposed final: **Elinstallationer · Laddbox · Solcellsbatteri ·
   Eljour** (service-led order per commercial priority). Confirm, or add **Solceller** / drop **Eljour**.
5. **[GAP] Quote attribution.** We kept our own displayed line ("…service i världsklass", `!` dropped).
   A first name ("— Mathias") would strengthen it; confirm we may attribute.
6. **[GAP] Webhook field test.** Confirm the n8n flow accepts the new keys (`namn`, `kundtyp`,
   `intresse[]`, `postnummer`, `ort`) or map them to existing columns.
7. Standard launch items: OG image (unchanged for a form), analytics container live, consent categories
   mapped, `php -l` on the Bricks snippet at staging.

---

## Prototype ≠ production caveats

- **Mock address search** (`js/app.js` → `mockSearch`): replace with the chosen API; the list render,
  keyboard nav and select→postnr fill are API-agnostic and reusable.
- **Submit fallback:** from a static preview the webhook may be CORS-blocked, so the prototype shows the
  success card even on network error (so the flow is reviewable). Production posts server-side and only
  shows success on a real `200`.
- **Fonts:** prototype loads Outfit from Google Fonts for rendering; production self-hosts it.

---

## Live preview

- **Local:** open `components/main-form/ampy-redesign/index.html` in a browser (all assets are relative).
- **GitHub Pages:** if enabled for `julius447/Picasso`, the URL is
  `https://julius447.github.io/Picasso/components/main-form/ampy-redesign/`.
