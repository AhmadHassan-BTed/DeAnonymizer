/**
 * Pinpoint Module: Window Framing & Iframe Sandbox Audit
 * Level 5: Weaponized Exploits
 */
export default {
    id: 'clickjack_engine',
    title: 'Window_Framing_Audit',
    level: 5,
    info: "Audits whether current window is running inside an iframe (window.top !== window.self) and inspects iframe sandbox attributes.",
    steps: ["Compare window.top with window.self.", "Inspect frameElement."],
    run: async () => {
        const isFramed = window.top !== window.self;
        return {
            isFramed: isFramed,
            hasFrameElement: !!window.frameElement,
            ancestorOriginsSupported: !!(window.location && window.location.ancestorOrigins),
            ancestorOriginsCount: (window.location && window.location.ancestorOrigins) ? window.location.ancestorOrigins.length : 0
        };
    }
};
