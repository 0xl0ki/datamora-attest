# Flash OSKey for the ESP32-E 2.8" ST7789 board

Your board is officially supported: `boards/esp32_32e_2.8_led_display_st7789.overlay`.

## Confirmed hardware (from the overlay)

| Peripheral | Detail |
|---|---|
| Display | `sitronix,st7789v` — 320×240, SPI2 (MIPI-DBI), RGB565 |
| Touch | `xpt2046` (resistive) |
| Host link | `app-uart = &uart0` — the wallet host talks over UART0 |
| Backlight | `lcd_bk` alias |

So the host↔device bridge (idea A/B) uses **UART0** (serial), which matches
OSKey's "UART: wallet communication through the board's configured serial port".

## Build environment (from OSKey `docs/start/compile.md`)

OSKey is Zephyr + Rust. Load all three environments in the same shell, then
build with `west`. Requires the Zephyr workspace and the `esp-rs` Xtensa Rust
toolchain (see the OSKey repo's `west.yml`, `patch/`, and `Dockerfile`).

```sh
source ~/Develop/platform/zephyr-project/.venv/bin/activate
source ~/Develop/platform/zephyr-project/zephyr/zephyr-env.sh
source ~/.esp.sh

command -v west && test -n "$ZEPHYR_BASE" && rustc +esp --version
```

## Build & flash

1. Follow OSKey's workspace setup (`west.yml` + `patch/apply.py`) once.
2. Build for your board. The exact Zephyr board identifier for `esp32_32e` is
   in the repo's `boards/` and `socs/` dirs — confirm it, then:

```sh
# replace <BOARD> with the esp32_32e Zephyr board identifier (e.g. from west.yml)
west build -p always -b <BOARD> -d build/oskey \
  -- -DOVERLAY_CONFIG="$(pwd)/boards/esp32_32e_2.8_led_display_st7789.overlay"
west flash -d build/oskey
```

3. First boot: review **OSKey capabilities** → **Set up OSKey** → set a PIN →
   create/import the wallet (the key that will authorize the agent).

## Wire the host bridge

The host (`hardware/bridge.mjs`) sends `req.message` / `req.summary` over the
UART0 serial port, the device shows the summary and signs on confirmation, and
the host reads the signature back. Implement `transports.serial` against OSKey's
host protocol (or use its host app / WebUSB) — the request/response payload is
the `buildSignRequest` object from `bridge.mjs`.

> Note: never use the device's real wallet for the demo until you are confident
> in the flow; a fresh demo wallet on the device is enough to prove the hardware
> path end to end.
