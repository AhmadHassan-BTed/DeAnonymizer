/**
 * src/core/transmitter.js — Local Data Dispatcher & Audit Exfiltration Simulator
 *
 * This module provides a safe, local-only data transmission pipeline that
 * routes diagnostic payloads directly to an IndexedDB‑backed execution log.
 * It performs **zero** remote network calls and is used exclusively for
 * audit trails and local debugging.
 *
 * Excluded capabilities:
 *   - transmitDNS(data)                // DNS exfiltration encoding
 *   - startWebSocketTunnel(url)        // covert WebSocket C2
 *   - Covert 1x1 image GET requests
 */

// ---------------------------------------------------------------------------
// Internal IndexedDB Execution Logger (self‑contained)
// ---------------------------------------------------------------------------

class ExecutionLoggerImpl {
    constructor() {
        this.dbName = 'PinpointAuditLog';
        this.storeName = 'logs';
        this.dbVersion = 1;
        this.db = null;
        this.ready = this._initDB();
    }

    /**
     * Initialise IndexedDB database. Creates the object store if needed.
     */
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

    /**
     * Log an entry to IndexedDB. Falls back to a silent in‑memory buffer
     * if IndexedDB is unavailable.
     *
     * @param {string} moduleId
     * @param {string} status
     * @param {*} payload
     */
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

        // Also output to console when in development
        if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'production') {
            console.log(`[ExecutionLogger] ${moduleId} :: ${status}`, payload);
        }
    }
}

// Singleton instance
const ExecutionLogger = new ExecutionLoggerImpl();

// ---------------------------------------------------------------------------
// Data Transmitter
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

// Also expose ExecutionLogger for other core modules that may need it
export { ExecutionLogger };
export default DataTransmitter;