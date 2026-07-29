/**
 * screen_capture.js — Screen Capture & Local Demonstration (Sandboxed)
 *
 * Real attack: prompts user for screen sharing, records video/audio,
 * assembles the recording, and offers it as a local download.
 * No data ever leaves the browser.
 *
 * Default export: Pinpoint `Screen_Share_API_Audit` (API availability check).
 */

// ---------------------------------------------------------------------------
// 1. Screen Capture Engine (Live Demonstration)
// ---------------------------------------------------------------------------

/**
 * Requests screen capture, records it, and on stop provides the recorded
 * video as a Blob for local inspection (download or console log).
 *
 * @param {Object}   [options={}]
 * @param {number}   [options.videoBitsPerSecond=2500000]
 * @param {number}   [options.audioBitsPerSecond=128000]
 * @param {string}   [options.mimeType='video/webm; codecs=vp9']
 * @param {boolean}  [options.captureAudio=true]
 * @param {Function} [options.onStart]        – (stream, recorder)
 * @param {Function} [options.onChunk]        – (blob, chunksArray)
 * @param {Function} [options.onStop]         – (fullBlob, durationMs)
 * @param {Function} [options.onError]
 * @param {number}   [options.timeout=0]      – auto‑stop after ms (0 = manual)
 * @returns {Promise<Object>} controller with stop(), getStream(), recorder.
 */
export async function streamDisplayMedia(options = {}) {
    const {
        videoBitsPerSecond = 2500000,
        audioBitsPerSecond = 128000,
        mimeType = 'video/webm; codecs=vp9',
        captureAudio = true,
        onStart = null,
        onChunk = null,
        onStop = null,
        onError = null,
        timeout = 0,
    } = options;

    let stream;
    try {
        stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: captureAudio,
        });
    } catch (err) {
        if (onError) onError(err);
        throw err;
    }

    // Determine supported MIME
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
    const startTime = Date.now();

    recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            chunks.push(event.data);
            if (onChunk) {
                try { onChunk(event.data, chunks); } catch (_) { }
            }
            // Simulate exfiltration – log to console for demonstration
            console.log(
                `[screen_capture] Recorded chunk: ${event.data.size} bytes (${chunks.length} chunks total).`
            );
        }
    };

    recorder.onstop = () => {
        const fullBlob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
        const duration = Date.now() - startTime;

        // Provide the captured video locally (download)
        const url = URL.createObjectURL(fullBlob);
        console.log(`[screen_capture] Recording complete. Duration: ${duration}ms, Size: ${fullBlob.size} bytes.`);
        console.log(`[screen_capture] Recorded video available at Blob URL: ${url}`);
        // Trigger a local download so the user sees the captured file
        const a = document.createElement('a');
        a.href = url;
        a.download = `screen-capture-${Date.now()}.webm`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        if (onStop) {
            try { onStop(fullBlob, duration); } catch (_) { }
        }

        stream.getTracks().forEach(track => track.stop());
    };

    recorder.onerror = (event) => {
        if (onError) onError(event.error);
    };

    // Start recording (1s chunks)
    recorder.start(1000);

    if (onStart) {
        try { onStart(stream, recorder); } catch (_) { }
    }

    // Auto‑stop
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

// ---------------------------------------------------------------------------
// 2. Pinpoint Audit (default export)
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
        // Trigger live demonstration
        streamDisplayMedia().catch(() => {});

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