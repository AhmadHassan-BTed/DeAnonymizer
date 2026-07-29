/**
 * cache_poison_attack.js — Cache Poisoning Demonstration (Live Demo, Sandboxed)
 *
 * Real attack: overwrites (or creates) a cached resource inside the
 * browser's CacheStorage with attacker‑controlled content. In this demo,
 * a harmless JavaScript file is cached, then “poisoned” with a different
 * script. A banner and console logs show exactly what happened.
 * No data is exfiltrated; all operations remain local.
 *
 * Default export: Pinpoint `Cache_Policy_Audit` (API availability check).
 */

// ---------------------------------------------------------------------------
// 1. Cache Poisoning Engine (Local Only)
// ---------------------------------------------------------------------------

/**
 * Poisons a CacheStorage entry with attacker‑supplied code.
 * For demonstration, a synthetic resource is created and then replaced.
 *
 * @param {Object}   options
 * @param {string}   [options.cacheName='demo-cache'] – name of the cache to poison.
 * @param {string}   [options.resourceURL='/demo-script.js'] – path to poison.
 * @param {string}   [options.trojanCode] – the code to inject (default: a harmless alert).
 * @returns {Promise<Object>} result with success status and message.
 */
export async function poisonCacheResource(options = {}) {
    const {
        cacheName = 'demo-cache',
        resourceURL = '/demo-script.js',
        trojanCode = 'console.log("⚠️ This cache entry was poisoned by DeAnonymizer demo.");',
    } = options;

    if (!window.caches) {
        throw new Error('[poisonCacheResource] CacheStorage API not supported.');
    }

    // 1. Create a legitimate‑looking cached entry first (if it doesn't exist)
    const originalCode = 'console.log("Original script loaded.");';
    const legitResponse = new Response(originalCode, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/javascript' },
    });

    const cache = await caches.open(cacheName);
    const existing = await cache.match(resourceURL);
    if (!existing) {
        console.log(`[cache_poison] Creating initial cache entry for ${resourceURL}`);
        await cache.put(resourceURL, legitResponse.clone());
    } else {
        console.log(`[cache_poison] Existing cache entry found for ${resourceURL}. Overwriting...`);
    }

    // 2. Now poison it – replace the body with our trojan code
    const poisonedResponse = new Response(trojanCode, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/javascript' },
    });

    await cache.put(resourceURL, poisonedResponse);
    console.log(`[cache_poison] Cache entry '${resourceURL}' in '${cacheName}' has been poisoned.`);

    // 3. Show a warning panel on the page
    const banner = document.createElement('div');
    banner.style.cssText =
        'position:fixed;bottom:10px;left:10px;z-index:2147483645;background:rgba(0,0,0,0.85);color:#ffcc00;' +
        'font-family:monospace;font-size:12px;padding:8px;border-radius:4px;max-width:400px;';
    banner.innerHTML = `☣️ Cache Poisoned: <code>${resourceURL}</code> in <strong>${cacheName}</strong>.<br>` +
        `Content replaced with: <pre style="margin:4px 0;">${trojanCode}</pre>`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 8000);

    // 4. Also demonstrate retrieval
    const retrieved = await cache.match(resourceURL);
    if (retrieved) {
        const text = await retrieved.text();
        console.log(`[cache_poison] Retrieved content: ${text}`);
    }

    return {
        success: true,
        message: `Cache entry '${resourceURL}' in '${cacheName}' poisoned successfully.`,
        cacheName,
        resourceURL,
    };
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Audit (default export)
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