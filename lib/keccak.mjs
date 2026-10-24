// Minimal, dependency-free Keccak-256 (the original padding used by Ethereum).
// Used for EVM-native Merkle pair hashes and for function selectors, so the
// off-chain tree and the Solidity anchor contract speak the same hash.
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const RHO = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44];
const PI = [10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1];
const MASK = 0xffffffffffffffffn;

const rotl = (x, n) => ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK;

function keccakF(state) {
  const C = new Array(5);
  const D = new Array(5);
  for (let r = 0; r < 24; r++) {
    for (let x = 0; x < 5; x++) C[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    for (let x = 0; x < 5; x++) D[x] = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1);
    for (let i = 0; i < 25; i++) state[i] ^= D[i % 5];
    let last = state[1];
    for (let i = 0; i < 24; i++) {
      const j = PI[i];
      const t = state[j];
      state[j] = rotl(last, RHO[i]);
      last = t;
    }
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) C[x] = state[x + 5 * y];
      for (let x = 0; x < 5; x++) state[x + 5 * y] = C[x] ^ (~C[(x + 1) % 5] & C[(x + 2) % 5]);
    }
    state[0] ^= RC[r];
  }
}

export function keccak256(bytes) {
  const msg = bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(String(bytes));
  const rate = 136;
  const padLen = rate - (msg.length % rate);
  const padded = new Uint8Array(msg.length + padLen);
  padded.set(msg, 0);
  padded[msg.length] = 0x01;
  padded[padded.length - 1] ^= 0x80;

  const state = new Array(25).fill(0n);
  for (let b = 0; b < padded.length; b += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let j = 0; j < 8; j++) lane |= BigInt(padded[b + i * 8 + j]) << BigInt(8 * j);
      state[i] ^= lane;
    }
    keccakF(state);
  }

  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    const lane = state[i];
    for (let j = 0; j < 8; j++) out[i * 8 + j] = Number((lane >> BigInt(8 * j)) & 0xffn);
  }
  return Array.from(out, (x) => x.toString(16).padStart(2, '0')).join('');
}

export const keccak256Utf8 = (s) => keccak256(new TextEncoder().encode(s));
export const keccak256Hex = (hex) => {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return keccak256(bytes);
};
export const selector = (sig) => keccak256Utf8(sig).slice(0, 8);
