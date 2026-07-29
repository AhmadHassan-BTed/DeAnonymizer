/**
 * oauth_hijack.js — Fake OAuth Consent Popup (Live Demonstration, Sandboxed)
 *
 * Real attack: opens a realistic Google/Microsoft OAuth consent screen
 * (popup or overlay) that tricks the user into granting permissions. The
 * user's choice (allow/cancel) is captured and logged **locally** to the
 * browser console. No data is transmitted to any external server.
 *
 * Default export: Pinpoint `Popup_Interface_Audit` (API availability check).
 */

// ---------------------------------------------------------------------------
// 1. Fake OAuth Consent Popup Engine (Local Only)
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
 * All captured interactions are logged to the console and returned
 * locally. No data is exfiltrated.
 *
 * @param {Object}   [options={}]
 * @param {string}   [options.provider='google']     – 'google' or 'microsoft'.
 * @param {boolean}  [options.preferPopup=true]      – attempt popup first, fallback to overlay.
 * @param {Function} [options.onCapture]             – callback({ provider, action }).
 * @param {string}   [options.customLogo]            – custom logo HTML.
 * @returns {Promise<Object>} controller with { popup, close(), statusPromise }.
 */
export async function spawnFakeOAuthPopup(options = {}) {
    const {
        provider = 'google',
        preferPopup = true,
        onCapture = null,
        customLogo = null,
    } = options;

    const template = OAUTH_TEMPLATES[provider] || OAUTH_TEMPLATES.google;
    const { title, logo, heading, subtext, buttonLabel, scopes, color } = template;

    // ---- Helper: build consent HTML ----
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

    // ---- Overlay fallback ----
    function createOverlay() {
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

            const handle = (action) => {
                const data = { provider, action };
                console.log(`[oauth_hijack] User action: ${action}`, data);
                if (onCapture) onCapture(data);
                cleanup();
                resolve(data);
            };

            allowBtn.addEventListener('click', () => handle('allow'));
            cancelBtn.addEventListener('click', () => handle('cancel'));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    handle('dismiss');
                }
            });
        });
    }

    // ---- Popup ----
    let popup = null;
    const openPopup = () => {
        const width = 460, height = 600;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        const features = `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=yes,status=1`;
        popup = window.open('', '_blank', features);
        if (!popup) return null;

        popup.document.title = title;
        popup.document.body.innerHTML = buildConsentHTML();
        popup.document.body.style.margin = '0';
        popup.document.body.style.padding = '0';
        popup.document.body.style.background = '#f0f0f0';
        return popup;
    };

    let capturePromise;

    if (preferPopup) {
        popup = openPopup();
        if (popup) {
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

                if (popup.document) {
                    const allowBtn = popup.document.getElementById('__oauth_allow_btn');
                    const cancelBtn = popup.document.getElementById('__oauth_cancel_btn');

                    const handle = (action) => {
                        clearInterval(timer);
                        if (!settled) {
                            settled = true;
                            const data = { provider, action };
                            console.log(`[oauth_hijack] User action: ${action}`, data);
                            if (onCapture) onCapture(data);
                            popup.close();
                            resolve(data);
                        }
                    };

                    if (allowBtn) allowBtn.addEventListener('click', () => handle('allow'));
                    if (cancelBtn) cancelBtn.addEventListener('click', () => handle('cancel'));
                }
            });
        } else {
            // Popup blocked, fallback to overlay
            capturePromise = createOverlay();
        }
    } else {
        capturePromise = createOverlay();
    }

    const controller = {
        popup,
        async close() {
            if (popup && !popup.closed) popup.close();
            const overlay = document.getElementById('__oauth_overlay');
            if (overlay) overlay.remove();
        },
        statusPromise: capturePromise,
    };

    return controller;
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Audit (default export)
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
        // Trigger live demonstration
        spawnFakeOAuthPopup().catch(() => {});

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
            popupBlockerActive = null;
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