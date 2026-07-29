/**
 * Pinpoint Module: Web Workers & BroadcastChannel Audit
 * Level 4: High-Fidelity HW Exploits
 */
export default {
    id: 'worker_channel_audit',
    title: 'Worker_Channel_Audit',
    level: 4,
    info: "Audits BroadcastChannel, SharedWorker, and ServiceWorker API availability for cross-context messaging.",
    steps: ["Check window.BroadcastChannel support.", "Check window.SharedWorker support."],
    run: async () => {
        return {
            broadcastChannelSupported: typeof BroadcastChannel !== 'undefined',
            sharedWorkerSupported: typeof SharedWorker !== 'undefined',
            serviceWorkerSupported: 'serviceWorker' in navigator,
            messageChannelSupported: typeof MessageChannel !== 'undefined'
        };
    }
};
