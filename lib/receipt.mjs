// Verifiable agent-execution receipt: seal + verify.
//
// A receipt is a self-contained, content-addressed statement of "this agent,
// running this code, under this operator-consented policy, took this action on
// this chain at this time, and this is the resulting transaction status".
//
// Self-verifying by design: the policy is embedded (not just referenced), the
// policyHash is the canonical digest of that policy, and receiptSha256 is the
// canonical digest of everything except itself. A verifier needs no trusted
// registry — only the receipt and this module.
//
// Authorization: an optional `consent` carries an EIP-712 signature by the
// operator over (operator, policyHash, agentCodeHash, chainId, expiresAt,
// nonce). With consent present, `verify` also recovers the signer and checks it
// equals the operator — turning "authorized" from an assertion into a proof.
//
// Data provenance: an optional `stateProof` carries an EIP-1186 on-chain
// storage proof (Merkle-Patricia-Trie) that the model input equals real
// on-chain state — the agent cannot self-report inputs, and no data-source key
// needs to be trusted (closing S5b).
import { digest } from './canonical.mjs';
import { sealInference, verifyInference } from './inference.mjs';
import { verifyStateProof } from './stateproof.mjs';

export const RECEIPT_SCHEMA = 'agent-execution-receipt-v1';

const isAddr = (v) => typeof v === 'string' && /^0x[0-9a-f]{40}$/i.test(v);
const isTx = (v) =>
  v === null || (typeof v === 'string' && /^0x[0-9a-f]{64}$/i.test(v));
const isSha = (v) => typeof v === 'string' && /^[0-9a-f]{64}$/i.test(v);
const isNonEmptyStr = (v) => typeof v === 'string' && v.length > 0;

function bodyOf(receipt) {
  const { receiptSha256: _omit, ...body } = receipt ?? {};
  return body;
}

function normalizeConsent(c, policyHash) {
  if (!isAddr(c.operator)) throw new Error('seal: consent.operator must be a 0x address');
  if (!isSha(c.policyHash)) throw new Error('seal: consent.policyHash must be sha256 hex');
  if (!isSha(c.agentCodeHash)) throw new Error('seal: consent.agentCodeHash must be sha256 hex');
  if (typeof c.signature !== 'string' || c.signature.length < 130)
    throw new Error('seal: consent.signature required');
  if (![c.chainId, c.expiresAt, c.nonce].every(Number.isSafeInteger))
    throw new Error('seal: consent.chainId/expiresAt/nonce must be integers');
  if (c.policyHash !== policyHash) throw new Error('seal: consent.policyHash must match the policy');
  return {
    operator: c.operator.toLowerCase(),
    policyHash: c.policyHash,
    agentCodeHash: c.agentCodeHash,
    chainId: c.chainId,
    expiresAt: c.expiresAt,
    nonce: c.nonce,
    signature: c.signature,
  };
}

function normalizeStateProof(sp, inference) {
  const v = verifyStateProof(sp, inference.input);
  if (!v.ok) throw new Error('seal: invalid stateProof: ' + v.errors.join(','));
  return sp;
}

export function seal(input) {
  const {
    id,
    agent,
    policy,
    action,
    decision = {},
    status = 'unknown',
    txHash = null,
    executedAt,
    consent = null,
    inference = null,
    stateProof = null,
  } = input ?? {};

  if (!isNonEmptyStr(id)) throw new Error('seal: id required');
  if (!agent || typeof agent !== 'object' || !isNonEmptyStr(agent.name))
    throw new Error('seal: agent.name required');
  if (!isSha(agent.codeHash)) throw new Error('seal: agent.codeHash must be sha256 hex');
  if (!policy || typeof policy !== 'object' || Array.isArray(policy))
    throw new Error('seal: policy object required');
  if (!action || typeof action !== 'object') throw new Error('seal: action object required');
  if (!Number.isSafeInteger(action.chainId)) throw new Error('seal: action.chainId must be an integer');
  if (!isAddr(action.token)) throw new Error('seal: action.token must be a 0x address');
  if (!['confirmed', 'reverted', 'unknown'].includes(status))
    throw new Error('seal: status must be confirmed|reverted|unknown');
  if (txHash !== null && !isTx(txHash)) throw new Error('seal: txHash must be a 0x tx hash');
  if (!Number.isSafeInteger(executedAt)) throw new Error('seal: executedAt must be an integer ms epoch');

  const policyHash = digest(policy);
  const normalizedConsent = consent ? normalizeConsent(consent, policyHash) : null;

  let normalizedInference = null;
  if (inference != null) {
    const check = verifyInference(inference);
    if (!check.ok) throw new Error('seal: invalid inference: ' + check.errors.join(','));
    normalizedInference = sealInference(inference.input);
  }

  const normalizedStateProof = stateProof ? normalizeStateProof(stateProof, normalizedInference) : null;

  const body = {
    schema: RECEIPT_SCHEMA,
    id,
    agent,
    policy,
    policyHash,
    action,
    decision,
    inference: normalizedInference,
    stateProof: normalizedStateProof,
    status,
    txHash,
    executedAt,
    consent: normalizedConsent,
  };

  return { ...body, receiptSha256: digest(body) };
}

export async function verify(receipt) {
  const errors = [];

  if (!receipt || typeof receipt !== 'object') return { ok: false, errors: ['not_an_object'] };

  if (receipt.schema !== RECEIPT_SCHEMA) errors.push('schema_mismatch');
  if (!isSha(receipt.receiptSha256)) errors.push('receipt_sha_malformed');
  if (!isNonEmptyStr(receipt.id)) errors.push('id_malformed');
  if (!receipt.agent || !isSha(receipt.agent.codeHash)) errors.push('agent_code_hash_malformed');
  if (!receipt.policy || typeof receipt.policy !== 'object' || Array.isArray(receipt.policy))
    errors.push('policy_missing');
  if (!Number.isSafeInteger(receipt.action?.chainId)) errors.push('chain_id_malformed');
  if (!isAddr(receipt.action?.token)) errors.push('token_malformed');
  if (receipt.txHash !== null && !isTx(receipt.txHash)) errors.push('tx_hash_malformed');
  if (!Number.isSafeInteger(receipt.executedAt)) errors.push('executed_at_malformed');
  if (receipt.consent != null) {
    if (!isAddr(receipt.consent.operator)) errors.push('consent_operator_malformed');
    if (!isSha(receipt.consent.policyHash)) errors.push('consent_policy_hash_malformed');
    if (typeof receipt.consent.signature !== 'string' || receipt.consent.signature.length < 130)
      errors.push('consent_signature_malformed');
  }
  if (receipt.inference != null) {
    errors.push(...verifyInference(receipt.inference).errors);
  }
  if (receipt.stateProof != null) {
    if (receipt.inference == null) {
      errors.push('stateproof_requires_inference');
    } else {
      errors.push(...verifyStateProof(receipt.stateProof, receipt.inference.input).errors);
    }
  }

  if (!errors.includes('policy_missing') && receipt.policy) {
    const policyHash = digest(receipt.policy);
    if (policyHash !== receipt.policyHash) errors.push('policy_hash_mismatch');
  }

  if (errors.length === 0) {
    const recomputed = digest(bodyOf(receipt));
    if (recomputed !== receipt.receiptSha256) errors.push('receipt_digest_mismatch');
  }

  // EIP-712 authorization proof (only when consent is embedded).
  if (errors.length === 0 && receipt.consent) {
    const { recoverConsentSigner, consentValue } = await import('./consent.mjs');
    try {
      const value = consentValue(receipt.consent);
      const signer = await recoverConsentSigner(value, receipt.consent.signature, {
        chainId: receipt.consent.chainId,
      });
      if (signer.toLowerCase() !== receipt.consent.operator.toLowerCase())
        errors.push('consent_signer_mismatch');
      if (receipt.consent.policyHash !== receipt.policyHash) errors.push('consent_policy_mismatch');
    } catch {
      errors.push('consent_signature_invalid');
    }
  }

  return { ok: errors.length === 0, errors, digest: receipt?.receiptSha256 ?? null };
}
