// x402-style pay-per-signal: HTTP 402 Payment Required → client pays → retries
// with a payment receipt → server returns a *sealed* signal receipt.
//
// This is a self-consistent, offline-friendly implementation of the x402 flow.
// In DEMO mode the "payment" is a formatted synthetic tx hash; LIVE mode plugs
// an on-chain transfer check (RPC_URL + SIGNAL_PAYMENT_CONTRACT) without
// changing the client contract.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { seal } from './receipt.mjs';

export const SIGNAL_CURRENCY = '0x0000000000000000000000000000000000000000'; // native ETH
export const SIGNAL_CHAIN_ID = 4663;

const SECRET = process.env.X402_SECRET ?? 'demo-insecure-secret';

export function paymentChallenge(signalId, { amount = '1000000000000000', payTo = '0x00000000000000000000000000000000000000De' } = {}) {
  return {
    network: 'robinhood-chain',
    chainId: SIGNAL_CHAIN_ID,
    currency: SIGNAL_CURRENCY,
    amount,
    payTo,
    signalId,
    expiresAt: Date.now() + 300_000,
  };
}

function receiptBody(p) {
  return `${p.signalId}|${p.payTo}|${p.amount}|${p.txHash}`;
}

export function signPaymentReceipt(p, txHash) {
  const payload = { signalId: p.signalId, payTo: p.payTo, amount: p.amount, txHash };
  const sig = createHmac('sha256', SECRET).update(receiptBody(payload)).digest('hex');
  return { ...payload, sig };
}

export function verifyPaymentReceipt(p, receipt) {
  if (!receipt || !receipt.sig) return { ok: false, reason: 'missing_signature' };
  if (receipt.signalId !== p.signalId || receipt.payTo !== p.payTo || receipt.amount !== p.amount)
    return { ok: false, reason: 'mismatch' };
  const expect = createHmac('sha256', SECRET).update(receiptBody(receipt)).digest('hex');
  const a = Buffer.from(expect, 'hex');
  const b = Buffer.from(receipt.sig, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'bad_signature' };
  return { ok: true };
}

// A demo "signal" that becomes a sealed, verifiable receipt once paid for.
export function makeSignalReceipt(signalId) {
  return seal({
    id: `signal-${signalId}`,
    agent: { name: 'datamora-radar-agent', version: '20261011-r1', codeHash: 'e'.repeat(64) },
    policy: { version: 'agent-radar-entry-v1', chainId: SIGNAL_CHAIN_ID, entryRule: 'original-base-guards-except-age-ceiling', changeFinancialLimits: false },
    action: { kind: 'signal_publish', chainId: SIGNAL_CHAIN_ID, token: '0x00000000000000000000000000000000000000Cc' },
    decision: { modelHash: 'd'.repeat(64), signalId, momentum: 0.14, liquidityUsd: 18400 },
    status: 'unknown',
    txHash: null,
    executedAt: Date.now(),
  });
}
