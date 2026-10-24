#!/bin/sh
# Datamora terminal theme for OSKey firmware UI.
# Run from the OSKey repo root. Backs up files first.
set -e

FILES="src/display/ui.c src/display/ui_controller.c src/display/ui_pages.c \
src/display/ui_dialog.c src/display/ui_confirmation.c src/display/ui_status.c \
src/display/ui_qr.c src/display/ui_hw.c src/display/ui_entropy.c \
src/display/ui_files.c src/display/display.c"

mkdir -p .theme-backup && cp $FILES .theme-backup/ 2>/dev/null || true

# ── accent: OSKey blue -> datamora green (the key change) ──
sed -i 's/0x4da3ff/0xcaf99c/g' $FILES   # ACTIVE accent (blue -> lime)
sed -i 's/0xbfe0ff/0xcaf99c/g' $FILES   # light blue -> lime

# ── success green -> datamora green ──
sed -i 's/0x6fd6a4/0xcaf99c/g' $FILES

# ── background ──
sed -i 's/0x090b0e/0x0a0a0a/g' $FILES   # near-black blue -> datamora black

# ── primary text ──
sed -i 's/0xf2f5f7/0xe8e8e5/g' $FILES   # cool white -> datamora off-white

# ── muted text ──
sed -i 's/0x929eaa/0xa1a598/g' $FILES
sed -i 's/0xb8c1ca/0xa1a598/g' $FILES
sed -i 's/0x697581/0xa1a598/g' $FILES
sed -i 's/0x727e89/0x73786e/g' $FILES   # placeholder -> dim

# ── borders / lines ──
sed -i 's/0x242b33/0x2a2e2a/g' $FILES
sed -i 's/0x29313a/0x2a2e2a/g' $FILES
sed -i 's/0x303944/0x2a2e2a/g' $FILES
sed -i 's/0x484848/0x2a2e2a/g' $FILES

# ── panels / cards ──
sed -i 's/0x14181d/0x16181a/g' $FILES
sed -i 's/0x12181e/0x16181a/g' $FILES
sed -i 's/0x11161c/0x16181a/g' $FILES

# ── scrollbar / dark element -> dim ──
sed -i 's/0x66727e/0x343831/g' $FILES
sed -i 's/0x343d46/0x343831/g' $FILES

echo "Datamora theme applied. Semantic colors kept: danger 0xe36a78, warning 0xe9b65e."
echo "Backup in .theme-backup/"
