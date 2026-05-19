# ccws design system

Source of truth for ccws's visual vocabulary. Codified during the borderless
premium redesign (v0.5.1). Read this before touching any TUI / picker code.

## Colors (Catppuccin Mocha)

| Role | Hex | Usage |
|------|-----|-------|
| Title, prompt | `#cba6f7` mauve | Top-of-picker title, fzf prompt char |
| Key, default name | `#f5c2e7` pink | Preview key labels, non-active workspace name |
| Active name | `#a6e3a1` green-bold | The workspace currently exported in this shell |
| Anthropic endpoint | `#89dceb` sky | `anthropic` short label |
| Gateway endpoint | `#f9e2af` yellow | `*-gw` short labels (deepseek-gw, openai-gw) |
| Other endpoint | `#b4befe` lavender | Any other normalized host |
| Badge on | `#a6e3a1` green | `● proxy` |
| Badge off, rule, hint, footer | `#6c7086` dim | `○ direct`, dividers, footer text, ghost hint |
| Value text | `#cdd6f4` | Preview values, default fg |
| Warning | `#f38ba8` red-pink | `(no ccws.env)`, `(ccws.env empty or malformed)` |
| Background | `#1e1e2e` | Main bg |
| Accent bg | `#313244` | fzf selected row bg |
| Preview bg | `#181825` | Preview window bg |

All colors are truecolor ANSI. The TUI degrades gracefully on monochrome
terminals (escapes are stripped or ignored).

## Glyphs

| Glyph | Codepoint | Role |
|-------|-----------|------|
| `❯` | U+276F | fzf cursor / pointer (the ONLY `❯` on screen) |
| `●` | U+25CF | Proxy badge ON (with green color), preview "active in this shell" marker |
| `○` | U+25CB | Proxy badge OFF (with dim color) |
| `·` | U+00B7 | Active-row "· active" suffix; footer separator before ghost hint |
| `─` | U+2500 | Horizontal divider (length 32) under title; preview border-top |
| `…` | U+2026 | Truncation suffix |

## Layout principles

1. **No outer frame on operational surfaces.** Indent via `--margin` (fzf) or
   leading spaces (fallback), not row-content padding.
2. **One job per surface.** Picker = pick. Init banner = welcome.
3. **32-character rule** under the title; same on fzf and fallback.
4. **~8 columns of left/right indent** on both engines.
5. **Active state = color + dim text suffix**, never a glyph. The fzf cursor
   `❯` is the only `❯` on screen — competing glyphs are confusion.
6. **Preview is a key/value table**, not a box. Below the list with
   `border-top`, not beside it.
7. **Footer is one dim line.** Help text + optional ghost-active hint
   separated by ` · `.
8. **Color + glyph redundancy** for state signals (proxy `● proxy` / `○ direct`)
   so colorblind users can read the picker.

## Preview

The preview iterates `CCWS_PREVIEW_KEYS` in `lib/tui.sh` — an ordered
`"ENV_VAR|label"` table. Keys present in `ccws.env` but absent from
`CCWS_PREVIEW_KEYS` are silently NOT shown. To expose a new key, add it
to `CCWS_PREVIEW_KEYS` in the order it should appear. This is the single
source of truth for both display order and label mapping.

The dim red-pink warning line `(ccws.env empty or malformed)` appears when
the env file exists but yields zero key/value rows (all comments, blank, or
parse failure). Distinguishes "ccws bug" from "user env file broken."

## Surface registry

ccws has three rendering surfaces. Each owns its own visual register; they
are intentionally NOT uniform.

| Surface | Register | Frame | Why |
|---------|----------|-------|-----|
| `ccws_tui_fzf_pick` (`lib/tui_fzf.sh`) | Operational | None | High-frequency daily use. Restraint earns its place by getting out of the way. |
| `ccws_tui_fallback_pick` (`lib/tui_fallback.sh`) | Operational | None | Mirror of the fzf register for narrow terminals / no-fzf / `CCWS_NO_TUI=1`. |
| `ccws_tui_banner` (`lib/tui_gum.sh`) | Ceremonial | Double border (gum) | One-time first-run welcome via `ccws init`. Attention budget is high, the moment carries weight, a bordered banner earns its presence. |

The same project can carry both registers if each surface owns its
register. Do NOT "normalize" the banner away to match the picker — the
contrast is intentional, not a bug.

## Versioning

Visual changes that don't change behavior or break keybindings are PATCH
bumps. Adding new commands, flags, or env vars is MINOR. Removing or
renaming commands / flags / env vars is MAJOR.

## Reference visual languages

The picker borrows from: Raycast, Linear command palette, 1Password mini,
macOS Spotlight. Common thread: narrow centered column, no outer frame,
generous vertical breathing room, hierarchy from color and weight rather
than boxes.
