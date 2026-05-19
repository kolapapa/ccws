# ccws design system

Source of truth for ccws's visual vocabulary. Codified during the borderless
premium redesign (v0.5.1). Read this before touching any TUI / picker code.

## Colors (Catppuccin Mocha)

| Role | Hex | Usage |
|------|-----|-------|
| Prompt, logo row 1 | `#cba6f7` mauve | fzf prompt char; first row of the ASCII logo gradient |
| Key, default name | `#f5c2e7` pink | Preview key labels, non-active workspace name |
| Active name | `#a6e3a1` green-bold | The workspace currently exported in this shell |
| Anthropic endpoint | `#89dceb` sky | `anthropic` short label |
| Gateway endpoint | `#f9e2af` yellow | `*-gw` short labels (deepseek-gw, openai-gw) |
| Other endpoint | `#b4befe` lavender | Any other normalized host |
| Badge on | `#a6e3a1` green | `● proxy` |
| Badge off, rule, hint, footer | `#6c7086` dim | `○ direct`, dividers, footer text, ghost hint |
| Value text | `#cdd6f4` | Preview values, default fg |
| Warning | `#f38ba8` red-pink | `(no ccws.env)`, `(ccws.env empty or malformed)` |
| Background | terminal default (`bg:-1`) | Picker bg, preview bg |
| Accent bg | inherited | fzf cursor row uses inverse colors via fg+/bg+ defaults |

All colors are truecolor ANSI. The TUI degrades gracefully on monochrome
terminals (escapes are stripped or ignored).

## Glyphs

| Glyph | Codepoint | Role |
|-------|-----------|------|
| `❯` | U+276F | fzf cursor / pointer (the ONLY `❯` on screen) |
| `●` | U+25CF | Proxy badge ON (with green color), preview "active in this shell" marker |
| `○` | U+25CB | Proxy badge OFF (with dim color) |
| `·` | U+00B7 | Active-row "· active" suffix; footer separator before ghost hint |
| `─` | U+2500 | Horizontal divider (length 32) under the logo; preview border-top |
| `…` | U+2026 | Truncation suffix |

## Layout principles

1. **Flush left, terminal-native background.** The picker fills the natural
   terminal width (no `--margin` indent) and uses `bg:-1` so the terminal's
   own background shows through. Earlier drafts centered the picker in a
   colored card; the result felt pasted on and disconnected from the
   surrounding shell. Restraint here means "don't fight the terminal," not
   "frame the picker."
2. **No outer frame on operational surfaces.** No `--border=rounded`; the
   only visual separator inside the picker is the preview's `border-top`.
3. **One job per surface.** Picker = pick. Init banner = welcome.
4. **32-character rule** under the logo; same on fzf and fallback.
5. **Active state = color + dim text suffix**, never a glyph. The fzf cursor
   `❯` is the only `❯` on screen — competing glyphs are confusion.
6. **Preview is a key/value table**, not a box. Below the list with
   `border-top`, auto-fit height (`down,~12`) so it shrinks to the content
   instead of reserving a fixed budget that looks half-empty.
7. **Footer is one dim line.** Help text + optional ghost-active hint
   separated by ` · ` — embedded as the last `--header` row since fzf 0.44
   has no native footer slot.
8. **Color + glyph redundancy** for state signals (proxy `● proxy` / `○ direct`)
   so colorblind users can read the picker.
9. **Label dedup in preview.** Two env vars mapping to the same display
   label (`HTTPS_PROXY` + `HTTP_PROXY` → both `proxy`) only render once.
   Otherwise `ccws add --proxy` writes both upper/lower-case vars and the
   preview shows two identical rows.

## Logo

The interactive picker (both fzf and fallback engines) opens with a 6-line
ANSI Shadow ASCII rendering of "ccws", written to stderr above the picker
by the shared helper `ccws_tui_logo` in `lib/tui.sh`. The logo replaces
the picker's title row — the rule + help row stay, but there is no
`ccws · workspaces` text any more.

**Color:** per-row Catppuccin Mocha gradient, top to bottom:
mauve `#cba6f7` → pink `#f5c2e7` → lavender `#b4befe` → sky `#89dceb`
→ green `#a6e3a1` → yellow `#f9e2af`. All rows are bold.

**Gates (any one suppresses the logo silently):**

| Gate | Trigger | Why |
|------|---------|-----|
| `CCWS_NO_LOGO=1` | User opt-out | Some users prefer the picker without branding |
| stderr is not a tty | Redirected, piped, CI | Logo bytes would corrupt machine-readable output |
| `COLUMNS < 36` | Narrow terminal | Logo is 34 cols wide; cramming it line-wraps to nonsense |
| `LINES < 24` | Short terminal | Picker (`--min-height=18`) plus logo would scroll off-screen |

The render lives in scrollback because fzf's alternate-screen mode does
not erase the main buffer. After Esc, the logo remains visible above the
prompt.

The ceremonial banner (`ccws_tui_banner` in `lib/tui_gum.sh`, used by
`ccws init`) is a separate surface and does NOT call `ccws_tui_logo` —
see the Surface Registry below.

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

| Surface | Register | Frame | Logo | Why |
|---------|----------|-------|------|-----|
| `ccws_tui_fzf_pick` (`lib/tui_fzf.sh`) | Operational | None | ASCII logo above (via `ccws_tui_logo`) | High-frequency daily use. Restraint earns its place by getting out of the way. |
| `ccws_tui_fallback_pick` (`lib/tui_fallback.sh`) | Operational | None | ASCII logo above (via `ccws_tui_logo`) | Mirror of the fzf register for narrow terminals / no-fzf / `CCWS_NO_TUI=1`. |
| `ccws_tui_banner` (`lib/tui_gum.sh`) | Ceremonial | Double border (gum) | No (the gum banner IS the brand mark) | One-time first-run welcome via `ccws init`. Attention budget is high, the moment carries weight, a bordered banner earns its presence. |

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
