// Minimal RLP decoder (sufficient for Ethereum Merkle-Patricia-Trie nodes).
export function hexToBytes(hex) {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToInt(bytes) {
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  return v;
}

// Decode one RLP item starting at `offset`. Returns [item, nextOffset].
// item is either a Uint8Array (byte string) or an array of items (list).
function decodeItem(b, offset) {
  const prefix = b[offset];
  if (prefix <= 0x7f) {
    return [b.slice(offset, offset + 1), offset + 1];
  } else if (prefix <= 0xb7) {
    const len = prefix - 0x80;
    return [b.slice(offset + 1, offset + 1 + len), offset + 1 + len];
  } else if (prefix <= 0xbf) {
    const lenOfLen = prefix - 0xb7;
    const len = Number(bytesToInt(b.slice(offset + 1, offset + 1 + lenOfLen)));
    const start = offset + 1 + lenOfLen;
    return [b.slice(start, start + len), start + len];
  } else if (prefix <= 0xf7) {
    const len = prefix - 0xc0;
    return decodeList(b, offset + 1, offset + 1 + len);
  } else {
    const lenOfLen = prefix - 0xf7;
    const len = Number(bytesToInt(b.slice(offset + 1, offset + 1 + lenOfLen)));
    const start = offset + 1 + lenOfLen;
    return decodeList(b, start, start + len);
  }
}

function decodeList(b, start, end) {
  const items = [];
  let pos = start;
  while (pos < end) {
    const [item, next] = decodeItem(b, pos);
    items.push(item);
    pos = next;
  }
  return [items, end];
}

export function rlpDecode(input) {
  const b = typeof input === 'string' ? hexToBytes(input) : input;
  const [item] = decodeItem(b, 0);
  return item;
}
