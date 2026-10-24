// Hardware-wallet consent signing (OSKey / ESP32).
//
// lib/consent.mjs signs with EIP-712 typed data. Hardware wallets such as
// OSKey sign EIP-191 personal messages and show the message on-device for
// review. This module bridges the two:
//
//   software path : EIP-712  typed data  -> verifyTypedData
//   hardware path : EIP-191  reviewable message -> verifyMessage
//
// The message is canonical (deterministic), reviewable, and binds every field
// that EIP-712 binds — so "what you read on the screen is exactly what you
// sign", which is the anti-blind-signing guarantee (idea B).
import { consentValue, consentDomain, CONSENT_TYPES } from '../lib/consent.mjs';

// Canonical, reviewable message. Order and casing are part of the commitment:
// changing any field changes the string, therefore the signature.
export function consentMessage(value) {
  const v = consentValue(value);
  return [
    'datamora-attest consent v1',
    `chain: ${v.chainId}`,
    `operator: ${v.operator}`,
    `policy: ${v.policyHash}`,
    `agent: ${v.agentCodeHash}`,
    `expires: ${v.expiresAt}`,
    `nonce: ${v.nonce}`,
  ].join('\n');
}

// EIP-712 digest (32 bytes) for wallets that sign the digest directly rather
// than a message string. `_TypedDataEncoder.hash` returns keccak256 of
// 0x19 0x01 || domainSeparator || hashStruct(message).
export async function consentDigest(value) {
  const { ethers } = await import('ethers');
  const v = consentValue(value);
  const domain = consentDomain(v.chainId);
  return ethers.utils._TypedDataEncoder.hash(domain, CONSENT_TYPES, v);
}

// Sign the reviewable message with a hardware key (EIP-191 personal_sign).
export async function signHardware(message, privateKey) {
  const { ethers } = await import('ethers');
  return new ethers.Wallet(privateKey).signMessage(message);
}

// Recover the signer of a hardware consent message.
export async function recoverHardware(message, signature) {
  const { ethers } = await import('ethers');
  return ethers.utils.verifyMessage(message, signature);
}

const short = (h) => (h || '').slice(0, 10) + '…' + (h || '').slice(-6);

// Human-readable summary lines for the 2.8" device screen. Each entry is
// [label, value] so the firmware can render label/value rows.
export function renderSummary(value) {
  const v = consentValue(value);
  return [
    ['Agent', short(v.agentCodeHash)],
    ['Policy', short(v.policyHash)],
    ['Chain', String(v.chainId)],
    ['Operator', v.operator.slice(0, 10) + '…' + v.operator.slice(-4)],
    ['Expires', v.expiresAt ? new Date(Number(v.expiresAt) * 1000).toISOString() : 'never'],
    ['Nonce', String(v.nonce)],
  ];
}
