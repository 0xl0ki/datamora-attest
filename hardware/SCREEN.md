# OSKey screen UI — Datamora terminal theme

The on-device consent screen matches the Datamora Attest workbench: black
terminal, `#CAF99C` green, monospace, thin dividers, scanline-free (the 320×240
panel is too small for scanlines; keep it crisp).

## Palette

| Token | Hex | Use |
|---|---|---|
| `bg` | `#0A0A0A` | background |
| `panel` | `#16181A` | header bar, button fill |
| `green` | `#CAF99C` | accent: mark, labels, primary button, ok state |
| `white` | `#E8E8E5` | primary values |
| `muted` | `#A1A598` | field labels, secondary text |
| `dim` | `#5B6058` | hints |
| `line` | `#2A2E2A` | dividers |

## Type

- Monospace (JetBrains Mono if available on the firmware, else the device's
  bundled mono). Sizes: title 14, value 11, label/eyebrow 9–11.

## Layout (320×240)

```
┌──────────────────────────────────┐
│ ◧◧ DATAMORA //ATTEST       [4663] │  header: mark + brand + chainId badge
├──────────────────────────────────┤
│ CONSENT REQUEST                    │  eyebrow (green, mono, uppercase)
│ AGENT      0x2222…2222            │  label muted-left, value white-right
│ POLICY     0x1111…1111            │
│ CHAIN      4663 · Robinhood       │
│ OPERATOR   0xf39f…2266            │
│ EXPIRES    never                  │
│ NONCE      1                      │
├──────────────────────────────────┤
│ review before signing             │  hint (dim)
│ [ SIGN ▸ ]          [ REJECT ]    │  primary green-fill / outline
└──────────────────────────────────┘
```

## The 2×2 mark

Draw the Datamora mark as a 2×2 grid (14px): top-left outline, top-right fill,
bottom-left fill, bottom-right outline — all `#CAF99C` (same as `logo.svg`).

## States

| State | Screen | Behavior |
|---|---|---|
| review | `screen-1-consent-review.png` | show summary, wait for tap |
| signed | `screen-2-signed.png` | show `SIGNED ✓` + signature preview |
| air-gapped | `screen-3-qr.png` | QR scan for idea C |

## Hash truncation

Long values truncate as `0x` + first 6 + `…` + last 4 (e.g. `0x222222…2222`) to
fit 320px; the full value is always in the message that is actually signed.

## Anti-blind-signing rule

**The exact string shown is the exact string signed.** The firmware must sign
`message` (from `buildSignRequest`), never a value the user did not see. This is
the whole point of the on-device review.
