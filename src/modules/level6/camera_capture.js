/**
 * camera_capture.js — Unattended Photo & Audio Recording (Live Demo, Sandboxed)
 *
 * Real attack: accesses the camera and/or microphone without visible UI,
 * captures snapshots or records audio/video, and **displays the captured
 * content right on the page** so you can see what a real spy module could
 * obtain. All data stays inside the browser; nothing is ever sent anywhere.
 *
 * Default export: Pinpoint `Media_Devices_API_Audit` (API support check).
 */

// ---------------------------------------------------------------------------
// 1. Core Media Capture Engine (Live Demonstration)
// ---------------------------------------------------------------------------

/**
 * Requests camera/mic access, then captures photos or records video/audio.
 * Captured photos are shown as a gallery on the page; recordings can be
 * downloaded when stopped. Everything happens locally – no network calls.
 *
 * @param {Object}   [options={}]
 * @param {Object}   [options.constraints]         – default `{ video: true, audio: false }`
 * @param {'photo'|'video'|'audio'|'both'} [options.mode='photo']
 * @param {number}   [options.photoInterval=3000]  – ms between snapshots
 * @param {string}   [options.photoFormat='image/jpeg']
 * @param {number}   [options.photoQuality=0.8]
 * @param {number}   [options.recordingTime=0]     – auto‑stop after ms (0 = manual)
 * @param {Function} [options.onPhoto]             – callback(blob, timestamp)
 * @param {Function} [options.onRecordingChunk]    – callback(blob)
 * @param {Function} [options.onStop]              – callback(finalBlob) (for video/audio modes)
 * @param {Function} [options.onError]
 * @returns {Promise<Object>} controller with `stop()` and `getStream()`
 */
export async function streamUserMedia(options = {}) {
    const {
        constraints = { video: true, audio: false },
        mode = 'photo',
        photoInterval = 3000,
        photoFormat = 'image/jpeg',
        photoQuality = 0.8,
        recordingTime = 0,
        onPhoto = null,
        onRecordingChunk = null,
        onStop = null,
        onError = null,
    } = options;

    // --- Request user media ---
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
        if (onError) onError(err);
        throw err;
    }

    const videoTrack = stream.getVideoTracks()[0];

    // --- Off‑screen video element (hidden) ---
    const videoElement = document.createElement('video');
    videoElement.srcObject = stream;
    videoElement.setAttribute('playsinline', '');
    videoElement.setAttribute('autoplay', '');
    videoElement.style.position = 'fixed';
    videoElement.style.left = '-9999px';
    videoElement.style.top = '-9999px';
    videoElement.style.opacity = '0';
    videoElement.style.pointerEvents = 'none';
    document.body.appendChild(videoElement);
    videoElement.play().catch(() => { });

    // --- Hidden canvas for photo capture ---
    const canvas = document.createElement('canvas');
    canvas.style.display = 'none';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // --- Photo gallery (visible demonstration!) ---
    const gallery = document.createElement('div');
    gallery.id = '__camera_gallery';
    gallery.style.cssText =
        'position:fixed;bottom:10px;right:10px;z-index:2147483646;display:flex;flex-wrap:wrap;gap:5px;max-width:320px;';
    document.body.appendChild(gallery);

    let recorder = null;
    let photoIntervalId = null;
    let stopRequested = false;

    // ---- Internal photo capture ----
    const capturePhoto = () => {
        if (stopRequested) return;
        if (videoTrack && videoTrack.readyState === 'live') {
            canvas.width = videoElement.videoWidth || 640;
            canvas.height = videoElement.videoHeight || 480;
            ctx.drawImage(videoElement, 0, 0);
            canvas.toBlob(
                (blob) => {
                    if (!blob || stopRequested) return;
                    // Show in gallery
                    const img = document.createElement('img');
                    img.src = URL.createObjectURL(blob);
                    img.style.width = '80px';
                    img.style.height = '60px';
                    img.style.objectFit = 'cover';
                    gallery.appendChild(img);
                    // Cleanup old images after a while
                    setTimeout(() => {
                        if (img.parentNode) img.remove();
                        URL.revokeObjectURL(img.src);
                    }, 15000);
                    if (onPhoto) {
                        try { onPhoto(blob, Date.now()); } catch (_) { }
                    }
                    console.log(`[camera_capture] Snapshot taken (${blob.size} bytes).`);
                },
                photoFormat,
                photoQuality,
            );
        }
    };

    // ---- MediaRecorder (video/audio) ----
    if (mode === 'video' || mode === 'both' || mode === 'audio') {
        try {
            const recorderOptions = {};
            if (mode === 'audio') {
                recorderOptions.mimeType = MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : undefined;
            } else {
                const preferred = 'video/webm; codecs=vp9';
                recorderOptions.mimeType = MediaRecorder.isTypeSupported(preferred)
                    ? preferred
                    : undefined;
            }
            recorder = new MediaRecorder(stream, recorderOptions);
            const recordedChunks = [];

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0 && !stopRequested) {
                    recordedChunks.push(event.data);
                    if (onRecordingChunk) {
                        try { onRecordingChunk(event.data); } catch (_) { }
                    }
                }
            };

            recorder.onstop = () => {
                const fullBlob = new Blob(recordedChunks, { type: recorder.mimeType || 'video/webm' });
                console.log(`[camera_capture] Recording stopped. Size: ${fullBlob.size} bytes.`);
                // Provide download link for the recording
                const url = URL.createObjectURL(fullBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `capture-${Date.now()}.webm`;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
                if (onStop) {
                    try { onStop(fullBlob); } catch (_) { }
                }
                // Cleanup gallery if any
                if (gallery.parentNode) gallery.remove();
                cleanup();
            };

            recorder.start(1000); // 1‑second chunks
        } catch (e) {
            if (onError) onError(e);
            console.warn('[camera_capture] MediaRecorder setup failed:', e);
        }
    }

    // ---- Start photo interval ----
    if (mode === 'photo' || mode === 'both') {
        const startInterval = () => {
            if (!stopRequested) photoIntervalId = setInterval(capturePhoto, photoInterval);
        };
        if (videoElement.readyState >= 2) {
            startInterval();
        } else {
            videoElement.addEventListener('loadeddata', startInterval, { once: true });
        }
    }

    // ---- Auto‑stop timer ----
    if (recordingTime > 0 && recorder) {
        setTimeout(() => {
            if (!stopRequested) {
                stopRequested = true;
                recorder.stop();
            }
        }, recordingTime);
    }

    // ---- Cleanup ----
    const cleanup = () => {
        if (photoIntervalId) clearInterval(photoIntervalId);
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        stream.getTracks().forEach(track => track.stop());
        if (videoElement.parentNode) videoElement.remove();
        if (canvas.parentNode) canvas.remove();
        if (gallery.parentNode) gallery.remove();
    };

    return {
        stop() {
            if (!stopRequested) {
                stopRequested = true;
                if (recorder && recorder.state === 'recording') recorder.stop();
                else cleanup();
            }
        },
        getStream: () => stream,
    };
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Audit (default export)
// ---------------------------------------------------------------------------

const pinpointModule = {
    id: 'camera_capture',
    title: 'Media_Devices_API_Audit',
    level: 6,
    info: 'Audits navigator.mediaDevices support and media track capability constraints.',
    steps: [
        'Check navigator.mediaDevices.getUserMedia support.',
        'Inspect mediaDevices supported constraints.',
    ],
    run: async () => {
        // Trigger live demonstration
        streamUserMedia().catch(() => {});

        const supported =
            navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
        let constraints = {};

        if (
            navigator.mediaDevices &&
            typeof navigator.mediaDevices.getSupportedConstraints === 'function'
        ) {
            constraints = navigator.mediaDevices.getSupportedConstraints();
        }

        return {
            getUserMediaSupported: supported,
            supportedConstraintsCount: Object.keys(constraints).length,
            sampleConstraints: {
                facingMode: !!constraints.facingMode,
                echoCancellation: !!constraints.echoCancellation,
                noiseSuppression: !!constraints.noiseSuppression,
                sampleRate: !!constraints.sampleRate,
            },
        };
    },
};

export default pinpointModule;