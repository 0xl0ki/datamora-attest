// Signed market-data provenance (S5b — input authenticity).
//
// The verifiable-inference proof (S5a) shows `output === model(input)`, but the
// input itself was self-reported by the agent. This module closes that gap:
// the input must come from a signed observation by a trusted data source.
//
//   observation = { source, token, chainId, momentum, liquidityUsd, ageMinutes, observedAt }
//   signature   = ECDSA(personal_sign) over sha256(canonical(observation))
//
// A receipt's `provenance` carries the signed observation; `verify` recovers
// the signer and checks it equals the trusted `sourceAddress`, that the signed
// values exactly equal the model input, and that the observation is fresh
// enough. An agent can no longer fabricate the input without the source key.
//
// Trust root: the data-source key must be honest (standard oracle model, same
// as Chainlink/Pyth). The demo key below is a Hardhat account and MUST be
// replaced by a real oracle/multisig/data-feed key in production.
import { digest } from './canonical.mjs';

export const DATA_SOURCE_NAME = 'datamora-market-data-source';
export const DATA_SOURCE_ADDRESS = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
export const DATA_SOURCE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

export const FRESHNESS_MS = 5 * 60 * 1000; // observation must be within 5 min of execution

export function observationDigest(obs) {
  return digest({
    source: obs.source,
    token: obs.token,
    chainId: obs.chainId,
    momentum: obs.momentum,
    liquidityUsd: obs.liquidityUsd,
    ageMinutes: obs.ageMinutes,
    observedAt: obs.observedAt,
  });
}

export async function signObservation(obs, privateKey) {
  const { ethers } = await import('ethers');
  const wallet = new ethers.Wallet(privateKey);
  return wallet.signMessage(ethers.utils.arrayify('0x' + observationDigest(obs)));
}

export async function recoverObservationSigner(obs, signature) {
  const { ethers } = await import('ethers');
  return ethers.utils.verifyMessage(ethers.utils.arrayify('0x' + observationDigest(obs)), signature);
}

export async function makeProvenance(
  { token, chainId, momentum, liquidityUsd, ageMinutes, observedAt },
  { source = DATA_SOURCE_NAME, sourceAddress = DATA_SOURCE_ADDRESS, privateKey = DATA_SOURCE_KEY } = {},
) {
  const obs = { source, token, chainId, momentum, liquidityUsd, ageMinutes, observedAt };
  const signature = await signObservation(obs, privateKey);
  return { ...obs, token: String(token).toLowerCase(), sourceAddress: String(sourceAddress).toLowerCase(), signature };
}
