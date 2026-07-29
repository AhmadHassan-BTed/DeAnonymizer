/**
 * Pinpoint Module: DNS Prefetch Support Audit
 * Level 2: Advanced Profiling
 */
export default {
    id: 'dns_prefetch_scan',
    title: 'DNS_Prefetch_Audit',
    level: 2,
    info: "Audits browser support for DNS prefetching elements (<link rel='dns-prefetch'>) and Resource Timing entries.",
    steps: ["Test DOM element creation for rel='dns-prefetch'.", "Inspect window.performance.getEntriesByType('resource') capabilities."],
    run: async () => {
        const link = document.createElement('link');
        const relListSupported = link.relList && typeof link.relList.supports === 'function';
        const isDnsPrefetchSupported = relListSupported ? link.relList.supports('dns-prefetch') : true;
        const resourceTimingSupported = typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function';

        return {
            dnsPrefetchSupported: isDnsPrefetchSupported,
            resourceTimingSupported: resourceTimingSupported,
            resourceEntriesCount: resourceTimingSupported ? performance.getEntriesByType('resource').length : 0
        };
    }
};
