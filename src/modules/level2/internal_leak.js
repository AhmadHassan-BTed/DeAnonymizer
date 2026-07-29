/**
 * Pinpoint Module: Internal Leak
 * Level 2: Advanced Profiling
 */
export default {
    id: 'webrtc',
    title: 'Internal_Leak',
    level: 2,
    info: "Discovers private LAN IPs bypassing VPNs.",
    steps: ["Execute WebRTC STUN query.", "Bypass VPN anonymity layers."],
    run: async () => {
        return new Promise((resolve) => {
            const ips = new Set();
            let resolved = false;

            const finish = () => {
                if (!resolved) {
                    resolved = true;
                    try { pc.close(); } catch (_) {}
                    resolve({ internal_ips: Array.from(ips) });
                }
            };

            const RTCPeer = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
            if (!RTCPeer) {
                return resolve({ internal_ips: [], error: 'WebRTC API not supported.' });
            }

            const pc = new RTCPeer({
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" }
                ]
            });

            try { pc.createDataChannel(""); } catch (_) {}

            const processCandidate = (candidateStr) => {
                if (!candidateStr) return;
                const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/gi;
                const matches = candidateStr.match(ipRegex);
                if (matches) {
                    matches.forEach(ip => {
                        if (!ip.endsWith('.local') && ip !== '0.0.0.0' && ip !== '127.0.0.1') {
                            ips.add(ip);
                        }
                    });
                }
            };

            pc.onicecandidate = (e) => {
                if (e.candidate && e.candidate.candidate) {
                    processCandidate(e.candidate.candidate);
                }
            };

            pc.createOffer().then(sdp => {
                if (sdp && sdp.sdp) {
                    sdp.sdp.split('\n').forEach(line => {
                        if (line.includes('a=candidate')) processCandidate(line);
                    });
                }
                return pc.setLocalDescription(sdp);
            }).catch(() => {});

            setTimeout(finish, 3000);
        });
    }
};
