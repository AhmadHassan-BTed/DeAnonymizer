/**
 * Pinpoint Module: Network Information Audit
 * Level 2: Advanced Profiling
 */
export default {
    id: 'network_info_audit',
    title: 'Network_Info_Audit',
    level: 2,
    info: "Inspects client NetworkInformation API metrics (effective connection type, downlink speed, RTT, saveData setting).",
    steps: ["Access navigator.connection object.", "Read effectiveType, downlink, rtt, saveData.", "Return structured connection capabilities."],
    run: async () => {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

        if (!conn) {
            return {
                supported: false,
                message: "NetworkInformation API not supported by this browser."
            };
        }

        return {
            supported: true,
            effectiveType: conn.effectiveType || 'unknown',
            downlinkMbps: conn.downlink || 'unknown',
            rttMs: conn.rtt || 'unknown',
            saveData: conn.saveData || false,
            type: conn.type || 'unknown'
        };
    }
};
