// EVM-native Merkle tree over receipt digests.
//
// Canonical scheme (identical in JS and Solidity):
//   - leaves are 32-byte hex digests (receipt `receiptSha256`)
//   - sort leaves, pad to the next power of two by duplicating the last leaf
//   - pair hash = keccak256(a ‖ b) with a,b sorted lexicographically
//
// Padding to a power of two keeps every level balanced, so a proof is a plain
// `bytes32[]` of siblings with no position flags — directly callable as
// `verifyProof(bytes32 leaf, bytes32[] proof, bytes32 root)` in Solidity.
import { keccak256Hex } from './keccak.mjs';

const isHex32 = (v) => typeof v === 'string' && /^[0-9a-f]{64}$/i.test(v);

export function pairHash(a, b) {
  return keccak256Hex(a < b ? a + b : b + a);
}

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function normalize(leaves) {
  const sorted = [...leaves].sort();
  const padded = sorted.slice();
  while (padded.length < nextPow2(sorted.length)) padded.push(padded[padded.length - 1]);
  return padded;
}

export function merkleRoot(leaves) {
  if (!leaves || leaves.length === 0) return null;
  let cur = normalize(leaves);
  while (cur.length > 1) {
    const next = [];
    for (let i = 0; i < cur.length; i += 2) next.push(pairHash(cur[i], cur[i + 1]));
    cur = next;
  }
  return cur[0];
}

export function merkleProof(leaves, target) {
  let cur = normalize(leaves);
  let idx = cur.indexOf(target);
  if (idx < 0) return null;
  const proof = [];
  while (cur.length > 1) {
    proof.push(idx % 2 === 0 ? cur[idx + 1] : cur[idx - 1]);
    const next = [];
    for (let i = 0; i < cur.length; i += 2) next.push(pairHash(cur[i], cur[i + 1]));
    cur = next;
    idx = Math.floor(idx / 2);
  }
  return proof;
}

export function verifyProof(leaf, proof, root) {
  let h = leaf;
  for (const s of proof) h = pairHash(h, s);
  return h === root;
}

export function validateLeaves(leaves) {
  if (!Array.isArray(leaves) || leaves.length === 0) throw new Error('merkle: leaves required');
  for (const l of leaves) if (!isHex32(l)) throw new Error('merkle: leaf must be 32-byte hex');
  return leaves;
}
