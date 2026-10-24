#!/usr/bin/env node
// Sign a Datamora consent with the OSKey device (stock firmware — no rebuild).
//
//   node hardware/sign-cli.mjs [operator] [chainId] [nonce]
//
// It prints the canonical consent message, you sign that message on the OSKey
// (via its host app / WebUSB wallet interface), paste the signature back, and
// it verifies + recovers the operator. No custom protocol needed: the OSKey
// already signs Ethereum personal messages out of the box.
import { createHash } from 'node:crypto';
import { buildSignRequest, attachHardwareSignature, verifyHardwareConsent } from './bridge.mjs';
import { DEMO_OPERATOR } from '../lib/consent.mjs';

const sha = (s) => '0x' + createHash('sha256').update(s).digest('hex');
const args = process.argv.slice(2);
const operator = args[0] || DEMO_OPERATOR;
const chainId = Number(args[1] || 4663);
const nonce = Number(args[2] || 1);
// deterministic demo hashes so the walkthrough is reproducible
const policyHash = sha('policy:buy-limited-v1');
const agentCodeHash = sha('agent:flash-v1');

const req = buildSignRequest({ operator, policyHash, agentCodeHash, chainId, nonce });

console.log('════════════════════════════════════════════');
console.log('  DATAMORA ATTEST · OSKey hardware signer');
console.log('════════════════════════════════════════════');
console.log('\n[1] 用 OSKey（host app / WebUSB）签名这条消息：\n');
console.log('  ' + req.message.replace(/\n/g, '\n  '));
console.log('\n[2] 粘贴 OSKey 返回的签名（0x 开头），回车：\n');

let sig = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { sig += d; });
process.stdin.on('end', async () => {
  sig = sig.trim();
  if (!sig.startsWith('0x')) sig = '0x' + sig;
  const consent = attachHardwareSignature(req, sig);
  try {
    const recovered = await verifyHardwareConsent(consent);
    console.log('\n[3] 验证结果：');
    console.log('  recovered operator :', recovered);
    console.log('  expected operator  :', operator.toLowerCase());
    console.log('  匹配               :', recovered.toLowerCase() === operator.toLowerCase() ? '✅ PASS' : '❌ FAIL（签名不属于该 operator）');
  } catch (e) {
    console.error('\n❌ 验证失败:', e.message);
    process.exit(1);
  }
});
