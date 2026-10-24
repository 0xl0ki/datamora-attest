# 主网部署交代（教你怎么做）

## 结论先行：主网只需要部署 **1 个合约**

| 组件 | 需要上主网吗 | 说明 |
|---|---|---|
| **AttestationAnchor** | ✅ **唯一需要** | 链上锚点：存 Merkle root + 时间戳，`verifyProof`/`verifyReceipt` 链上验真 |
| consent（EIP-712 授权） | ❌ | 纯链下签名，无合约 |
| inference（可验证推理） | ❌ | 纯链下计算 |
| stateProof（数据来源） | ❌ | 读链上**已有**状态（生产读真实池子，不部署你自己的） |
| x402 付费信号 | ❌ | demo 是模拟支付；生产用链上原生转账，无专属合约 |
| zkML（EZKL 证明） | ⚠️ 可选 | 默认离线验证；要做"链上验 ZK"才需部署 EZKL 的 Halo2 verifier（高级，demo 不需要） |

**所以：你只需要部署 `AttestationAnchor.sol` 到 Robinhood Chain 主网（chainId 4663），别的都不用。**

## 部署到哪里

- 链：Robinhood Chain mainnet，chainId **4663**
- RPC：`https://rpc.mainnet.chain.robinhood.com`
- 浏览器：Robinhood Chain 的 Blockscout 区块浏览器（查 tx 用）

## 部署步骤（一条命令）

1. **准备钱包**：一个在 Robinhood Chain 上有少量 **ETH**（付 gas）的钱包地址 + 私钥。L2 gas 很便宜。
2. **别用 demo 私钥**：`deploy.mjs` 里的默认 key 是 Hardhat 开发密钥，主网必须传自己的 `PRIVATE_KEY`。
3. **跑部署 + 一笔真实锚定**（用专门的主网脚本，不影响本地 demo）：

```bash
cd /root/datamora-attest
RPC_URL=https://rpc.mainnet.chain.robinhood.com \
PRIVATE_KEY=0x你的私钥 \
node scripts/deploy-mainnet.mjs
```

它会：编译 → 部署 `AttestationAnchor` → 封存 3 条 receipt 折成 Merkle root → **跑一笔真实 `attest(root)`** → 把地址/tx hash/block 存到 `data/deployment-mainnet.json` 并打印：

```
deployed AttestationAnchor @ 0x…  (chainId 4663)
attested root 0x…
tx 0x… (block …)
```

## 现场怎么用

- **主方案（现场）**：本地链，`systemctl` 已配好，开 `http://127.0.0.1:9292` 演示，`ATTEST (LIVE)` 真发交易——零风险、不赌网络。
- **主网旁证（加分）**：赛前跑上面那条命令，把 `deployed @ 0x…` + `tx 0x…` + Blockscout 链接**截图放进 PPT**。现场说一句："我们的锚点合约已在 Robinhood Chain 主网部署，这是真实锚定交易的区块浏览器记录。"——本地 demo 继续照走，主网那条只是证明"真的能上主网"。

## 常见坑

1. **私钥泄露**：`PRIVATE_KEY` 只放环境变量，绝不进 git/仓库/截图。
2. **gas 不足**：先确认钱包在 Robinhood Chain 有 ETH；没有就用桥（Arbitrum Orbit 官方桥）从 ETH 主网桥一点过去。
3. **别覆盖本地 deployment.json**：主网脚本写的是 `deployment-mainnet.json`，本地 demo 用的 `deployment.json` 不受影响。
4. **stateProof 的主网语义**：demo 里 `MarketState` 是"链上状态"的替身；主网真要严谨，就把 stateProof 指向**真实池子的 reserves/创建区块**，机制完全不变（见 SECURITY.md S5b）。
