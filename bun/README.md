# ccws Bun rewrite (Phase 1)

TUI picker for ccws. Compiled binary that the bash `ccws_tui_run`
invokes when present. fzf remains a fallback for users who haven't
installed the binary yet.

## Dev

    bun install
    bun run dev       # run the picker against ~/.ccws/workspaces/
    bun run test      # vitest
    bun run typecheck # tsc --noEmit

## Build

    bun run build     # produces dist/ccws-picker-<platform> for 4 targets

See `../docs/superpowers/specs/2026-05-20-ccws-bun-rewrite-design.md`
for the full design and phasing plan.
