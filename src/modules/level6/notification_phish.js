/**
 * Pinpoint Module: Web Notification API Capability Audit
 * Level 6: Social Engineering & Phishing
 */
export default {
    id: 'notification_phish',
    title: 'Notification_API_Audit',
    level: 6,
    info: "Audits Notification API support and current origin notification permission state.",
    steps: ["Check window.Notification existence.", "Read Notification.permission state."],
    run: async () => {
        const supported = 'Notification' in window;
        return {
            notificationApiSupported: supported,
            permissionState: supported ? Notification.permission : 'unsupported',
            maxActionsSupported: supported && Notification.maxActions ? Notification.maxActions : 0
        };
    }
};
