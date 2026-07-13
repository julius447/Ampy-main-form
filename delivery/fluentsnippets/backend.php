<?php
/**
 * ============================================================================
 *  Ampy — Kontaktform (main-form redesign) · backend.php
 *  FluentSnippets: "Functions – PHP Snippet"  ·  Run: FRONTEND & BACKEND
 * ============================================================================
 *
 *  WHAT THIS IS
 *  ------------
 *  One self-contained snippet that:
 *    1. registers the [ampy_kontaktform] shortcode (returns the approved markup,
 *       byte-equivalent to /main-form/ampy-redesign/index.html, wrapped in the
 *       scoping root .ampy-mf), enqueues the companion styles.css + engine.js,
 *       self-hosts Outfit via @font-face, and hands the REST URL + a fresh nonce
 *       to the browser through wp_localize_script (window.AMPY_MF).
 *    2. registers the REST route  POST /wp-json/ampy/v1/kontakt  that receives
 *       the lead SAME-ORIGIN (killing the browser CORS problem), enforces the
 *       honeypot + a per-IP rate limit + server-side validation, forwards the
 *       payload SERVER-SIDE to the n8n webhook, and NEVER drops a lead: on any
 *       webhook failure it persists the lead (private CPT, options fallback +
 *       error_log) and returns 502 so the client shows the retry/phone state.
 *
 *  ── HOW THIS SATISFIES THE AUDIT (lead-integrity items) ────────────────────
 *    • Server-side honeypot .... field `company_url`; non-empty => 200 OK but the
 *                                lead is silently discarded (bots see "success").
 *                                Enforced HERE, not just in the browser.
 *    • Rate limit ............... per-IP transient, max AMPY_MF_RATE_MAX (5)
 *                                *successful* forwards / AMPY_MF_RATE_WINDOW
 *                                (10 min). Malformed/spam probes do NOT burn a
 *                                real user's quota (slot consumed only on 2xx).
 *    • Never-drop-a-lead ........ webhook 2xx => {ok:true}. Webhook non-2xx /
 *                                WP_Error / timeout => the lead is written to a
 *                                private `ampy_lead` CPT (options-table fallback
 *                                + error_log if the insert itself fails), THEN a
 *                                502 {ok:false} is returned so the client keeps
 *                                the form and shows "ring oss". No lead is lost.
 *    • No CORS .................. the browser now POSTs to the WordPress origin
 *                                (/wp-json/ampy/v1/kontakt); the cross-origin hop
 *                                to n8n happens server-to-server via
 *                                wp_remote_post. The client only ever talks
 *                                same-origin, so no CORS preflight can block it.
 *    • Nonce ................... a real WP nonce (action 'wp_rest') is printed
 *                                into the markup (data-nonce + hidden input) AND
 *                                localized to JS; the route verifies X-WP-Nonce.
 *
 *  ── REQUIRED / OPTIONAL CONFIG CONSTANTS (define BEFORE this snippet runs,
 *     e.g. in wp-config.php or an earlier "run everywhere" snippet) ───────────
 *    AMPY_MF_WEBHOOK_URL   (string)  n8n endpoint the lead is forwarded to.
 *                                    DEFAULT: https://n8nflows.ampy.se/webhook/Kontakt
 *                                    Override per the contract's "owner-config,
 *                                    never hard-frozen" rule; also filterable via
 *                                    `add_filter('ampy_mf_webhook_url', …)`.
 *                                    Empty/null => leads are persisted, never sent
 *                                    (a launch-gate item).
 *    AMPY_MF_ASSET_URL     (string)  Base URL where styles.css + engine.js live.
 *                                    DEFAULT: {uploads}/ampy-mf/
 *                                    Upload styles.css & engine.js there, OR paste
 *                                    them into a CSS/JS FluentSnippet instead and
 *                                    define AMPY_MF_SKIP_ENQUEUE (see notes).
 *    (Fonts)                         Outfit is self-hosted via ONE @font-face
 *                                    block that lives in styles.css (the single
 *                                    source of truth — this PHP prints no font
 *                                    CSS). styles.css references the variable
 *                                    woff2 at /wp-content/uploads/ampy-fonts/.
 *                                    See the install note below.
 *    AMPY_MF_PHOTO_URL     (string)  Card background photo. DEFAULT: uploads/ampy-mf/form-photo.jpg
 *    AMPY_MF_LOGO_URL      (string)  White Ampy logo.       DEFAULT: uploads/ampy-mf/ampy-logo-white.png
 *    AMPY_MF_GOOGLE_URL    (string)  Google Business Profile review URL for the
 *                                    5-star badge. DEFAULT: '' → badge is not a link.
 *                                    [GAP] owner must supply the real profile URL.
 *    AMPY_MF_SKIP_ENQUEUE  (bool)    Define truthy to NOT enqueue styles.css/engine.js
 *                                    from here (use it when the CSS/JS ship as their
 *                                    own FluentSnippets per the contract's §1). The
 *                                    nonce/endpoint are still exposed via an inline
 *                                    window.AMPY_MF fallback so engine.js keeps working.
 *
 *  ── FLUENTSNIPPETS INSTALL NOTES ───────────────────────────────────────────
 *    • This file  -> Functions – PHP Snippet, run location "Frontend & Backend"
 *      (REST needs backend; markup + enqueue need frontend). Paste verbatim.
 *    • styles.css -> CSS Snippet, Frontend / wp_head   (handle: ampy-mf-css)
 *    • engine.js  -> JS Snippet,  Frontend / wp_footer (handle: ampy-mf-js)
 *      (If you paste CSS/JS as snippets, define AMPY_MF_SKIP_ENQUEUE truthy.)
 *    • Fonts: upload Outfit-latin.woff2 + Outfit-latin-ext.woff2 (variable,
 *      weight 200–800) to {uploads}/ampy-fonts/ — the exact path styles.css's
 *      @font-face points at. No per-weight files; the variable font covers all.
 *    • Page: drop  [ampy_kontaktform]  into a Bricks SHORTCODE element
 *      (never the Code element).
 *
 *  FORMAT ONLY — no pixel, weight, gradient, spacing, or word is changed vs the
 *  approved prototype. This packages the approved build for WordPress 1-to-1.
 * ============================================================================
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

/* --------------------------------------------------------------------------
 *  0. Config resolvers (constants > filters > sane defaults). Idempotent.
 * ------------------------------------------------------------------------ */
if ( ! function_exists( 'ampy_mf_cfg' ) ) {

	function ampy_mf_uploads_base() : string {
		$u = wp_get_upload_dir();
		$base = isset( $u['baseurl'] ) ? $u['baseurl'] : content_url( '/uploads' );
		return trailingslashit( $base ) . 'ampy-mf/';
	}

	function ampy_mf_webhook_url() : string {
		$url = defined( 'AMPY_MF_WEBHOOK_URL' )
			? (string) AMPY_MF_WEBHOOK_URL
			: 'https://n8nflows.ampy.se/webhook/Kontakt';
		/** Owner-configurable per the delivery contract (never truly frozen). */
		$url = (string) apply_filters( 'ampy_mf_webhook_url', $url );
		return trim( $url );
	}

	function ampy_mf_asset_url() : string {
		$base = defined( 'AMPY_MF_ASSET_URL' ) ? (string) AMPY_MF_ASSET_URL : ampy_mf_uploads_base();
		return trailingslashit( $base );
	}

	function ampy_mf_photo_url() : string {
		return defined( 'AMPY_MF_PHOTO_URL' ) ? (string) AMPY_MF_PHOTO_URL : ( ampy_mf_uploads_base() . 'form-photo.jpg' );
	}

	function ampy_mf_logo_url() : string {
		return defined( 'AMPY_MF_LOGO_URL' ) ? (string) AMPY_MF_LOGO_URL : ( ampy_mf_uploads_base() . 'ampy-logo-white.png' );
	}

	function ampy_mf_google_url() : string {
		return defined( 'AMPY_MF_GOOGLE_URL' ) ? (string) AMPY_MF_GOOGLE_URL : '';
	}
}

/* --------------------------------------------------------------------------
 *  1. Assets — register once, enqueue only when the shortcode is on the page.
 * ------------------------------------------------------------------------ */
if ( ! defined( 'AMPY_MF_VER' ) ) { define( 'AMPY_MF_VER', '1.0.0' ); }

if ( ! function_exists( 'ampy_mf_register_assets' ) ) {
	function ampy_mf_register_assets() : void {
		if ( defined( 'AMPY_MF_SKIP_ENQUEUE' ) && AMPY_MF_SKIP_ENQUEUE ) { return; }
		$base = ampy_mf_asset_url();
		if ( ! wp_style_is( 'ampy-mf-css', 'registered' ) ) {
			wp_register_style( 'ampy-mf-css', $base . 'styles.css', array(), AMPY_MF_VER );
		}
		if ( ! wp_script_is( 'ampy-mf-js', 'registered' ) ) {
			// In footer so the DOM exists before the IIFE runs.
			wp_register_script( 'ampy-mf-js', $base . 'engine.js', array(), AMPY_MF_VER, true );
		}
	}
	add_action( 'wp_enqueue_scripts', 'ampy_mf_register_assets' );
	add_action( 'admin_enqueue_scripts', 'ampy_mf_register_assets' );
}

/**
 * Expose the REST endpoint + a FRESH nonce to engine.js as window.AMPY_MF.
 * A nonce baked into cached HTML can expire; regenerating it here (and, when
 * enqueuing is skipped, printing it inline) keeps the REST call authenticated
 * on cached pages. Returns the JS one-liner used in both enqueue paths.
 */
if ( ! function_exists( 'ampy_mf_localize_payload' ) ) {
	function ampy_mf_localize_payload() : string {
		$data = array(
			'endpoint' => esc_url_raw( rest_url( 'ampy/v1/kontakt' ) ),
			'nonce'    => wp_create_nonce( 'wp_rest' ),
		);
		return 'window.AMPY_MF = ' . wp_json_encode( $data ) . ';';
	}
}

/* --------------------------------------------------------------------------
 *  2. (Fonts are self-hosted via a single @font-face in styles.css — this PHP
 *     intentionally prints no font CSS. See the header note.)
 *
 *  3. The shortcode — returns the approved markup (never echoes).
 * ------------------------------------------------------------------------ */
if ( ! function_exists( 'ampy_mf_shortcode' ) ) {
	add_shortcode( 'ampy_kontaktform', 'ampy_mf_shortcode' );

	function ampy_mf_shortcode( $atts = array() ) : string {
		$skip_enqueue = ( defined( 'AMPY_MF_SKIP_ENQUEUE' ) && AMPY_MF_SKIP_ENQUEUE );

		if ( ! $skip_enqueue ) {
			ampy_mf_register_assets();
			wp_enqueue_style( 'ampy-mf-css' );
			wp_enqueue_script( 'ampy-mf-js' );
			// Attach window.AMPY_MF to the registered JS handle (runs before engine.js).
			wp_add_inline_script( 'ampy-mf-js', ampy_mf_localize_payload(), 'before' );
		}

		$nonce   = wp_create_nonce( 'wp_rest' );
		$photo   = ampy_mf_photo_url();
		$logo    = ampy_mf_logo_url();
		$google  = ampy_mf_google_url();

		ob_start();
		?>
<?php if ( $skip_enqueue ) : ?>
<script id="ampy-mf-localize"><?php echo ampy_mf_localize_payload(); // JSON-encoded, safe ?></script>
<?php endif; ?>
<div class="ampy-mf-outer">
<div class="ampy-mf" id="ampyMf" data-nonce="<?php echo esc_attr( $nonce ); ?>" data-booted="0">

<section class="mf-section">
  <div class="mf-card" role="region" aria-label="Kontakta Ampy för kostnadsfri rådgivning">

    <!-- Full-bleed photo background (Ampy's own) — behind everything. -->
    <img class="mf-cardbg" src="<?php echo esc_url( $photo ); ?>" alt="" aria-hidden="true">
    <span class="mf-cardov" aria-hidden="true"></span>

    <!-- LEFT (desktop) / TOP content (mobile) — transparent, over the photo -->
    <aside class="mf-photo">
      <div class="mf-photo__logo">
        <img class="mf-photo__logoimg" src="<?php echo esc_url( $logo ); ?>" alt="Ampy">
      </div>

      <!-- Info block — centered in the upper region (testimonial the focus) -->
      <div class="mf-photo__body">
        <blockquote class="mf-photo__quote">&rdquo;Från start till mål levererades en service i världsklass.&rdquo;</blockquote>

        <?php
        // Google rating badge. With a real profile URL it is a link; without one
        // ([GAP]) it renders as a non-interactive span (candour: never a dead #).
        if ( $google ) : ?>
        <a class="mf-photo__rating" href="<?php echo esc_url( $google ); ?>" aria-label="Ampys betyg på Google: 5 av 5">
        <?php else : ?>
        <div class="mf-photo__rating" aria-label="Ampys betyg på Google: 5 av 5">
        <?php endif; ?>
          <span class="mf-photo__stars" role="img" aria-label="5 av 5 stjärnor">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L10 14.77 4.8 17.5l.99-5.79L1.58 7.62l5.82-.85z"/></svg>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L10 14.77 4.8 17.5l.99-5.79L1.58 7.62l5.82-.85z"/></svg>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L10 14.77 4.8 17.5l.99-5.79L1.58 7.62l5.82-.85z"/></svg>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L10 14.77 4.8 17.5l.99-5.79L1.58 7.62l5.82-.85z"/></svg>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L10 14.77 4.8 17.5l.99-5.79L1.58 7.62l5.82-.85z"/></svg>
          </span>
          <span class="mf-photo__rating-txt"><strong>5 av 5</strong> &middot; Betyg på Google</span>
        <?php echo $google ? '</a>' : '</div>'; ?>

        <p class="mf-photo__vol"><strong>3&nbsp;000+</strong> genomförda installationer om året</p>
      </div>

      <!-- "Vad händer sen" — 3 steps, pinned near the bottom (desktop only) -->
      <ul class="mf-photo__steps mf-photo__steps--desktop">
        <li class="mf-photo__step">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3 11 14"/><path d="M22 3l-7 19-4-8-8-4z"/></svg>
          <span>Skicka in dina<br>uppgifter</span>
        </li>
        <li class="mf-photo__step">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>
          <span>Vi ringer dig inom 24<br>timmar</span>
        </li>
        <li class="mf-photo__step">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <span>Kostnadsfri rådgivning<br>av elektriker</span>
        </li>
      </ul>
    </aside>

    <!-- ============================================================= -->
    <!-- RIGHT — the form pane (white)                                 -->
    <!-- ============================================================= -->
    <div class="mf-form-pane">
      <header class="mf-head">
        <h2 class="mf-head__h">Få en kostnadsfri <span class="grad">rådgivning</span></h2>
        <p class="mf-head__p">Bli uppringd av vår behöriga elektriker som konsulterar dig <br class="mf-br-desk">från start till mål.</p>
      </header>

      <form class="mf-form" id="mfForm" novalidate>
        <!-- hidden mapping fields for the webhook -->
        <input type="hidden" name="form_type" value="Kontakt">
        <!-- REST nonce (mirrors data-nonce / window.AMPY_MF.nonce) -->
        <input type="hidden" name="_ampy_mf_nonce" value="<?php echo esc_attr( $nonce ); ?>">
        <!-- honeypot (bots fill it; humans never see it). Server MUST also enforce. -->
        <div class="mf-hp-wrap" aria-hidden="true">
          <label>Lämna tomt<input id="mf_hp" name="company_url" type="text" tabindex="-1" autocomplete="off"></label>
        </div>

        <!-- 1. Förnamn | Efternamn -->
        <div class="mf-field mf-field--half" data-validate="forenamn">
          <label class="mf-label" for="mf_forenamn">Förnamn <span class="mf-req">*</span></label>
          <input class="mf-input" id="mf_forenamn" name="forenamn" type="text" autocomplete="given-name" required>
          <span class="mf-feedback"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 8v5"/><path d="M12 16h.01"/></svg><span>Fyll i ditt förnamn.</span></span>
        </div>
        <div class="mf-field mf-field--half" data-validate="efternamn">
          <label class="mf-label" for="mf_efternamn">Efternamn <span class="mf-req">*</span></label>
          <input class="mf-input" id="mf_efternamn" name="efternamn" type="text" autocomplete="family-name" required>
          <span class="mf-feedback"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 8v5"/><path d="M12 16h.01"/></svg><span>Fyll i ditt efternamn.</span></span>
        </div>

        <!-- 2. E-post | Telefonnummer -->
        <div class="mf-field mf-field--half" data-validate="email">
          <label class="mf-label" for="mf_email">E-post <span class="mf-req">*</span></label>
          <input class="mf-input" id="mf_email" name="email" type="email" autocomplete="email" required>
          <span class="mf-feedback"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 8v5"/><path d="M12 16h.01"/></svg><span>Dubbelkolla e-postadressen &ndash; något ser fel ut.</span></span>
        </div>
        <div class="mf-field mf-field--half" data-validate="phone">
          <label class="mf-label" for="mf_telefon">Telefonnummer <span class="mf-req">*</span></label>
          <input class="mf-input" id="mf_telefon" name="telefon" type="tel" autocomplete="tel" required>
          <span class="mf-feedback"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 8v5"/><path d="M12 16h.01"/></svg><span>Vi behöver ett nummer att ringa dig på.</span></span>
        </div>

        <!-- 4. Adress — autocomplete (mock) + manuellt fallback -->
        <div class="mf-field mf-field--full mf-addr" data-validate="address">
          <div class="mf-addr__label-row">
            <label class="mf-label" for="mf_adress_sok">Adress <span class="mf-req">*</span></label>
            <button type="button" class="mf-addr__manual" id="mfAddrManual" aria-expanded="false" aria-controls="mfManualFields">Ange adress manuellt</button>
          </div>
          <div class="mf-addr__input-wrap">
            <svg class="mf-addr-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <input class="mf-input" id="mf_adress_sok" name="adress_sok" type="text" placeholder="Sök efter din adress" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="mfAddrList">
            <div class="mf-addr__list" id="mfAddrList" role="listbox" aria-label="Adressförslag"></div>
          </div>
          <span class="mf-feedback"><span>Fyll i din adress.</span></span>
        </div>

        <!-- manual address fields (revealed by "Ange adress manuellt") -->
        <div class="mf-manual-fields" id="mfManualFields">
          <div class="mf-field" style="grid-column: 1 / -1;">
            <label class="mf-label" for="mf_adress">Gatuadress</label>
            <input class="mf-input" id="mf_adress" name="adress" type="text" autocomplete="street-address">
          </div>
          <div class="mf-field">
            <label class="mf-label" for="mf_postnummer">Postnummer</label>
            <input class="mf-input" id="mf_postnummer" name="postnummer" type="text" inputmode="numeric" autocomplete="postal-code">
          </div>
          <div class="mf-field">
            <label class="mf-label" for="mf_ort">Stad</label>
            <input class="mf-input" id="mf_ort" name="ort" type="text" autocomplete="address-level2">
          </div>
        </div>

        <!-- 4. Meddelande (Svea's "produkter"-slot → free text, per owner) -->
        <div class="mf-field mf-field--full">
          <label class="mf-label" for="mf_meddelande">Meddelande</label>
          <textarea class="mf-textarea" id="mf_meddelande" name="meddelande" placeholder="Valfritt meddelande"></textarea>
        </div>

        <div class="mf-actions">
          <button type="submit" class="mf-submit" id="mfSubmit">
            <span class="mf-submit__spin" aria-hidden="true"></span>
            <span class="mf-submit__label">Gratis rådgivning</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
          </button>
        </div>

        <p class="mf-error" id="mfError" role="alert" tabindex="-1">
          Något gick fel när formuläret skulle skickas. Försök igen, eller ring oss på <strong>010&ndash;265 79 79</strong>.
        </p>

        <p class="mf-consent">
          Genom att skicka in godkänner du att Ampy kontaktar dig enligt vår
          <a href="/integritetspolicy/">integritetspolicy</a>.
        </p>
      </form>

      <!-- In-place success (no redirect) -->
      <div class="mf-success" id="mfSuccess" role="status" aria-live="polite" tabindex="-1">
        <div class="mf-success__ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <h3 class="mf-success__h">Tack &ndash; vi har fått din förfrågan</h3>
        <p class="mf-success__p">En elektriker hör av sig och går igenom ditt behov. Ingen kostnad, inget köpkrav.</p>
        <span class="mf-success__meta">Vill du prata direkt? Ring <strong>010&ndash;265 79 79</strong>.</span>
      </div>
    </div>

    <!-- Mobile-only: volume proof under the form, then the 3 steps (over the photo) -->
    <p class="mf-vol--mobile"><strong>3&nbsp;000+</strong> genomförda installationer om året</p>
    <ul class="mf-photo__steps mf-photo__steps--mobile">
      <li class="mf-photo__step">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3 11 14"/><path d="M22 3l-7 19-4-8-8-4z"/></svg>
        <span>Skicka in dina uppgifter</span>
      </li>
      <li class="mf-photo__step">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>
        <span>Vi ringer dig inom 24 timmar</span>
      </li>
      <li class="mf-photo__step">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <span>Kostnadsfri rådgivning av elektriker</span>
      </li>
    </ul>

  </div>
</section>

</div><!-- .ampy-mf -->
</div><!-- .ampy-mf-outer -->
		<?php
		return ob_get_clean(); // shortcodes RETURN, never echo
	}
}

/* --------------------------------------------------------------------------
 *  4. Lead store — private CPT `ampy_lead` (the never-drop-a-lead backstop).
 * ------------------------------------------------------------------------ */
if ( ! function_exists( 'ampy_mf_register_cpt' ) ) {
	function ampy_mf_register_cpt() : void {
		if ( post_type_exists( 'ampy_lead' ) ) { return; }
		register_post_type( 'ampy_lead', array(
			'labels'          => array(
				'name'          => 'Ampy Leads',
				'singular_name' => 'Ampy Lead',
			),
			'public'          => false,
			'show_ui'         => true,     // owner can inspect stranded leads in wp-admin
			'show_in_menu'    => true,
			'show_in_rest'    => false,
			'menu_icon'       => 'dashicons-email-alt',
			'capability_type' => 'post',
			'supports'        => array( 'title', 'custom-fields' ),
			'rewrite'         => false,
			'has_archive'     => false,
			'exclude_from_search' => true,
		) );
	}
	add_action( 'init', 'ampy_mf_register_cpt' );
}

/**
 * Persist a lead that could NOT be forwarded, so it is never lost.
 * Tries the CPT first; on failure falls back to the options table + error_log.
 */
if ( ! function_exists( 'ampy_mf_persist_stranded_lead' ) ) {
	function ampy_mf_persist_stranded_lead( array $lead, string $reason ) : void {
		$title = sprintf(
			'[EJ SKICKAD] %s %s — %s',
			$lead['forenamn'] ?? '',
			$lead['efternamn'] ?? '',
			$lead['received_at'] ?? current_time( 'mysql' )
		);

		$post_id = 0;
		if ( function_exists( 'wp_insert_post' ) ) {
			$post_id = wp_insert_post( array(
				'post_type'   => 'ampy_lead',
				'post_status' => 'private',
				'post_title'  => wp_strip_all_tags( $title ),
			), true );
		}

		if ( $post_id && ! is_wp_error( $post_id ) ) {
			foreach ( $lead as $k => $v ) {
				update_post_meta( $post_id, '_mf_' . sanitize_key( (string) $k ), is_scalar( $v ) ? (string) $v : wp_json_encode( $v ) );
			}
			update_post_meta( $post_id, '_mf_delivery_error', sanitize_text_field( $reason ) );
			update_post_meta( $post_id, '_mf_delivered', '0' );
			return;
		}

		// Fallback: append to an options-table ring buffer (cap 200) + error_log.
		$store = get_option( 'ampy_mf_stranded_leads', array() );
		if ( ! is_array( $store ) ) { $store = array(); }
		array_unshift( $store, array(
			'lead'   => $lead,
			'reason' => $reason,
			'time'   => current_time( 'mysql' ),
		) );
		update_option( 'ampy_mf_stranded_leads', array_slice( $store, 0, 200 ), false );
		error_log( 'AMPY_MF stranded lead (' . $reason . '): ' . wp_json_encode( $lead ) );
	}
}

/* --------------------------------------------------------------------------
 *  5. Client IP (proxy-aware, spoof-conscious — used only for rate-limit key).
 * ------------------------------------------------------------------------ */
if ( ! function_exists( 'ampy_mf_client_ip' ) ) {
	function ampy_mf_client_ip() : string {
		$candidates = array( 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR' );
		foreach ( $candidates as $key ) {
			if ( empty( $_SERVER[ $key ] ) ) { continue; }
			$raw   = sanitize_text_field( wp_unslash( (string) $_SERVER[ $key ] ) );
			$first = trim( explode( ',', $raw )[0] );
			$ip    = filter_var( $first, FILTER_VALIDATE_IP );
			if ( $ip ) { return $ip; }
		}
		return '0.0.0.0';
	}
}

/* --------------------------------------------------------------------------
 *  6. REST — POST /wp-json/ampy/v1/kontakt
 * ------------------------------------------------------------------------ */
if ( ! defined( 'AMPY_MF_RATE_MAX' ) )    { define( 'AMPY_MF_RATE_MAX', 5 ); }
if ( ! defined( 'AMPY_MF_RATE_WINDOW' ) ) { define( 'AMPY_MF_RATE_WINDOW', 10 * MINUTE_IN_SECONDS ); }

if ( ! function_exists( 'ampy_mf_register_rest' ) ) {
	function ampy_mf_register_rest() : void {
		register_rest_route( 'ampy/v1', '/kontakt', array(
			'methods'             => WP_REST_Server::CREATABLE, // POST
			'callback'            => 'ampy_mf_handle_lead',
			'permission_callback' => 'ampy_mf_rest_permission',
		) );
	}
	add_action( 'rest_api_init', 'ampy_mf_register_rest' );
}

/** Nonce gate — verifies the X-WP-Nonce header (action 'wp_rest'). */
if ( ! function_exists( 'ampy_mf_rest_permission' ) ) {
	function ampy_mf_rest_permission( WP_REST_Request $req ) {
		$nonce = $req->get_header( 'x_wp_nonce' );
		if ( empty( $nonce ) || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new WP_Error( 'ampy_mf_bad_nonce', 'Ogiltig eller utgången sessions-token.', array( 'status' => 403 ) );
		}
		return true;
	}
}

if ( ! function_exists( 'ampy_mf_handle_lead' ) ) {
	function ampy_mf_handle_lead( WP_REST_Request $req ) {

		/* Payload size cap before decode. */
		if ( strlen( (string) $req->get_body() ) > 16384 ) {
			return new WP_Error( 'ampy_mf_too_large', 'Payload too large.', array( 'status' => 413 ) );
		}

		$in = $req->get_json_params();
		if ( empty( $in ) || ! is_array( $in ) ) {
			// Tolerate urlencoded form posts too.
			$in = $req->get_body_params();
		}
		if ( empty( $in ) || ! is_array( $in ) ) {
			return new WP_Error( 'ampy_mf_empty', 'Ingen data mottogs.', array( 'status' => 400 ) );
		}

		/* ── Honeypot: bots fill `company_url`; a non-empty value => fake success. ── */
		$hp = isset( $in['company_url'] ) ? trim( (string) $in['company_url'] ) : '';
		if ( $hp !== '' ) {
			return new WP_REST_Response( array( 'ok' => true ), 200 ); // silently dropped
		}

		/* ── Rate limit: check the cap early; consume a slot only on a real 2xx. ── */
		$rl_key = 'ampy_mf_rl_' . md5( ampy_mf_client_ip() );
		$hits   = (int) get_transient( $rl_key );
		if ( $hits >= (int) AMPY_MF_RATE_MAX ) {
			return new WP_Error( 'ampy_mf_rate', 'För många försök. Försök igen om en stund.', array( 'status' => 429 ) );
		}

		/* ── Sanitize + validate the required fields. ── */
		$forenamn  = sanitize_text_field( $in['forenamn']  ?? '' );
		$efternamn = sanitize_text_field( $in['efternamn'] ?? '' );
		$email     = sanitize_email(      $in['email']     ?? '' );
		$telefon   = sanitize_text_field( $in['telefon']   ?? '' );
		// Address: prefer the resolved street field, fall back to the search box value.
		$adress    = sanitize_text_field( $in['adress'] ?? '' );
		if ( $adress === '' ) { $adress = sanitize_text_field( $in['adress_sok'] ?? '' ); }

		$postnummer = sanitize_text_field( $in['postnummer'] ?? '' );
		$ort        = sanitize_text_field( $in['ort'] ?? '' );
		$meddelande = sanitize_textarea_field( $in['meddelande'] ?? '' );

		$errors = array();
		if ( mb_strlen( $forenamn ) < 2 )  { $errors['forenamn']  = 'Ange ditt förnamn.'; }
		if ( mb_strlen( $efternamn ) < 2 ) { $errors['efternamn'] = 'Ange ditt efternamn.'; }
		if ( ! is_email( $email ) )        { $errors['email']     = 'Ange en giltig e-postadress.'; }
		$phone_digits = preg_replace( '/[^\d+]/', '', $telefon );
		if ( ! preg_match( '/^\+?\d{7,15}$/', (string) $phone_digits ) ) { $errors['telefon'] = 'Ange ett giltigt telefonnummer.'; }
		if ( mb_strlen( $adress ) < 2 )    { $errors['adress']    = 'Ange din adress.'; }

		if ( $errors ) {
			return new WP_Error( 'ampy_mf_invalid', 'Formuläret kunde inte valideras.', array(
				'status' => 400,
				'fields' => $errors,
			) );
		}

		/* ── Build the forward payload + server-side stamps. ── */
		$source = esc_url_raw( $in['sida'] ?? ( function_exists( 'wp_get_referer' ) ? (string) wp_get_referer() : '' ) );
		$lead = array(
			'form_type'   => 'Kontakt',
			'forenamn'    => $forenamn,
			'efternamn'   => $efternamn,
			'email'       => $email,
			'telefon'     => $telefon,
			'adress'      => $adress,
			'postnummer'  => $postnummer,
			'ort'         => $ort,
			'meddelande'  => $meddelande,
			'event_id'    => sanitize_text_field( $in['event_id'] ?? ( 'kontakt_' . time() . '_' . wp_generate_password( 6, false ) ) ),
			// Server-side provenance (never trust the client for these):
			'source'      => $source,
			'received_at' => current_time( 'mysql' ),
			'received_at_gmt' => current_time( 'mysql', true ),
			'ip'          => ampy_mf_client_ip(),
		);

		/* ── Forward SERVER-SIDE to n8n (removes the browser CORS problem). ── */
		$webhook = ampy_mf_webhook_url();
		$delivered   = false;
		$fail_reason = '';

		if ( $webhook === '' ) {
			$fail_reason = 'no webhook configured'; // launch-gate item
		} else {
			$resp = wp_remote_post( $webhook, array(
				'headers'     => array( 'Content-Type' => 'application/json' ),
				'body'        => wp_json_encode( $lead ),
				'timeout'     => 8,
				'blocking'    => true, // must be blocking so we learn the outcome
				'data_format' => 'body',
			) );
			if ( is_wp_error( $resp ) ) {
				$fail_reason = 'webhook WP_Error: ' . $resp->get_error_message();
			} else {
				$code = (int) wp_remote_retrieve_response_code( $resp );
				if ( $code >= 200 && $code < 300 ) {
					$delivered = true;
				} else {
					$fail_reason = 'webhook HTTP ' . $code;
				}
			}
		}

		if ( $delivered ) {
			// Consume one rate-limit slot only for a genuinely delivered lead.
			set_transient( $rl_key, $hits + 1, (int) AMPY_MF_RATE_WINDOW );
			/** CRM hook for anything else that wants the lead. */
			do_action( 'ampy_mf_lead_received', $lead );
			return new WP_REST_Response( array( 'ok' => true ), 200 );
		}

		/* ── NEVER DROP A LEAD: persist, then tell the client to show retry/phone. ── */
		ampy_mf_persist_stranded_lead( $lead, $fail_reason );
		do_action( 'ampy_mf_lead_delivery_failed', $lead, $fail_reason );

		return new WP_REST_Response( array(
			'ok'    => false,
			'error' => 'delivery_failed',
		), 502 );
	}
}
