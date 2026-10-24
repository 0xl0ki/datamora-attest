# zkML 升级路径（EZKL）

当前 `lib/inference.mjs` 提供的是**确定性可验证推理**：模型公开、输入可见、任何人可复算 `output === runModel(input)` 并核对 `inferenceHash`。这关闭了 S5 的"Agent 自报数字"漏洞，但**不是零知识**（模型与输入不隐藏，证明也不简洁、不能直接上链验证）。

升级到简洁零知识证明用 [EZKL](https://github.com/zkonduit/ezkl)：同一模型导出为 ONNX，EZKL 编译成 Halo2 电路，产出可在链上验证的紧凑证明。

## 为什么现在不能在本机跑

EZKL 最新版（v23.x）**没有 macOS arm64 二进制**（只有 Linux / Windows），pip 的 Python 绑定在这台 Mac 上 `dlopen` 失败（架构/签名不匹配）。所以真实证明需在 Linux 或 Docker 里跑。逻辑已留好：receipt 的 `inference` 对象预留 `zkProof` 字段，拿到证明后塞进去即可，其余不变。

## 模型（与 lib/inference.mjs 完全一致）

```
score = sigmoid( 0.0 + 2.5*momentum + 0.8*log1p(liquidityUsd/1e3) - 0.05*(ageMinutes/100) )
```
3 输入 → 1 输出，固定权重 `[0.0, 2.5, 0.8, -0.05]`，模型名 `datamora-entry-score-v1`。

## 在 Docker / Linux 里跑完整证明

```bash
# 1. 导出 ONNX（任何能写 ONNX 的工具；下面用 python）
pip install onnx torch
python3 export_model.py            # 产出 model.onnx

# 2. 准备输入样例（与 receipt 里 decision 一致）
cat > input.json <<'JSON'
{"input_data": [[0.12, 18400.0, 45.0]]}
JSON

# 3. EZKL 流程（ezkl 二进制）
ezkl gen-srs --k 17 --bits 16 -o kzg.srs
ezkl calibrate-settings --model model.onnx --data input.json --target accuracy
ezkl compile-circuit --model model.onnx --settings settings.json --compiled-circuit network.ezkl
ezkl gen-witness --model model.onnx --data input.json --compiled-circuit network.ezkl --output witness.json
ezkl setup --model model.onnx --compiled-circuit network.ezkl --srs kzg.srs --vk vk.json --pk pk.json
ezkl prove --witness witness.json --pk pk.json --compiled-circuit network.ezkl --proof proof.json --srs kzg.srs --model model.onnx
ezkl verify --proof proof.json --vk vk.json --settings settings.json
# 通过后，把 proof.json 内容放入 receipt.inference.zkProof 即可
```

产出：`proof.json`（证明）、`vk.json`（验证钥）。链上验证用 EZKL 的 Halo2 验证器合约（`ezkl create-evm-verifier`）。

## 落地到 receipt

```js
// 现在（确定性可验证）
inference: { model, modelHash, input, output, inferenceHash }

// 将来（EZKL 证明后追加）
inference: { model, modelHash, input, output, inferenceHash, zkProof: <proof.json 内容>, vk: <vk.json> }
```
`verify` 已按现有字段校验；`zkProof` 出现时，链上验证器接管"输入→输出"的证明。
