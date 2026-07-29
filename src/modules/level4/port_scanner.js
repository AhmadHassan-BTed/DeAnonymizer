/**
 * port_scanner.js — Real Localhost TCP Port Scanner (Sandboxed, No Exfiltration)
 *
 * Real attack: uses fetch() and WebSocket() to probe ports on 127.0.0.1.
 * Timing and error differences allow inference of open vs. closed ports.
 * All scans are local; nothing is sent to any remote server.
 *
 * Default export: Pinpoint `Network_Sockets_Audit` (API availability check).
 */

// ---------------------------------------------------------------------------
// 1. Actual port probing helpers
// ---------------------------------------------------------------------------

const delay = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Probe using fetch (HTTP/HTTPS).
 * Returns true if a response arrives within timeout (TCP handshake completed).
 */
async function probeWithFetch(host, port, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = performance.now();

    try {
        await fetch(`http://${host}:${port}/`, {
            mode: 'no-cors',
            cache: 'no-cache',
            signal: controller.signal,
            headers: { 'Accept': '*/*' },
        });
        clearTimeout(timer);
        return { method: 'fetch', open: true, time: performance.now() - start };
    } catch (err) {
        clearTimeout(timer);
        const elapsed = performance.now() - start;
        // AbortError = timeout → probably filtered (could be open but we treat as closed)
        // Other TypeError = connection refused → closed
        return { method: 'fetch', open: false, time: elapsed, error: err.name };
    }
}

/**
 * Probe using WebSocket.
 * Returns true if the WebSocket opens or closes with code 1006 (TCP accepted).
 */
async function probeWithWebSocket(host, port, timeoutMs) {
    return new Promise(resolve => {
        const start = performance.now();
        let settled = false;
        const ws = new WebSocket(`ws://${host}:${port}/`);

        const finish = (open) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                ws.close();
                resolve({ method: 'websocket', open, time: performance.now() - start });
            }
        };

        const timer = setTimeout(() => finish(false), timeoutMs);

        ws.onopen = () => finish(true);
        ws.onerror = () => { }; // ignore, wait for close
        ws.onclose = (e) => {
            clearTimeout(timer);
            if (!settled) {
                settled = true;
                // wasClean or code 1006 indicates TCP accepted
                const open = e.wasClean || e.code === 1006;
                resolve({ method: 'websocket', open, time: performance.now() - start });
            }
        };
    });
}

/**
 * Scan a single port: multiple probes (fetch + WS) → majority vote.
 */
async function scanPort(host, port, timeout = 1000, attempts = 2) {
    const probes = [];
    for (let i = 0; i < attempts; i++) {
        probes.push(probeWithFetch(host, port, timeout));
        probes.push(probeWithWebSocket(host, port, timeout));
        await delay(10); // tiny gap between probes
    }
    const results = await Promise.all(probes);
    const openCount = results.filter(r => r.open).length;
    return {
        port,
        host,
        open: openCount > 0,
        confidence: Math.round((openCount / results.length) * 100) / 100,
        probes: results,
    };
}

// ---------------------------------------------------------------------------
// 2. Main scanner function (real, local only)
// ---------------------------------------------------------------------------

/**
 * Scans a list of ports on 127.0.0.1 (or any given host) using fetch
 * and WebSocket timing side‑channels. No external network calls.
 * Results are shown live in an overlay panel.
 *
 * @param {Object} [options]
 * @param {string} [options.host='127.0.0.1']
 * @param {number[]} [options.ports] – default common ports
 * @param {number} [options.timeout=1000] – per‑probe timeout (ms)
 * @param {number} [options.attempts=2] – probes per method
 * @param {Function} [options.onProgress] – callback(host, port, result)
 * @returns {Promise<Object[]>} scan results
 */
export async function scanLocalhostTCP(options = {}) {
    const {
        host = '127.0.0.1',
        ports = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 993, 995,
            1433, 1521, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 9000, 27017],
        timeout = 1000,
        attempts = 2,
        onProgress = null,
    } = options;

    // --- Live panel ---
    const panel = document.createElement('div');
    panel.id = '__port_scan_panel';
    panel.style.cssText =
        'position:fixed;top:10px;left:10px;z-index:2147483645;background:rgba(0,0,0,0.85);color:#0f0;' +
        'font-family:monospace;font-size:11px;padding:8px;border-radius:4px;max-width:350px;max-height:300px;' +
        'overflow-y:auto;white-space:pre-wrap;';
    panel.innerHTML = `🔍 Scanning ${host} ports...<br>`;
    document.body.appendChild(panel);

    const results = [];

    for (const port of ports) {
        const result = await scanPort(host, port, timeout, attempts);
        results.push(result);

        const line = `${result.open ? '🟢' : '🔴'} Port ${port}: ${result.open ? 'OPEN' : 'closed'} (confidence ${result.confidence})`;
        panel.innerHTML += line + '<br>';
        panel.scrollTop = panel.scrollHeight;
        console.log('[port_scanner]', line);

        if (onProgress) {
            try { onProgress(host, port, result); } catch (_) { }
        }
    }

    const openCount = results.filter(r => r.open).length;
    panel.innerHTML += `<br>✅ Done. ${openCount} open port(s) detected.`;
    setTimeout(() => panel.remove(), 8000);

    return results;
}

// ---------------------------------------------------------------------------
// 3. Pinpoint Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'port_scanner',
    title: 'Network_Sockets_Audit',
    level: 4,
    info: 'Audits window.WebSocket and fetch API support for network socket communication capabilities.',
    steps: [
        'Check window.WebSocket support.',
        'Check window.fetch support.',
        'Check navigator.sendBeacon support.',
    ],
    run: async () => {
        // Trigger live demonstration
        scanLocalhostTCP().catch(() => {});

        return {
            webSocketsSupported: typeof WebSocket !== 'undefined',
            fetchSupported: typeof fetch !== 'undefined',
            beaconSupported: typeof navigator.sendBeacon !== 'undefined',
        };
    },
};

export default pinpointModule;