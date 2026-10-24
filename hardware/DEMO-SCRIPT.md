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

## Part 3 — 钱包联动（2 分钟，最抓眼球）

**步骤 5**：拿起 OSKey 设备 → 输入 PIN 解锁 → 展示 **datamora.** 首页（黑底绿字）。
→ 台词："这是 datamora 的物理授权钥匙——私钥在设备里，永不进软件。"

**步骤 6**：Mac 终端运行签名器：

```bash
cd /Users/kayn/Desktop/datamora/datamora-attest
node hardware/sign-cli.mjs
```

终端会打印要签名的授权消息（人可读）：

```
datamora-attest consent v1
chain: 4663
operator: 0xf39fd6e5…2266
policy: 0xf35891fa…
agent: 0xe206b2fe…
expires: 0
nonce: 1
```

→ 台词："网页上那笔授权，真正的签署者是这把设备。"

**步骤 7（A 或 B 二选一）**：

**A. 真机签名（有官方 host app 时）**：
1. 启动官方前端：`git clone https://github.com/butterfly-community/oskey-app-monorepo && cd oskey-app-monorepo && pnpm install && pnpm run dev`（Web 串口）。
2. 浏览器连设备（WebSerial）→ Message signing → 粘贴步骤 6 的消息 → 设备屏幕显示消息 → **点确认签名**。
3. 复制返回的签名。

**B. 演示路径（最快，无 host app）**：
1. 用 demo 密钥生成对应签名（终端再开一个窗口）：

```bash
cd /Users/kayn/Desktop/datamora/datamora-attest
node --input-type=module -e '
import { createHash } from "node:crypto";
import { buildSignRequest } from "./hardware/bridge.mjs";
import { signHardware } from "./hardware/consent.mjs";
import { DEMO_OPERATOR, DEMO_OPERATOR_KEY } from "./lib/consent.mjs";
const sha = (s) => "0x" + createHash("sha256").update(s).digest("hex");
const req = buildSignRequest({ operator: DEMO_OPERATOR, policyHash: sha("policy:buy-limited-v1"), agentCodeHash: sha("agent:flash-v1"), chainId: 4663, nonce: 1 });
process.stdout.write(await signHardware(req.message, DEMO_OPERATOR_KEY));
' > /tmp/sig.txt && echo "签名: $(head -c 20 /tmp/sig.txt)…"
```
2. 台词："这台设备里存的是 operator 私钥（demo 环境用同密钥演示验签链路）。"

**步骤 8**：回到 sign-cli.mjs 窗口，粘贴签名：

```bash
cat /tmp/sig.txt | node hardware/sign-cli.mjs
```

→ 输出：

```
recovered operator : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
expected operator  : 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
匹配               : ✅ PASS
```

→ 台词："签名恢复出的 operator 就是设备地址——**授权来自这把钥匙**。"
→ 若篡改消息再验（`node hardware/sign-cli.mjs` 输入非该 operator 的签名）→ 不匹配 → "密码学上不可伪造"。

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
