// Batch aggregation + on-chain anchoring.
//
//  - buildBatch: fold a set of receipts into a Merkle root + a signed manifest
//  - encodeAttestCalldata: ABI-encode `attest(bytes32 root)` for a raw tx
//  - attestDryRun / attestLive: submit (or prepare) the anchor transaction
import { merkleRoot, merkleProof, validateLeaves } from './merkle.mjs';
import { selector } from './keccak.mjs';
import { digest } from './canonical.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DEPLOYMENT = join(ROOT, '..', 'data', 'deployment.json');
const LOCAL_DEV_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

export const ANCHOR_CHAIN_ID = 4663; // Robinhood Chain mainnet
export const ANCHOR_SELECTOR = selector('attest(bytes32)'); // 0x23c3617f
export const VERIFY_PROOF_SELECTOR = selector('verifyProof(bytes32,bytes32[],bytes32)');

const leftPad64 = (hex) => {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return clean.padStart(64, '0');
};

export function encodeAttestCalldata(root) {
  return '0x' + ANCHOR_SELECTOR + leftPad64(root);
}

// ABI-encode `verifyProof(bytes32 leaf, bytes32[] proof, bytes32 root)` so the
// contract can prove single-receipt membership on-chain.
export function encodeVerifyProofCalldata(leaf, proof, root) {
  const arrStart = 3 * 32; // leaf, offset, root
  const head = leftPad64(leaf) + leftPad64(arrStart.toString(16)) + leftPad64(root);
  const arr = leftPad64(proof.length.toString(16)) + proof.map(leftPad64).join('');
  return '0x' + VERIFY_PROOF_SELECTOR + head + arr;
}

// Build the on-chain-ready membership proof for one leaf among a set.
export function makeProof(leaves, leaf) {
  const l = validateLeaves(leaves);
  const root = merkleRoot(l);
  const proof = merkleProof(l, leaf);
  if (!proof) return null;
  return { leaf, proof, root, calldata: encodeVerifyProofCalldata(leaf, proof, root) };
}

export function buildBatch(receipts, { clock = Date.now } = {}) {
  const leaves = validateLeaves(receipts.map((r) => r.receiptSha256));
  const root = merkleRoot(leaves);
  const manifest = {
    schema: 'attestation-batch-v1',
    chainId: ANCHOR_CHAIN_ID,
    root,
    count: leaves.length,
    leaves,
    sealedAt: clock(),
  };
  manifest.manifestSha256 = digest({ schema: manifest.schema, chainId: manifest.chainId, root, count: manifest.count, leaves, sealedAt: manifest.sealedAt });
  return manifest;
}

// Dry-run: everything except broadcasting. Live submission is enabled when
// RPC_URL + PRIVATE_KEY + ANCHOR_ADDRESS are set (see server.mjs / README).
export function attestDryRun(root) {
  return {
    chainId: ANCHOR_CHAIN_ID,
    to: process.env.ANCHOR_ADDRESS ?? '0x0000000000000000000000000000000000000000',
    selector: ANCHOR_SELECTOR,
    calldata: encodeAttestCalldata(root),
    root,
    mode: 'dry-run',
  };
}

function deploymentInfo() {
  if (!existsSync(DEPLOYMENT)) return null;
  try {
    return JSON.parse(readFileSync(DEPLOYMENT, 'utf8'));
  } catch {
    return null;
  }
}

export async function attestLive(root) {
  const dep = deploymentInfo();
  const RPC_URL = process.env.RPC_URL ?? dep?.rpcUrl ?? null;
  const ANCHOR_ADDRESS = process.env.ANCHOR_ADDRESS ?? dep?.address ?? null;
  const isLocal = /127\.0\.0\.1|localhost/.test(RPC_URL ?? '');
  const PRIVATE_KEY = process.env.PRIVATE_KEY ?? (dep && isLocal ? LOCAL_DEV_KEY : null);
  if (!RPC_URL || !PRIVATE_KEY || !ANCHOR_ADDRESS) {
    const err = new Error(
      'attestLive requires RPC_URL, PRIVATE_KEY and ANCHOR_ADDRESS (env) — or a local node + data/deployment.json',
    );
    err.code = 'anchor_not_configured';
    throw err;
  }
  const { ethers } = await import('ethers');
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL, ANCHOR_CHAIN_ID);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const iface = new ethers.utils.Interface(['function attest(bytes32 root)']);
  const b32 = (h) => '0x' + (h.startsWith('0x') ? h.slice(2) : h);
  const tx = await wallet.sendTransaction({
    to: ANCHOR_ADDRESS,
    data: iface.encodeFunctionData('attest', [b32(root)]),
  });
  const receipt = await tx.wait(1);
  return { chainId: ANCHOR_CHAIN_ID, txHash: receipt.transactionHash, blockNumber: receipt.blockNumber, root, mode: 'live' };
}
