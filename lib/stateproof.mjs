// On-chain state proof (S5b trust root upgrade).
//
// Instead of trusting a signed data source (which requires trusting its key),
// the model input is proven to come from on-chain state: an EIP-1186
// `eth_getProof` storage proof, verified locally against the block's stateRoot
// via the Ethereum Merkle-Patricia-Trie (lib/mpt.mjs). The remaining trust is
// "the stateRoot belongs to a canonical block", i.e. the chain's own consensus
// — no oracle key to compromise.
//
// MarketState slots: 0 = momentumBips (1200 = 0.12), 1 = liquidityUsd, 2 = ageMinutes.
import { verifyAccountProof, verifyStorageProof } from './mpt.mjs';
import { rlpDecode, bytesToHex } from './rlp.mjs';

export const SLOT_MOMENTUM = '0x' + '0'.repeat(64);
export const SLOT_LIQUIDITY = '0x' + '0'.repeat(63) + '1';
export const SLOT_AGE = '0x' + '0'.repeat(63) + '2';
const SLOTS = [SLOT_MOMENTUM, SLOT_LIQUIDITY, SLOT_AGE];

const isHex = (v, n) => typeof v === 'string' && new RegExp(`^0x[0-9a-f]{${n}}$`, 'i').test(v);

export function deriveInput(values) {
  return {
    momentum: Number(values[0]) / 10000,
    liquidityUsd: Number(values[1]),
    ageMinutes: Number(values[2]),
  };
}

// Verify an on-chain state proof and check it matches the expected model input.
export function verifyStateProof(sp, expectedInput) {
  const errors = [];
  if (!sp || typeof sp !== 'object') return { ok: false, errors: ['stateproof_missing'] };
  if (!isHex(sp.contract, 40)) errors.push('stateproof_contract_malformed');
  if (!isHex(sp.stateRoot, 64)) errors.push('stateproof_state_root_malformed');
  if (!Array.isArray(sp.accountProof) || sp.accountProof.length === 0) errors.push('stateproof_account_proof_malformed');
  if (!Array.isArray(sp.storage) || sp.storage.length !== 3) errors.push('stateproof_storage_shape_malformed');
  if (errors.length) return { ok: false, errors };

  const acct = verifyAccountProof(sp.accountProof, sp.stateRoot, sp.contract);
  if (!acct) return { ok: false, errors: ['stateproof_account_invalid'] };
  const storageHash = bytesToHex(rlpDecode(acct)[2]);

  const values = [];
  for (let i = 0; i < 3; i++) {
    const s = sp.storage[i];
    const valHex = verifyStorageProof(s.proof, storageHash, SLOTS[i]);
    if (!valHex) return { ok: false, errors: ['stateproof_storage_invalid_' + i] };
    values.push(BigInt('0x' + (bytesToHex(rlpDecode(valHex)) || '0')));
  }

  const derived = deriveInput(values);
  const eps = 1e-9;
  const ok =
    Math.abs(derived.momentum - expectedInput.momentum) < eps &&
    derived.liquidityUsd === expectedInput.liquidityUsd &&
    derived.ageMinutes === expectedInput.ageMinutes;
  if (!ok) errors.push('stateproof_input_mismatch');

  return { ok: errors.length === 0, errors, derived, values: values.map(String) };
}

// Server-side: set MarketState storage to the model input, then fetch eth_getProof.
export async function fetchStateProof(provider, wallet, contractAddress, { momentum, liquidityUsd, ageMinutes }) {
  const { ethers } = await import('ethers');
  const momentumBips = Math.round(momentum * 10000);
  const liquidity = Math.round(liquidityUsd);
  const age = Math.round(ageMinutes);
  const iface = new ethers.utils.Interface(['function set(uint256,uint256,uint256)']);
  await (await wallet.sendTransaction({ to: contractAddress, data: iface.encodeFunctionData('set', [momentumBips, liquidity, age]) })).wait(1);
  const rawBlock = await provider.send('eth_getBlockByNumber', ['latest', false]);
  const proof = await provider.send('eth_getProof', [contractAddress, SLOTS, 'latest']);
  return {
    schema: 'onchain-state-proof-v1',
    contract: contractAddress,
    blockNumber: Number(rawBlock.number),
    blockHash: rawBlock.hash,
    stateRoot: rawBlock.stateRoot,
    accountProof: proof.accountProof,
    storage: proof.storageProof.map((s, i) => ({ slot: SLOTS[i], proof: s.proof, value: s.value })),
  };
}
