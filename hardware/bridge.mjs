// Bridge between the Datamora Attest host and an OSKey device.
//
// The host builds a signing request; a transport adapter delivers it to the
// device (UART / WebUSB / Bluetooth / QR); the device shows the summary and
// signs on user confirmation; the transport returns the signature; the host
// attaches it to the consent.
//
// This file is transport-agnostic. Concrete transports:
//   * QR air-gapped flow  -> see qr-flow.md
//   * UART / WebUSB       -> wire the adapter below to OSKey's host protocol
import { consentValue } from '../lib/consent.mjs';
import { consentMessage, renderSummary } from './consent.mjs';

// Build the request the device needs: the reviewable message it signs, and the
// summary rows it displays.
export function buildSignRequest({ operator, policyHash, agentCodeHash, chainId, expiresAt = 0, nonce = 0 }) {
  const value = consentValue({ operator, policyHash, agentCodeHash, chainId, expiresAt, nonce });
  return {
    kind: 'datamora-attest/consent/v1',
    value,
    message: consentMessage(value), // exactly what the device signs
    summary: renderSummary(value),  // what the device displays
  };
}

// Attach the device signature, producing a consent object embeddable in a
// receipt. `signer: 'hardware'` marks that verification must use
// verifyMessage(message, signature) rather than EIP-712 verifyTypedData.
export function attachHardwareSignature(request, signature) {
  const v = request.value;
  return {
    operator: v.operator,
    policyHash: v.policyHash,
    agentCodeHash: v.agentCodeHash,
    chainId: v.chainId,
    expiresAt: v.expiresAt,
    nonce: v.nonce,
    signature,
    message: request.message,
    signer: 'hardware',
  };
}

// Verify a hardware consent (either the object from attachHardwareSignature or
// an explicit message + signature pair). Returns the recovered operator.
export async function verifyHardwareConsent(consent) {
  const { recoverHardware } = await import('./consent.mjs');
  return recoverHardware(consent.message, consent.signature);
}

// Transport adapter interface. A concrete adapter implements:
//   async send(request) -> { signature }   (or throws)
// Implementations open the device, present request.message/request.summary,
// wait for on-device confirmation, and return the signature bytes.
export const transports = {
  // Placeholder — wire to OSKey's host app (UART/WebUSB) or QR flow.
  serial: null,
  qr: null,
};
