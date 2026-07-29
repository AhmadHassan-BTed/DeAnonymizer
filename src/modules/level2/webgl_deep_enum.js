/**
 * Pinpoint Module: WebGL Detailed Parameter Enumeration
 * Level 2: Advanced Profiling
 */
export default {
    id: 'webgl_deep_enum',
    title: 'WebGL_Params',
    level: 2,
    info: "Enumerates WebGL context capabilities, supported extensions, and graphics hardware limits.",
    steps: ["Create offscreen HTML5 canvas & WebGL context.", "Query webgl extensions list.", "Query WebGL parameter limits."],
    run: async () => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
            return { error: 'WebGL context not supported or disabled.' };
        }

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        const extensions = gl.getSupportedExtensions() || [];

        const params = {
            vendor: gl.getParameter(gl.VENDOR),
            renderer: gl.getParameter(gl.RENDERER),
            version: gl.getParameter(gl.VERSION),
            shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
            unmaskedVendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'N/A',
            unmaskedRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'N/A',
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
            maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
            maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
            maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
            maxVertexTextureImageUnits: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
            maxCombinedTextureImageUnits: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
            supportedExtensionsCount: extensions.length,
            extensions: extensions
        };

        return params;
    }
};
