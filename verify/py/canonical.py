#!/usr/bin/env python3
"""Cross-language canonical serialization reference.

Must reproduce, byte-for-byte, the digest produced by lib/canonical.mjs so a
third party (without Node) can independently re-verify a receipt. Semantics:
sort object keys recursively, then JSON.stringify without whitespace, SHA-256.
"""
import hashlib
import json


def canonical(value):
    if isinstance(value, list):
        return [canonical(v) for v in value]
    if isinstance(value, dict):
        return {k: canonical(value[k]) for k in sorted(value.keys())}
    return value


def digest(value) -> str:
    # separators=(",", ":") -> no whitespace, matching JSON.stringify
    encoded = json.dumps(canonical(value), separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


if __name__ == "__main__":
    import sys

    if len(sys.argv) == 2:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            print(digest(json.load(f)))
    else:
        # smoke vector
        print(digest({"b": 2, "a": 1, "c": [3, 1, 2]}))
