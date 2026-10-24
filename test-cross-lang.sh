#!/usr/bin/env bash
# Cross-language canonical digest parity check (Node vs Python).
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FIXTURE=$(mktemp)
cat > "$FIXTURE" <<'JSON'
{"schema":"agent-execution-receipt-v1","id":"x-lang-1","z":0,"a":1,"nested":{"b":2,"c":[3,1,2]},"unicode":"链上存证","list":[{"x":1},{"y":2}]}
JSON

NODE_DIGEST=$(node --input-type=module -e "import {digest} from './lib/canonical.mjs'; import {readFileSync} from 'node:fs'; console.log(digest(JSON.parse(readFileSync('$FIXTURE','utf8'))))")
PY_DIGEST=$(python3 verify/py/canonical.py "$FIXTURE")
rm -f "$FIXTURE"

echo "node   $NODE_DIGEST"
echo "python $PY_DIGEST"
if [ "$NODE_DIGEST" = "$PY_DIGEST" ]; then
  echo "PASS: digests match"
else
  echo "FAIL: digest mismatch" >&2
  exit 1
fi
