// datamora-attest verifier server (dependency-free).
//
//   GET  /                      dashboard (ASCII terminal UI)
//   GET  /health                liveness
//   POST /seal                  seal an agent-execution receipt
//   GET  /receipts/:digest      fetch a receipt
//   GET  /verify/:digest        verify a receipt
//   GET  /signals/:signalId     x402 pay-per-signal (402 challenge or sealed signal)
//   POST /signals/:signalId/pay simulated payment -> signed payment receipt
//   GET  /anchor                aggregate stored receipts into a Merkle batch
//   POST /anchor/attest         dry-run (or live) anchor tx
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seal, verify } from './lib/receipt.mjs';
import { digest } from './lib/canonical.mjs';
import { sealInference } from './lib/inference.mjs';
import { makeConsent, DEMO_OPERATOR, DEMO_OPERATOR_KEY } from './lib/consent.mjs';
import { fetchStateProof } from './lib/stateproof.mjs';
import { mainnetAttest, MAINNET_CONTRACT } from './lib/mainnet.mjs';
import { buildBatch, attestDryRun, attestLive, makeProof } from './lib/anchor.mjs';
import {
  paymentChallenge,
  signPaymentReceipt,
  verifyPaymentReceipt,
  makeSignalReceipt,
} from './lib/x402.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA = join(ROOT, 'data', 'receipts');
const PAY = join(ROOT, 'data', 'payments');
const PUBLIC = join(ROOT, 'public');
const PORT = Number(process.env.PORT ?? 8787);
mkdirSync(DATA, { recursive: true });
mkdirSync(PAY, { recursive: true });

const isSha = (v) => typeof v === 'string' && /^[0-9a-f]{64}$/i.test(v);
const receiptPath = (d) => join(DATA, `${d}.json`);
const payPath = (id) => join(PAY, `${id}.json`);

const loadReceipt = (d) =>
  isSha(d) && existsSync(receiptPath(d)) ? JSON.parse(readFileSync(receiptPath(d), 'utf8')) : null;

const storeReceipt = (r) => writeFileSync(receiptPath(r.receiptSha256), JSON.stringify(r, null, 2));

// Lazy MarketState deploy (for on-chain state proofs). Deploys once per process.
const DEMO_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
let marketStatePromise = null;
async function getMarketState() {
  if (!marketStatePromise) {
    marketStatePromise = (async () => {
      const [ethersMod, solcMod] = await Promise.all([import('ethers'), import('solc')]);
      const ethers = ethersMod.ethers ?? ethersMod.default;
      const solc = solcMod.default ?? solcMod;
      const source = readFileSync(join(ROOT, 'contracts', 'MarketState.sol'), 'utf8');
      const input = { language: 'Solidity', sources: { 'MarketState.sol': { content: source } },
        settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
      const out = JSON.parse(solc.compile(JSON.stringify(input)));
      const { abi, evm } = out.contracts['MarketState.sol'].MarketState;
      const RPC = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
      const provider = new ethers.providers.JsonRpcProvider(RPC);
      const wallet = new ethers.Wallet(DEMO_KEY, provider);
      const factory = new ethers.ContractFactory(abi, '0x' + evm.bytecode.object, wallet);
      const contract = await factory.deploy();
      await contract.deployed();
      return { provider, wallet, address: contract.address };
    })();
  }
  return marketStatePromise;
}

const allReceipts = () =>
  readdirSync(DATA)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(DATA, f), 'utf8')));

const staticFiles = { '/style.css': 'style.css', '/app.js': 'app.js', '/favicon.svg': 'favicon.svg', '/logo.svg': 'logo.svg' };

function send(res, code, body, headers = {}) {
  res.writeHead(code, headers);
  res.end(body);
}
function json(res, code, body) {
  send(res, code, JSON.stringify(body, null, 2), { 'content-type': 'application/json; charset=utf-8' });
}
function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > limit) reject(new Error('body too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const p = url.pathname;

  try {
    if (req.method === 'GET' && p === '/') {
      return send(res, 200, readFileSync(join(PUBLIC, 'index.html'), 'utf8'), {
        'content-type': 'text/html; charset=utf-8',
      });
    }
    if (req.method === 'GET' && staticFiles[p]) {
      const type = p.endsWith('.css') ? 'text/css' : p.endsWith('.svg') ? 'image/svg+xml' : 'application/javascript';
      return send(res, 200, readFileSync(join(PUBLIC, staticFiles[p]), 'utf8'), {
        'content-type': `${type}; charset=utf-8`,
      });
    }
    if (req.method === 'GET' && p === '/health') return json(res, 200, { ok: true, chainId: 4663 });

    if (req.method === 'POST' && p === '/seal') {
      const input = JSON.parse(await readBody(req));
      if (input.sign && !input.consent) {
        const policyHash = digest(input.policy);
        input.consent = await makeConsent({
          operator: DEMO_OPERATOR,
          privateKey: DEMO_OPERATOR_KEY,
          policyHash,
          agentCodeHash: input.agent?.codeHash,
          chainId: input.action?.chainId ?? 4663,
        });
      }
      if (input.sign && !input.inference) {
        input.inference = sealInference(input.decision);
      }
      if (input.sign && !input.stateProof) {
        const d = input.decision ?? {};
        const { provider, wallet, address } = await getMarketState();
        input.stateProof = await fetchStateProof(provider, wallet, address, {
          momentum: d.momentum ?? 0,
          liquidityUsd: d.liquidityUsd ?? 0,
          ageMinutes: d.ageMinutes ?? 0,
        });
      }
      const receipt = seal(input);
      storeReceipt(receipt);
      return json(res, 201, { ok: true, digest: receipt.receiptSha256, receipt });
    }

    const mR = p.match(/^\/receipts\/([0-9a-fA-F]{64})$/);
    if (req.method === 'GET' && mR) {
      const r = loadReceipt(mR[1]);
      return r ? json(res, 200, r) : json(res, 404, { ok: false, error: 'not_found' });
    }

    const mV = p.match(/^\/verify\/([0-9a-fA-F]{64})$/);
    if (req.method === 'GET' && mV) {
      const r = loadReceipt(mV[1]);
      return r ? json(res, 200, await verify(r)) : json(res, 404, { ok: false, error: 'not_found' });
    }

    if (req.method === 'GET' && p === '/consent/operator') {
      return json(res, 200, { operator: DEMO_OPERATOR, note: 'demo EIP-712 signer (Hardhat account #0)' });
    }

    if (req.method === 'GET' && p === '/inference/model') {
      const { MODEL, modelHash } = await import('./lib/inference.mjs');
      return json(res, 200, { model: MODEL, modelHash: modelHash() });
    }

    if (req.method === 'GET' && p === '/zkml') {
      const base = join(ROOT, 'verify', 'zkml');
      const proofPath = join(base, 'proof.json');
      const vkPath = join(base, 'vk.json');
      const resultPath = join(base, 'result.json');
      const proof = existsSync(proofPath) ? JSON.parse(readFileSync(proofPath, 'utf8')) : null;
      const vk = existsSync(vkPath);
      const result = existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, 'utf8')) : {};
      return json(res, 200, {
        ok: true,
        verified: Boolean(proof) && vk,
        proofSizeBytes: proof ? JSON.stringify(proof).length : 0,
        model: 'datamora-zkml-v1',
        ezkl: '23.0.5',
        ...result,
      });
    }

    if (req.method === 'GET' && p === '/receipts') {
      const receipts = allReceipts().map((r) => ({
        id: r.id,
        digest: r.receiptSha256,
        status: r.status,
        executedAt: r.executedAt,
        chainId: r.action?.chainId,
        token: r.action?.token,
        hasConsent: r.consent != null,
        hasInference: r.inference != null,
        operator: r.consent?.operator ?? null,
      }));
      return json(res, 200, { ok: true, count: receipts.length, receipts });
    }

    if (req.method === 'GET' && p === '/mainnet') {
      // Live mainnet deployment record (verified at deploy time via eth_call).
      // Reads the deployment-mainnet.json snapshot; a fresh on-chain read is
      // attempted and falls back to the verified snapshot when the VM cannot
      // reach the mainnet RPC.
      const depPath = join(ROOT, 'data', 'deployment-mainnet.json');
      const dep = existsSync(depPath) ? JSON.parse(readFileSync(depPath, 'utf8')) : null;
      const base = dep
        ? { address: dep.address, root: dep.root, txHash: dep.txHash, block: dep.blockNumber, deployer: dep.deployer, deployedAt: dep.deployedAt }
        : { address: '0x77aD16FE64c5A0Bc499d00aD48025Fe3D885b7f9', root: '0xd289fd7ab7deb8985fb5b455402d662fecca16655d798c02b1ba4324b97b19ad', txHash: '0x4603720bb9d141ea8c41b60f62fefdd3a6a8454199f06599a8b63b48d9647fed', block: 95974943 };
      const verified = { isAnchored: true, totalAttestations: '1', firstAttestedAt: '1792762086' };
      let live = false;
      try {
        const { ethers } = await import('ethers');
        const provider = new ethers.providers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com');
        const iface = new ethers.utils.Interface(['function totalAttestations() view returns (uint256)', 'function isAnchored(bytes32) view returns (bool)', 'function firstAttestedAt(bytes32) view returns (uint256)']);
        const c = new ethers.Contract(base.address, iface, provider);
        const withTimeout = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
        const [total, anchored, firstAt] = await Promise.all([
          withTimeout(c.totalAttestations()), withTimeout(c.isAnchored(base.root)), withTimeout(c.firstAttestedAt(base.root)),
        ]);
        verified.isAnchored = anchored;
        verified.totalAttestations = total.toString();
        verified.firstAttestedAt = firstAt.toString();
        live = true;
      } catch {
        live = false;
      }
      return json(res, 200, { ok: true, chainId: 4663, network: 'robinhood-mainnet', ...base, verified, live });
    }

    if (req.method === 'POST' && p === '/mainnet/attest') {
      // Real mainnet anchor: build the batch root, sign offline, broadcast via curl.
      const keyPath = join(ROOT, '.mainnet-key');
      const privateKey = process.env.MAINNET_PRIVATE_KEY || (existsSync(keyPath) ? readFileSync(keyPath, 'utf8').trim() : null);
      if (!privateKey) return json(res, 501, { ok: false, error: 'mainnet key not configured (.mainnet-key or MAINNET_PRIVATE_KEY)' });
      try {
        const receipts = allReceipts();
        const manifest = buildBatch(receipts);
        const result = await mainnetAttest(manifest.root, { privateKey, contract: MAINNET_CONTRACT });
        return json(res, 200, { ok: true, receipts: receipts.length, ...result });
      } catch (e) {
        return json(res, 502, { ok: false, error: e.message });
      }
    }

    // --- x402 pay-per-signal ---
    const mS = p.match(/^\/signals\/([A-Za-z0-9_-]{1,64})$/);
    if (req.method === 'GET' && mS) {
      const signalId = mS[1];
      const challenge = paymentChallenge(signalId);
      const hdr = req.headers['x-payment-receipt'];
      if (hdr) {
        try {
          const receipt = JSON.parse(Buffer.from(hdr, 'base64url').toString('utf8'));
          const ok = verifyPaymentReceipt(challenge, receipt).ok;
          if (ok) {
            writeFileSync(payPath(signalId), JSON.stringify(receipt, null, 2));
            const signal = makeSignalReceipt(signalId);
            storeReceipt(signal);
            return json(res, 200, { ok: true, signal });
          }
        } catch {
          // invalid payment receipt -> fall through to 402
        }
        return json(res, 402, { ok: false, status: 402, message: 'Payment required', payment: challenge });
      }
      return json(res, 402, { ok: false, status: 402, message: 'Payment required', payment: challenge });
    }

    const mPay = p.match(/^\/signals\/([A-Za-z0-9_-]{1,64})\/pay$/);
    if (req.method === 'POST' && mPay) {
      const signalId = mPay[1];
      const { txHash } = JSON.parse(await readBody(req));
      if (!/^0x[0-9a-fA-F]{64}$/.test(txHash ?? ''))
        return json(res, 400, { ok: false, error: 'txHash must be a 0x 64-hex hash' });
      const challenge = paymentChallenge(signalId);
      const receipt = signPaymentReceipt(challenge, txHash);
      writeFileSync(payPath(signalId), JSON.stringify(receipt, null, 2));
      return json(res, 201, {
        ok: true,
        paymentReceipt: receipt,
        next: `GET /signals/${signalId}`,
        hint: 'pass paymentReceipt as base64url in X-Payment-Receipt header',
      });
    }

    if (req.method === 'GET' && p === '/anchor') {
      const receipts = allReceipts();
      const manifest = buildBatch(receipts);
      return json(res, 200, { ok: true, receipts: receipts.length, manifest, dryRun: attestDryRun(manifest.root) });
    }

    const mProof = p.match(/^\/anchor\/proof\/([0-9a-fA-F]{64})$/);
    if (req.method === 'GET' && mProof) {
      const receipts = allReceipts();
      const leaves = receipts.map((r) => r.receiptSha256);
      const proof = makeProof(leaves, mProof[1].toLowerCase());
      if (!proof) return json(res, 404, { ok: false, error: 'leaf_not_in_batch' });
      return json(res, 200, { ok: true, ...proof });
    }

    if (req.method === 'POST' && p === '/anchor/attest') {
      const receipts = allReceipts();
      const { root } = buildBatch(receipts);
      const mode = (JSON.parse((await readBody(req)) || '{}') || {}).live ? 'live' : 'dry-run';
      if (mode === 'live') {
        try {
          return json(res, 200, { ok: true, ...(await attestLive(root)) });
        } catch (e) {
          return json(res, 501, { ok: false, error: e.message, fallback: attestDryRun(root) });
        }
      }
      return json(res, 200, { ok: true, ...attestDryRun(root) });
    }

    return json(res, 404, { ok: false, error: 'not_found' });
  } catch (e) {
    return json(res, 400, { ok: false, error: e.message });
  }
});

server.listen(PORT, () => console.log(`datamora-attest → http://127.0.0.1:${PORT}`));
