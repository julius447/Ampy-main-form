# Ampy — Kontaktformulär (`/offert`) · implementationspaket

Detta är leveranspaketet för det omdesignade Ampy-kontaktformuläret — det som
ska ligga på **ampy.se** och fungera dygnet runt. Designen är godkänd och
frusen; **detta paket ändrar inte en pixel, vikt, gradient, mellanrum eller ett
ord** mot den godkända prototypen (`../index.html` + `../css/styles.css` +
`../js/app.js`). Det förpackar bara samma bygge för WordPress på **två sätt**.

Källdesign & live-granskning: <https://julius447.github.io/Ampy-main-form/>

---

## Två format — välj ett (bygg inte båda på samma sida)

| | **Format 1 — FluentSnippets** | **Format 2 — Bricks paste-JSON** |
|---|---|---|
| Mapp | `fluentsnippets/` | `bricks/` |
| Vad det är | 3 snippets (CSS / PHP+HTML / JS) + självhostad font | Bricks "copied elements", exakt samma struktur som originalet |
| Inskickning | **Egen REST-endpoint** (`/wp-json/ampy/v1/kontakt`) → n8n, server-side | **Bricks nativa `form`** → webhook + save-submission |
| Styrka | Full kontroll: honeypot, rate-limit, aldrig-tappa-en-lead-CPT, nonce | Redigeras visuellt i Bricks som vilket element som helst |
| Rekommendation | **Default för produktion** (robustast, testad end-to-end) | När Chris vill ha formuläret som ett Bricks-element i canvas |

Båda ger **exakt samma design och innehåll**. Skillnaden är bara hur de
installeras och hur leaden skickas. Kör **inte** båda på samma sida — då dubblas
formuläret.

---

## Förhandsvisning (det som faktiskt skickas)

`preview/index.html` drar in `fluentsnippets/styles.css` + `fluentsnippets/engine.js`
**1:1** (inga kopior, inga ändringar) och renderar shortcodens exakta markup. Öppna
den lokalt via en statisk server från prototyproten:

```bash
cd ampy-redesign
python3 -m http.server 8772
# → http://localhost:8772/delivery/preview/index.html
```

Verifierat i denna leverans (bevis, inte påstående):

- **Desktop 1280** — kort 1128 px (maxbredd 1220), 50/50-split, 2-kolumnsformulär,
  desktop-stegen synliga, mobil-blocken dolda. Font = Outfit (självhostad, `200 800`),
  woff2 `200 OK`, inga konsolfel.
- **Mobil 390** — Svea-mekanismen: helbleed-foto, flytande vitt formulärkort
  (16 px ränna, 15 px radie), stegblocket under, `3 000+` dold på mobil (ägarbeslut).
- **Motorn** (från `engine.js`): "Ange adress manuellt" fäller ut (`aria-expanded`
  false→true), tom obligatorisk fält får `has-error` vid blur, och **tom inskickning
  visar ALDRIG falsk success** (`#mfSuccess` förblir dold) — audit-blocker #1 håller.

---

## Format 1 — FluentSnippets: installation

Se den fylliga install-headern i `fluentsnippets/backend.php`. Kort:

1. **`backend.php`** → *Functions – PHP Snippet*, run location **"Frontend & Backend"**.
   Klistra in ordagrant. (Ger shortcode, enqueue, REST-endpoint, lead-CPT.)
2. **`styles.css`** → *CSS Snippet*, Frontend / `wp_head` (handle `ampy-mf-css`).
3. **`engine.js`** → *JS Snippet*, Frontend / `wp_footer` (handle `ampy-mf-js`).
   *(Om CSS/JS klistras in som egna snippets: definiera `AMPY_MF_SKIP_ENQUEUE` truthy.)*
4. **Font** → ladda upp `fonts/Outfit-latin.woff2` **och** `fonts/Outfit-latin-ext.woff2`
   (variabel, vikt 200–800) till `wp-content/uploads/ampy-fonts/`. Det är exakt den
   sökväg `styles.css` `@font-face` pekar på. **En** `@font-face`-källa: styles.css.
   `backend.php` skriver medvetet **ingen** font-CSS.
5. **Bilder** → ladda upp fotot + vita loggan; sätt `AMPY_MF_PHOTO_URL` / `AMPY_MF_LOGO_URL`
   (annars faller de tillbaka på `uploads/ampy-mf/…`).
6. **Sida** → lägg `[ampy_kontaktform]` i ett Bricks **Shortcode**-element (inte Code).

Endpoint, nonce, honeypot, rate-limit och lead-lagring beskrivs i `backend.php`-headern.

## Format 2 — Bricks paste-JSON: installation

Se `bricks/README.md` (fullständig: klistra-in, element-träd, fält→webhook-nyckel,
tokens). Kort: öppna sidan i Bricks → **Paste elements** med innehållet i
`bricks/ampy-mainform.bricks.json`. Nativa formuläret äger inskickning + webhook;
`mfcode`-elementet är **enbart förbättring** (adress-autocomplete + validering + mobil-CSS)
och POST:ar aldrig själv (ingen dubbel-submit). Kräver "execute code"-behörighet i Bricks.

Strukturen speglar `bricks/_ORIGINAL-reference.bricks.json` exakt: samma envelope
(`source:"bricksCopiedElements"`, `version:"2.3.9"`), samma två-komponents-nästling
(instans i `content` med unikt id + `cid` → komponentdefinition i `components`). Rubrikens
gradientord ("rådgivning") görs med Bricks **nativa** `_gradient` (`applyTo:"text"` +
`data-highlight:"last-1"`), inte med CSS-hack.

---

## Fält → webhook-nycklar (identiskt i båda format)

| Fält | `name` / webhook-nyckel | Obligatoriskt |
|---|---|---|
| Förnamn | `forenamn` | ja |
| Efternamn | `efternamn` | ja |
| E-post | `email` | ja |
| Telefonnummer | `telefon` | ja |
| Adress | `adress` (+ `postnummer`, `ort` vid manuellt läge) | ja |
| Meddelande | `meddelande` | nej |
| *(dolt)* | `form_type = "Kontakt"` | — |
| *(honeypot)* | `company_url` — måste vara tomt | — |

Webhook: `https://n8nflows.ampy.se/webhook/Kontakt` (samma URL originalet redan använde;
i FluentSnippets överstyrbar via `AMPY_MF_WEBHOOK_URL` / filter `ampy_mf_webhook_url`).

---

## Launch-gate — måste stängas innan skarp drift (ägare/dev)

Detta är inga buggar — det är konfig/provenance som bara ägaren/dev kan sätta.

| # | Punkt | Åtgärd |
|---|---|---|
| 1 | **n8n-webhook tar emot de nya nycklarna** | Bekräfta att flödet på `/webhook/Kontakt` mappar `forenamn/efternamn/email/telefon/adress/postnummer/ort/meddelande/form_type`. Utan detta tolkas leads fel. |
| 2 | **Riktigt foto** | Ladda upp `assets/form-photo.jpg` (Modernt-hus, skymning) till Media; sätt URL:en (FS: `AMPY_MF_PHOTO_URL`; Bricks: `mfphot`-bakgrund). |
| 3 | **Vit logga** | Ladda upp `assets/ampy-logo-white.png`; sätt URL + Media-id (FS: `AMPY_MF_LOGO_URL`; Bricks: `mflogo`). |
| 4 | **Google-betyg (provenance)** | "5 av 5 · Betyg på Google" är ägar­godkänt men saknar `[FACT]`/`src:` i `ampy-foretagsdata`. Bekräfta att det är sant och rättighets­klart. Sätt gärna en riktig Google-profil-URL (FS: `AMPY_MF_GOOGLE_URL`; Bricks: ACF) så badgen blir en länk — annars renderas den som icke-klickbar (aldrig en död `#`). |
| 5 | **"3 000+ genomförda installationer om året" (provenance)** | Verifiera siffran och tagga i `ampy-foretagsdata` innan ship (samma disciplin som "1000+ kunder"). Om overifierad → mjuka upp eller ta bort. |
| 6 | **Adress-API i produktion** | Motorn använder Photon (OSM, gratis, EU, ingen nyckel) — bra för start. Vid volym/SLA: byt till **Google Places Autocomplete** (referrer-låst nyckel) eller Lantmäteriet via proxy. Endast `fetch`-URL:en i motorn behöver bytas. |
| 7 | **Fonter uppladdade** | Se steg 4 ovan — annars faller texten tillbaka på system-sans. |
| 8 | **Bricks "execute code"-behörighet** | (Endast Format 2) `mfcode` kräver att den inloggade rollen får köra kod, annars startar inte autocomplete/mobil-CSS. |
| 9 | **Consent-gated tracking** | `form_start` / `generate_lead` bakom Cookiebot-samtycke. I FS ligger detta i motorn; i Bricks (nativ submit) koppla via n8n eller en form-success-hook — den trimmade motorn utelämnar det. |

---

## Vad som INTE klonades (och varför) — IP & candour

Detta är Ampys eget formulär, inte en kopia av någon annans. Format och proportioner
(mått, layout, mobil-mekanism) är inte skyddsbart och matchades medvetet; **allt
innehåll är Ampys eget**. Medvetet **inte** återgivet: en konkurrents logotyp,
ordagranna marknadstexter, foto eller deras Trustpilot-siffra (deras IP / falskt på
Ampy). Ägaren har uttryckligen godkänt Ampys egna "5 av 5 · Betyg på Google" och
"3 000+" — de bär `[GAP]`-flagga för provenance ovan (punkt 4–5).

---

## Verifieringslogg (denna leverans)

- `engine.js` → `node --check` **OK**
- `backend.php` → `php -l` **No syntax errors**
- `ampy-mainform.bricks.json` → `JSON.parse` **OK**; 33 element-noder, **inga
  dubbletter av id** (rättade instans/komponent-id-krock: `content[0].id` = `mfin01`
  skilt från `cid`/komponent-id `mfsec1`, precis som originalets `74c56a ≠ dtbymx`)
- Font: **en** `@font-face`-källa (styles.css, variabel Outfit); backend.php:s tidigare
  per-vikt-injektion borttagen (motstridiga källor eliminerade)
- Gradientrubrik: `@supports`-fallback tillagd i styles.css (ordet syns solitt-teal om
  `background-clip:text` inte stöds — aldrig osynligt)
- Renderparitet desktop 1280 + mobil 390 mot godkänd design: **matchar**
