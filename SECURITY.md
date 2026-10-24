# SECURITY.md — Datamora Attest 安全模型

本文件诚实标注：哪些性质**已被证明**，哪些目前**只是断言**。科学性的体现不是"用了区块链所以安全"，而是"说清楚在什么前提下成立、什么前提下不成立"。

## 1. 威胁模型

- **保护对象**：Agent 执行记录的完整性、操作者授权的可证明性、链上锚定时间戳的不可篡改性。
- **对手假设**：能够篡改/重放/伪造 receipt 存储的任意方（服务器运营者、恶意 Agent、第三方存储）。**我们不假设存储是诚实的。**
- **不防御**：操作者签了之后反悔（我们证明"谁授权了"，不证明"授权得是否明智"）, 超出 L2 自身保证的重组。

## 2. 安全性质（每条：论证 + 反例测试）

### S1 · 防篡改（tamper-evidence）— ✅ 已证明
- **性质**：receipt 内容任何一处改动都会改变 `receiptSha256`。
- **论证**：SHA-256 规范序列化（递归键排序），哈希碰撞难度。
- **反例测试**：`test.mjs` 改一个字段 → `policy_hash_mismatch` / `receipt_digest_mismatch`。
- **前提**：SHA-256 抗碰撞。

### S2 · 批次成员证明（batch membership）— ✅ 已证明
- **性质**：某 receipt 属于某锚定 Merkle root，当且仅当存在有效证明。
- **论证**：keccak256 排序对 Merkle（补齐 2 的幂），`AttestationAnchor.verifyProof` 链上实跑。
- **反例测试**：`test.mjs` proof 验证/拒绝 + `npm run local:demo` 链上 `verifyProof = true`。

### S3 · 锚定时间戳不可篡改 — ✅ 已证明
- **性质**：`firstAttestedAt[root]` 只写一次、永不覆盖；`isAnchored` 一旦为真永久为真。
- **论证**：EVM 存储语义 + `if (firstAttestedAt[root]==0)` 守卫。
- **反例测试**：`local:demo` 重复锚定只累加计数，不覆盖首次时间戳。
- **前提**：L2 最终性。

### S4 · 授权绑定（authorization binding）— ✅ 已证明（此前为断言）
- **性质**：授权该 policy 的操作者地址被密码学唯一确定。
- **论证**：EIP-712 签名覆盖 `(operator, policyHash, agentCodeHash, chainId, expiresAt, nonce)`，验签恢复出的 signer 必须等于 `operator`。
- **反例测试**：`test.mjs` —— 正确签名恢复 operator；**另一把私钥签的 consent 被 `consent_signer_mismatch` 拒绝**；policy 不匹配在 seal 阶段即拒绝。
- **前提**：secp256k1 ECDSA 不可伪造。

### S5 · 决策输入真实性（decision-input authenticity）— ✅ 完全证明（信任根：链本身）

S5 拆成两个子命题，二者都已覆盖：

**S5a · 计算完整性**（✅ 已证明）
- **性质**：`output` 确实是 `model(input)` 忠实算出的，Agent 没在算数上作弊。
- **论证**：`lib/inference.mjs` 确定性可验证推理（模型公开、`modelHash` 提交、`output===runModel(input)` 可复算）；简洁 ZK 证明走 EZKL（`verify/zkml/`，已实测 `verified: true`）。

**S5b · 数据来源真实性**（✅ 已证明，信任根：链本身，无需任何签名数据源）
- **性质**：`input` 不是 Agent 自报，而是来自**链上真实状态**。
- **论证**：`lib/stateproof.mjs` + `lib/mpt.mjs` —— receipt 的 `stateProof` 携带 EIP-1186 `eth_getProof` 存储证明，`verify` 用自实现的 **Ethereum Merkle-Patricia-Trie 验证器**离线核对：账户证明对上区块 `stateRoot` → 取 `storageHash` → 三个 storage slot（momentumBips / liquidityUsd / ageMinutes）的证明对上 `storageHash` → 推导出的输入必须与 `inference.input` 完全一致。
- **反例测试**：`test.mjs` —— 真实 `eth_getProof` 样本离线验真通过；**篡改 storage proof → 拒绝**；**input 与链上值不一致 → `stateproof_input_mismatch`**。
- **信任根**：从"签名源密钥诚实"降级为"`stateRoot` 属于某个规范区块"——即链自身的共识/最终性（区块哈希承诺了 stateRoot）。**不再需要信任任何预言机/数据源密钥。**
- **边界（诚实标注）**：demo 用一个 `MarketState` 合约充当"该 token 的链上状态"；生产应替换为 token 实际链上状态（如池子 reserves、创建区块时间戳），证明机制不变。

> 一句话：Agent 既不能在**算数**上作弊（S5a），也不能在**喂数据**上作弊（S5b）——除非它能改写整条链的状态根。

## 3. 已证明 vs 断言（速查）

| 性质 | 状态 |
|---|---|
| S1 防篡改 | ✅ 已证明 |
| S2 成员证明 | ✅ 已证明 |
| S3 锚定时间戳 | ✅ 已证明 |
| S4 授权绑定（EIP-712） | ✅ 已证明 |
| S5 决策输入真实性（计算 + 链上来源） | ✅ 已证明（信任根：链本身） |

此外：`executedAt` / `status` 由服务端填写（信任边界）；`txHash` / `chainId` / `token` 可链上核对（强）。

## 4. 密码学假设

- SHA-256 与 Keccak-256 抗碰撞
- secp256k1 ECDSA 不可伪造
- Robinhood Chain（Arbitrum Orbit L2）最终性
- 验证方运行本仓库开源的 canonical/merkle/consent 代码（含 Python 跨语言参考实现）

## 5. 已知边界 / 明确不做

- Agent 对输入的诚实性 —— **已由 S5b 链上存储证明覆盖**（信任根：链本身）
- policy 的"语义正确性"（治理问题，非密码学问题）
- L2 重组风险
- **demo 操作者私钥是公开的 Hardhat 开发密钥，真实部署必须换成真实操作者密钥**
