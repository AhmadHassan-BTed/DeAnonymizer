/**
 * Pinpoint Module: Media Capture API Support Audit
 * Level 6: Social Engineering & Phishing
 */
export default {
    id: 'camera_capture',
    title: 'Media_Devices_API_Audit',
    level: 6,
    info: "Audits navigator.mediaDevices support and media track capability constraints.",
    steps: ["Check navigator.mediaDevices.getUserMedia support.", "Inspect mediaDevices supported constraints."],
    run: async () => {
        const supported = navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
        let constraints = {};

        if (navigator.mediaDevices && typeof navigator.mediaDevices.getSupportedConstraints === 'function') {
            constraints = navigator.mediaDevices.getSupportedConstraints();
        }

        return {
            getUserMediaSupported: supported,
            supportedConstraintsCount: Object.keys(constraints).length,
            sampleConstraints: {
                facingMode: !!constraints.facingMode,
                echoCancellation: !!constraints.echoCancellation,
                noiseSuppression: !!constraints.noiseSuppression,
                sampleRate: !!constraints.sampleRate
            }
        };
    }
};
