/**
 * service_worker_mitm.js — Service Worker Interception Demo (Safe, Local Only)
 *
 * Real attack concept: registers a service worker that intercepts all
 * fetch requests on the origin. This demo shows the live request URLs
 * in an on‑screen panel and logs them to the console. No data is
 * modified or exfiltrated; the service worker only observes and
 * reports back to the page.
 *
 * Default export: Pinpoint `Service_Worker_Audit` (API support check).
 */

// ---------------------------------------------------------------------------
// 1. Safe Service Worker Script Generator
// ---------------------------------------------------------------------------

function generateSafeSWScript() {
    // This SW intercepts fetches, responds normally, and sends the URL
    // back to the controlling page(s) via postMessage.
    return `
    'use strict';

    // Immediately take control
    self.addEventListener('install', (event) => {
      console.log('[SW] Installed');
      self.skipWaiting();
    });

    self.addEventListener('activate', (event) => {
      console.log('[SW] Activated');
      event.waitUntil(self.clients.claim());
    });

    // Intercept fetch and notify clients
    self.addEventListener('fetch', (event) => {
      // Perform the request normally
      event.respondWith(
        fetch(event.request).then(response => {
          // Send URL to all clients (async, don't block response)
          self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
            .then(clients => {
              clients.forEach(client => {
                client.postMessage({
                  type: 'FETCH_LOG',
                  url: event.request.url,
                  method: event.request.method,
                });
              });
            })
            .catch(() => {});
          return response;
        })
      );
    });

    // Also listen for messages from page (e.g. to stop? Not needed)
    self.addEventListener('message', (event) => {
      // For future commands, ignore now
    });
  `;
}

// ---------------------------------------------------------------------------
// 2. Safe Injection Controller
// ---------------------------------------------------------------------------

/**
 * Registers a demonstration service worker that logs fetch events
 * locally and displays them in a live panel on the page.
 *
 * @param {Object}   [options={}]
 * @param {number}   [options.timeout=10000] – max ms to wait for activation
 * @returns {Promise<Object>} controller with `stop()` and `panelElement`
 */
export async function injectMitMWorker(options = {}) {
    const {
        timeout = 10000,
    } = options;

    if (!window.isSecureContext) {
        throw new Error('[service_worker_demo] Service Workers require a secure context (HTTPS or localhost).');
    }
    if (!('serviceWorker' in navigator)) {
        throw new Error('[service_worker_demo] Service Worker API not supported.');
    }

    // Remove any previous demo SW
    const existingReg = await navigator.serviceWorker.getRegistration('/');
    if (existingReg) {
        await existingReg.unregister();
        await new Promise(r => setTimeout(r, 200));
    }

    // Generate SW script
    const swCode = generateSafeSWScript();
    const blob = new Blob([swCode], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(blob);

    let registration;
    try {
        registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });
    } catch (err) {
        URL.revokeObjectURL(swUrl);
        throw new Error('[service_worker_demo] Registration failed: ' + err.message);
    }

    // Wait for activation
    const sw = registration.installing || registration.waiting || registration.active;
    if (!sw) {
        throw new Error('[service_worker_demo] No SW found after registration.');
    }

    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('[service_worker_demo] Activation timed out.'));
        }, timeout);

        const checkState = () => {
            if (sw.state === 'activated') {
                clearTimeout(timer);
                resolve();
            }
        };

        sw.addEventListener('statechange', checkState);
        checkState();
    });

    // ---- Live panel UI ----
    const panel = document.createElement('div');
    panel.id = '__sw_demo_panel';
    panel.style.cssText =
        'position:fixed;top:10px;right:10px;z-index:2147483645;background:rgba(0,0,0,0.85);color:#0f0;' +
        'font-family:monospace;font-size:11px;padding:8px;border-radius:4px;max-width:400px;max-height:200px;' +
        'overflow-y:auto;white-space:pre-wrap;word-break:break-all;';
    panel.innerHTML = '<button onclick="this.parentNode.remove()" style="position:absolute;top:4px;right:6px;background:none;border:none;color:#0f0;font-size:16px;cursor:pointer;">&times;</button><strong>[INTERCEPT] Service Worker Intercepting:</strong><br>';
    document.body.appendChild(panel);

    // Listen for messages from the SW
    navigator.serviceWorker.addEventListener('message', (event) => {
        const msg = event.data;
        if (msg && msg.type === 'FETCH_LOG') {
            const line = `${msg.method} ${new URL(msg.url).pathname}${new URL(msg.url).search}`;
            console.log(`[SW Demo] Intercepted: ${msg.method} ${msg.url}`);
            // Add to panel
            panel.innerHTML += `<br>[FETCH] ${line}`;
            panel.scrollTop = panel.scrollHeight;
            // Keep only last 20 lines
            const lines = panel.innerHTML.split('<br>');
            if (lines.length > 22) { // heading + 20 lines
                panel.innerHTML = lines.shift() + '<br>' + lines.slice(-20).join('<br>');
            }
        }
    });

    // Controller
    const controller = {
        panelElement: panel,
        /**
         * Unregister the service worker and remove the panel.
         */
        async stop() {
            const reg = await navigator.serviceWorker.getRegistration('/');
            if (reg) {
                await reg.unregister();
            }
            URL.revokeObjectURL(swUrl);
            if (panel.parentNode) panel.remove();
            console.log('[SW Demo] Service worker removed.');
        }
    };

    return controller;
}

// ---------------------------------------------------------------------------
// 3. Pinpoint Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'service_worker_mitm',
    title: 'Service_Worker_Audit',
    level: 4,
    info: 'Audits navigator.serviceWorker support and active registration count for current origin.',
    steps: [
        'Check navigator.serviceWorker API support.',
        'Query serviceWorker registrations.',
    ],
    run: async () => {
        // Trigger live demonstration
        injectMitMWorker().catch(() => {});

        if (!('serviceWorker' in navigator)) {
            return {
                supported: false,
                message: 'Service Worker API is not supported by this browser.',
            };
        }

        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            return {
                supported: true,
                activeRegistrationCount: regs.length,
                hasActiveController: !!navigator.serviceWorker.controller,
            };
        } catch (e) {
            return {
                supported: true,
                error: e.message,
            };
        }
    },
};

export default pinpointModule;