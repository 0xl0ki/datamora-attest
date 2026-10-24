# 刷机手册 — Datamora 主题 OSKey 固件

固件已从源码编译成功（`BUILD_EXIT=0`），datamora 主题（黑底 + `#CAF99C` 绿）已烧进二进制。

## 产物

| 文件 | 大小 | 用途 |
|---|---|---|
| `firmware/oskey-datamora-theme.bin` | 700 KB | 可刷写镜像（app） |
| `firmware/oskey-datamora-theme.elf` | 6.4 MB | 调试符号（可选） |

## 刷机（二选一）

### 方式 A：west flash（推荐，自动处理 bootloader + 分区表 + app）

```sh
# 1. 用 USB 线把 ESP32-E 2.8" 板子接到 Mac
# 2. 找到串口
ls /dev/cu.usbserial-* /dev/cu.SLAB_USBtoUART 2>/dev/null

# 3. 加载环境 + 刷入
cd ~/zephyr/oskey-ws/oskey
source ~/zephyr/.venv/bin/activate
source ~/zephyr/oskey-ws/zephyr/zephyr-env.sh
source /Users/kayn/export-esp.sh
west flash -d build/oskey
```

### 方式 B：esptool 直接刷 app（如果你只想刷 app 分区）

```sh
esptool.py --chip esp32 --port /dev/cu.usbserial-XXXX --baud 921600 \
  write_flash 0x10000 firmware/oskey-datamora-theme.bin
```

> 注意：方式 B 只刷 app。若板子之前没有 Zephyr 的 bootloader/分区表，请用方式 A（west flash 会一并处理）。

## 刷完验证

1. 板子重启，屏幕应显示**黑底 + `#CAF99C` 绿**的 OSKey 界面（不再是白/蓝）。
2. 首次启动走 OSKey 初始化：设 PIN → 建/导钱包。

## 重要安全提醒

- **刷机会清掉设备上现有的钱包数据**。如果板子上有旧钱包，先备份助记词。
- 刷完用**全新 demo 钱包**，绝不用带真钱的钱包。

## 复现编译（如需改色后重编）

完整工具链已装在 Mac（`~/zephyr/`）：

- Rust 1.99.1 + esp-rs Xtensa 1.97（`source ~/.cargo/env` + `source /Users/kayn/export-esp.sh`）
- Zephyr SDK 1.0.1（`~/zephyr/sdk/zephyr-sdk-1.0.1`）
- west 工作区（`~/zephyr/oskey-ws/`）
- 主题脚本：`theme-apply.sh`（改 `src/display/*.c` 色值）

## 两个必须的坑（不设会启动崩溃 / 刷机失败）

1. **主线程栈太小会启动崩溃**：OSKey 的 Kconfig 只在 NXP/benchmark 才设大栈，普通
   `STORAGE+DISPLAY` 构建 `CONFIG_MAIN_STACK_SIZE` 落到 Zephyr 默认 2048（2KB），
   启动即 `Stack overflow on CPU 0`。**必须加 `-DCONFIG_MAIN_STACK_SIZE=16384`**。

2. **921600 波特率刷不进**：CH340/CP2102 USB 串口芯片扛不住 921600，报
   `Unable to verify flash chip connection`。**用 `--baud 115200` 刷**。

改色后重编（含两个坑的修复）：

```sh
cd ~/zephyr/oskey-ws/oskey
# 改 src/display/*.c 里的 lv_color_hex 色值，然后：
export SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.sdk
export ZEPHYR_SDK_INSTALL_DIR=$HOME/zephyr/sdk/zephyr-sdk-1.0.1
source ~/.cargo/env
source ~/zephyr/.venv/bin/activate
source ~/zephyr/oskey-ws/zephyr/zephyr-env.sh
source /Users/kayn/export-esp.sh
west build -p always -b esp32_devkitc/esp32/procpu -d build/oskey \
  -- -DCONFIG_OSKEY_STORAGE=y -DCONFIG_OSKEY_DISPLAY=y \
  -DCONFIG_MAIN_STACK_SIZE=16384 \
  -DCONFIG_LV_Z_VDB_SIZE=24 -DCONFIG_LV_Z_DOUBLE_VDB=y \
  -DCONFIG_LV_Z_FLUSH_THREAD=y -DCONFIG_LV_Z_FLUSH_THREAD_STACK_SIZE=4096 \
  -DEXTRA_DTC_OVERLAY_FILE="$(pwd)/boards/esp32_32e_2.8_led_display_st7789.overlay"
```
（最终配置：无 SMP/无 PSRAM/无调试日志；SMP 与 PSRAM 均实验过——SMP 导致黑屏、板子为 WROOM 无 PSRAM，均已回退）