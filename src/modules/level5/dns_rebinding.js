/**
 * Pinpoint Module: Origin Security Boundary Audit
 * Level 5: Weaponized Exploits
 */
export default {
    id: 'dns_rebinding',
    title: 'Origin_Boundary_Audit',
    level: 5,
    info: "Audits current window.location origin and document.domain security isolation status.",
    steps: ["Read window.location.origin.", "Inspect document.domain security state."],
    run: async () => {
        return {
            origin: window.location.origin,
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            port: window.location.port || (window.location.protocol === 'https:' ? '443' : '80'),
            domain: document.domain
        };
    }
};
