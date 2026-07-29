/**
 * Pinpoint Module: Speech Voice Enumeration
 * Level 1: Standard Recon
 */
export default {
    id: 'speech_recon',
    title: 'Speech_Voices',
    level: 1,
    info: "Enumerates installed Web Speech API synthesis voices to inspect client language engine support.",
    steps: ["Access window.speechSynthesis.", "Wait for voiceschanged event if required.", "Enumerate voice attributes (name, lang, default)."],
    run: async () => {
        if (!('speechSynthesis' in window)) {
            return { error: 'Web Speech API (speechSynthesis) not supported by browser.' };
        }

        return new Promise((resolve) => {
            let voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                return resolve(formatVoices(voices));
            }

            // Wait for voiceschanged event if voices haven't loaded yet
            const onVoicesChanged = () => {
                voices = window.speechSynthesis.getVoices();
                window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
                resolve(formatVoices(voices));
            };

            window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

            // Timeout fallback
            setTimeout(() => {
                window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
                resolve(formatVoices(window.speechSynthesis.getVoices()));
            }, 1000);
        });
    }
};

function formatVoices(voices) {
    return {
        totalVoices: voices.length,
        voices: voices.map(v => ({
            name: v.name,
            lang: v.lang,
            default: v.default,
            localService: v.localService
        }))
    };
}
