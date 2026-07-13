# Ampy — Main contact form (redesign) · Bricks paste file

`ampy-mainform.bricks.json` reproduces the redesigned Ampy contact form
(`../../index.html` + `css/styles.css` + `js/app.js`) as **paste-valid Bricks
"copied elements"**, mirroring the envelope and conventions of the owner's
`_ORIGINAL-reference.bricks.json` exactly.

- Envelope: `{ content:[section], source:"bricksCopiedElements", version:"2.3.9", components:[…] }`
- Two components, same shape as the original: a **section** wrapper (`mfsec1`)
  that references the **container** component (`mfcont`) via `cid`.
- Validated: `JSON.parse` succeeds; 30 container elements; no duplicate ids.

---

## How Chris pastes it

1. Open the target page/template in **Bricks** (builder).
2. Right-click the canvas (or a structure node) → **Paste elements**
   (Bricks reads the clipboard, but it also imports a `bricksCopiedElements`
   JSON directly). Alternatively: select the JSON contents, copy, then
   `⌘/Ctrl+V` on the Bricks canvas.
3. It drops in as: `section "Main contact"` → `container "Global Form"` → two
   panes + the engine code element.

> The **code element** (`mfcode`, `executeCode: true`) carries JS + a scoped
> `<style>`. Bricks only runs `executeCode` for users whose role is allowed to
> execute code (**Bricks → Settings → Custom code**). Confirm Chris's user has
> that capability, or the autocomplete/CSS won't run.

---

## Element tree

```
section  Main contact            mfsec1   bg Color #20 (#f5f9ff), padded
└ container  Global Form         mfcont   #fff, radius --apradius-l, row, max 1220px,
  │                                       fadeIn on enterView, data-mf="card"
  ├ block  Photo pane            mfphot   bg-image (form-image-1.webp) + overlay
  │ │                                     gradient rgba(6,8,26,.55), data-mf="photo"
  │ ├ image  Logo                mflogo   white wordmark, data-mf="logo"   [GAP asset]
  │ ├ block  Info                mfbody
  │ │ ├ text-basic  Testimonial  mfquot   "…service i världsklass." data-mf="quote"
  │ │ ├ div(a)  Google rating    mfrato   link → {acf_google_business_profile_url}
  │ │ │ ├ div  Stars             mfstar   data-mf="stars"
  │ │ │ │ └ icon ×5              mfst01-05 ion-md-star (gold via scoped CSS)
  │ │ │ └ text-basic  Rating txt mfrtxt   "{acf_google_rating} · Betyg på Google"
  │ │ └ text-basic  Volume       mfvol1   "3 000+ genomförda installationer…"  [GAP prov.]
  │ └ block(ul)  Steps           mfstpb   3-up row, data-mf="steps"
  │   ├ li  Step 1               mfsp1    ion-md-send + "Skicka in dina uppgifter"
  │   ├ li  Step 2               mfsp2    ion-md-call + "Vi ringer dig inom 24 timmar"
  │   └ li  Step 3               mfsp3    ion-md-checkmark + "Kostnadsfri rådgivning…"
  └ block  Form pane             mffrmb   #fff, soft shadow, data-mf="formpane"
    ├ heading  Header            mfhead   "Få en kostnadsfri rådgivning" +
    │                                     text-gradient + data-highlight="last-1"
    ├ text-basic  Paragraph      mfpara   "Bli uppringd av vår behöriga elektriker…"
    ├ form  Form                 mffrm2   native Bricks form (see below)
    ├ text  Consent              mfcons   → /integritetspolicy/
    └ code  Engine               mfcode   JS (address autocomplete/validation/aria)
                                          + scoped <style> (mobile full-bleed etc.)
```

`data-mf="…"` attributes are real HTML attributes (Bricks `_attributes`) — the
scoped CSS and the engine JS hook off them, so nothing depends on Bricks'
generated element ids.

---

## The form (native Bricks) + webhook

`mffrm2` is a **native Bricks `form`** — it owns submission and the webhook
(server-side, no CORS). Conventions match the original export 1:1.

- **Fields** (`name` → webhook key): `forenamn`, `efternamn`, `email`,
  `telefon`, `adress`, `meddelande`, hidden `form_type = "Kontakt"`.
  Field ids are `fornmn / efternm / emailf / telefn / adrssf / meddel / ftype`.
- **Submit:** `Gratis rådgivning` · full width · pill radius (`999px`) · teal
  `#00a991` (the teal→green **gradient** is applied by the code-element CSS —
  Bricks' solid `submitButtonBackgroundColor` can't hold a gradient).
- **Field style:** `fieldBackgroundColor #f7f7f7`, radius `8`, Outfit labels.
- **actions:** `["webhook","save-submission"]` (redirect dropped — the redesign
  shows an in-place success; Bricks' native `successMessage` is set).
- **Webhook:** `https://n8nflows.ampy.se/webhook/Kontakt` (the redesign's
  endpoint — same URL the original already used).

### Engine vs native form (division of labour — important)

The redesign's `js/app.js` did its **own** `fetch` POST + in-place success. To
avoid a **double submit**, the pasted build lets the **native Bricks form** own
submit + webhook, and the code element (`mfcode`) is an **enhancement layer
only**:

- ✅ address autocomplete (Photon — free, whole of Sweden, no key),
- ✅ forgiving blur validation (name/email/phone) with `aria-invalid`,
- ✅ ARIA combobox wiring on the address field,
- ✅ the scoped `<style>` for things native Bricks can't express (mobile
  full-bleed photo + floating form card, steps reflow, submit gradient,
  dropdown styling).

It does **not** POST or render success — Bricks does. Canonical, fuller JS/CSS
live in `../../js/app.js` and `../../css/styles.css`; the code element inlines a
trimmed version.

---

## Design tokens used (unchanged from the Ampy system)

`--apspace-*` (padding/gaps), `--apradius-l` / `999px` pill, `--aptext-*`
(type scale), palette refs `Color #20` (#f5f9ff), `Color #19` (#fff),
`Color #49` (shadow). Teal `#00a991`, gold stars `#ffc24b`, overlay
`rgba(6,8,26,0.55)`. Responsive suffixes used: `:mobile_portrait`,
`:tablet_portrait` (matching the original's convention).

---

## Open [GAP]s — resolve before go-live

| # | GAP | What to do |
|---|-----|------------|
| 1 | **Real photo** | Placeholder is `https://ampy.se/wp-content/uploads/form-image-1.webp`. The chosen redesign photo is `Modernt-hus-…` (local `assets/form-photo.jpg`). Owner uploads the real photo to the Media Library and swaps the `mfphot` `_background.image` URL/id. |
| 2 | **White logo asset URL** | `mflogo` points at a placeholder `…/ampy-logo-white.png` with **no attachment id**. Upload the real white wordmark (local `assets/ampy-logo-white.png`) and set its Media id + URL. |
| 3 | **Google rating provenance** | Rating shows `{acf_google_rating}` (ACF dynamic, like the original) + stars. **Candour gate:** do NOT hard-code "5,0" / "5 av 5" without owner/ampy-foretagsdata provenance. Confirm the ACF field resolves to an owner-approved, real value. |
| 4 | **"3 000+ genomförda installationer om året"** | Volume claim carried over from the redesign. Not yet provenance-tagged in `ampy-foretagsdata`. Needs a `[FACT]`/`src:` sign-off before ship (same discipline as "1000+ kunder"). If unverified → soften or drop. |
| 5 | **Engine field selectors** | The JS finds inputs via `name="form-field-<id>"` using the field ids above. Verify these ids survive the paste (Bricks usually keeps them). If Bricks regenerates them, update the `byField()` ids in the code element (or add per-field classes). |
| 6 | **Code execution capability** | `mfcode` needs Bricks "execute code" permission for the pasting user, or autocomplete + mobile CSS won't run. |
| 7 | **Consent-gated tracking** | The canonical `app.js` fires `form_start` / `generate_lead` only behind Cookiebot marketing consent. Because submit is now the native Bricks form, wire those events server-side (n8n) or via a Bricks form success hook — the trimmed engine omits them. |
