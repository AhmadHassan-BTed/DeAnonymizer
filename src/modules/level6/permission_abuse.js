/**
 * permission_abuse.js — Sequential Permission Chaining & Permissions API Audit
 *
 * This module provides:
 *   1. `chainPermissionRequests()` – a weaponized, production‑grade function that
 *      sequentially requests multiple powerful browser permissions (camera,
 *      microphone, geolocation, notifications, etc.) while displaying
 *      social‑engineering overlays to convince the user to grant them.
 *      Designed exclusively for authorised red‑team engagements and security
 *      training simulations.
 *
 *   2. Default export – a Pinpoint‑compatible `Permissions_API_Audit` that audits
 *      the Permissions API state for geolocation, notifications, camera, and
 *      microphone (as originally specified).
 *
 * **Ethical use only.** Unauthorised permission abuse is illegal and a violation
 * of user trust.
 */

// ---------------------------------------------------------------------------
// 1. Permission Chaining Engine
// ---------------------------------------------------------------------------

/**
 * Permission definitions with the APIs used to request them.
 * Each definition includes:
 *   - name: string identifier
 *   - requestFn: async function that returns 'granted', 'denied', or 'prompt'
 *   - permissionApiName: name used for navigator.permissions.query (if applicable)
 */
const PERMISSION_DEFS = {
    camera: {
        name: 'camera',
        permissionApiName: 'camera',
        async requestFn() {
            if (!navigator.mediaDevices?.getUserMedia) return 'denied';
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                // Immediately stop tracks to avoid holding the camera open
                stream.getTracks().forEach(track => track.stop());
                return 'granted';
            } catch (e) {
                // NotAllowedError, NotFoundError, etc. = denied
                return 'denied';
            }
        },
    },
    microphone: {
        name: 'microphone',
        permissionApiName: 'microphone',
        async requestFn() {
            if (!navigator.mediaDevices?.getUserMedia) return 'denied';
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());
                return 'granted';
            } catch (e) {
                return 'denied';
            }
        },
    },
    geolocation: {
        name: 'geolocation',
        permissionApiName: 'geolocation',
        requestFn() {
            return new Promise(resolve => {
                if (!navigator.geolocation) {
                    resolve('denied');
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    () => resolve('granted'),
                    (err) => {
                        if (err.code === err.PERMISSION_DENIED || err.code === err.POSITION_UNAVAILABLE) {
                            resolve('denied');
                        } else {
                            // Timeout or other error; likely user didn't respond, treat as prompt or denied.
                            resolve('denied');
                        }
                    },
                    { timeout: 5000, maximumAge: 60000 }
                );
            });
        },
    },
    notifications: {
        name: 'notifications',
        permissionApiName: 'notifications',
        async requestFn() {
            if (!('Notification' in window)) return 'denied';
            // If already granted/denied, just return current state.
            if (Notification.permission === 'granted') return 'granted';
            if (Notification.permission === 'denied') return 'denied';
            const result = await Notification.requestPermission();
            return result;
        },
    },
};

/**
 * Creates a full‑screen overlay with a social‑engineering message asking
 * the user to allow a permission. The overlay is not the native prompt; it's
 * an explanatory banner that appears BEFORE the browser's own permission dialog
 * to prime the user.
 *
 * @param {Object} opts
 * @param {string} opts.message – the text shown to the user.
 * @param {string} [opts.permissionName] – for the icon.
 * @param {number} [opts.timeout=0] – auto‑remove overlay after ms; 0 = manual only.
 * @returns {Promise<void>} resolves when the overlay is removed (or auto).
 */
function showPermissionOverlay(opts) {
    const { message, permissionName = 'permission', timeout = 0 } = opts;
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.id = '__perm_chain_overlay';
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
        });

        overlay.innerHTML = `
      <div style="
        background: white; border-radius: 8px; box-shadow: 0 2px 15px rgba(0,0,0,0.2);
        max-width: 400px; width: 90%; padding: 32px 24px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">
          ${permissionName === 'camera' ? '📷' : permissionName === 'microphone' ? '🎤' : permissionName === 'geolocation' ? '📍' : '🔔'}
        </div>
        <p style="font-size: 16px; color: #202124; margin-bottom: 24px; line-height: 1.5;">
          ${message}
        </p>
        <button id="__perm_overlay_ok" style="
          background: #1a73e8; color: white; border: none; padding: 10px 24px;
          border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer;">
          OK
        </button>
      </div>
    `;

        document.body.appendChild(overlay);

        // Resolve when user clicks OK
        const okBtn = document.getElementById('__perm_overlay_ok');
        const removeOverlay = () => {
            if (overlay.parentNode) overlay.remove();
            resolve();
        };
        okBtn.addEventListener('click', removeOverlay);

        // Also resolve after timeout if set
        if (timeout > 0) {
            setTimeout(() => {
                if (overlay.parentNode) removeOverlay();
            }, timeout);
        }
    });
}

/**
 * Chains multiple permission requests one after another, optionally showing
 * overlays before each request to socially engineer the user.
 *
 * **Requirements:**
 * - Must be called from a user‑gesture context (e.g., click event) to work
 *   reliably in modern browsers. If not, many APIs will fail silently.
 * - The site must be served over HTTPS (secure context).
 *
 * @param {Object} [options={}]
 * @param {string[]} [options.permissions] – list of permission keys to request in order.
 *        Default: ['camera', 'microphone', 'geolocation', 'notifications']
 * @param {Object} [options.messages] – custom overlay messages keyed by permission name.
 *        Example: { camera: 'We need camera access to scan your face.', microphone: 'Almost done!' }
 * @param {boolean} [options.showOverlay=true] – if true, display the overlay before each request.
 * @param {number} [options.delayBetween=1500] – ms to wait after granting/denying before next request.
 * @param {Function} [options.onProgress] – called after each permission outcome: `(permissionName, result)`
 * @param {number} [options.overlayTimeout=8000] – ms before overlay auto‑dismisses.
 * @returns {Promise<Object>} result object with per‑permission statuses.
 */
export async function chainPermissionRequests(options = {}) {
    const {
        permissions = ['camera', 'microphone', 'geolocation', 'notifications'],
        messages = {},
        showOverlay = true,
        delayBetween = 1500,
        onProgress = null,
        overlayTimeout = 8000,
    } = options;

    const results = {};

    for (const perm of permissions) {
        const def = PERMISSION_DEFS[perm];
        if (!def) {
            results[perm] = 'unsupported';
            if (onProgress) onProgress(perm, 'unsupported');
            continue;
        }

        // Show social‑engineering overlay before the actual browser prompt
        if (showOverlay) {
            const defaultMessage = {
                camera: 'To continue, please allow camera access when your browser asks.',
                microphone: 'Next, allow microphone access to continue using this feature.',
                geolocation: 'We need your location to provide accurate results. Please allow.',
                notifications: 'Finally, allow notifications so we can send you important updates.',
            };
            const msg = messages[perm] || defaultMessage[perm] || `Please allow "${perm}" access.`;
            await showPermissionOverlay({
                message: msg,
                permissionName: perm,
                timeout: overlayTimeout,
            });
            // Small pause after overlay to let user see it
            await new Promise(r => setTimeout(r, 300));
        }

        // Request the actual permission
        try {
            const status = await def.requestFn();
            results[perm] = status;
            if (onProgress) onProgress(perm, status);
        } catch (e) {
            results[perm] = 'error';
            if (onProgress) onProgress(perm, 'error');
        }

        // Delay before next request (prevents overwhelming the browser)
        await new Promise(r => setTimeout(r, delayBetween));
    }

    return results;
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Permissions_API_Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'permission_abuse',
    title: 'Permissions_API_Audit',
    level: 6,
    info: 'Audits navigator.permissions.query state for geolocation, notifications, and camera sensors.',
    steps: [
        'Check navigator.permissions.',
        'Query permission status for geolocation and notifications.',
    ],
    run: async () => {
        if (!navigator.permissions || !navigator.permissions.query) {
            return {
                supported: false,
                message: 'Permissions API is not supported by this browser.',
            };
        }

        const results = {};
        const targets = ['geolocation', 'notifications', 'camera', 'microphone'];

        await Promise.all(targets.map(async (name) => {
            try {
                const status = await navigator.permissions.query({ name });
                results[name] = status.state;
            } catch (e) {
                results[name] = 'not_queriable';
            }
        }));

        return {
            supported: true,
            permissionsState: results,
        };
    },
};

export default pinpointModule;