/**
 * clickjack_engine.js — Transparent Iframe Overlay (Live Demo, Sandboxed)
 *
 * Real attack: creates a transparent iframe precisely positioned over a
 * decoy element (e.g., a button). When the user tries to click the decoy,
 * they are actually clicking inside the hidden iframe. In this demo, no
 * external content is loaded—the iframe simply captures the click and
 * displays a warning explaining the attack.
 *
 * Default export: Pinpoint `Window_Framing_Audit` (API check).
 */

// ---------------------------------------------------------------------------
// 1. Clickjacking Overlay Engine (Local Only)
// ---------------------------------------------------------------------------

/**
 * Creates a transparent iframe overlay over a visible decoy element.
 * When the user clicks the decoy, the click is intercepted by the iframe
 * and a warning banner appears explaining the clickjacking concept.
 * No external requests are made; the iframe loads a local blank page.
 *
 * @param {Object}   options
 * @param {string}   [options.decoySelector]  – CSS selector for the element to overlay.
 *        If not provided, a default "Download" button is created as a demo.
 * @param {number}   [options.zIndex=2147483647]
 * @param {Function} [options.onClickEvent]   – callback(clickEvent) after interception.
 * @returns {{ remove: Function, overlayElement: HTMLIFrameElement }}
 */
export function renderClickjackOverlay(options = {}) {
    const {
        decoySelector = null,
        zIndex = 2147483647,
        onClickEvent = null,
    } = options;

    // ---- Create a decoy if one doesn't exist ----
    let decoy = decoySelector ? document.querySelector(decoySelector) : null;
    if (!decoy) {
        decoy = document.createElement('button');
        decoy.textContent = 'Download Free Tool';
        decoy.style.cssText =
            'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1;' +
            'padding:14px 28px;font-size:18px;cursor:pointer;';
        document.body.appendChild(decoy);
        // Remove decoy after overlay is gone
        setTimeout(() => decoy.remove(), 8000);
    }

    const rect = decoy.getBoundingClientRect();

    // ---- Create the transparent iframe ----
    const iframe = document.createElement('iframe');
    // Load a blank same‑origin page to avoid any external content
    iframe.src = 'about:blank';
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('frameborder', '0');

    Object.assign(iframe.style, {
        position: 'fixed',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        border: 'none',
        margin: '0',
        padding: '0',
        opacity: '0',               // completely invisible
        pointerEvents: 'auto',      // but still captures clicks!
        zIndex: zIndex,
        display: 'block',
        background: 'transparent',
    });

    document.body.appendChild(iframe);

    // ---- Intercept clicks on the iframe ----
    const clickHandler = (e) => {
        if (e.target === iframe) {
            e.stopPropagation();
            e.preventDefault();

            console.log('[clickjack_engine] Click intercepted by transparent iframe!');
            console.log('  Decoy element:', decoySelector || 'generated button');

            // Show a warning banner
            const banner = document.createElement('div');
            banner.style.cssText =
                'position:fixed;top:0;left:0;width:100%;background:#d32f2f;color:white;text-align:center;' +
                'padding:10px;z-index:999999;font-family:sans-serif;font-size:16px;';
            banner.textContent = '[DEMO] You were just clickjacked! The invisible iframe stole your click.';
            document.body.prepend(banner);
            setTimeout(() => banner.remove(), 5000);

            if (onClickEvent) {
                try { onClickEvent(e); } catch (_) { }
            }
        }
    };

    document.addEventListener('click', clickHandler, true);

    // ---- Controller ----
    const controller = {
        overlayElement: iframe,
        remove() {
            if (iframe.parentNode) iframe.remove();
            document.removeEventListener('click', clickHandler, true);
        }
    };

    // Auto‑remove after 8 seconds for convenience
    setTimeout(() => controller.remove(), 8000);

    return controller;
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Audit (default export)
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
        // Trigger live demonstration
        renderClickjackOverlay();

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