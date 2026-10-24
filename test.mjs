// Full self-test: receipt integrity + tamper detection, keccak vectors,
// Merkle root/proof, x402 payment signing, anchor calldata encoding.
import { seal, verify } from './lib/receipt.mjs';
import { keccak256, keccak256Utf8, keccak256Hex, selector } from './lib/keccak.mjs';
import { merkleRoot, merkleProof, verifyProof, pairHash } from './lib/merkle.mjs';
import { encodeAttestCalldata, encodeVerifyProofCalldata, buildBatch, makeProof, VERIFY_PROOF_SELECTOR } from './lib/anchor.mjs';
import { paymentChallenge, signPaymentReceipt, verifyPaymentReceipt } from './lib/x402.mjs';
import { makeConsent, recoverConsentSigner, consentValue, DEMO_OPERATOR, DEMO_OPERATOR_KEY } from './lib/consent.mjs';
import { sealInference, verifyInference, modelHash, runModel } from './lib/inference.mjs';
import { makeProvenance, recoverObservationSigner, observationDigest, DATA_SOURCE_ADDRESS, DATA_SOURCE_KEY } from './lib/source.mjs';
import { verifyStateProof, SLOT_MOMENTUM, SLOT_LIQUIDITY, SLOT_AGE } from './lib/stateproof.mjs';

const results = [];
const check = (name, cond) => {
  results.push([name, cond]);
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
};

// --- keccak256 known vectors ---
check('keccak("")', keccak256(new Uint8Array(0)) === 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
check('keccak("abc")', keccak256Utf8('abc') === '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
check('selector attest(bytes32)', selector('attest(bytes32)') === '23c3617f');

// --- receipt seal/verify/tamper ---
const policy = { version: 'agent-radar-entry-v1', chainId: 4663, entryRule: 'demo' };
const mk = (id) => seal({
  id,
  agent: { name: 'datamora-personal-agent', version: '20261010', codeHash: 'f'.repeat(64) },
  policy,
  action: { kind: 'swap_buy', chainId: 4663, token: '0x' + 'aa'.repeat(20) },
  decision: { modelHash: 'a'.repeat(64), signalId: id },
  status: 'confirmed',
  txHash: '0x' + 'b'.repeat(64),
  executedAt: Date.now(),
});
const r1 = mk('t1'), r2 = mk('t2'), r3 = mk('t3');
check('seal produces 64-hex receiptSha256', /^[0-9a-f]{64}$/.test(r1.receiptSha256));
check('verify(sealed) ok', (await verify(r1)).ok);
const tampered = JSON.parse(JSON.stringify(r1));
tampered.policy.entryRule = 'changed';
const vTampered = await verify(tampered);
check('tamper detected (policy_hash_mismatch)', !vTampered.ok && vTampered.errors.includes('policy_hash_mismatch'));

// --- EIP-712 authorization consent ---
const policyHash = r1.policyHash;
const consent = await makeConsent({
  operator: DEMO_OPERATOR,
  privateKey: DEMO_OPERATOR_KEY,
  policyHash,
  agentCodeHash: r1.agent.codeHash,
  chainId: 4663,
  expiresAt: 0,
  nonce: 0,
});
const signer = await recoverConsentSigner(consentValue(consent), consent.signature, { chainId: 4663 });
check('consent recovers the operator', signer.toLowerCase() === DEMO_OPERATOR.toLowerCase());

const rSigned = seal({ ...mk('t4'), consent });
check('seal embeds consent', rSigned.consent?.operator === DEMO_OPERATOR.toLowerCase());
check('verify(signed) ok incl. consent', (await verify(rSigned)).ok);

const rForged = JSON.parse(JSON.stringify(rSigned));
rForged.consent.operator = '0x' + '11'.repeat(20);
const vForged = await verify(rForged);
check('forged consent operator caught by integrity (receipt_digest_mismatch)', !vForged.ok && vForged.errors.includes('receipt_digest_mismatch'));

// A consent that claims operator=DEMO but is actually signed by a DIFFERENT key:
// receipt integrity passes (re-sealed), but signer recovery must reject it.
const OTHER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const wrongConsent = await makeConsent({
  operator: DEMO_OPERATOR, privateKey: OTHER_KEY, policyHash, agentCodeHash: r1.agent.codeHash, chainId: 4663,
});
const rWrongSigner = seal({ ...mk('t6'), consent: wrongConsent });
const vWrongSigner = await verify(rWrongSigner);
check('wrong-signer consent rejected (consent_signer_mismatch)', !vWrongSigner.ok && vWrongSigner.errors.includes('consent_signer_mismatch'));

const rBadPolicy = JSON.parse(JSON.stringify(rSigned));
rBadPolicy.consent.policyHash = '0'.repeat(64);
let sealThrew = false;
try { seal(rBadPolicy); } catch { sealThrew = true; }
check('consent policyHash mismatch rejected at seal', sealThrew);

// --- verifiable inference (S5) ---
const inf = sealInference({ momentum: 0.12, liquidityUsd: 18400, ageMinutes: 45 });
check('inference output is deterministic', inf.output === runModel({ momentum: 0.12, liquidityUsd: 18400, ageMinutes: 45 }));
check('verifyInference ok', verifyInference(inf).ok);
const infTampered = { ...inf, output: inf.output + 0.001 };
check('tampered inference output rejected', !verifyInference(infTampered).ok && verifyInference(infTampered).errors.includes('inference_output_mismatch'));

const rInf = seal({ ...mk('t7'), inference: inf });
check('verify(receipt with inference) ok', (await verify(rInf)).ok);
const rInfBad = JSON.parse(JSON.stringify(rInf));
rInfBad.inference.output = 0.5;
check('tampered inference inside receipt rejected', !(await verify(rInfBad)).ok);

// --- on-chain state proof (S5b, EIP-1186 storage proof) ---
// Loads a real eth_getProof fixture (fetched from the local chain). The proof
// is verified offline against the block's stateRoot — no signer trust.
import { readFileSync, existsSync } from 'node:fs';
const fixturePath = new URL('./data/stateproof-fixture.json', import.meta.url).pathname;
if (existsSync(fixturePath)) {
  const fx = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const sp = {
    schema: 'onchain-state-proof-v1',
    contract: fx.address,
    blockNumber: fx.blockNumber,
    blockHash: fx.blockHash,
    stateRoot: fx.stateRoot,
    accountProof: fx.accountProof,
    storage: fx.storageProof.map((s, i) => ({ slot: [SLOT_MOMENTUM, SLOT_LIQUIDITY, SLOT_AGE][i], proof: s.proof, value: s.value })),
  };
  const vsp = verifyStateProof(sp, { momentum: 0.12, liquidityUsd: 18400, ageMinutes: 45 });
  check('state proof verifies against stateRoot (offline MPT)', vsp.ok);
  check('state proof derives exact model input', vsp.derived && vsp.derived.momentum === 0.12 && vsp.derived.liquidityUsd === 18400 && vsp.derived.ageMinutes === 45);

  const rSp = seal({ ...mk('t9'), inference: inf, stateProof: sp });
  check('verify(receipt with stateProof) ok', (await verify(rSp)).ok);

  const rSpMismatch = JSON.parse(JSON.stringify(rSp));
  rSpMismatch.inference.input.momentum = 0.999;
  const vSpMismatch = await verify(rSpMismatch);
  check('stateProof input mismatch rejected', !vSpMismatch.ok && vSpMismatch.errors.includes('stateproof_input_mismatch'));

  const rSpForged = JSON.parse(JSON.stringify(rSp));
  rSpForged.stateProof.storage[0].proof[0] = '0x' + 'ff'.repeat(32);
  const vSpForged = await verify(rSpForged);
  check('forged storage proof rejected', !vSpForged.ok);
} else {
  console.log('SKIP  state proof tests (run scripts/fetch-stateproof.mjs first)');
}

// --- merkle (sorted-pair, power-of-2 padding) ---
const leaves = [r1, r2, r3].map((r) => r.receiptSha256);
const root = merkleRoot(leaves);
const proof = merkleProof(leaves, r1.receiptSha256);
check('merkle proof verifies against root', verifyProof(r1.receiptSha256, proof, root));
check('merkle proof rejects foreign leaf', !verifyProof('0'.repeat(64), proof, root));

// Independent reference implementation to guard against self-consistent bugs.
function refRoot(ls) {
  const sorted = [...ls].sort();
  let cur = sorted;
  while (cur.length < (() => { let p = 1; while (p < sorted.length) p <<= 1; return p; })()) cur.push(cur[cur.length - 1]);
  const pair = (a, b) => keccak256Hex(a < b ? a + b : b + a);
  while (cur.length > 1) {
    const n = [];
    for (let i = 0; i < cur.length; i += 2) n.push(pair(cur[i], cur[i + 1]));
    cur = n;
  }
  return cur[0];
}
check('root matches independent reference impl', root === refRoot(leaves));

// On-chain membership: build Solidity-ready proof + calldata.
const mp = makeProof(leaves, r2.receiptSha256);
check('makeProof root matches batch root', mp.root === root);
check('makeProof proof verifies off-chain', verifyProof(mp.leaf, mp.proof, mp.root));
check('verifyProof selector correct', VERIFY_PROOF_SELECTOR.length === 8 && /^[0-9a-f]{8}$/.test(VERIFY_PROOF_SELECTOR));
check('encodeVerifyProofCalldata prefix', encodeVerifyProofCalldata(mp.leaf, mp.proof, mp.root).startsWith('0x' + VERIFY_PROOF_SELECTOR));

check('anchor calldata well-formed', encodeAttestCalldata(root) === '0x23c3617f' + root);
check('batch manifest has root + count', buildBatch([r1, r2, r3]).count === 3 && buildBatch([r1, r2, r3]).root === root);

// Solidity paste-ready test vector (leaf, proof, root).
console.log('\n--- Solidity test vector (paste into Remix/forge) ---');
console.log('leaf :', mp.leaf);
console.log('proof: [' + mp.proof.map((p) => `bytes32(0x${p})`).join(', ') + ']');
console.log('root :', mp.root);
console.log('expect verifyProof(leaf, proof, root) == true\n');

// --- x402 ---
const ch = paymentChallenge('signal-42');
const pay = signPaymentReceipt(ch, '0x' + '9'.repeat(64));
check('x402 payment receipt verifies', verifyPaymentReceipt(ch, pay).ok);
const bad = { ...pay, amount: '0' };
check('x402 tampered amount rejected', !verifyPaymentReceipt(ch, bad).ok);

const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
