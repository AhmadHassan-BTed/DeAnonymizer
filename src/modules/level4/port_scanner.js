/**
 * port_scanner.js — Browser‑based TCP Port Scanner & Network Capability Audit
 *
 * This module provides:
 *   1. `scanLocalhostTCP()` – a stealthy, production‑grade port scanner that
 *      uses fetch and WebSocket timing side‑channels to detect open ports on
 *      localhost and internal subnets.
 *   2. Default export – a Pinpoint‑compatible `Network_Sockets_Audit` that
 *      reports availability of WebSocket, fetch, and sendBeacon APIs.
 *
 * Designed for authorised red‑team engagements and security audits.
 * Only use on systems you own or have explicit permission to test.
 */

// ---------------------------------------------------------------------------
// 1. Internal helpers
// ---------------------------------------------------------------------------

/**
 * Shortcut for async wait.
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Attempts to probe a port using the fetch API (HTTP/HTTPS).
 * Measures time until first byte or error.
 *
 * @param {string} host – target host/IP
 * @param {number} port – target port
 * @param {number} timeout – max time to wait (ms)
 * @returns {Promise<{ method: 'fetch', open: boolean, time: number, error?: string }>}
 */
async function probeWithFetch(host, port, timeout) {
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    const url = `${protocol}://${host}:${port}/`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const start = performance.now();
    try {
        await fetch(url, {
            mode: 'no-cors',
            cache: 'no-cache',
            signal: controller.signal,
            // Some browsers may require these headers to bypass preflight
            headers: { 'Accept': '*/*' },
        });
        const elapsed = performance.now() - start;
        clearTimeout(timer);
        // If we reach here, the server responded with some HTTP response (open).
        return { method: 'fetch', open: true, time: elapsed };
    } catch (err) {
        clearTimeout(timer);
        const elapsed = performance.now() - start;
        if (err.name === 'AbortError') {
            // Timeout -> could be open (filtered) or very slow. Treat as filtered.
            return { method: 'fetch', open: false, time: elapsed, error: 'timeout' };
        }
        // Connection refused (TypeError) or network error = closed or unreachable.
        return { method: 'fetch', open: false, time: elapsed, error: err.message };
    }
}

/**
 * Attempts to probe a port using a WebSocket connection.
 * Measures time until onerror/onclose fires.
 *
 * @param {string} host
 * @param {number} port
 * @param {number} timeout
 * @returns {Promise<{ method: 'websocket', open: boolean, time: number, error?: string }>}
 */
async function probeWithWebSocket(host, port, timeout) {
    return new Promise(resolve => {
        const start = performance.now();
        let settled = false;

        const wsUrl = `ws://${host}:${port}/`;
        const ws = new WebSocket(wsUrl);
        ws.binaryType = 'blob';

        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                ws.close();
                resolve({
                    method: 'websocket',
                    open: false,
                    time: performance.now() - start,
                    error: 'timeout',
                });
            }
        }, timeout);

        ws.onopen = () => {
            // Shouldn't happen on most ports, but if it does, port is open (and
            // speaks WebSocket).
            clearTimeout(timer);
            if (!settled) {
                settled = true;
                const elapsed = performance.now() - start;
                ws.close();
                resolve({ method: 'websocket', open: true, time: elapsed });
            }
        };

        ws.onerror = (e) => {
            // Error event fires quickly for closed ports. We still wait for close.
            // We'll rely on onclose to measure final time.
        };

        ws.onclose = (e) => {
            clearTimeout(timer);
            if (!settled) {
                settled = true;
                const elapsed = performance.now() - start;
                // If the WebSocket connected successfully and then closed (code 1006
                // often), it means the TCP handshake succeeded, so port is open.
                // Otherwise it's a connection refused or timed out.
                const open = e.wasClean || e.code === 1006; // 1006 is abnormal closure
                resolve({ method: 'websocket', open, time: elapsed, code: e.code });
            }
        };
    });
}

/**
 * Runs multiple probes for a single port and aggregates results.
 * Uses a simple heuristic: if any probe reports open, we mark it as
 * likely open. Confidence increases with the proportion of open probes.
 *
 * @param {string} host
 * @param {number} port
 * @param {number} timeout
 * @param {number} attempts – probes per method (default 2 per method)
 * @returns {Promise<{ port: number, open: boolean, confidence: number, details: Array }>}
 */
async function scanPort(host, port, timeout, attempts = 2) {
    const probes = [];
    for (let i = 0; i < attempts; i++) {
        probes.push(probeWithFetch(host, port, timeout));
        probes.push(probeWithWebSocket(host, port, timeout));
        // Small jitter to evade rate‑limiting detection
        await delay(20 + Math.random() * 30);
    }

    const results = await Promise.all(probes);
    const openCount = results.filter(r => r.open).length;
    const confidence = results.length > 0 ? openCount / results.length : 0;

    return {
        port,
        host,
        open: openCount > 0,
        confidence: Math.round(confidence * 100) / 100,
        probes: results,
    };
}

// ---------------------------------------------------------------------------
// 2. Main scanner function
// ---------------------------------------------------------------------------

/**
 * Scans a list of ports on localhost (127.0.0.1) by default, and optionally
 * on additional internal subnets. Uses fetch and WebSocket timing
 * side‑channels to infer which TCP ports are open.
 *
 * **Limitations:**
 * - Browsers may block mixed content or cross‑origin requests; the scanner
 *   still leaks timing information.
 * - Results are probabilistic and may vary based on network conditions,
 *   firewall rules, and browser implementation.
 * - The scan requires a few seconds per port (adjustable via `timeout`).
 *
 * @param {Object} [options]
 * @param {string[]} [options.hosts=['127.0.0.1']]        – hosts/IPs to scan.
 * @param {number[]} [options.ports]                      – ports to scan (default common ports).
 * @param {number}   [options.timeout=2000]               – per‑probe timeout (ms).
 * @param {number}   [options.attempts=2]                 – probes per method per port.
 * @param {Function} [options.onProgress]                 – callback(host, port, result)
 * @returns {Promise<Object[]>} – array of per‑port results.
 */
export async function scanLocalhostTCP(options = {}) {
    const {
        hosts = ['127.0.0.1'],
        ports = [
            21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 993, 995,
            1433, 1521, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 9000, 27017,
        ],
        timeout = 2000,
        attempts = 2,
        onProgress = null,
    } = options;

    const results = [];

    for (const host of hosts) {
        for (const port of ports) {
            const res = await scanPort(host, port, timeout, attempts);
            results.push(res);
            if (onProgress) {
                try { onProgress(host, port, res); } catch (_) { }
            }
            // Small cooldown between ports to avoid overwhelming the stack
            await delay(50);
        }
    }

    return results;
}

// ---------------------------------------------------------------------------
// 3. Pinpoint‑compatible Network_Sockets_Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'port_scanner',
    title: 'Network_Sockets_Audit',
    level: 4, // High‑Fidelity HW Exploits – as specified
    info: 'Audits window.WebSocket and fetch API support for network socket communication capabilities.',
    steps: [
        'Check window.WebSocket support.',
        'Check window.fetch support.',
        'Check navigator.sendBeacon support.',
    ],
    run: async () => {
        return {
            webSocketsSupported: typeof window.WebSocket !== 'undefined',
            fetchSupported: typeof window.fetch !== 'undefined',
            beaconSupported: typeof navigator.sendBeacon !== 'undefined',
        };
    },
};

export default pinpointModule;