/**
 * Pinpoint Module: Permissions API State Audit
 * Level 6: Social Engineering & Phishing
 */
export default {
    id: 'permission_abuse',
    title: 'Permissions_API_Audit',
    level: 6,
    info: "Audits navigator.permissions.query state for geolocation, notifications, and camera sensors.",
    steps: ["Check navigator.permissions.", "Query permission status for geolocation and notifications."],
    run: async () => {
        if (!navigator.permissions || !navigator.permissions.query) {
            return {
                supported: false,
                message: "Permissions API is not supported by this browser."
            };
        }

        const results = {};
        const targets = ['geolocation', 'notifications', 'camera', 'microphone'];

        await Promise.all(targets.map(async (name) => {
            try {
                const status = await navigator.permissions.query({ name });
                results[name] = status.state;
            } catch (e) {
                results[name] = 'not_queriable';
            }
        }));

        return {
            supported: true,
            permissionsState: results
        };
    }
};
