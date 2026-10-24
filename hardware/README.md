# Hardware integration — OSKey as the authorization signer

Datamora Attest's weakest demo point is **S4 authorization**: the operator's
consent is currently signed by a software demo key. This package turns an
[OSKey](https://github.com/butterfly-community/oskey-firmware) device (ESP32 +
2.8" ST7789) into the **physical signer of operator consent**, so "who
authorized the agent" is backed by hardware the operator holds.

> **Attribution**: the device firmware is a derivative of
> [butterfly-community/oskey-firmware](https://github.com/butterfly-community/oskey-firmware)
> (MPL-2.0), with the Datamora theme, branding, logo, and bug/performance fixes.
> See [NOTICE.md](../NOTICE.md) for the full change list and license compliance.

## Firmware changes on top of OSKey (for `esp32_32e_2.8_led_display_st7789`)

| Change | Detail |
|---|---|
| Datamora theme | `#CAF99C` / `#0A0A0A` palette (`theme-apply.sh`) |
| Branding | "OSKey" → "datamora."; USB "datamora key"; BT "datamora"; AP "datamora-AP" |
| Logo | splash wallet icon → Datamora 2×2 mark (`generated/wallet_logo.a8`) |
| Touch fix | `int-gpios = <&gpio1 4 (GPIO_ACTIVE_LOW \| GPIO_PULL_UP)>` (GPIO36 offset + pull-up) |
| Boot fix | `CONFIG_MAIN_STACK_SIZE=16384` (stack overflow) |
| Performance | LVGL VDB 24 + double VDB + flush thread |

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
