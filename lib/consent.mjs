// EIP-712 operator consent.
//
// The receipt's policy hash proves *which* policy an action ran under, but by
// itself it does not prove *who authorized* it — that was an assertion. This
// module upgrades it to proof: the operator signs a typed struct binding
// (operator, policyHash, agentCodeHash, chainId, expiresAt, nonce), and the
// signature is recoverable without any trusted party.
//
//   domain   EIP712Domain(name,version,chainId,verifyingContract)
//   message  AgentConsent(address operator,bytes32 policyHash,
//             bytes32 agentCodeHash,uint256 chainId,uint256 expiresAt,
//             uint256 nonce)
//
// Signing / recovery uses secp256k1 (ethers, lazy-loaded). The receipt itself
// still self-verifies via sha256; consent adds the authorization proof.
export const CONSENT_NAME = 'DatamoraAttest';
export const CONSENT_VERSION = '1';
export const CONSENT_TYPES = {
  AgentConsent: [
    { name: 'operator', type: 'address' },
    { name: 'policyHash', type: 'bytes32' },
    { name: 'agentCodeHash', type: 'bytes32' },
    { name: 'chainId', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
};

// Demo operator (Hardhat account #0). Used ONLY for the local demo so receipts
// carry a real, recoverable signature without a live wallet. Never use this
// key for anything with value.
export const DEMO_OPERATOR = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
export const DEMO_OPERATOR_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const b32 = (h) => '0x' + (h.startsWith('0x') ? h.slice(2) : h);

export function consentDomain(chainId, verifyingContract = '0x0000000000000000000000000000000000000000') {
  return { name: CONSENT_NAME, version: CONSENT_VERSION, chainId, verifyingContract };
}

export function consentValue({ operator, policyHash, agentCodeHash, chainId, expiresAt, nonce }) {
  return {
    operator: String(operator).toLowerCase(),
    policyHash: b32(policyHash),
    agentCodeHash: b32(agentCodeHash),
    chainId,
    expiresAt,
    nonce,
  };
}

export async function signConsent(value, privateKey, { chainId, verifyingContract } = {}) {
  const { ethers } = await import('ethers');
  const wallet = new ethers.Wallet(privateKey);
  const domain = consentDomain(chainId ?? value.chainId, verifyingContract);
  return wallet._signTypedData(domain, CONSENT_TYPES, value);
}

export async function recoverConsentSigner(value, signature, { chainId, verifyingContract } = {}) {
  const { ethers } = await import('ethers');
  const domain = consentDomain(chainId ?? value.chainId, verifyingContract);
  return ethers.utils.verifyTypedData(domain, CONSENT_TYPES, value, signature);
}

// Build a full consent object (normalized value + signature) for embedding.
export async function makeConsent({
  operator,
  privateKey,
  policyHash,
  agentCodeHash,
  chainId,
  expiresAt = 0,
  nonce = 0,
  verifyingContract,
}) {
  const value = consentValue({ operator, policyHash, agentCodeHash, chainId, expiresAt, nonce });
  const signature = await signConsent(value, privateKey, { chainId, verifyingContract });
  return { operator: value.operator, policyHash, agentCodeHash, chainId, expiresAt, nonce, signature };
}
