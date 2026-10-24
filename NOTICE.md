# NOTICE — 版权与致谢 / Attribution

## 设备固件（hardware/）

Datamora Attest 的硬件演示固件基于 **[butterfly-community/oskey-firmware](https://github.com/butterfly-community/oskey-firmware)**，遵循其原许可证 **Mozilla Public License 2.0（MPL-2.0）**。

我们对固件源码做了以下修改（被修改的文件保留原有 `SPDX-License-Identifier: MPL-2.0` 头）：

| # | 修改 | 说明 |
|---|---|---|
| 1 | **Datamora 主题** | UI 配色改为 `#CAF99C` 绿 + `#0A0A0A` 黑（原为蓝强调色） |
| 2 | **品牌文案** | 用户可见的 "OSKey" → "datamora."（UI 文案、USB 产品名 "datamora key"、蓝牙名、WiFi AP "datamora-AP"、主机名） |
| 3 | **Logo** | 开机 splash 的钱包图标 → Datamora 2×2 mark |
| 4 | **触摸修复（bug fix）** | XPT2046 IRQ 引脚 `gpio1 36` → `gpio1 4`（GPIO36 的 gpio1 偏移编号），并补 `GPIO_PULL_UP` |
| 5 | **启动修复（bug fix）** | `CONFIG_MAIN_STACK_SIZE` 2048 → 16384（修复启动栈溢出崩溃） |
| 6 | **性能** | LVGL VDB 10→24 行、双缓冲、独立刷屏线程（经典 ESP32 无 PSRAM 下的最优配置） |

MPL-2.0 合规要点：

- 固件的**被修改文件**保持原 MPL-2.0 许可证头；未被修改的文件保持原状。
- 若分发修改后的固件二进制（如 `firmware/oskey-datamora-theme.bin`），须按 MPL-2.0 第 3.2 节**向接收者提供修改后的源码**（已公开：**[github.com/0xl0ki/oskey-firmware-datamora](https://github.com/0xl0ki/oskey-firmware-datamora)**）。
- 内部标识符（`CONFIG_OSKEY_*`、`oskey_*` 等）**有意保留**，以保证溯源可审计与 patch 系统兼容。

## 其余代码

`lib/`、`server.mjs`、`contracts/`、`public/` 等为 Datamora Attest 原创代码，MIT 许可证（见 [LICENSE](LICENSE)）。

## 第三方组件

- **EZKL**（`verify/zkml/`）：zkML 证明工具链，用于生成/验证 Halo2 推理证明。
- **ethers.js / solc / ganache**：本地部署与验证路径的开发依赖。
- **Tabler 图标集**（`hardware/` 文档引用）：OSKey 资产自带 `LICENSE.tabler`。
