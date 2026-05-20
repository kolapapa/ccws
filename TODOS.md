# TODOS

Open work items, organized by component then priority (P0 → P4). Completed
items move to `## Completed` at the bottom with the version they shipped in.

## TUI / picker

### Workspace name >12 chars cannot be activated via picker
**Priority:** P1
**Surfaced by:** /ship adversarial review on feat/tui-borderless-redesign (2026-05-19)
**What:** `ccws_tui_truncate` shortens names to 12 chars with a `…` suffix for
display. The selection extractor (`awk '{print $1}'`) returns the *truncated*
display string, which then fails `ccws_validate_name` because `…` is non-ASCII.
A user with `production-east` cannot select it from the picker — they get
"unknown workspace" instead.
**Why fix:** Picker is the primary UX surface; any name created by
`ccws add` (validator allows up to 64 chars) should be selectable via the
picker. Today only ≤12-char names work.
**Pros:** Closes a silent functional gap; restores parity with `ccws add` limits.
**Cons:** Touches the row-format printf + selection-extraction logic in
`lib/tui_fzf.sh` and `lib/tui_fallback.sh`. Needs care with ANSI escapes.
**Context:** Pre-existing on `main`. Not introduced by the borderless
redesign. Suggested fix: emit a sentinel (e.g. tab or NUL) between the
displayed name and the rest of the row, then `cut -d$'\t' -f1` on selection
to recover the full untruncated name from a separate column. Or: store the
full name in fzf's hidden `--with-nth`/`--delimiter` columns.
**Depends on:** none.

### `|` in `ANTHROPIC_BASE_URL` corrupts row parser
**Priority:** P1
**Surfaced by:** /ship adversarial review on feat/tui-borderless-redesign (2026-05-19)
**What:** `ccws_tui_collect_workspaces` emits `name | endpoint | proxy | mtime`
with `|` as the column separator. Both pickers parse with `IFS='|' read`. The
endpoint comes verbatim from `ccws.env`'s `ANTHROPIC_BASE_URL`, which has no
validation. A URL like `https://gw.example.com/?a=1|b=2` shifts the proxy and
mtime columns one slot, breaking endpoint-family color detection and the
ghost-active row matching.
**Why fix:** `ccws.env` is user-editable and the value flows through a
column-delimited format; we should either escape `|` or pick an unambiguous
separator.
**Pros:** Removes a quiet corruption path; makes the picker robust to
unsanitized env files.
**Cons:** Requires changing the collect format + all consumers in lockstep.
**Context:** Pre-existing on `main`. Suggested fix: use NUL (`\x00`) or
ASCII Unit Separator (`\x1f`) as the column separator, or backslash-escape
literal `|` in values.
**Depends on:** none.

### Workspace dir with whitespace silently activates the wrong workspace
**Priority:** P1
**Surfaced by:** /ship adversarial review on feat/tui-borderless-redesign (2026-05-19)
**What:** `ccws_validate_name` rejects names with spaces during `ccws add`,
but `ccws_tui_collect_workspaces` enumerates `$ws_dir/*/` via shell glob and
includes any directory regardless of name shape. A stale dir like `foo bar/`
(from a renamed workspace, sync error, or manual mkdir) appears in the
picker. When selected, the row's name field gets split on whitespace by
`awk '{print $1}'`, returning only `foo`. The wrapper then activates a
different workspace named `foo` (or errors). The user picked one row but
got another.
**Why fix:** Silent wrong activation is the worst kind of bug — no error,
wrong state. Even if the trigger is rare, the failure mode warrants a guard.
**Pros:** Eliminates a class of silent corruption in the picker selection.
**Cons:** Either tighten the glob (skip dirs failing the name validator) or
fix the selection extraction to recover the full name without whitespace
splitting (see related: 12-char truncation TODO).
**Context:** Pre-existing on `main`. Suggested fix: in
`ccws_tui_collect_workspaces`, call `ccws_validate_name "$name"` on each
directory and skip + log invalid ones. Plus use the sentinel approach from
the 12-char truncation fix for selection extraction.
**Depends on:** none (but the fix overlaps with the 12-char truncation TODO).

## Completed
