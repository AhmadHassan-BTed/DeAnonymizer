/**
 * Pinpoint Module: Custom Protocol Handler Audit
 * Level 1: Standard Recon
 */
export default {
    id: 'protocol_handler_scan',
    title: 'Protocol_Handler_Audit',
    level: 1,
    info: "Audits navigator.registerProtocolHandler support and current origin protocol registration capabilities.",
    steps: ["Check navigator.registerProtocolHandler existence.", "Inspect protocol handler registration interface capabilities."],
    run: async () => {
        const supported = typeof navigator.registerProtocolHandler === 'function';
        return {
            supported: supported,
            canRegisterCustomProtocols: supported,
            message: supported 
                ? "Custom protocol handler registration API is supported by this browser."
                : "Custom protocol handler registration API is not supported by this browser."
        };
    }
};
