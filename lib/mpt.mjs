// Ethereum Merkle-Patricia-Trie proof verifier (EIP-1186 eth_getProof).
// Verifies that a value exists at a key in a trie with a given root hash,
// using only the proof nodes — no RPC or trusted node required once you have
// the state root (which the block hash commits to).
import { keccak256Hex } from './keccak.mjs';
import { rlpDecode, bytesToHex, hexToBytes } from './rlp.mjs';

export function bytesToNibbles(hex) {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const nibbles = [];
  for (const ch of clean) nibbles.push(parseInt(ch, 16));
  return nibbles;
}

// Decode the hex-prefix (compact) trie path encoding. The first BYTE holds
// the flag in its high nibble (0/1/2/3), and the low nibble is the first path
// nibble when the path length is odd.
export function decodeHexPrefix(pathHex) {
  const clean = pathHex.startsWith('0x') ? pathHex.slice(2) : pathHex;
  const bytes = hexToBytes(clean);
  const flag = bytes[0] >> 4;
  const isLeaf = flag >= 2;
  const odd = (flag & 1) === 1;
  const nibbles = [];
  if (odd) nibbles.push(bytes[0] & 0x0f);
  for (let i = 1; i < bytes.length; i++) {
    nibbles.push(bytes[i] >> 4, bytes[i] & 0x0f);
  }
  return { isLeaf, nibbles };
}

function norm(hex) {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}

function walk(nodeHex, path, offset, nodeByHash) {
  const node = rlpDecode(nodeHex);
  if (Array.isArray(node) && node.length === 2) {
    const { isLeaf, nibbles } = decodeHexPrefix(bytesToHex(node[0]));
    if (offset + nibbles.length > path.length) return null;
    for (let i = 0; i < nibbles.length; i++) if (path[offset + i] !== nibbles[i]) return null;
    if (isLeaf) return bytesToHex(node[1]);
    return walk(bytesToHex(node[1]), path, offset + nibbles.length, nodeByHash);
  } else if (Array.isArray(node) && node.length === 17) {
    if (offset === path.length) return node[16].length ? bytesToHex(node[16]) : null;
    const child = node[path[offset]];
    if (!child || child.length === 0) return null;
    const childHex = bytesToHex(child);
    if (child.length < 32) return walk(childHex, path, offset + 1, nodeByHash);
    const childNode = nodeByHash.get(childHex);
    if (!childNode) return null;
    return walk(childNode, path, offset + 1, nodeByHash);
  }
  return null;
}

// proof: array of hex strings (RLP-encoded nodes); root: hex root hash; keyHex: 32-byte key.
// Returns the RLP-encoded value (hex) at the key, or null.
export function verifyProof(proof, root, keyHex) {
  if (!proof || proof.length === 0) return null;
  const path = bytesToNibbles(keyHex);
  const nodeByHash = new Map();
  for (const n of proof) nodeByHash.set(keccak256Hex(n), norm(n));
  if (keccak256Hex(proof[0]) !== norm(root)) return null;
  return walk(norm(proof[0]), path, 0, nodeByHash);
}

// Account proof: key = keccak256(address). Returns the account RLP (hex), or null.
export function verifyAccountProof(accountProof, stateRoot, address) {
  return verifyProof(accountProof, stateRoot, keccak256Hex(address));
}

// Storage proof: key = keccak256(slot). Returns the slot value RLP (hex), or null.
export function verifyStorageProof(storageProof, storageHash, slotHex) {
  return verifyProof(storageProof, storageHash, keccak256Hex(slotHex));
}
