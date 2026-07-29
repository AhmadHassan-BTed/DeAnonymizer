/**
 * Pinpoint Module: Service Worker Capability Audit
 * Level 4: High-Fidelity HW Exploits
 */
export default {
    id: 'service_worker_mitm',
    title: 'Service_Worker_Audit',
    level: 4,
    info: "Audits navigator.serviceWorker support and active registration count for current origin.",
    steps: ["Check navigator.serviceWorker API support.", "Query serviceWorker registrations."],
    run: async () => {
        if (!('serviceWorker' in navigator)) {
            return {
                supported: false,
                message: "Service Worker API is not supported by this browser."
            };
        }

        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            return {
                supported: true,
                activeRegistrationCount: regs.length,
                hasActiveController: !!navigator.serviceWorker.controller
            };
        } catch (e) {
            return {
                supported: true,
                error: e.message
            };
        }
    }
};
