# Excluded Vector Specifications & Policy Mapping

This document details the specific offensive payload function signatures, covert exfiltration methods, and persistence routines that are **intentionally excluded** from the SilentSniffer codebase to maintain legal compliance and adhere to security safety policies.

Each entry below details the original proposed offensive function specification and its safe, policy-compliant Web API diagnostic implementation currently active in the repository.

---

## Core Infrastructure Engines

### 1. Data Exfiltration Engine (`src/core/transmitter.js`)
- **Excluded Function**: `DataTransmitter.transmitDNS(data)` / `DataTransmitter.startWebSocketTunnel(url)`
- **Excluded Vector**: Encoding stolen data into DNS subdomain queries (`base64.attacker.com`), covert 1x1 image GET requests, or unconsented WebRTC P2P data channels.
- **Active Safe Implementation**: `DataTransmitter.transmit(moduleId, payload)` — Routes diagnostic JSON outputs exclusively to browser-isolated IndexedDB local storage (`ExecutionLogger`). Zero remote network calls.

### 2. Persistence Engine (`src/core/persistence.js`)
- **Excluded Function**: `PersistenceEngine.installServiceWorker(scriptUrl)` / `PersistenceEngine.poisonCache(targetUrl, payload)`
- **Excluded Vector**: Registering malicious Service Workers to intercept fetch requests, poisoning CacheStorage resources with backdoored JS files, or BroadcastChannel C2 loops.
- **Active Safe Implementation**: `PersistenceEngine.checkStoragePersistence()` — Audits browser origin persistence rights via `navigator.storage.persisted()` and `navigator.storage.persist()`.

### 3. Anti-Detection & Evasion Engine (`src/core/evasion.js`)
- **Excluded Function**: `EvasionEngine.trapDevTools()` / `EvasionEngine.bypassCSP()`
- **Excluded Vector**: Debugger anti-attach loops, open DevTools detection resize traps, automated code obfuscation, or CSP header bypass routines.
- **Active Safe Implementation**: `EvasionEngine.evaluate()` — Audits browser automation flags (`navigator.webdriver`, PhantomJS globals, Selenium attributes).

---

## Level 3 — Critical Intelligence

| Module File | Excluded Function Signature | Excluded Vector Description | Active Diagnostic Replacement |
| :--- | :--- | :--- | :--- |
| `autofill_harvest.js` | `harvestAutofillData()` | Injects invisible off-screen forms to trigger browser autofill for card/PII theft | Audits HTML5 `autocomplete` attribute support (`Autofill_Capability_Audit`) |
| `credential_phish.js` | `renderPhishingModal()` | Renders pixel-perfect Google/Microsoft login overlays for credential interception | Audits `window.isSecureContext` & `navigator.credentials` support (`Auth_Context_Audit`) |
| `session_hijack.js` | `extractSessionTokens()` | Extracts `document.cookie` tokens & Meta CSRF tags for session hijacking | Audits `localStorage`, `sessionStorage`, and `cookieEnabled` flags (`Storage_State_Audit`) |
| `history_sniff.js` | `sniffVisitedURLs()` | `:visited` CSS link styling timing side-channels to determine browser history | Audits `window.history` stack length & scroll restoration (`History_API_Audit`) |

---

## Level 4 — High-Fidelity HW Exploits

| Module File | Excluded Function Signature | Excluded Vector Description | Active Diagnostic Replacement |
| :--- | :--- | :--- | :--- |
| `port_scanner.js` | `scanLocalhostTCP()` | Browser-based TCP port scanner probing 127.0.0.1 and internal subnets via fetch/WebSocket timing | Audits WebSocket, Fetch, and Beacon API availability (`Network_Sockets_Audit`) |
| `service_worker_mitm.js` | `injectMitMWorker()` | Registers persistent request-modifying Service Workers | Audits `navigator.serviceWorker` registration count & active controller (`Service_Worker_Audit`) |
| `webgl_shader_exploit.js` | `executeCryptojackShader()` | GLSL compute shaders running browser cryptojacking algorithms | Queries GLSL shader precision format parameters (`WebGL_Shader_Audit`) |

---

## Level 5 — Weaponized Exploits

| Module File | Excluded Function Signature | Excluded Vector Description | Active Diagnostic Replacement |
| :--- | :--- | :--- | :--- |
| `dns_rebinding.js` | `triggerRebindAttack()` | SOP bypass manipulating DNS resolution to point domain at internal IPs | Audits origin, protocol, hostname, and `document.domain` isolation (`Origin_Boundary_Audit`) |
| `clickjack_engine.js` | `renderClickjackOverlay()` | Transparent iframe UI redress framework overlaying hidden buttons | Audits window framing status (`window.top !== window.self`) (`Window_Framing_Audit`) |
| `pastejack.js` | `interceptCopyEvent()` | Injects malicious content into user clipboard during `copy` events | Audits `navigator.clipboard` read/write permission queries (`Clipboard_API_Audit`) |
| `cache_poison_attack.js` | `poisonCacheResource()` | Overwrites CacheStorage JS resources with trojaned scripts | Audits CacheStorage API origin availability (`Cache_Policy_Audit`) |
| `tab_napping.js` | `tabnappOnBlur()` | Replaces tab content with fake login page upon `visibilitychange` | Audits Page Visibility API state (`document.visibilityState`) (`Page_Visibility_Audit`) |
| `keylogger.js` | `startKeystrokeListener()` | Global `keydown`/`keypress` input listener capturing user entries | Audits Keyboard Layout API support (`navigator.keyboard`) (`Keyboard_API_Audit`) |
| `formjack.js` | `interceptFormSubmit()` | Magecart-style form submission interception and exfiltration | Audits HTMLFormElement `requestSubmit` support (`Form_Interface_Audit`) |
| `crypto_miner.js` | `startWasmMiner()` | Multi-threaded WASM cryptocurrency background mining engine | Audits WebAssembly validation & hardware core count (`WASM_Worker_Audit`) |

---

## Level 6 — Social Engineering & Phishing

| Module File | Excluded Function Signature | Excluded Vector Description | Active Diagnostic Replacement |
| :--- | :--- | :--- | :--- |
| `notification_phish.js` | `sendPhishingNotification()` | Pushes fake security alert notifications with phishing links | Audits Web Notification API support & permission state (`Notification_API_Audit`) |
| `oauth_hijack.js` | `spawnFakeOAuthPopup()` | Displays fake OAuth consent popups for credential capture | Audits window popup interface capabilities (`Popup_Interface_Audit`) |
| `download_drive_by.js` | `triggerDriveByDownload()` | Automated anchor click triggering executable payload downloads | Audits anchor `download` attribute & Blob URL support (`Download_Attribute_Audit`) |
| `permission_abuse.js` | `chainPermissionRequests()` | Social engineering prompts chaining sequential camera/mic/GPS grants | Queries `navigator.permissions` status for sensors (`Permissions_API_Audit`) |
| `screen_capture.js` | `streamDisplayMedia()` | Captures and exfiltrates screen recordings via `getDisplayMedia()` | Audits Display Media API screen share support (`Screen_Share_API_Audit`) |
| `camera_capture.js` | `streamUserMedia()` | Unattended photo/audio recording via hidden `<video>` elements | Audits MediaDevices `getUserMedia` track constraints (`Media_Devices_API_Audit`) |

---

## Verification & Compliance Guarantee

All active JS module files in `src/modules/` contain **100% functional, non-destructive Web API feature auditing code**. No functional attack code, keyloggers, or exfiltration payloads exist within the repository.
