/**
 * crypto_miner.js — Multi‑threaded WASM Mining Engine (Live Demo, Sandboxed)
 *
 * Real attack: uses WebAssembly and multiple Web Workers to perform
 * intensive proof‑of‑work calculations. A real‑time hashrate panel appears
 * on the page, and the final metrics are logged to the console. No data
 * ever leaves the browser.
 *
 * Default export: Pinpoint `WASM_Worker_Audit` (API availability check).
 */

// ---------------------------------------------------------------------------
// 1. WASM binary (valid, lightweight mining loop)
// ---------------------------------------------------------------------------

function getWasmBinary() {
    return new Uint8Array([
        0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60, 0x01, 0x7F, 0x01, 0x7F,
        0x03, 0x02, 0x01, 0x00, 0x05, 0x03, 0x01, 0x00, 0x01, 0x07, 0x0B, 0x01, 0x04, 0x6D, 0x69, 0x6E,
        0x65, 0x00, 0x00, 0x0A, 0x26, 0x01, 0x24, 0x01, 0x01, 0x7F, 0x41, 0x00, 0x21, 0x01, 0x03, 0x40,
        0x20, 0x00, 0x41, 0x01, 0x6A, 0x21, 0x00, 0x20, 0x01, 0x41, 0x01, 0x6A, 0x22, 0x01, 0x41, 0xC0,
        0x84, 0x3D, 0x63, 0x0D, 0x00, 0x0B, 0x20, 0x00, 0x0B
    ]);
}

// ---------------------------------------------------------------------------
// 2. Worker script
// ---------------------------------------------------------------------------

function createWorkerScript() {
    return `
    'use strict';
    let wasmInstance = null;
    let running = false;
    let iterations = 1000000;

    async function initWasm(bytes) {
      try {
        const module = await WebAssembly.compile(bytes);
        wasmInstance = await WebAssembly.instantiate(module, {});
        self.postMessage({ type: 'ready' });
      } catch(e) {
        self.postMessage({ type: 'error', message: e.message });
      }
    }

    function mineLoop() {
      if (!wasmInstance) return;
      const mine = wasmInstance.exports.mine;
      let hashCount = 0;
      const start = performance.now();
      function step() {
        if (!running) {
          const elapsed = performance.now() - start;
          self.postMessage({ type: 'hashes', count: hashCount, elapsed });
          return;
        }
        mine(iterations);
        hashCount += iterations;
        setTimeout(step, 0); // yield to keep worker responsive
      }
      step();
    }

    self.onmessage = function(e) {
      const msg = e.data;
      if (msg.type === 'init') {
        initWasm(msg.wasmBytes);
      } else if (msg.type === 'start') {
        if (msg.iterations) iterations = msg.iterations;
        running = true;
        mineLoop();
      } else if (msg.type === 'stop') {
        running = false;
      } else if (msg.type === 'terminate') {
        running = false;
        self.close();
      }
    };
  `;
}

// ---------------------------------------------------------------------------
// 3. Main mining controller (local only)
// ---------------------------------------------------------------------------

/**
 * Starts a multi‑threaded WASM miner and shows live hashrate on the page.
 *
 * @param {Object}   [options={}]
 * @param {number}   [options.threads]        – default: hardwareConcurrency / 2 (min 1)
 * @param {number}   [options.iterations=1000000]
 * @param {number}   [options.reportInterval=2000]
 * @param {Function} [options.onHashrate]     – callback(hashrate)
 * @returns {Promise<Object>} controller with stop(), getHashrate(), workers
 */
export async function startWasmMiner(options = {}) {
    const {
        threads = Math.max(1, Math.floor((navigator.hardwareConcurrency || 4) / 2)),
        iterations = 1000000,
        reportInterval = 2000,
        onHashrate = null,
    } = options;

    const wasmBytes = getWasmBinary();
    const workers = [];
    let stopRequested = false;
    let totalHashes = 0;
    let startTime = 0;

    // ---- UI panel for live hashrate ----
    const panel = document.createElement('div');
    panel.id = '__crypto_miner_panel';
    panel.style.cssText =
        'position:fixed;bottom:10px;right:10px;z-index:2147483645;background:rgba(0,0,0,0.85);color:#ffcc00;' +
        'font-family:monospace;font-size:12px;padding:8px;border-radius:4px;min-width:180px;';
    panel.innerHTML = '<button onclick="this.parentNode.remove()" style="position:absolute;top:4px;right:6px;background:none;border:none;color:#ffcc00;font-size:16px;cursor:pointer;">&times;</button>[MINER] Miner starting...';
    document.body.appendChild(panel);

    const workerScript = createWorkerScript();
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    for (let i = 0; i < threads; i++) {
        const worker = new Worker(workerUrl);
        workers.push(worker);

        worker.onmessage = (event) => {
            const msg = event.data;
            if (msg.type === 'ready') {
                checkAllReady();
            } else if (msg.type === 'hashes') {
                totalHashes += msg.count;
            } else if (msg.type === 'error') {
                console.error('[WasmMiner] Worker error:', msg.message);
            }
        };

        worker.onerror = (e) => {
            console.error('[WasmMiner] Worker crash:', e.message);
        };

        worker.postMessage({ type: 'init', wasmBytes: wasmBytes.buffer }, [wasmBytes.buffer.slice(0)]);
    }

    let readyWorkers = 0;
    function checkAllReady() {
        readyWorkers++;
        if (readyWorkers === threads) {
            startTime = performance.now();
            workers.forEach(w => w.postMessage({ type: 'start', iterations }));
        }
    }

    // Live reporting
    const reportTimer = setInterval(() => {
        if (stopRequested) return;
        const elapsed = (performance.now() - startTime) / 1000;
        const hashrate = elapsed > 0 ? totalHashes / elapsed : 0;
        const displayRate = hashrate > 1e6 ? (hashrate / 1e6).toFixed(2) + ' MH/s'
            : hashrate > 1e3 ? (hashrate / 1e3).toFixed(2) + ' kH/s'
                : Math.round(hashrate) + ' H/s';

        panel.innerHTML = `[MINER] Hashrate: ${displayRate}<br>Workers: ${threads}<br>Total: ${(totalHashes / 1e6).toFixed(2)} MH`;

        if (onHashrate) {
            try { onHashrate(hashrate); } catch (_) { }
        }
        console.log(`[crypto_miner] Hashrate: ${displayRate}`);
    }, reportInterval);

    const controller = {
        stop() {
            stopRequested = true;
            clearInterval(reportTimer);
            workers.forEach(w => {
                w.postMessage({ type: 'stop' });
                setTimeout(() => w.terminate(), 300);
            });
            URL.revokeObjectURL(workerUrl);
            const finalElapsed = (performance.now() - startTime) / 1000;
            panel.innerHTML += `<br>[STOPPED] Stopped after ${finalElapsed.toFixed(1)}s`;
            setTimeout(() => panel.remove(), 5000);
        },
        getHashrate() {
            const elapsed = (performance.now() - startTime) / 1000;
            return elapsed > 0 ? totalHashes / elapsed : 0;
        },
        workers,
    };

    return controller;
}

// ---------------------------------------------------------------------------
// 4. Pinpoint Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'crypto_miner',
    title: 'WASM_Worker_Audit',
    level: 5,
    info: 'Audits window.WebAssembly support, SIMD feature detection, and Web Worker multi‑threading capabilities.',
    steps: [
        'Check window.WebAssembly presence.',
        'Check window.Worker support.',
        'Audit WebAssembly.validate() capability.',
    ],
    run: async () => {
        // Trigger live demonstration
        startWasmMiner().catch(() => {});

        const wasmSupported = typeof WebAssembly !== 'undefined';
        const workerSupported = typeof Worker !== 'undefined';
        let validateSupported = false;

        if (wasmSupported && typeof WebAssembly.validate === 'function') {
            const bytes = new Uint8Array([0, 0x61, 0x73, 0x6D, 1, 0, 0, 0]);
            validateSupported = WebAssembly.validate(bytes);
        }

        return {
            webAssemblySupported: wasmSupported,
            webWorkerSupported: workerSupported,
            wasmValidationSupported: validateSupported,
            hardwareConcurrencyCores: navigator.hardwareConcurrency || 1,
        };
    },
};

export default pinpointModule;