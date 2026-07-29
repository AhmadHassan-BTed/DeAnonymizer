<div align="center">

#  DeAnonymizer
### *Professional Intelligence & Vulnerability Diagnostic Framework*

[![License: MIT](https://img.shields.io/badge/License-MIT-00ff41.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/Version-3.2.0-ffcc00.svg?style=flat-square)](#)
[![Threat Levels](https://img.shields.io/badge/Threat_Levels-1--4-ff003c.svg?style=flat-square)](#)
[![Developer](https://img.shields.io/badge/Lead_Developer-Ahmad_Hassan_(B--Ted)-9d00ff.svg?style=flat-square)](https://github.com/AhmadHassan-BTed)
[![Live Demo](https://img.shields.io/badge/View_Live-DeAnonymizer-00ff41?style=for-the-badge&logo=target)](https://AhmadHassan-BTed.github.io/Pinpoint-Location-Tracker/)

**Engineered by Ahmad Hassan (B-Ted)**

---
*A high-fidelity cybersecurity laboratory designed for diagnostic telemetry, advanced fingerprinting, and browser security boundary research.*
</div>

##  Architecture Overview

The toolkit is built on a **Zero-Coupling Dynamic Plugin Architecture**. The core engine remains entirely agnostic of individual module logic, discovering and loading tools at runtime via a centralized manifest.

```mermaid
graph TD
    A[index.html / debug.html] -->|Bootstrap| B[src/core/engine.js]
    B -->|Fetch Discovery| C[src/config/modules.json]
    C -->|Return Payload Paths| B
    B -->|Dynamic import| D[src/modules/level_X/*.js]
    D -->|Self-Register| B
    B -->|Render Grid| UI[Dynamic Command Center]
```

### Key Design Principles:
- **0% Coupling**: Core engine logic and security payloads never touch.
- **100% Cohesion**: Each module is a self-contained unit with its own metadata and execution logic.
- **Dynamic Handshake**: New tools are added by updating a JSON manifest—no code modification required.

---

##  Threat Escalation Hierarchy

Tools are categorized into six distinct levels, reflecting the severity of information exposure.

| Level | Classification | Visual | Focus Area | Implementation Status |
| :--- | :--- | :--- | :--- | :--- |
| **L1** | **Standard Recon** | 🟢 Green | OS, Browser, and Performance Telemetry | Functional Diagnostics |
| **L2** | **Advanced Profiling** | 🟡 Yellow | Network Topology & Hardware Fingerprinting | Functional Diagnostics |
| **L3** | **Critical Intelligence** | 🔴 Red | PII, Storage Metadata, and Web APIs | Functional Diagnostics |
| **L4** | **High-Fidelity HW Exploits** | 🟣 Purple | Hardware Silicon & Audio Fingerprinting | Diagnostic Probes |
| **L5** | **Weaponized Exploits** | 🖤 Black | Active Weaponized Vectors (Keyloggers, MitM, Formjacking) | **Disabled per Security Policy** |
| **L6** | **Social Engineering & Phishing** | 🔥 Crimson | Phishing Kits, OAuth Hijacking, Unattended Captures | **Disabled per Security Policy** |

---

## 🔒 Policy & Implementation Constraints

This framework is maintained strictly for educational research and authorized penetration testing diagnostics. **Active attack modules, credential phishing interfaces, keyloggers, and data exfiltration infrastructure are intentionally disabled.**

### Disabled / Non-Implemented Modules:
- **Exfiltration Infrastructure**: `transmitter.js` (Covert channels, DNS exfiltration, image beacons).
- **Persistence Engines**: `persistence.js` (Service Worker MitM, cache poisoning, C2 channels).
- **Evasion Engines**: `evasion.js` (DevTools bypass, anti-debugging, code obfuscation).
- **Active Network Probes**: `port_scanner.js`, `dns_rebinding.js`.
- **Credential & Phishing Modules**: `credential_phish.js`, `autofill_harvest.js`, `session_hijack.js`, `keylogger.js`, `formjack.js`, `oauth_hijack.js`, `notification_phish.js`.
- **Media & Hardware Capture**: `camera_capture.js`, `screen_capture.js`, `download_drive_by.js`, `permission_abuse.js`.
- **Crypto & Side Channels**: `crypto_miner.js`, `timing_oracle.js`, `webgl_shader_exploit.js`, `spectre_probe.js`.

When executed, disabled module stubs safely return:
```json
{
  "status": "NOT_IMPLEMENTED",
  "message": "This module is not implemented and disabled per security policy constraints."
}
```

---

##  System Workflow & Data Flow

When a module is executed, it follows a strict lifecycle from initialization to exfiltration.

```mermaid
sequenceDiagram
    participant U as UI (Command Center)
    participant E as Engine.js
    participant M as Module.js
    participant API as Browser/External API

    U->>E: User clicks 'EXEC'
    E->>E: Initializing Sequence
    E->>M: run() async
    M->>API: Native Probe / Fetch
    API-->>M: Raw Data
    M-->>E: Structured JSON Payload
    E->>U: Render to Terminal Output
```

---

##  Repository Structure

```text
Pinpoint-Location-Tracker/
├── src/
│   ├── core/
│   │   ├── engine.js         # Framework Orchestrator
│   │   └── transmitter.js    # Data Exfiltration Logic
│   ├── config/
│   │   └── modules.json      # Discovery Manifest
│   ├── modules/              # Plug-and-Play Tools
│   │   ├── level1/           # Standard Recon
│   │   ├── level2/           # Fingerprinting
│   │   ├── level3/           # Intelligence
│   │   └── level4/           # Bypass Lab
│   └── styles/               # Global Design System
├── debug.html                # Automated Lab Shell
└── index.html                # Stealth Dashboard
```

---

##  Internal Module Structure

Every module must adhere to a strict interface to ensure 100% cohesion within the framework.

<details>
<summary><b>View Module Template (JavaScript)</b></summary>

```javascript
/**
 * Pinpoint Module Template
 */
export default {
    id: 'unique_identifier',
    title: 'Display_Name',
    level: 4, // Level 1-4
    info: "Description of the security exposure.",
    steps: [
        "Phase 1 Recon...",
        "Phase 2 Probe...",
        "Phase 3 Exfiltration..."
    ],
    run: async () => {
        // Implementation logic
        return { data: 'captured_intel' };
    }
};
```
</details>

---

##  Development & Contribution

The repository is maintained with a focus on engineering excellence. Contributors are encouraged to expand the toolkit by implementing new diagnostic modules.

1.  **Draft**: Implement the module using the standard template.
2.  **Locate**: Place the script in the corresponding `src/modules/levelX/` folder.
3.  **Register**: Add the file path to `src/config/modules.json`.
4.  **Verify**: Open `debug.html` to confirm the tool is automatically rendered and functional.

---

<div align="center">
  <br />
  <sub><b>Developed & Documented by Ahmad Hassan (B-Ted)</b></sub>
  <br />
  <sup>Professionally maintained for Cybersecurity Research & Education</sup>
</div>
