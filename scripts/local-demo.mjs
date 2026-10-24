// End-to-end local deployment + on-chain verification demo.
//
//   npm run local:demo
//
// Compiles AttestationAnchor.sol, starts an in-process local EVM (ganache,
// chainId 4663 to mirror Robinhood Chain), deploys the contract, seeds demo
// receipts, anchors a batch, then calls verifyProof / verifyReceipt on-chain —
// printing every step. Writes data/deployment.json for the server to use.
import solc from 'solc';
import ganache from 'ganache';
import { ethers } from 'ethers';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seal } from '../lib/receipt.mjs';
import { buildBatch, makeProof } from '../lib/anchor.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CONTRACTS = join(ROOT, '..', 'contracts');
const DATA = join(ROOT, '..', 'data');
mkdirSync(DATA, { recursive: true });

const hr = () => console.log('\n' + '─'.repeat(72));

// 1. compile
console.log('▸ Compiling AttestationAnchor.sol (solc 0.8.20) …');
const source = readFileSync(join(CONTRACTS, 'AttestationAnchor.sol'), 'utf8');
const input = {
  language: 'Solidity',
  sources: { 'AttestationAnchor.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors ?? []).filter((e) => e.severity === 'error');
if (errors.length) {
  console.error(errors.map((e) => e.formattedMessage).join('\n'));
  process.exit(1);
}
const { abi, evm } = output.contracts['AttestationAnchor.sol']['AttestationAnchor'];
const bytecode = '0x' + evm.bytecode.object;
console.log(`  ✓ compiled · bytecode ${(bytecode.length - 2) / 2} bytes · ${abi.length} ABI entries`);

// 2. local chain
console.log('▸ Starting local EVM (ganache, chainId 4663) …');
const provider = new ethers.providers.Web3Provider(
  ganache.provider({ chain: { chainId: 4663 }, logging: { quiet: true } })
);
const signer = provider.getSigner(0);
const chainId = (await provider.getNetwork()).chainId;
const deployer = await signer.getAddress();
console.log(`  ✓ chainId ${chainId} · deployer ${deployer}`);

// 3. deploy
console.log('▸ Deploying AttestationAnchor …');
const factory = new ethers.ContractFactory(abi, bytecode, signer);
const contract = await factory.deploy();
await contract.deployed();
console.log(`  ✓ deployed at ${contract.address} · tx ${contract.deployTransaction.hash}`);
hr();

// 4. demo receipts -> batch -> anchor
console.log('▸ Sealing 3 demo receipts (off-chain, self-verifying) …');
const policy = { version: 'agent-radar-entry-v1', chainId: 4663, entryRule: 'demo', changeFinancialLimits: false };
const mk = (id, status, txHash) =>
  seal({
    id,
    agent: { name: 'datamora-personal-agent', version: '20261010', codeHash: 'a'.repeat(64) },
    policy,
    action: { kind: 'swap_buy', chainId: 4663, token: '0x' + id.charCodeAt(0).toString(16).padStart(2, '0').repeat(20) },
    decision: { modelHash: 'b'.repeat(64), signalId: id },
    status,
    txHash,
    executedAt: Date.now(),
  });
const b32 = (h) => '0x' + (h.startsWith('0x') ? h.slice(2) : h);
const r1 = mk('intent-1', 'confirmed', '0x' + '11'.repeat(32));
const r2 = mk('intent-2', 'confirmed', '0x' + '22'.repeat(32));
const r3 = mk('intent-3', 'reverted', null);
const receipts = [r1, r2, r3];

const manifest = buildBatch(receipts);
const root = manifest.root;
console.log(`  ✓ ${receipts.length} receipts → Merkle root ${root}`);

console.log('▸ Attesting batch on-chain: contract.attest(root) …');
const tx = await contract.attest(b32(root));
const rec = await tx.wait();
const event = rec.events.find((e) => e.event === 'Attested');
console.log(`  ✓ anchored · tx ${rec.transactionHash} · block ${rec.blockNumber}`);
console.log(`  ✓ event Attested(id=${event.args.id}, by=${event.args.by})`);
console.log(`  ✓ isAnchored(root) = ${await contract.isAnchored(b32(root))}`);
console.log(`  ✓ firstAttestedAt[root] = ${(await contract.firstAttestedAt(b32(root))).toString()}`);
hr();

// 5. on-chain membership proof
console.log('▸ On-chain verifyProof for intent-2 …');
const p2 = makeProof(receipts.map((r) => r.receiptSha256), r2.receiptSha256);
const okProof = await contract.verifyProof(b32(p2.leaf), p2.proof.map(b32), b32(p2.root));
console.log(`  leaf ${p2.leaf}`);
console.log(`  proof[${p2.proof.length}] ${p2.proof.map((x) => x.slice(0, 18) + '…').join(', ')}`);
console.log(`  root ${p2.root}`);
console.log(`  verifyProof = ${okProof}`);

console.log('▸ On-chain verifyReceipt (must be anchored) …');
console.log(`  verifyReceipt(anchored) = ${await contract.verifyReceipt(b32(p2.root), b32(p2.leaf), p2.proof.map(b32))}`);
const badRoot = '0x' + 'ff'.repeat(32);
console.log(`  verifyReceipt(unanchored root) = ${await contract.verifyReceipt(badRoot, b32(p2.leaf), p2.proof.map(b32))}`);
console.log(`  verifyProof(wrong root) = ${await contract.verifyProof(b32(p2.leaf), p2.proof.map(b32), badRoot)}`);
hr();

// 6. persist deployment info
const deployment = {
  schema: 'attestation-deployment-v1',
  chainId,
  network: 'local-ganache',
  note: 'local dev chain configured with Robinhood Chain id 4663 (NOT the real mainnet)',
  address: contract.address,
  deployer,
  deployedAt: new Date().toISOString(),
  abi,
  bytecode,
};
writeFileSync(join(DATA, 'deployment.json'), JSON.stringify(deployment, null, 2));
console.log('▸ Wrote data/deployment.json');
console.log(`\nLOCAL DEPLOYMENT OK — AttestationAnchor @ ${contract.address}`);
