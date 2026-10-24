#!/usr/bin/env bash
# Datamora Attest demo — idempotent start
set -e
cd /root/datamora-attest
export PORT="${PORT:-9292}"
CHAIN_PORT=8545

port_up() { ss -tln 2>/dev/null | grep -q ":$1 "; }

echo "▸ [1/4] local chain (ganache :$CHAIN_PORT)"
if port_up $CHAIN_PORT; then echo "  · already running"; else
  nohup node scripts/local-node.mjs > /tmp/datamora-chain.log 2>&1 < /dev/null &
  sleep 3
  echo "  · started"
fi

echo "▸ [2/4] AttestationAnchor contract"
if [ -f data/deployment.json ]; then
  echo "  · already deployed @ $(node -e "console.log(require(./data/deployment.json).address)")"
else
  node scripts/deploy.mjs 2>&1 | grep -vE "uWS|uws|Falling back|bigint|Require stack" | tail -1
fi

echo "▸ [3/4] demo receipts"
if [ -n "$(ls -A data/receipts 2>/dev/null)" ]; then echo "  · already seeded"; else node seed.mjs 2>&1 | tail -1; fi

echo "▸ [4/4] server (:$PORT)"
if port_up $PORT; then echo "  · already running"; else
  nohup node server.mjs > /tmp/datamora-server.log 2>&1 < /dev/null &
  sleep 2
  echo "  · started"
fi

echo ""
echo "✔ DATAMORA ATTEST ready → http://127.0.0.1:$PORT"
