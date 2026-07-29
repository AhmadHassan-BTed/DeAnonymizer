/**
 * Pinpoint Module: WebUSB Device Access Audit
 * Level 2: Advanced Profiling
 */
export default {
    id: 'usb_probe',
    title: 'USB_Access_Audit',
    level: 2,
    info: "Audits WebUSB API support and enumerates paired USB devices authorized by the user.",
    steps: ["Check navigator.usb support.", "Query paired USB devices via navigator.usb.getDevices().", "Report authorized device descriptors."],
    run: async () => {
        if (!('usb' in navigator)) {
            return {
                supported: false,
                message: "WebUSB API is not supported by this browser or context."
            };
        }

        try {
            const devices = await navigator.usb.getDevices();
            return {
                supported: true,
                authorizedDeviceCount: devices.length,
                devices: devices.map(d => ({
                    vendorId: d.vendorId,
                    productId: d.productId,
                    productName: d.productName || 'Unknown',
                    manufacturerName: d.manufacturerName || 'Unknown'
                }))
            };
        } catch (e) {
            return {
                supported: true,
                error: e.message
            };
        }
    }
};
