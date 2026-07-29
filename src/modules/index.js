/**
 * Pinpoint Framework: Module Registry
 * Organized by Threat Hierarchy
 */

// LEVEL 1: STANDARD RECON
import env_telemetry from './level1/env_telemetry.js';
import node_health from './level1/node_health.js';
import pwr_analytics from './level1/pwr_analytics.js';
import software_profile from './level1/software_profile.js';
import timezone_leak from './level1/timezone_leak.js';
import speech_recon from './level1/speech_recon.js';

// LEVEL 2: ADVANCED PROFILING
import net_uplink from './level2/net_uplink.js';
import internal_leak from './level2/internal_leak.js';
import hardware_hash from './level2/hardware_hash.js';
import hw_enumerate from './level2/hw_enumerate.js';
import access_audit from './level2/access_audit.js';
import webgl_deep_enum from './level2/webgl_deep_enum.js';

// LEVEL 3: CRITICAL INTELLIGENCE
import geospatial_fix from './level3/geospatial_fix.js';
import civic_locator from './level3/civic_locator.js';
import deep_token_hunt from './level3/deep_token_hunt.js';
import identity_trace from './level3/identity_trace.js';
import buffer_audit from './level3/buffer_audit.js';

// LEVEL 4: BYPASS & HW EXPLOITS
import gpu_trace from './level4/gpu_attack.js';
import audio_hash from './level4/audio_fingerprint.js';
import sandbox_probe from './level4/sandbox_probe.js';

export const activeModules = [
    env_telemetry, node_health, pwr_analytics, software_profile, timezone_leak, speech_recon,
    net_uplink, internal_leak, hardware_hash, hw_enumerate, access_audit, webgl_deep_enum,
    geospatial_fix, civic_locator, deep_token_hunt, identity_trace, buffer_audit,
    gpu_trace, audio_hash, sandbox_probe
];
