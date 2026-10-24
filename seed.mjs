// Seed a small set of demo receipts so the UI and /anchor have data on boot.
import { seal } from './lib/receipt.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA = join(ROOT, 'data', 'receipts');
mkdirSync(DATA, { recursive: true });

const policy = {
  version: 'agent-radar-entry-v1',
  chainId: 4663,
  entryRule: 'original-base-guards-except-age-ceiling',
  changeFinancialLimits: false,
};

const seeds = [
  { id: 'intent-demo-1', kind: 'swap_buy', token: '0x00000000000000000000000000000000000000Aa', status: 'confirmed', txHash: '0x' + 'a1'.repeat(32) },
  { id: 'intent-demo-2', kind: 'swap_sell', token: '0x00000000000000000000000000000000000000Bb', status: 'confirmed', txHash: '0x' + 'b2'.repeat(32) },
  { id: 'intent-demo-3', kind: 'cancel', token: '0x00000000000000000000000000000000000000Cc', status: 'reverted', txHash: null },
];

for (const s of seeds) {
  const r = seal({
    id: s.id,
    agent: { name: 'datamora-personal-agent', version: '20261010-personal-agent-v1', codeHash: 'a'.repeat(64) },
    policy,
    action: { kind: s.kind, chainId: 4663, token: s.token },
    decision: { modelHash: 'b'.repeat(64), signalId: s.id, momentum: 0.09 },
    status: s.status,
    txHash: s.txHash,
    executedAt: Date.now() - Math.floor(Math.random() * 86400000),
  });
  writeFileSync(join(DATA, `${r.receiptSha256}.json`), JSON.stringify(r, null, 2));
  console.log('seeded', r.id, r.receiptSha256);
}
