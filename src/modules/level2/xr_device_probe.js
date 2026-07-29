/**
 * Pinpoint Module: WebXR Device API Audit
 * Level 2: Advanced Profiling
 */
export default {
    id: 'xr_device_probe',
    title: 'WebXR_Device_Audit',
    level: 2,
    info: "Audits navigator.xr support and WebXR session mode availability (inline, immersive-vr, immersive-ar).",
    steps: ["Check navigator.xr presence.", "Query isSessionSupported for inline and immersive VR/AR modes."],
    run: async () => {
        if (!('xr' in navigator)) {
            return {
                supported: false,
                message: "WebXR Device API is not supported by this browser."
            };
        }

        let inlineSupported = false;
        let vrSupported = false;
        let arSupported = false;

        try { inlineSupported = await navigator.xr.isSessionSupported('inline'); } catch (e) {}
        try { vrSupported = await navigator.xr.isSessionSupported('immersive-vr'); } catch (e) {}
        try { arSupported = await navigator.xr.isSessionSupported('immersive-ar'); } catch (e) {}

        return {
            supported: true,
            modes: {
                inline: inlineSupported,
                immersiveVr: vrSupported,
                immersiveAr: arSupported
            }
        };
    }
};
