/**
 * src/core/persistence.js — Browser Storage Persistence Audit Engine
 *
 * Final version for SilentSniffer framework.
 * Performs a safe, passive inspection of the origin’s storage persistence
 * capabilities. It reports API availability, current persistence state, and
 * quota/usage estimates – all locally, no network calls.
 *
 * Excluded capabilities (per security policy):
 *   - installServiceWorker()
 *   - poisonCache()
 *   - BroadcastChannel C2 loops
 */

const PersistenceEngine = {
    /**
     * Comprehensive check of the Storage Persistence API and quota estimates.
     *
     * @returns {Promise<Object>} Detailed audit result.
     */
    checkStoragePersistence: async () => {
        const result = {
            supported: false,
            isPersisted: false,
            canRequestPersistence: false,
            quota: null,
            usage: null,
            usagePercent: null,
            message: '',
        };

        // 1. Basic API existence
        if (!navigator.storage || typeof navigator.storage.persisted !== 'function') {
            result.message = 'Storage Persistence API not supported by this browser.';
            return result;
        }

        result.supported = true;
        result.canRequestPersistence = typeof navigator.storage.persist === 'function';

        // 2. Query persistence state
        try {
            result.isPersisted = await navigator.storage.persisted();
        } catch (e) {
            result.isPersisted = false;
            result.message = 'Failed to query persistence state: ' + e.message;
        }

        // 3. Estimate quota and usage
        if (navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                result.quota = estimate.quota;
                result.usage = estimate.usage;
                if (result.quota > 0) {
                    result.usagePercent = Math.round((result.usage / result.quota) * 100 * 100) / 100;
                }
            } catch (e) {
                // Non‑fatal
                result.quota = null;
                result.usage = null;
            }
        }

        result.isLikelyEvictable = result.isPersisted ? false : true;

        if (!result.message) {
            result.message = result.isPersisted
                ? 'Origin storage is persistent and will not be evicted automatically.'
                : 'Origin storage is not persistent and may be evicted under storage pressure.';
        }

        // Log result for transparency
        console.log('[PersistenceEngine] Storage persistence audit:', result);
        return result;
    },

    /**
     * Control stub: only performs the audit – does not install any
     * persistent workers or scripts.
     *
     * @returns {Promise<Object>} Audit report.
     */
    install: async () => {
        const audit = await PersistenceEngine.checkStoragePersistence();
        return {
            status: 'AUDIT_ONLY',
            persistenceAudit: audit,
            message:
                'Storage capability audit completed. Persistent script installation disabled per security policy.',
        };
    },
};

export { PersistenceEngine };
export default PersistenceEngine;