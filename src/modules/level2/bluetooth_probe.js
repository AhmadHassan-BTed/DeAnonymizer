/**
 * Pinpoint Module: Web Bluetooth Availability Audit
 * Level 2: Advanced Profiling
 */
export default {
    id: 'bluetooth_probe',
    title: 'Bluetooth_Audit',
    level: 2,
    info: "Audits Web Bluetooth API availability and permission support in the current browsing context.",
    steps: ["Check navigator.bluetooth support.", "Query Bluetooth availability state.", "Check user gesture requirement."],
    run: async () => {
        if (!('bluetooth' in navigator)) {
            return {
                supported: false,
                message: "Web Bluetooth API is not supported by this browser or context."
            };
        }

        let isAvailable = false;
        try {
            if (navigator.bluetooth.getAvailability) {
                isAvailable = await navigator.bluetooth.getAvailability();
            }
        } catch (e) {
            isAvailable = false;
        }

        return {
            supported: true,
            adapterAvailable: isAvailable,
            requiresUserGesture: true
        };
    }
};
