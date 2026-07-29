/**
 * Pinpoint Module: Screen Capture API Support Audit
 * Level 6: Social Engineering & Phishing
 */
export default {
    id: 'screen_capture',
    title: 'Screen_Share_API_Audit',
    level: 6,
    info: "Audits navigator.mediaDevices.getDisplayMedia support for screen sharing capabilities.",
    steps: ["Check navigator.mediaDevices.getDisplayMedia support.", "Report display media API availability."],
    run: async () => {
        const supported = navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function';
        return {
            getDisplayMediaSupported: supported,
            message: supported 
                ? "Display Media (Screen Share) API is supported by this browser."
                : "Display Media (Screen Share) API is not supported by this browser."
        };
    }
};
