/**
 * Pinpoint Module: Web Codecs API Audit
 * Level 4: High-Fidelity HW Exploits
 */
export default {
    id: 'codecs_audit',
    title: 'WebCodecs_API_Audit',
    level: 4,
    info: "Audits window.VideoEncoder and window.AudioEncoder support for hardware video/audio encoding capabilities.",
    steps: ["Check VideoEncoder and AudioEncoder globals.", "Inspect MediaCapabilities API decoding info."],
    run: async () => {
        const hasVideoEncoder = typeof VideoEncoder !== 'undefined';
        const hasAudioEncoder = typeof AudioEncoder !== 'undefined';
        const hasMediaCapabilities = navigator.mediaCapabilities && typeof navigator.mediaCapabilities.decodingInfo === 'function';

        return {
            videoEncoderSupported: hasVideoEncoder,
            audioEncoderSupported: hasAudioEncoder,
            mediaCapabilitiesApiSupported: hasMediaCapabilities
        };
    }
};
