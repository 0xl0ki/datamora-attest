# Hardware integration — OSKey as the authorization signer

Datamora Attest's weakest demo point is **S4 authorization**: the operator's
consent is currently signed by a software demo key. This package turns an
[OSKey](https://github.com/butterfly-community/oskey-firmware) device (ESP32 +
2.8" ST7789) into the **physical signer of operator consent**, so "who
authorized the agent" is backed by hardware the operator holds.

## The four ideas

| Idea | What it is | Status |
|---|---|---|
| **A — hardware signing** | OSKey signs the operator's consent (EIP-191 personal_sign) instead of a software key | ✅ `bridge.mjs` + `consent.mjs` (working crypto) |
| **B — on-device review** | The 2.8" screen shows a human-readable summary before signing (anti-blind-signing) | ✅ `renderSummary()` (working) |
| **C — air-gapped QR** | Sign via camera QR scan, no USB trust | 📄 `qr-flow.md` (protocol + steps) |
| **D — physical identity** | OSKey as "your key in the agent economy" | 📄 `concept.md` (vision) |

## How it fits the receipt

```
seal ──► consent ──► inference ──► anchor
            ▲
   software path: EIP-712 typed data (lib/consent.mjs)
   hardware path: EIP-191 reviewable message (this package)
```

The receipt's consent gains a `signer: 'hardware'` variant. Verification for
that variant uses `verifyMessage(message, signature)` and recovers the same
operator address — but now that key never touches software.

## Files

- `consent.mjs` — canonical reviewable message, EIP-712 digest, sign/recover, screen summary.
- `bridge.mjs` — transport-agnostic request builder + signature attachment + verify.
- `FLASH.md` — build & flash OSKey for the `esp32_32e_2.8_led_display_st7789` board.
- `qr-flow.md` — air-gapped QR signing (idea C).
- `concept.md` — physical identity key (idea D).

## Quick demo flow (idea A + B)

```js
import { buildSignRequest, attachHardwareSignature, verifyHardwareConsent } from './hardware/bridge.mjs';

const req = buildSignRequest({ operator, policyHash, agentCodeHash, chainId, nonce });
// 1. transport sends req.summary to the device screen, req.message is what it signs
// 2. operator reviews + confirms on the device
const signature = await oskeyTransport.send(req);      // device returns signature
const consent = attachHardwareSignature(req, signature);
const recovered = await verifyHardwareConsent(consent); // === operator
```
