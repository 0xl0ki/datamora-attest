# Datamora Attest — 链上自主 Agent 的可验证执行存证

> ETH Shenzhen 2026 Hackathon 提交项目（方向：01 Agent 与机器经济 / 03 可验证 AI）

当 AI Agent 在链上自主花钱时，别人凭什么信它「做了这件事、用了这份代码、在经授权的策略下执行」？
Datamora Attest 把一次 Agent 执行封装成一份**自验证、内容寻址的 receipt**，并可批量聚合为 Merkle root **一笔 tx 锚定上链**；信号侧走 **x402 按次付费**，付完拿到的是可验证的信号 receipt。全程零运行时依赖，第三方无需信任中心化注册表即可离线复算验真。

## 一句话

让自主 Agent 的每一次链上决策**可验证、可授权、可追责**。

## 能力矩阵

| 能力 | 实现 | 端点 |
|---|---|---|
| 执行存证 | `agent-execution-receipt-v1` schema，策略原文内嵌 + `policyHash` + 输入指纹 + 链上状态，自验证 | `POST /seal`、`GET /verify/:digest` |
| 授权绑定 | **EIP-712 签名**：操作者签 `(operator, policyHash, agentCodeHash, …)`，验签恢复 signer==operator | `GET /consent/operator` |
| 推理证明 | **确定性可验证推理**（S5a）+ **EIP-1186 链上存储证明**（S5b，自实现 MPT 验证器）；EZKL 路径见 `verify/zkml/` | `GET /inference/model` |
| 链上锚定 | keccak256 排序对 Merkle 聚合 + `AttestationAnchor` 合约 + ABI calldata | `GET /anchor`、`POST /anchor/attest` |
| 链上验真 | 单条 receipt 的成员证明，合约 `verifyProof` / `verifyReceipt` 可直接验 | `GET /anchor/proof/:digest` |
| x402 付费信号 | HTTP 402 付款要求 → 付款回执（HMAC 签名）→ 携回执重试 → 可验证信号 | `GET /signals/:id`、`POST /signals/:id/pay` |
| 审计流水 | 全部回执列表 + 单条验真 | `GET /receipts` |
| 跨语言验真 | Python 参考实现，与 Node 同 digest | `verify/py/canonical.py`、`test-cross-lang.sh` |
| 可视化 | 多视图工作台 + 终端对话 + 一键演示导览 | `GET /` |

> 安全模型与"已证明 vs 断言"边界见 [SECURITY.md](SECURITY.md)；与 TraceQuay / riftmark 的定位差异见 [docs/POSITIONING.md](docs/POSITIONING.md)。

## 硬件授权（OSKey → Datamora 定制固件）

S4 授权的**生产级形态**：操作者用一把**物理硬件钥匙**（ESP32 + 2.8" ST7789，基于 [OSKey](https://github.com/butterfly-community/oskey-firmware)，MPL-2.0）签署 EIP-191 授权消息——私钥永不出设备。设备固件已定制：Datamora 主题、品牌文案、Logo、触摸/启动修复与渲染优化。详见 [hardware/README.md](hardware/README.md) 与 [NOTICE.md](NOTICE.md)（版权与致谢、MPL-2.0 合规）。

- 硬件签名桥：`hardware/bridge.mjs` + `hardware/consent.mjs`（签名/恢复/篡改检测已实测）
- 签名器 CLI：`hardware/sign-cli.mjs`（打印授权消息 → 设备签名 → 贴回验证）
- 定制固件：`hardware/firmware/oskey-datamora-theme.bin`（已编译，含全部定制）

## 关键技术栈

- Node.js ≥ 22（v24 验证）；**运行时零依赖**（仅 `node:crypto`/`node:http`/`node:fs`；live 锚定路径按需懒加载 ethers）
- 自实现 **Keccak-256**（EVM 原生，含已知测试向量校验）+ SHA-256 规范序列化
- Solidity `AttestationAnchor`（^0.8.20，solc 0.8.20 编译，本地 ganache 已验证部署+链上验真）
- Python 3 参考实现（跨语言 canonical）
- 目标链：**Robinhood Chain mainnet**（chainId `4663`，Arbitrum Orbit 系 Ethereum L2，Uniswap v4 / Universal Router）

## 运行方式

```bash
git clone <repo> && cd datamora-attest
npm install               # 仅本地部署/编译用（solc/ethers/ganache）；运行时零依赖

node test.mjs            # 33 项自测：receipt 完整性/篡改、EIP-712 授权、推理证明、链上存储证明、keccak 向量、merkle、x402、calldata
./test-cross-lang.sh     # Node 与 Python 的 canonical digest 一致性
node seed.mjs            # 造 3 条 demo receipt 供 UI/锚定演示
node server.mjs          # http://127.0.0.1:8787 （浏览器打开 /）
```

### 本地部署（浏览器里看真上链）

一条命令跑通完整 in-process 流程（编译 → 起链 → 部署 → 锚定 → 链上验真）：

```bash
npm run local:demo
```

要看常驻本地链 + 让 UI 的 `ATTEST (LIVE)` 真发交易：

```bash
npm run local:node   # 终端 1：本地 EVM http://127.0.0.1:8545 (chainId 4663)
npm run deploy       # 终端 2：编译 + 部署，写 data/deployment.json
npm start            # 终端 3：起 server（自动读 deployment.json 接本地链）
# 浏览器打开 http://127.0.0.1:8787 → 04 面板点 "ATTEST (LIVE local)"
```

本地链用固定 mnemonic（Hardhat 默认），account[0] = `0xf39F…92266`，私钥 `0xac0974…ff80`（仅本地开发用，切勿用于真实网络）。



### 现场演示路径（推荐顺序）

1. 打开 `/`，展示霓虹终端 dashboard；
2. **01 封存**：点 `SEAL` → 得到 receiptSha256；
3. **02 验证**：粘贴 digest → `{ ok:true }`；再演示篡改被 `policy_hash_mismatch` 检出；
4. **03 x402 信号**：点 `REQUEST SIGNAL` → 先收到 HTTP 402 付款要求 → 模拟支付 → 携回执重试 → 拿到信号 receipt → 自动验证 `{ ok:true }`；
5. **04 锚定**：`BUILD BATCH` 看 Merkle root 与 `0x23c3617f…` calldata；`ATTEST (dry-run)` 展示上链交易载荷；
6. **04 验真**：粘贴某条 digest 点 `PROVE` → 得到 `leaf + proof + root + verifyProof calldata`，展示链上可证成员关系。

### 真实上链（可选）

```bash
# 部署到任意 RPC（含真实 Robinhood Chain）
RPC_URL=https://rpc.mainnet.chain.robinhood.com PRIVATE_KEY=0x… npm run deploy
# 部署后 server 会自动读 data/deployment.json 的地址与 rpcUrl
# 再用 POST /anchor/attest  body: {"live":true} 发真实锚定交易
```

## 新增功能与赛期增量说明（迭代声明）

本项目基于已有私有系统 **datamora**（生产运行中的链上交易 Agent + 研究实验室）迭代，赛期内（2026-09-30 起）将其中**执行存证/授权/链上结算**能力抽取并公开化为独立产品。赛期内新增/沉淀：

- **执行存证层**（本仓库核心）：`agent-execution-receipt-v1` schema + 自验证 seal/verify + 公开验证端点（赛期内新开发）
- **链上锚定**：keccak256 Merkle 聚合 + `AttestationAnchor.sol` + calldata 编码（赛期内新开发）
- **x402 付费信号**：402 付款要求 + 签名付款回执 + 可验证信号（赛期内新开发）
- **跨语言验真**：Python canonical 参考实现 + 一致性测试（赛期内新开发）
- 上游复用自赛期内增量：personal-agent v1（2026-10-10）、radar feed（2026-10-11）、radar 策略哈希与 freshness 修复（2026-10-20，生产 commit `125b573`）中的 `radarPolicyDigest` / `agent-cancellation-proof-v1` 语义
- 非赛期存量（仅作上游数据来源，不作为本项目主体提交）：lab 研究引擎（20260929 release）与历史回测

本项目**不以盈利表现作为卖点**；demo 只读展示，不操作真实资金。

## Roadmap

1. x402 真实链上付款校验（`RPC_URL` + 收款合约），替换 demo 模拟支付
2. 更多语言的 canonical 参考实现（Rust/Go）
3. 已部署的 `AttestationAnchor` 地址 + 浏览器一键调用 `verifyReceipt`（连钱包）
