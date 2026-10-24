# Apply the Datamora theme to the OSKey firmware UI

The OSKey device UI is **LVGL** (`src/display/ui.c` and friends). Its default
theme is dark with a **blue** accent (`0x4da3ff`). To match the Datamora Attest
workbench (black `#0A0A0A`, lime `#CAF99C`), swap the accent to green and align
the neutrals.

## One command

From the OSKey repo root:

```sh
sh /path/to/datamora-attest/hardware/theme-apply.sh
```

The script backs up the edited files to `.theme-backup/` and applies every swap
below, then rebuild + flash with `west` as usual.

## Color map

| Old hex | Role | New hex | Datamora role |
|---|---|---|---|
| `0x4da3ff` | ACTIVE accent (blue) | `0xcaf99c` | **accent (lime)** ← the key change |
| `0xbfe0ff` | light blue | `0xcaf99c` | accent |
| `0x6fd6a4` | success (teal) | `0xcaf99c` | success = accent |
| `0x090b0e` | screen bg | `0x0a0a0a` | background |
| `0xf2f5f7` | primary text | `0xe8e8e5` | text |
| `0x929eaa` / `0xb8c1ca` / `0x697581` | muted text | `0xa1a598` | muted |
| `0x727e89` | placeholder | `0x73786e` | dim |
| `0x242b33` / `0x29313a` / `0x303944` / `0x484848` | borders | `0x2a2e2a` | line |
| `0x14181d` / `0x12181e` / `0x11161c` | panels/cards | `0x16181a` | panel |
| `0x66727e` / `0x343d46` | scrollbar/dark | `0x343831` | dim |

**Kept on purpose** (semantic, not theme): danger `0xe36a78`, warning `0xe9b65e`,
black `0x000000`, white press flash `0xffffff`.

## After applying

```sh
# from the OSKey repo, with the Zephyr + esp-rs env loaded (see FLASH.md)
west build -p always -b <BOARD> -d build/oskey \
  -- -DOVERLAY_CONFIG="$(pwd)/boards/esp32_32e_2.8_led_display_st7789.overlay"
west flash -d build/oskey
```

## Optional: monospace font

The OSKey UI uses Montserrat (proportional). For the full terminal look, add
JetBrains Mono (or any mono) to LVGL's fonts and change the `UI_FONT_*` macros
in `src/display/ui.h`. This is a larger change (font asset + build); the color
theme above already gives the Datamora look without it.
