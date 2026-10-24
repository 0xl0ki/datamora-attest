# Hardware demo runbook (stock OSKey firmware — no rebuild)

This is the shortest path to a working on-device authorization demo using your
ESP32-E 2.8" board **as-is** (stock OSKey firmware, default UI). No theme
rebuild, no custom protocol — the OSKey already signs Ethereum personal
messages out of the box.

## Prerequisites

1. OSKey firmware flashed on the board (stock release is fine).
2. A **demo wallet** created on the device (never a wallet with real value).
3. OSKey's host app / WebUSB wallet interface, so a message can be sent for
   signing and the signature read back.

## The flow

```
host (sign-cli.mjs)                        OSKey device
  prints consent message  ──────────────►  host app sends message to device
                                           device shows summary, user confirms
  paste signature ◄──────────────────────  host app returns signature
  verify + recover operator
```

## Steps

```sh
cd datamora-attest
node hardware/sign-cli.mjs              # prints the consent message
```

1. Copy the printed message into OSKey's host app (or its WebUSB page).
2. On the device, review the fields, tap **Sign**.
3. Copy the returned signature, paste it into the CLI, press Enter.
4. The CLI prints `recovered operator` + `✅ PASS`.

## Wiring it into the receipt

The signature is an EIP-191 personal signature over the canonical message.
`attachHardwareSignature(req, sig)` returns a consent object with
`signer: 'hardware'`. In the receipt, store that object; verification uses
`verifyMessage(message, signature)` (see `hardware/consent.mjs`) instead of the
EIP-712 `verifyTypedData` used by the software path. Both recover the same
operator address — but the hardware path proves the key was in a device.

## Demo script (30 seconds)

> "The user authorizes the agent from a physical key. On the screen: the agent
> code hash, policy hash, chain 4663. One tap. The signature proves
> authorization, and the key never leaves the device."

## Notes

- The exact host-app/WebUSB interaction depends on OSKey's host tooling; the
  message + signature format here is transport-independent.
- If you later rebuild the firmware (theme + mono font), the message format and
  this flow are unchanged — only the screen appearance changes.
