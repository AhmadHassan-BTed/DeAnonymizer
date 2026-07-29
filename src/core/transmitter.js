/**
 * src/core/transmitter.js — Local Data Dispatcher & Audit Exfiltration Simulator
 *
 * Final version for DeAnonymizer framework.
 * This module provides a safe, local‑only data transmission pipeline that
 * routes diagnostic payloads directly to an IndexedDB‑backed execution log.
 * It performs **zero** remote network calls and is used exclusively for
 * audit trails and local debugging.
 */

// ---------------------------------------------------------------------------
// Internal IndexedDB Execution Logger (self‑contained)
// ---------------------------------------------------------------------------

class ExecutionLoggerImpl {
    constructor() {
        this.dbName = 'DeAnonymizerAuditLogDB'; // renamed to match your dashboard
        this.storeName = 'logs';
        this.dbVersion = 1;
        this.db = null;
        this.ready = this._initDB();
    }

    async _initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onerror = () => {
                console.warn('[ExecutionLogger] IndexedDB not available; falling back to in-memory log.');
                this.db = null;
                resolve();
            };
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    async log(moduleId, status, payload) {
        await this.ready;

        const entry = {
            timestamp: Date.now(),
            moduleId,
            status,
            payload: JSON.stringify(payload),
        };

        if (this.db) {
            try {
                const tx = this.db.transaction([this.storeName], 'readwrite');
                const store = tx.objectStore(this.storeName);
                store.add(entry);
                await new Promise((resolve, reject) => {
                    tx.oncomplete = resolve;
                    tx.onerror = reject;
                });
            } catch (e) {
                console.error('[ExecutionLogger] Failed to write log entry:', e);
            }
        }

        // Console log for immediate feedback (development)
        console.log(`[ExecutionLogger] ${moduleId} :: ${status}`, payload);
    }
}

const ExecutionLogger = new ExecutionLoggerImpl();

// ---------------------------------------------------------------------------
// Data Transmitter (public API)
// ---------------------------------------------------------------------------

export const DataTransmitter = {
    mode: 'LOCAL_LOG_ONLY',

    /**
     * Safely logs a diagnostic payload to the browser‑local IndexedDB audit
     * store. No data ever leaves the device.
     *
     * @param {string} moduleId   – Identifier of the reporting module.
     * @param {*}      payload    – Any JSON‑serializable diagnostic data.
     * @returns {Promise<Object>}  Status object.
     */
    transmit: async (moduleId, payload) => {
        await ExecutionLogger.log(moduleId, 'TRANSMITTED', payload);

        const payloadString = JSON.stringify(payload);
        return {
            status: 'SUCCESS_LOCAL',
            channel: 'INDEXEDDB_AUDIT_LOG',
            bytesTransmitted: payloadString.length,
            message:
                'Payload safely logged to browser-local audit storage. External network exfiltration is disabled per policy.',
        };
    },
};

export { ExecutionLogger };
export default DataTransmitter;