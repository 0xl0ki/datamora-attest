// Canonical JSON serialization + content addressing.
//
// The canonical form is independent of key insertion order and whitespace, so
// the same logical document always hashes to the same digest. This mirrors the
// existing `radarPolicyDigest` implementation in datamora (sort keys
// recursively, then JSON.stringify), kept here as a standalone, dependency-free
// module so any third party can recompute a receipt's hash.
import { createHash } from 'node:crypto';

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = canonical(value[k]);
    return out;
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonical(value));
}

export function sha256hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

export function digest(value) {
  return sha256hex(canonicalJson(value));
}
