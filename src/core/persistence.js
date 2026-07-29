/**
 * Core Infrastructure: Local Storage Persistence Audit Engine
 * Audits origin persistence capabilities (navigator.storage.persisted & persist).
 */
export const PersistenceEngine = {
    checkStoragePersistence: async () => {
        if (navigator.storage && typeof navigator.storage.persisted === 'function') {
            const isPersisted = await navigator.storage.persisted();
            return {
                supported: true,
                isPersisted: isPersisted,
                canRequestPersistence: typeof navigator.storage.persist === 'function'
            };
        }
        return {
            supported: false,
            message: "Storage Persistence API not supported by browser."
        };
    },

    install: async () => {
        const audit = await PersistenceEngine.checkStoragePersistence();
        return {
            status: "AUDIT_ONLY",
            persistenceAudit: audit,
            message: "Storage capability audit completed. Persistent script installation disabled per security policy."
        };
    }
};

export default PersistenceEngine;
