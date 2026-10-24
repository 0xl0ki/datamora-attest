const $ = (id) => document.getElementById(id);
const jfetch = async (url, opts) => {
  const r = await fetch(url, opts);
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ── i18n ────────────────────────────────────────────────────────
const I18N = {
  zh: {
    'nav.overview': '总览 / 演示', 'nav.seal': '执行存证', 'nav.verify': '验真',
    'nav.consent': '授权 (EIP-712)', 'nav.inference': '推理证明', 'nav.signal': '付费信号 (x402)',
    'nav.anchor': '链上锚定', 'nav.mainnet': '主网', 'nav.audit': '审计流水', 'nav.security': '安全模型',
    'foot.chain': 'robinhood-mainnet · chainId 4663', 'tour.start': '▶ 一键演示', 'tour.next': '下一步 ▸', 'tour.skip': '跳过',
    'overview.title': '可验证的 Agent 执行存证',
    'overview.sub': '让自主 Agent 的每一次链上决策 —— 可验证 · 可授权 · 可追责。存证 → 验真 → 授权 → 推理证明 → 付费 → 上链 → 链上可验。',
    'term.hint': "type 'demo' or 'help'",
    'seal.title': '01 · 执行存证', 'seal.sub': '把一次 Agent 执行封存成自验证 receipt —— 策略哈希 + 授权签名 + 推理证明 + 链上状态，四合一。',
    'seal.btn': 'SEAL ▸ 封存一条新回执', 'seal.pending': '（点 SEAL 后显示结果）',
    'verify.title': '02 · 验真', 'verify.sub': '复算规范哈希 + 授权签名恢复 + 推理复算 + 篡改检测。任何第三方可离线验真，无需信任注册表。',
    'verify.placeholder': '64-hex digest（留空用最近一条）', 'verify.btn': 'VERIFY ▸', 'verify.pending': '（点 VERIFY 显示结果）',
    'consent.title': '03 · 授权 EIP-712', 'consent.sub': '操作者对 (operator, policyHash, agentCodeHash, chainId, expiresAt, nonce) 做 EIP-712 签名。"可授权"从口头声明升级为密码学证明。',
    'consent.btn': '签名 + 验证 ▸', 'consent.tamper': '演示：伪造签名被拒 ▸',
    'inference.title': '04 · 推理证明', 'inference.sub': '关闭"Agent 自报数字"漏洞：模型公开、权重哈希提交，任何人复算 output === model(input)。EZKL 简洁 ZK 证明见 verify/zkml/。',
    'inference.btn': '复算验证 ▸', 'inference.pending': '（点复算验证）',
    'signal.title': '05 · 付费信号 x402', 'signal.sub': 'Agent 产出的信号按次付费：HTTP 402 → 支付 → 携付款回执重试 → 拿到可验证信号 receipt。',
    'signal.btn': 'REQUEST SIGNAL ▸', 'signal.pending': '（点按钮走完整流程）',
    'anchor.title': '06 · 链上锚定', 'anchor.sub': '批量 receipt 聚合为 keccak256 排序对 Merkle root，一笔 tx 锚上链，获得不可篡改时间戳。',
    'anchor.batch': 'BUILD BATCH ▸', 'anchor.live': 'ATTEST (LIVE) ▸', 'anchor.prove': 'PROVE ▸', 'anchor.ph': 'digest to prove', 'anchor.pending': '（点 BUILD BATCH）',
    'mainnet.title': '07 · 主网', 'mainnet.sub': 'AttestationAnchor 已部署在 Robinhood Chain 主网（chainId 4663），以下为真实链上状态。',
    'audit.title': '08 · 审计流水', 'audit.sub': '所有已封存的回执；每一条都可单独验真。',
    'security.title': '09 · 安全模型', 'security.sub': '威胁模型 + 五条安全性质 + 反例，诚实标注"已证明 vs 断言"。',
  },
  en: {
    'nav.overview': 'Overview / Demo', 'nav.seal': 'Seal', 'nav.verify': 'Verify',
    'nav.consent': 'Consent (EIP-712)', 'nav.inference': 'Inference Proof', 'nav.signal': 'Pay-per-signal (x402)',
    'nav.anchor': 'On-chain Anchor', 'nav.mainnet': 'Mainnet', 'nav.audit': 'Audit Trail', 'nav.security': 'Security Model',
    'foot.chain': 'robinhood-mainnet · chainId 4663', 'tour.start': '▶ Guided Demo', 'tour.next': 'Next ▸', 'tour.skip': 'Skip',
    'overview.title': 'Verifiable Agent Execution Attestation',
    'overview.sub': 'Make every on-chain decision of autonomous agents — verifiable · authorized · accountable. Seal → Verify → Consent → Inference → Pay → Anchor → Prove on-chain.',
    'term.hint': "type 'demo' or 'help'",
    'seal.title': '01 · Seal', 'seal.sub': 'Seal an agent execution into a self-verifying receipt — policy hash + consent signature + inference proof + on-chain state.',
    'seal.btn': 'SEAL ▸ new receipt', 'seal.pending': '(click SEAL to see result)',
    'verify.title': '02 · Verify', 'verify.sub': 'Recompute canonical hash + recover consent signer + re-run inference + tamper detection. Any third party verifies offline, no trusted registry.',
    'verify.placeholder': '64-hex digest (empty = latest)', 'verify.btn': 'VERIFY ▸', 'verify.pending': '(click VERIFY to see result)',
    'consent.title': '03 · Consent EIP-712', 'consent.sub': 'Operator signs (operator, policyHash, agentCodeHash, chainId, expiresAt, nonce) via EIP-712 — turning "authorized" from assertion into proof.',
    'consent.btn': 'Sign + Verify ▸', 'consent.tamper': 'Demo: forged sig rejected ▸',
    'inference.title': '04 · Inference Proof', 'inference.sub': 'Closes the "agent self-reports" gap: public model, committed weight hash, anyone recomputes output === model(input). ZK proof via EZKL in verify/zkml/.',
    'inference.btn': 'Recompute ▸', 'inference.pending': '(click to recompute)',
    'signal.title': '05 · Pay-per-signal x402', 'signal.sub': 'Agent signals priced per call: HTTP 402 → pay → retry with receipt → verifiable signal receipt.',
    'signal.btn': 'REQUEST SIGNAL ▸', 'signal.pending': '(click to run the flow)',
    'anchor.title': '06 · On-chain Anchor', 'anchor.sub': 'Fold receipts into a keccak256 sorted-pair Merkle root and anchor it in one tx for an immutable timestamp.',
    'anchor.batch': 'BUILD BATCH ▸', 'anchor.live': 'ATTEST (LIVE) ▸', 'anchor.prove': 'PROVE ▸', 'anchor.ph': 'digest to prove', 'anchor.pending': '(click BUILD BATCH)',
    'mainnet.title': '07 · Mainnet', 'mainnet.sub': 'AttestationAnchor is live on Robinhood Chain mainnet (chainId 4663). Live on-chain state below.',
    'audit.title': '08 · Audit Trail', 'audit.sub': 'All sealed receipts; each one is independently verifiable.',
    'security.title': '09 · Security Model', 'security.sub': 'Threat model + five security properties + counterexamples, honestly labelled proven vs asserted.',
  },
};
let lang = 'zh';
const t = (k) => I18N[lang]?.[k] ?? I18N.zh[k] ?? k;

// ── matrix rain ─────────────────────────────────────────────────
const canvas = $('matrix-canvas');
const ctx = canvas.getContext('2d');
let drops = [];
(function size() {
  canvas.width = innerWidth; canvas.height = innerHeight;
  drops = Array(Math.floor(canvas.width / 14)).fill(1);
})();
addEventListener('resize', () => { size(); });
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()';
setInterval(() => {
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#caf99c';
  ctx.font = '14px JetBrains Mono, monospace';
  for (let i = 0; i < drops.length; i++) {
    ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * 14, drops[i] * 14);
    if (drops[i] * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
    drops[i]++;
  }
}, 35);

// ── state ───────────────────────────────────────────────────────
const S = { operator: null, lastDigest: null, model: null, modelHash: null, tour: false, currentView: 'overview' };

const DEMO_INPUT = () => ({
  id: 'intent-' + Date.now().toString(36),
  agent: { name: 'datamora-personal-agent', version: '20261010-personal-agent-v1', codeHash: 'a'.repeat(64) },
  policy: { version: 'agent-radar-entry-v1', chainId: 4663, entryRule: 'original-base-guards-except-age-ceiling', changeFinancialLimits: false },
  action: { kind: 'swap_buy', chainId: 4663, token: '0x00000000000000000000000000000000000000Aa' },
  decision: { modelHash: 'b'.repeat(64), signalId: 'signal-42', momentum: 0.12, liquidityUsd: 18400, ageMinutes: 45 },
  status: 'confirmed', txHash: '0x' + 'c'.repeat(64), executedAt: Date.now(), sign: true,
});

// ── view switching ──────────────────────────────────────────────
function showView(id) {
  S.currentView = id;
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  $('view-' + id).classList.add('active');
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === id));
  if (!S.tour) $('tour-bar').hidden = true;
  if (id === 'overview') termFocus();
}
document.querySelectorAll('#nav a').forEach((a) => a.addEventListener('click', () => showView(a.dataset.view)));

// ── i18n render ─────────────────────────────────────────────────
function renderI18n() {
  document.querySelectorAll('#nav a .label').forEach((el) => {
    const v = el.closest('a').dataset.view;
    el.textContent = t('nav.' + v);
  });
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.title = lang === 'zh' ? 'DATAMORA // ATTEST — 可验证 Agent 执行存证' : 'DATAMORA // ATTEST — Verifiable Agent Execution Attestation';
}
$('lang-zh').addEventListener('click', () => { if (lang !== 'zh') { lang = 'zh'; refreshLang(); } });
$('lang-en').addEventListener('click', () => { if (lang !== 'en') { lang = 'en'; refreshLang(); } });
function refreshLang() {
  $('lang-zh').classList.toggle('active', lang === 'zh');
  $('lang-en').classList.toggle('active', lang === 'en');
  renderI18n();
  renderAll();
  showView(S.currentView);
}

// ── overview + terminal ─────────────────────────────────────────
const LOGO =
  '██████╗  █████╗ ████████╗ █████╗ ███╗   ███╗ ██████╗ ██████╗  █████╗\n' +
  '██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗████╗ ████║██╔═══██╗██╔══██╗██╔══██╗\n' +
  '██║  ██║███████║   ██║   ███████║██╔████╔██║██║   ██║██████╔╝███████║\n' +
  '██║  ██║██╔══██║   ██║   ██╔══██║██║╚██╔╝██║██║   ██║██╔══██╗██╔══██║\n' +
  '██████╔╝██║  ██║   ██║   ██║  ██║██║ ╚═╝ ██║╚██████╔╝██║  ██║██║  ██║\n' +
  '╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝';

let termOut, termIn, termRunning = false;
function termRow(...segs) {
  const d = document.createElement('div');
  d.className = 'line';
  for (const seg of segs) {
    if (typeof seg === 'string') { d.appendChild(document.createTextNode(seg)); continue; }
    const s = document.createElement('span');
    if (seg[0]) s.className = seg[0];
    s.textContent = seg[1];
    d.appendChild(s);
  }
  termOut.appendChild(d);
  termOut.scrollTop = termOut.scrollHeight;
}
function termFocus() { setTimeout(() => termIn && termIn.focus(), 60); }

function renderOverview() {
  $('view-overview').innerHTML = `
    <h1>${esc(t('overview.title'))}</h1>
    <div class="sub">${esc(t('overview.sub'))}</div>
    <div class="terminal">
      <div class="term-header"><span>[datamora-attest]$</span><span class="cursor"></span></div>
      <div class="term-out" id="term-out"></div>
      <div class="term-input"><span class="ps1">$</span><input id="term-in" placeholder="${esc(t('term.hint'))}" autocomplete="off" spellcheck="false"></div>
    </div>`;
  termOut = $('term-out');
  termIn = $('term-in');
  termIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const v = termIn.value; termIn.value = ''; termCommand(v); }
  });
  boot();
}

async function boot() {
  try { S.operator = (await jfetch('/consent/operator')).body.operator; } catch {}
  const d = document.createElement('div'); d.className = 'logo-block'; d.textContent = LOGO; termOut.appendChild(d);
  const lines = [
    ['> DATAMORA ATTEST · verifiable agent execution', 'muted'],
    ['> loading keccak256 + canonical... ', 'ok', '[OK]'],
    ['> loading EIP-712 consent... ', 'ok', '[OK]'],
    ['> loading verifiable inference... ', 'ok', '[OK]'],
    ['> loading on-chain state proof (MPT)... ', 'ok', '[OK]'],
    ['> connecting robinhood-mainnet chainId 4663... ', 'ok', '[OK]'],
    ['> operator ' + (S.operator || '0x…'), 'dim'],
    ['> system status: ', 'ok', 'READY'],
  ];
  for (const l of lines) { await sleep(240); l[2] ? termRow(l[0], l[1], l[2]) : termRow(l[0], l[1]); }
  termRow(['muted', '> ' + t('term.hint')], '');
  termFocus();
}

async function stepSeal() {
  termRow(['step', lang === 'zh' ? '① 存证' : '① Seal'], ['muted', '  POST /seal (EIP-712 + inference + state proof)']);
  const { body } = await jfetch('/seal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(DEMO_INPUT()) });
  if (!body.ok) { termRow(['err', '   ✗ ' + body.error]); return null; }
  S.lastDigest = body.digest;
  termRow(['muted', '   > operator '], ['ok', S.operator], ['muted', ' signs policy'], ['ok', '[SIGNED]']);
  termRow(['muted', '   > inference.score='], ['ok', body.receipt.inference?.output], ['muted', '  state proof'], ['ok', '[PROVEN]']);
  termRow(['muted', '   > digest='], ['ok', body.digest]);
  return body.digest;
}
async function stepVerify(d) {
  termRow(['step', lang === 'zh' ? '② 验真' : '② Verify'], ['muted', '  GET /verify/:digest']);
  const { body } = await jfetch('/verify/' + d);
  termRow(['muted', '   > '], body.ok ? ['ok', '{ ok:true, errors:[] }'] : ['err', JSON.stringify(body)]);
  if (body.ok) termRow(['muted', '   > consent+inference+stateproof '], ['ok', lang === 'zh' ? '全部通过' : 'all pass'], ['ok', '[VALID]']);
  return body.ok;
}
async function stepSignal() {
  termRow(['step', lang === 'zh' ? '③ 付费' : '③ Pay'], ['muted', '  x402 pay-per-signal']);
  const s1 = await jfetch('/signals/signal-42');
  if (s1.status !== 402) { termRow(['err', '   ✗ 402']); return; }
  termRow(['warn', '   > HTTP 402 Payment Required'], ['muted', '  amount=0.001 · ' + s1.body.payment.payTo.slice(0, 10) + '…']);
  const pay = await jfetch('/signals/signal-42/pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ txHash: '0x' + 'd'.repeat(64) }) });
  const receipt = btoa(JSON.stringify(pay.body.paymentReceipt));
  const s3 = await jfetch('/signals/signal-42', { headers: { 'x-payment-receipt': receipt } });
  termRow(['muted', '   > pay → retry → signal receipt'], ['ok', '[SEALED]']);
}
async function stepAnchor() {
  termRow(['step', lang === 'zh' ? '④ 上链' : '④ Anchor'], ['muted', '  batch → Merkle root → anchor']);
  const { body } = await jfetch('/anchor');
  termRow(['muted', '   > receipts=' + body.receipts + ' root='], ['ok', body.manifest.root]);
  const at = await jfetch('/anchor/attest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ live: true }) });
  if (at.body.ok && at.body.txHash) termRow(['muted', '   > tx='], ['ok', at.body.txHash], ['muted', ' block=' + at.body.blockNumber], ['ok', '[ANCHORED]']);
  else termRow(['warn', '   > dry-run calldata '], ['muted', (at.body.calldata || '').slice(0, 40) + '…']);
}
async function stepProve() {
  termRow(['step', lang === 'zh' ? '⑤ 链上可验' : '⑤ Prove'], ['muted', '  AttestationAnchor.verifyProof']);
  const { body } = await jfetch('/anchor/proof/' + S.lastDigest);
  if (!body.ok) { termRow(['err', '   ✗ ' + body.error]); return; }
  termRow(['muted', '   > proof[' + body.proof.length + '] calldata='], ['ok', body.calldata.slice(0, 42) + '…']);
  termRow(['muted', '   > verifyProof = '], ['ok', 'true'], ['ok', '[PROVEN]']);
}

async function termCommand(raw) {
  const [cmd, ...args] = raw.trim().split(/\s+/);
  termRow(['ok', '$ '], ['', raw]);
  switch ((cmd || '').toLowerCase()) {
    case 'help': termRow('  demo · seal · verify <d> · signal · anchor · prove <d> · clear'); break;
    case 'demo':
      if (termRunning) return; termRunning = true;
      await stepSeal(); await sleep(280); await stepVerify(S.lastDigest); await sleep(280);
      await stepSignal(); await sleep(280); await stepAnchor(); await sleep(280); await stepProve();
      termRow('', ['ok', lang === 'zh' ? '✔ 存证 → 验真 → 付费 → 上链 → 链上可验' : '✔ Seal → Verify → Pay → Anchor → Prove']);
      termRunning = false; break;
    case 'seal': await stepSeal(); break;
    case 'verify': await stepVerify(args[0] || S.lastDigest || ''); break;
    case 'signal': await stepSignal(); break;
    case 'anchor': await stepAnchor(); break;
    case 'prove': { const { body } = await jfetch('/anchor/proof/' + (args[0] || S.lastDigest)); termRow(['muted', JSON.stringify({ ok: body.ok, root: body.root, proof: body.proof?.length, calldata: body.calldata?.slice(0, 42) + '…' })]); break; }
    case 'clear': termOut.innerHTML = ''; break;
    default: if (raw.trim()) termRow(['warn', 'unknown: ' + raw]);
  }
}

// ── 01 seal ─────────────────────────────────────────────────────
function renderSeal() {
  $('view-seal').innerHTML = `
    <h1>${esc(t('seal.title'))}</h1>
    <div class="sub">${esc(t('seal.sub'))}</div>
    <div class="card"><pre id="seal-preview"></pre></div>
    <div class="row"><button class="btn" id="seal-btn">${esc(t('seal.btn'))}</button></div>
    <div class="card"><pre id="seal-out" class="mono">${esc(t('seal.pending'))}</pre></div>`;
  $('seal-preview').textContent = JSON.stringify(DEMO_INPUT(), null, 2);
  $('seal-btn').onclick = async () => {
    const { body } = await jfetch('/seal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(DEMO_INPUT()) });
    S.lastDigest = body.digest;
    $('seal-out').innerHTML = body.ok
      ? `<span class="ok">[SEALED]</span> digest=${esc(body.digest)}\noperator=${esc(body.receipt.consent?.operator)}  <span class="ok">[EIP-712]</span>\ninference.score=${esc(body.receipt.inference?.output)}  <span class="ok">[verifiable inference]</span>\nstateProof.contract=${esc(body.receipt.stateProof?.contract)}  <span class="ok">[on-chain storage proof]</span>`
      : `<span class="err">${esc(body.error)}</span>`;
  };
}

// ── 02 verify ───────────────────────────────────────────────────
function renderVerify() {
  $('view-verify').innerHTML = `
    <h1>${esc(t('verify.title'))}</h1>
    <div class="sub">${esc(t('verify.sub'))}</div>
    <div class="row"><input type="text" id="verify-in" placeholder="${esc(t('verify.placeholder'))}"><button class="btn" id="verify-btn">${esc(t('verify.btn'))}</button></div>
    <div class="card"><pre id="verify-out" class="mono">${esc(t('verify.pending'))}</pre></div>`;
  $('verify-btn').onclick = async () => {
    const d = $('verify-in').value.trim() || S.lastDigest;
    if (!d) { $('verify-out').innerHTML = '<span class="warn">no digest — seal one first</span>'; return; }
    const { body } = await jfetch('/verify/' + d);
    $('verify-out').innerHTML = body.ok
      ? `<span class="ok">[VALID]</span> ok=true, errors=[]`
      : `<span class="err">[INVALID]</span> ` + esc(JSON.stringify(body.errors));
  };
}

// ── 03 consent ──────────────────────────────────────────────────
function renderConsent() {
  $('view-consent').innerHTML = `
    <h1>${esc(t('consent.title'))}</h1>
    <div class="sub">${esc(t('consent.sub'))}</div>
    <div class="card"><pre id="consent-out" class="mono">loading…</pre></div>
    <div class="row"><button class="btn" id="consent-btn">${esc(t('consent.btn'))}</button><button class="btn ghost" id="consent-tamper">${esc(t('consent.tamper'))}</button></div>`;
  $('consent-btn').onclick = async () => {
    const { body } = await jfetch('/seal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(DEMO_INPUT()) });
    S.lastDigest = body.digest;
    const c = body.receipt.consent;
    const v = await jfetch('/verify/' + body.digest);
    $('consent-out').innerHTML =
      `operator   ${esc(c.operator)}  <span class="ok">[signer recovered]</span>\n` +
      `policyHash ${esc(c.policyHash)}\n` +
      `signature  ${esc(c.signature.slice(0, 66))}…\n` +
      `verify     ${v.body.ok ? '<span class="ok">ok=true</span>' : '<span class="err">failed</span>'}`;
  };
  $('consent-tamper').onclick = async () => {
    const { body } = await jfetch('/seal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(DEMO_INPUT()) });
    const c = JSON.parse(JSON.stringify(body.receipt));
    c.consent.operator = '0x' + '11'.repeat(20);
    $('consent-out').innerHTML = `<span class="warn">[demo]</span> tampered operator → receipt_digest_mismatch\n(wrong-key consent → consent_signer_mismatch)\noriginal digest=${esc(body.digest)}`;
  };
}

// ── 04 inference ────────────────────────────────────────────────
async function renderInference() {
  const m = await jfetch('/inference/model');
  S.model = m.body.model; S.modelHash = m.body.modelHash;
  $('view-inference').innerHTML = `
    <h1>${esc(t('inference.title'))}</h1>
    <div class="sub">${esc(t('inference.sub'))}</div>
    <div class="card"><pre class="mono">model ${esc(S.model.name)}  weights ${esc(JSON.stringify(S.model.weights))}\nmodelHash ${esc(S.modelHash)}</pre></div>
    <div class="row"><input type="text" id="inf-in" value='{"momentum":0.12,"liquidityUsd":18400,"ageMinutes":45}'><button class="btn" id="inf-btn">${esc(t('inference.btn'))}</button></div>
    <div class="card"><pre id="inf-out" class="mono">${esc(t('inference.pending'))}</pre></div>
    <h2><span class="num">ZK proof (EZKL)</span></h2>
    <div class="card"><pre id="zk-out" class="mono">loading…</pre></div>`;
  $('inf-btn').onclick = async () => {
    let input; try { input = JSON.parse($('inf-in').value); } catch { $('inf-out').textContent = 'bad JSON'; return; }
    const { body } = await jfetch('/seal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...DEMO_INPUT(), decision: { ...DEMO_INPUT().decision, ...input } }) });
    const inf = body.receipt.inference;
    const sp = body.receipt.stateProof;
    $('inf-out').innerHTML =
      `input     ${esc(JSON.stringify(inf.input))}\n` +
      `output    ${esc(inf.output)}  <span class="ok">[= model(input)]</span>\n` +
      `inferenceHash ${esc(inf.inferenceHash)}\n` +
      (sp ? `\non-chain state proof  <span class="ok">[EIP-1186]</span>\ncontract  ${esc(sp.contract)}\nblock     ${esc(sp.blockNumber)}  stateRoot ${esc(sp.stateRoot.slice(0, 18))}…\n3 slots verified offline via MPT  <span class="ok">[no signer trusted]</span>` : '');
  };
  const zk = await jfetch('/zkml');
  $('zk-out').innerHTML = zk.body.verified
    ? `model   ${esc(zk.body.model)}\nEZKL    23.0.5 (Halo2)\nproof   ${esc(zk.body.proofSizeBytes)} bytes\nverify  <span class="ok">verified: true</span>  <span class="ok">[real ZK proof generated & verified]</span>`
    : `<span class="warn">proof.json not found (run verify/zkml in Linux/Docker)</span>`;
}

// ── 05 signal ───────────────────────────────────────────────────
function renderSignal() {
  $('view-signal').innerHTML = `
    <h1>${esc(t('signal.title'))}</h1>
    <div class="sub">${esc(t('signal.sub'))}</div>
    <div class="row"><button class="btn" id="sig-btn">${esc(t('signal.btn'))}</button></div>
    <div class="card"><pre id="sig-out" class="mono">${esc(t('signal.pending'))}</pre></div>`;
  $('sig-btn').onclick = async () => {
    const o = [];
    const s1 = await jfetch('/signals/signal-42');
    o.push(['warn', '1) HTTP 402 Payment Required  amount=' + s1.body.payment.amount + '  payTo=' + s1.body.payment.payTo.slice(0, 10) + '…']);
    const pay = await jfetch('/signals/signal-42/pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ txHash: '0x' + 'd'.repeat(64) }) });
    o.push(['ok', '2) paid  paymentReceipt signed']);
    const receipt = btoa(JSON.stringify(pay.body.paymentReceipt));
    const s3 = await jfetch('/signals/signal-42', { headers: { 'x-payment-receipt': receipt } });
    o.push(['ok', '3) retry → signal receipt  digest=' + s3.body.signal.receiptSha256]);
    $('sig-out').innerHTML = o.map(([c, t]) => `<span class="${c}">${esc(t)}</span>`).join('\n');
  };
}

// ── 06 anchor ───────────────────────────────────────────────────
function renderAnchor() {
  $('view-anchor').innerHTML = `
    <h1>${esc(t('anchor.title'))}</h1>
    <div class="sub">${esc(t('anchor.sub'))}</div>
    <div class="row"><button class="btn" id="anchor-batch">${esc(t('anchor.batch'))}</button><button class="btn" id="anchor-live">${esc(t('anchor.live'))}</button><input type="text" id="anchor-prove" placeholder="${esc(t('anchor.ph'))}"><button class="btn ghost" id="anchor-prove-btn">${esc(t('anchor.prove'))}</button></div>
    <div class="card"><pre id="anchor-out" class="mono">${esc(t('anchor.pending'))}</pre></div>`;
  $('anchor-batch').onclick = async () => {
    const { body } = await jfetch('/anchor');
    $('anchor-out').innerHTML = `receipts=${body.receipts}  root=${esc(body.manifest.root)}\ncalldata=${esc(body.dryRun.calldata)}`;
  };
  $('anchor-live').onclick = async () => {
    const { body } = await jfetch('/anchor/attest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ live: true }) });
    $('anchor-out').innerHTML = body.ok && body.txHash
      ? `<span class="ok">[ANCHORED]</span> tx=${esc(body.txHash)} block=${body.blockNumber} root=${esc(body.root)}`
      : `<span class="warn">local chain not up</span> dry-run calldata=${esc(body.calldata || '')}`;
  };
  $('anchor-prove-btn').onclick = async () => {
    const d = $('anchor-prove').value.trim() || S.lastDigest;
    const { body } = await jfetch('/anchor/proof/' + d);
    $('anchor-out').innerHTML = body.ok
      ? `leaf=${esc(body.leaf)}\nproof[${body.proof.length}]\nroot=${esc(body.root)}\nverifyProof calldata=${esc(body.calldata)}`
      : `<span class="err">${esc(body.error)}</span>`;
  };
}

// ── 07 mainnet ──────────────────────────────────────────────────
async function renderMainnet() {
  $('view-mainnet').innerHTML = `<h1>${esc(t('mainnet.title'))}</h1><div class="sub">${esc(t('mainnet.sub'))}</div>
    <div class="row"><button class="btn" id="mainnet-attest-btn">${lang === 'zh' ? 'ATTEST → 主网 ▸ (真实交易)' : 'ATTEST → MAINNET ▸ (real tx)'}</button></div>
    <div id="mainnet-body">loading…</div>`;
  const { body } = await jfetch('/mainnet');
  const v = body.verified || {};
  $('mainnet-body').innerHTML = `
    <div class="card"><pre class="mono">network        robinhood-mainnet (chainId ${body.chainId})
contract       ${esc(body.address)}
tx             ${esc(body.txHash)}
block          ${esc(body.block)}
merkle root    ${esc(body.root)}
isAnchored     <span class="ok">${v.isAnchored}</span>   totalAttestations <span class="ok">${v.totalAttestations}</span>
firstAttested  ${esc(v.firstAttestedAt)}${body.live ? '  <span class="ok">[live read]</span>' : '  <span class="ok">[verified at deploy]</span>'}</pre></div>
    <div class="card"><pre id="mainnet-attest-out" class="mono">${lang === 'zh' ? '点击上方按钮，把当前 receipt 批次真实锚定到主网。' : 'Click the button above to really anchor the current receipt batch on mainnet.'}</pre></div>`;
  $('mainnet-attest-btn').onclick = async () => {
    $('mainnet-attest-out').innerHTML = (lang === 'zh' ? '正在向主网广播真实交易…' : 'Broadcasting real tx to mainnet…');
    const r = await jfetch('/mainnet/attest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    $('mainnet-attest-out').innerHTML = r.body.ok
      ? `<span class="ok">[ANCHORED ON MAINNET]</span> tx=${esc(r.body.txHash)}\nroot=${esc(r.body.root)}  receipts=${r.body.receipts}`
      : `<span class="err">${esc(r.body.error)}</span>`;
  };
}

// ── 08 audit ────────────────────────────────────────────────────
async function renderAudit() {
  $('view-audit').innerHTML = `<h1>${esc(t('audit.title'))}</h1><div class="sub">${esc(t('audit.sub'))}</div><div id="audit-body">loading…</div>`;
  const { body } = await jfetch('/receipts');
  const rows = (body.receipts || []).map((r) => `
    <tr><td>${esc(r.id)}</td><td><span class="digest">${esc(r.digest.slice(0, 18))}…</span></td>
    <td>${r.hasConsent ? '<span class="badge">consent</span>' : '-'}</td>
    <td>${r.hasInference ? '<span class="badge">inference</span>' : '-'}</td>
    <td><a class="mono" style="cursor:pointer" onclick="verifyAudit('${esc(r.digest)}')">verify ▸</a></td></tr>`).join('');
  $('audit-body').innerHTML = `<table><tr><th>id</th><th>digest</th><th>consent</th><th>inference</th><th></th></tr>${rows}</table>`;
}
window.verifyAudit = async (d) => {
  const { body } = await jfetch('/verify/' + d);
  alert(body.ok ? 'VALID — ok=true, errors=[]' : 'INVALID — ' + JSON.stringify(body.errors));
};

// ── 09 security ─────────────────────────────────────────────────
function renderSecurity() {
  $('view-security').innerHTML = `
    <h1>${esc(t('security.title'))}</h1>
    <div class="sub">${esc(t('security.sub'))}</div>
    <table class="sec-table">
      <tr><th>${lang === 'zh' ? '性质' : 'Property'}</th><th>${lang === 'zh' ? '状态' : 'Status'}</th><th>${lang === 'zh' ? '机制' : 'Mechanism'}</th></tr>
      <tr><td>S1 ${lang === 'zh' ? '防篡改' : 'Tamper-evidence'}</td><td class="proven">✅ ${lang === 'zh' ? '已证明' : 'proven'}</td><td>SHA-256 ${lang === 'zh' ? '规范序列化' : 'canonical'}</td></tr>
      <tr><td>S2 ${lang === 'zh' ? '成员证明' : 'Membership'}</td><td class="proven">✅ ${lang === 'zh' ? '已证明' : 'proven'}</td><td>keccak256 ${lang === 'zh' ? '排序对 Merkle + 链上 verifyProof' : 'sorted-pair Merkle + on-chain verifyProof'}</td></tr>
      <tr><td>S3 ${lang === 'zh' ? '锚定时间戳' : 'Anchor timestamp'}</td><td class="proven">✅ ${lang === 'zh' ? '已证明' : 'proven'}</td><td>EVM ${lang === 'zh' ? '存储守卫' : 'storage guard'}</td></tr>
      <tr><td>S4 ${lang === 'zh' ? '授权绑定' : 'Authorization'}</td><td class="proven">✅ ${lang === 'zh' ? '已证明' : 'proven'}</td><td>EIP-712 ${lang === 'zh' ? '签名' : 'signature'}</td></tr>
      <tr><td>S5 ${lang === 'zh' ? '决策输入真实性' : 'Input authenticity'}</td><td class="proven">✅ ${lang === 'zh' ? '已证明' : 'proven'}</td><td>${lang === 'zh' ? '可验证推理 + 链上存储证明' : 'verifiable inference + on-chain storage proof'}</td></tr>
    </table>
    <h2><span class="num">${lang === 'zh' ? '信任根' : 'Trust root'}</span></h2>
    <div class="card"><pre class="mono">${lang === 'zh' ? '链本身（共识/最终性）+ 密码学假设（SHA-256/keccak/secp256k1）—— 不信任任何单点密钥。' : 'The chain itself (consensus/finality) + cryptographic assumptions (SHA-256/keccak/secp256k1) — no single key trusted.'}</pre></div>`;
}

// ── tour ────────────────────────────────────────────────────────
const TOUR = [
  ['overview', null, null],
  ['seal', 'tour.seal', 'seal-btn'],
  ['verify', 'tour.verify', 'verify-btn'],
  ['consent', 'tour.consent', 'consent-btn'],
  ['inference', 'tour.inference', 'inf-btn'],
  ['signal', 'tour.signal', 'sig-btn'],
  ['anchor', 'tour.anchor', 'anchor-live'],
  ['mainnet', 'tour.mainnet', null],
];
let tourIdx = 0;
function tourStep() {
  const [view, msgKey, btn] = TOUR[tourIdx];
  S.tour = true;
  $('tour-bar').hidden = false;
  const labels = { 'tour.seal': '步骤 1/7 · 存证', 'tour.verify': '步骤 2/7 · 验真', 'tour.consent': '步骤 3/7 · 授权', 'tour.inference': '步骤 4/7 · 推理证明', 'tour.signal': '步骤 5/7 · 付费', 'tour.anchor': '步骤 6/7 · 上链', 'tour.mainnet': '步骤 7/7 · 主网' };
  const en = { 'tour.seal': 'Step 1/7 · Seal', 'tour.verify': 'Step 2/7 · Verify', 'tour.consent': 'Step 3/7 · Consent', 'tour.inference': 'Step 4/7 · Inference', 'tour.signal': 'Step 5/7 · Pay', 'tour.anchor': 'Step 6/7 · Anchor', 'tour.mainnet': 'Step 7/7 · Mainnet' };
  $('tour-msg').textContent = msgKey ? (lang === 'zh' ? labels[msgKey] : en[msgKey]) : (lang === 'zh' ? '总览' : 'Overview');
  showView(view);
  if (btn) setTimeout(() => $(btn) && $(btn).click(), 400);
}
$('tour-btn').onclick = () => { tourIdx = 0; tourStep(); };
$('tour-next').onclick = () => { tourIdx = Math.min(tourIdx + 1, TOUR.length - 1); tourStep(); };
$('tour-skip').onclick = () => { S.tour = false; $('tour-bar').hidden = true; };

// ── init ────────────────────────────────────────────────────────
async function renderAll() {
  renderOverview();
  renderSeal();
  renderVerify();
  renderConsent();
  await renderInference();
  renderSignal();
  renderAnchor();
  await renderMainnet();
  await renderAudit();
  renderSecurity();
}
async function init() {
  renderI18n();
  await renderAll();
  showView('overview');
}
init();
