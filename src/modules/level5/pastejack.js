/**
 * Pinpoint Module: Clipboard API Permission & Capability Audit
 * Level 3: Critical Intelligence
 */
export default {
    id: 'pastejack',
    title: 'Clipboard_API_Audit',
    level: 3,
    info: "Audits navigator.clipboard support and permission states (clipboard-read, clipboard-write).",
    steps: ["Check navigator.clipboard existence.", "Query clipboard permission states via navigator.permissions.query."],
    run: async () => {
        const supported = typeof navigator.clipboard !== 'undefined';
        let readPermission = 'unknown';
        let writePermission = 'unknown';

        if (navigator.permissions && navigator.permissions.query) {
            try {
                const readStatus = await navigator.permissions.query({ name: 'clipboard-read' });
                readPermission = readStatus.state;
            } catch (e) {
                readPermission = 'not_queriable';
            }
            try {
                const writeStatus = await navigator.permissions.query({ name: 'clipboard-write' });
                writePermission = writeStatus.state;
            } catch (e) {
                writePermission = 'not_queriable';
            }
        }

        return {
            clipboardApiSupported: supported,
            readTextSupported: supported && typeof navigator.clipboard.readText === 'function',
            writeTextSupported: supported && typeof navigator.clipboard.writeText === 'function',
            permissions: {
                read: readPermission,
                write: writePermission
            }
        };
    }
};
