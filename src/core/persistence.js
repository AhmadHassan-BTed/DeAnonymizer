/**
 * src/core/persistence.js — Browser Storage Persistence Audit Engine
 *
 * This module audits the origin’s storage persistence capabilities. It
 * provides a safe, passive inspection of whether the browser allows
 * persistent storage, the current persistence state, and estimates of
 * available storage space.
 *
 * Excluded capabilities (per policy):
 *   - installServiceWorker()   // register malicious service workers
 *   - poisonCache()            // poison CacheStorage with backdoored resources
 *   - BroadcastChannel C2 loops
 *
 * The `install()` method is a control stub that only performs the audit and
 * explicitly refuses to install any persistence mechanism.
 */

const PersistenceEngine = {
    /**
     * Comprehensive check of the browser’s Storage Persistence API and
     * quota estimates.
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

        // 3. Estimate quota and usage (passive)
        if (navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                result.quota = estimate.quota;   // total bytes available
                result.usage = estimate.usage;   // bytes used by this origin
                if (result.quota > 0) {
                    result.usagePercent = Math.round((result.usage / result.quota) * 100 * 100) / 100;
                }
            } catch (e) {
                // Non‑fatal, just log
                result.quota = null;
                result.usage = null;
            }
        }

        // 4. Supplementary info: whether storage is likely evicted under pressure
        result.isLikelyEvictable = result.isPersisted ? false : true;

        if (!result.message) {
            result.message = result.isPersisted
                ? 'Origin storage is persistent and will not be evicted automatically.'
                : 'Origin storage is not persistent and may be evicted under storage pressure.';
        }

        return result;
    },

    /**
     * Control stub: performs a storage persistence audit and returns the
     * result. No persistence installation is performed.
     *
     * @returns {Promise<Object>} Audit report.
     */
    install: async () => {
        const audit = await PersistenceEngine.checkStoragePersistence();
        return {
            status: 'AUDIT_ONLY',
            persistenceAudit: audit,
            message: 'Storage capability audit completed. Persistent script installation disabled per security policy.',
        };
    },
};

export { PersistenceEngine };
export default PersistenceEngine;