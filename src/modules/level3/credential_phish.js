/**
 * Pinpoint Module: Secure Context & Credential Management Audit
 * Level 3: Critical Intelligence
 */
export default {
    id: 'credential_phish',
    title: 'Auth_Context_Audit',
    level: 3,
    info: "Audits window.isSecureContext state and Credential Management API (navigator.credentials) support.",
    steps: ["Check window.isSecureContext.", "Inspect navigator.credentials support."],
    run: async () => {
        const isSecure = window.isSecureContext || false;
        const hasCredentials = typeof navigator.credentials !== 'undefined';

        return {
            isSecureContext: isSecure,
            credentialsApiSupported: hasCredentials,
            federatedAuthSupported: hasCredentials && typeof navigator.credentials.get === 'function'
        };
    }
};
