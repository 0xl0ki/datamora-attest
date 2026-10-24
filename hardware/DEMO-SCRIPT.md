# Datamora Attest — 现场演示脚本（含钱包联动）

## 准备（开场前）

1. VM 已开机，`datamora-attest-server` 服务运行中（浏览器打开 **http://127.0.0.1:9292** 备用）。
2. OSKey 设备插在 Mac USB 上，已初始化（datamora 主题 + demo 钱包，PIN 自己设的）。
3. Mac 终端备用（跑 sign-cli.mjs）。

---

## 开场白（30 秒）

> AI Agent 正在自主管钱。但它做了一笔交易，你凭什么信"它做对了、是主人授权的"？
> Datamora Attest 把 Agent 的每次执行打包成一条**自验证 receipt**：授权（EIP-712）、推理（EZKL）、链上数据（EIP-1186）、锚定（Merkle→Robinhood 主网），而且**用这把物理钥匙授权**（举起 OSKey）。

---

## Part 1 — VM 网站核心演示（2 分钟）

**步骤 1**：VM 浏览器打开 `http://127.0.0.1:9292`
→ 终端风格工作台，左侧 9 个视图。

**步骤 2**：终端输入 `demo` 回车
→ 自动跑 7 步导览（seal → verify → consent → inference → signal → anchor → mainnet），每步展示各视图。
→ 讲解台词："一次 seal 生成 receipt；verify 演示篡改检测；anchor 把 receipt 折成 Merkle root 锚定上链。"

**步骤 3（手动补两个重点）**：

- **篡改检测**：侧边栏 → `02 验真` → 拿一条 receipt 的 digest，改一个字符 → verify 报错 → 说"改一个字节，证明就失效"。
- **授权绑定**：侧边栏 → `03 授权` → 展示 EIP-712 签名数据（operator + policyHash）→ 说"操作者签名绑定了策略和 Agent 代码"。

---

## Part 2 — 主网真锚定（30 秒）

**步骤 4**：侧边栏 → `07 主网`
→ 卡片显示已部署的 `AttestationAnchor`（chainId 4663，合约 `0x77aD…b7f9`，区块 95974943）。
→ 点 **`ATTEST → 主网 ▸ (真实交易)`** 按钮。
→ 下方出现 `tx=0x…` + `root=0x…`（**真实主网交易**，deployer 钱包余额够发 20+ 次）。
→ 台词："这不是本地链，是往 Robinhood Chain 主网发的一笔真交易。"

---

## Part 3 — 钱包联动（1 分钟，一条龙，全在网页里）

**步骤 5**：拿起 OSKey 设备 → PIN 解锁 → 展示 **datamora.** 首页（黑底绿字）放在评委面前。
→ 台词："这是 datamora 的物理授权钥匙——私钥在设备里，永不进软件。"

**步骤 6（一条龙，一个按钮）**：回到 VM 网页 → 侧边栏 `03 授权` → 往下滚到**「硬件授权（OSKey · datamora 固件）」**卡片 → 点 **`一键演示 ▸ 设备签名授权`**。

→ 网页立刻展示完整链路：

```
device     OSKey · datamora firmware

datamora-attest consent v1
chain: 4663
operator: 0xf39fd6e5…2266
policy: 0xf35891fa…
agent: 0xe206b2fe…

signature  0x9935fc47…
recovered  0xf39Fd6e5…2266  [match ✓]
```

→ 台词："网页生成的授权请求，设备安全芯片签名，验签恢复出 operator = 设备地址——**授权来自这把钥匙**。"

**步骤 7（进阶，可选）**：真机签名路径——官方 host app（oskey-app-monorepo，Web 串口）连设备，Message signing 粘贴网页上的消息，设备屏幕确认签名，把真签名贴回 `/consent/hardware` 的验签流程。演示路径（步骤 6）与真机路径共用同一套消息格式与验签代码。

---

## 收尾（30 秒）

> 从一条 receipt 到主网锚定，再到物理钥匙授权——Datamora Attest 让 Agent 的每一次行动**可验证、可授权、可追责**。
> 代码开源：github.com/0xl0ki/datamora-attest；固件 fork：github.com/0xl0ki/oskey-firmware-datamora（MPL-2.0）。

---

## 备用：纯 API 演示（UI 出问题时用）

```bash
# seal 一条 receipt
curl -s -X POST http://127.0.0.1:9292/seal -H 'content-type: application/json' -d '{"policy":"buy-limited-v1","params":{"token":"0xabc"}}'

# 主网真实锚定
curl -s -X POST http://127.0.0.1:9292/mainnet/attest -H 'content-type: application/json' -d '{}'
```
