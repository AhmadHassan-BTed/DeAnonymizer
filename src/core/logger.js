/**
 * Core Infrastructure: Local Execution Logger (IndexedDB)
 * Logs execution attempts and diagnostic results locally for developer audits.
 */
export const ExecutionLogger = {
    dbName: 'DeAnonymizerAuditLogDB',
    dbVersion: 1,
    db: null,

    async init() {
        if (this.db) return this.db;
        if (typeof indexedDB === 'undefined') return null;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('logs')) {
                    db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            request.onerror = (e) => {
                console.error("ExecutionLogger IndexedDB initialization error:", e);
                resolve(null);
            };
        });
    },

    async log(moduleId, level, output) {
        try {
            const db = await this.init();
            if (!db) return;
            const tx = db.transaction('logs', 'readwrite');
            const store = tx.objectStore('logs');
            store.add({
                timestamp: new Date().toISOString(),
                moduleId,
                level,
                output
            });
        } catch (e) {
            console.error("Failed to write to execution log:", e);
        }
    },

    async getAllLogs() {
        const db = await this.init();
        if (!db) return [];
        return new Promise((resolve) => {
            const tx = db.transaction('logs', 'readonly');
            const store = tx.objectStore('logs');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        });
    }
};

export default ExecutionLogger;
