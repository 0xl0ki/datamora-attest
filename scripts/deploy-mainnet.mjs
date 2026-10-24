// Deploy AttestationAnchor to a real chain (e.g. Robinhood Chain mainnet) and
// run ONE attest tx as proof-of-work. Keeps the local demo's deployment.json
// untouched (writes data/deployment-mainnet.json instead).
//
//   RPC_URL=https://rpc.mainnet.chain.robinhood.com PRIVATE_KEY=0x… npm run deploy:mainnet
import solc from 'solc';
import { ethers } from 'ethers';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seal } from '../lib/receipt.mjs';
import { sealInference } from '../lib/inference.mjs';
import { buildBatch } from '../lib/anchor.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA = join(ROOT, '..', 'data');
mkdirSync(DATA, { recursive: true });

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!RPC_URL || !PRIVATE_KEY) throw new Error('set RPC_URL and PRIVATE_KEY (do NOT use the demo key on mainnet)');

const source = readFileSync(join(ROOT, '..', 'contracts', 'AttestationAnchor.sol'), 'utf8');
const input = { language: 'Solidity', sources: { 'AttestationAnchor.sol': { content: source } },
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errs = (out.errors ?? []).filter((e) => e.severity === 'error');
if (errs.length) { console.error(errs.map((e) => e.formattedMessage).join('\n')); process.exit(1); }
const { abi, evm } = out.contracts['AttestationAnchor.sol'].AttestationAnchor;

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const chainId = (await provider.getNetwork()).chainId;

const factory = new ethers.ContractFactory(abi, '0x' + evm.bytecode.object, wallet);
const contract = await factory.deploy();
await contract.deployed();
console.log(`deployed AttestationAnchor @ ${contract.address} (chainId ${chainId})`);

// one real attest: seal 3 demo receipts, fold to a Merkle root, anchor it
const policy = { version: 'agent-radar-entry-v1', chainId, entryRule: 'demo', changeFinancialLimits: false };
const receipts = ['mainnet-1', 'mainnet-2', 'mainnet-3'].map((id) =>
  seal({
    id, agent: { name: 'datamora-personal-agent', version: '20261010', codeHash: 'a'.repeat(64) },
    policy, action: { kind: 'swap_buy', chainId, token: '0x' + 'aa'.repeat(20) },
    decision: { modelHash: 'b'.repeat(64), signalId: id, momentum: 0.12, liquidityUsd: 18400, ageMinutes: 45 },
    inference: sealInference({ momentum: 0.12, liquidityUsd: 18400, ageMinutes: 45 }),
    status: 'confirmed', txHash: '0x' + 'c'.repeat(64), executedAt: Date.now(),
  }));
const root = buildBatch(receipts).root;
const tx = await contract.attest('0x' + root);
const rec = await tx.wait(1);

const info = { schema: 'attestation-deployment-mainnet-v1', chainId, rpcUrl: RPC_URL, address: contract.address,
  deployer: await wallet.getAddress(), root, txHash: rec.transactionHash, blockNumber: rec.blockNumber, deployedAt: new Date().toISOString(), abi };
writeFileSync(join(DATA, 'deployment-mainnet.json'), JSON.stringify(info, null, 2));

console.log(`attested root ${root}`);
console.log(`tx ${rec.transactionHash} (block ${rec.blockNumber})`);
console.log('saved data/deployment-mainnet.json');
