/**
 * Pinpoint Module: Display & Accessibility Metrics
 * Level 1: Standard Recon
 */
export default {
    id: 'display_metrics',
    title: 'Display_Accessibility',
    level: 1,
    info: "Inspects screen color depth, device pixel ratio, screen orientation, and system accessibility preferences.",
    steps: ["Query screen.colorDepth and window.devicePixelRatio.", "Query screen.orientation.", "Check matchMedia for dark mode and reduced motion preferences."],
    run: async () => {
        const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const prefersContrast = window.matchMedia && window.matchMedia('(prefers-contrast: more)').matches;

        return {
            colorDepth: screen.colorDepth,
            pixelDepth: screen.pixelDepth,
            devicePixelRatio: window.devicePixelRatio,
            orientationType: screen.orientation ? screen.orientation.type : 'N/A',
            orientationAngle: screen.orientation ? screen.orientation.angle : 0,
            accessibility: {
                prefersDarkMode: isDarkMode,
                prefersReducedMotion: prefersReducedMotion,
                prefersHighContrast: prefersContrast
            }
        };
    }
};
