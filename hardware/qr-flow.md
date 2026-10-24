# Air-gapped QR signing (idea C)

OSKey supports camera QR scanning and air-gapped signing: scan a request QR,
review + sign on device, display the signature as a QR. This removes USB trust
entirely — the desktop never touches the private key, and the signature travels
by QR.

## Flow

```
desktop                                   OSKey
  │  buildSignRequest(...)                 │
  │  render request as QR ───────────────►│ scan with camera
  │                                        │ show summary on screen
  │                                        │ user reviews + confirms
  │  scan signature QR ◄──────────────────│ render signature as QR
  │  attachHardwareSignature(req, sig)     │
```

## Request payload (what the QR encodes)

The QR encodes the `buildSignRequest` object as compact JSON:

```json
{
  "kind": "datamora-attest/consent/v1",
  "value": {
    "operator": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "policyHash": "0x1111...1111",
    "agentCodeHash": "0x2222...2222",
    "chainId": 4663,
    "expiresAt": 0,
    "nonce": 1
  },
  "message": "datamora-attest consent v1\nchain: 4663\n...",
  "summary": [["Agent","0x2222…2222"],["Policy","0x1111…1111"],["Chain","4663"],["Operator","0xf39f…2266"],["Expires","never"],["Nonce","1"]]
}
```

## Response payload (what the device QR encodes)

```json
{
  "kind": "datamora-attest/consent/v1/signature",
  "signature": "0x<65-byte sig>",
  "signer": "0x<recovered operator address>"
}
```

## QR mechanics

- Use QR mode **byte / alphanumeric** at the highest error correction (H) the
  camera reads reliably; a full consent request is ~500 bytes, well within QR
  capacity (~2.9 KB at version 40).
- Chunk into multiple QRs if the request JSON is large (a "N of M" frame header).
- On the desktop, generate the QR with any QR library; on the device, OSKey's
  camera module handles scan + the sign flow.

## Demo script

1. Desktop shows the consent request as a QR.
2. Presenter scans it with the OSKey camera (no cable — clean, trustless).
3. Screen shows `Agent / Policy / Chain / Operator / Expires`; presenter taps
   **Sign**.
4. Device shows the signature QR; desktop scans it back.
5. `attachHardwareSignature` + `verifyHardwareConsent` recover the operator.

This is the most visually striking path: a physical device signs off the
authorization with zero trust in the cable or the host.
