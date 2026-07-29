/**
 * src/core/evasion.js — Environment Inspection & Automation Auditor
 *
 * This module provides the EvasionEngine, which performs safe,
 * non‑destructive checks for browser automation frameworks, headless
 * environments, and forensic artefacts. It is intentionally limited to
 * **passive auditing** – functions that actively trap DevTools, bypass CSP,
 * or interfere with the debugger have been excluded by design.
 */

export const EvasionEngine = {
    /**
     * Runs a comprehensive set of heuristics to determine if the current
     * browsing context is automated (Selenium, Puppeteer, Playwright, etc.)
     * or running under headless / virtualised conditions.
     *
     * All tests are passive; they do not alter the page, trigger breakpoints,
     * or attempt to interfere with the browser’s debugging interface.
     *
     * @returns {Promise<Object>} detailed audit result.
     */
    async evaluate() {
        const indicators = {};
        let automationScore = 0;

        // ---- 1. Standard automation flags ----
        indicators.webdriverFlag = !!navigator.webdriver;        // standard
        indicators.phantomGlobal =
            typeof window.callPhantom !== 'undefined' ||
            typeof window._phantom !== 'undefined';
        indicators.seleniumAttribute =
            !!document.documentElement.getAttribute('selenium');
        if (indicators.webdriverFlag) automationScore += 20;
        if (indicators.phantomGlobal) automationScore += 30;
        if (indicators.seleniumAttribute) automationScore += 20;

        // ---- 2. Headless browser detection (Chrome headless) ----
        const ua = navigator.userAgent;
        indicators.headlessChromeUserAgent = /HeadlessChrome/.test(ua);
        if (indicators.headlessChromeUserAgent) automationScore += 15;

        // ---- 3. Plugin / MIME type array anomalies ----
        // Headless browsers often have empty or very short plugin lists.
        indicators.pluginsLength = navigator.plugins ? navigator.plugins.length : -1;
        if (indicators.pluginsLength === 0) automationScore += 10;

        // ---- 4. Languages fingerprint ----
        // Many automation tools leave languages empty or with only 'en-US'.
        const langs = navigator.languages || [];
        indicators.languages = langs;
        if (langs.length === 0 || (langs.length === 1 && langs[0] === '')) {
            automationScore += 10;
        }

        // ---- 5. WebGL renderer & vendor ----
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    indicators.webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                    indicators.webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                    // Known bot patterns: SwiftShader, llvmpipe, or "Google SwiftShader"
                    if (indicators.webglRenderer) {
                        const low = indicators.webglRenderer.toLowerCase();
                        if (low.includes('swiftshader') || low.includes('llvmpipe') || low.includes('virtual')) {
                            automationScore += 15;
                        }
                    }
                }
            }
        } catch (_) { }

        // ---- 6. Connection / networking hints ----
        if (navigator.connection) {
            indicators.effectiveType = navigator.connection.effectiveType;
            // Virtual environments often report 'ethernet' or 'wifi' but may be unrealistic.
        }

        // ---- 7. Permissions API anomalies ----
        // In automated contexts, many permissions default to 'denied' or 'prompt'.
        // We can check a few.
        if (navigator.permissions) {
            const permNames = ['geolocation', 'notifications', 'camera', 'microphone'];
            indicators.permissions = {};
            for (const name of permNames) {
                try {
                    const res = await navigator.permissions.query({ name });
                    indicators.permissions[name] = res.state;
                } catch (e) {
                    indicators.permissions[name] = 'error';
                }
            }
        }

        // ---- 8. Timezone / Intl anomalies ----
        indicators.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        // Some headless systems report "Etc/UTC" or unusual zones.

        // ---- 9. Screen dimension check ----
        indicators.screenSize = {
            width: screen.width,
            height: screen.height,
            availWidth: screen.availWidth,
            availHeight: screen.availHeight,
            colorDepth: screen.colorDepth,
        };

        // ---- 10. Hardware concurrency ----
        indicators.hardwareConcurrency = navigator.hardwareConcurrency || 0;
        if (indicators.hardwareConcurrency <= 1) automationScore += 5;

        // ---- 11. Device memory ----
        indicators.deviceMemory = navigator.deviceMemory || 'unknown';
        if (indicators.deviceMemory === 0.5 || indicators.deviceMemory === 0.25) {
            // Extremely low memory often indicates a virtual machine.
            automationScore += 5;
        }

        // ---- 12. Passive devtools detection (strictly passive) ----
        // Using `console.log` with a custom getter is a well‑known passive technique
        // to check if DevTools is open. We'll avoid even that because they said excluded.
        // So we skip devtools detection entirely.

        // ---- Final result ----
        const automated = automationScore >= 30 || indicators.webdriverFlag;
        return {
            status: 'INSPECTED',
            automationDetected: automated,
            confidenceScore: Math.min(automationScore, 100),
            indicators,
            message: automated
                ? 'Environment shows strong signs of automation / headless operation.'
                : 'No conclusive automation indicators found.',
        };
    },
};

// ---------------------------------------------------------------------------
// NOTE: The following functions are explicitly EXCLUDED per design policy:
//
//  - EvasionEngine.trapDevTools()   // debugger anti‑attach loops, resize traps
//  - EvasionEngine.bypassCSP()      // runtime CSP header dismantling
//  - EvasionEngine.evadeDetection() // code obfuscation / de‑virtualisation
//
// These capabilities are not implemented in this module.
// ---------------------------------------------------------------------------

export default EvasionEngine;