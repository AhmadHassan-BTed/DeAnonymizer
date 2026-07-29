/**
 * Pinpoint Module: Blob URL & HTMLAnchorElement Download Attribute Audit
 * Level 6: Social Engineering & Phishing
 */
export default {
    id: 'download_drive_by',
    title: 'Download_Attribute_Audit',
    level: 6,
    info: "Audits HTMLAnchorElement download attribute support and URL.createObjectURL availability.",
    steps: ["Check download attribute on HTMLAnchorElement.", "Check URL.createObjectURL support."],
    run: async () => {
        const a = document.createElement('a');
        const downloadSupported = 'download' in a;
        const blobSupported = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

        return {
            downloadAttributeSupported: downloadSupported,
            blobObjectUrlSupported: blobSupported
        };
    }
};
