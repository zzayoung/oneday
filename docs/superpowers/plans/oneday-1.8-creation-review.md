# OneDay 1.8 — Scoped creation review

## Verdict

**Clean after the verified correction. No outstanding concrete issue remains in the scoped creation implementation.** The initial review found one P2 draft-preservation issue, documented below with its resolution.

## Scope

Reviewed `/tmp/oneday18-creation-review.diff` against `docs/superpowers/specs/2026-10-28-oneday-1.8-design.md` and `docs/superpowers/plans/oneday-1.8-task-2-brief.md`.

Source scope: the creation portion of `src/lite/dialogs.js`, the generic initial-focus fallback in `src/lite/ui.js`, and `src/lite/records.css`. Regression scope additionally includes the new `tests/cloud/creation-sheet-focus.cjs` and category-event fixture updates in `tests/cloud/editor-draft-sessions.cjs` and `tests/cloud/task-workflow.cjs`.

Timeline implementation and its gesture behavior are excluded. Root separately reports that native 390 px UI, focus, category, and duration checks passed; this reviewer did not perform those browser checks.

## Resolved finding

### P2 — Restoring a custom-category draft silently changed note creation into task creation

**Location:** `src/lite/dialogs.js`, `L.openCreationSheet()`, fixed `categories` list and the immediately following `saved.category` fallback, approximately lines 164–166.

Restricting the control to the four required categories removes custom categories that 1.7 previously populated from existing notes. The unchanged unsupported-category fallback then maps such a restored category to 待办. This affects an existing `newrecord.root` draft and a migrated `newnote.root` draft with a custom category. On the next capture, the mapped category replaces the stored category. Pressing 添加 subsequently calls task creation, although the restored draft represented a note.

This is observable without modifying production data. A targeted check through the existing `editor-draft-sessions.cjs` fixture seeded a stored note under 自定义资料 plus an unsaved `newrecord.root` draft with the same category. Opening the creation sheet selected 待办 while retaining the body. Submitting called `createTask` and removed the draft:

```json
{"restoredCategory":"待办","restoredBody":"未提交的自定义笔记"}
{"writes":[{"kind":"task","values":{"title":"未提交的自定义笔记","body":"未提交的自定义笔记","estimate":60,"parent":""}}],"remainingDraft":null}
```

This violates the task's draft-preservation requirement by silently changing note/task semantics. Keeping four visible tabs is compatible with normalizing an unsupported nonempty restored note category to 记录. Root accepted that resolution; missing categories and child creation should continue to default to 待办. Add regression coverage for both modern and legacy custom-category drafts.

**Resolution verified:** `openCreationSheet()` now maps an unsupported nonempty restored category to 记录. Known categories retain their value; a missing category or child creation remains 待办. The new `task-workflow.cjs` regression exercises both `newrecord.root` and legacy `newnote.root`, submits the restored body through the real store fixture, and asserts no task was created, a 记录 note contains the exact Markdown body, existing notes remain unchanged, and the consumed draft is removed. The targeted test passed after the fix.

## Checks without findings

### Focus lifecycle

The content editor remains focused synchronously inside the dialog's `onMount`, after the modal is attached and made active. No promise, timer, synthetic click, or animation-frame boundary is introduced before the focus call.

The generic 50 ms fallback now returns if the dialog is detached, is not the top modal, is under an inert ancestor, or already contains the active element. This preserves the editor's synchronous focus and user-selected focus, avoids a parent's deferred focus after nested creation, and avoids attempts to focus a closed dialog. When a dialog has no focused descendant, the existing explicit-autofocus/default-close behavior remains available.

The new lifecycle regression runs the production dialog, editor, and draft registry together. Its DOM boundary records focus attempts even when it would reject an inert or detached target, which makes the parent/closed-dialog guard assertions meaningful. Physical mobile keyboard presentation remains outside the capability of these Node tests, as the implementation report correctly states.

### Categories and duration

The new selector contains exactly four buttons, removes the redundant range and handler, retains `aria-pressed`, and preserves the disabled non-task options for child creation. Category changes continue to use one editor buffer and invalidate/cancel any pending schedule choice.

Duration remains 10–480 minutes, step 10, default 60. Switching categories preserves the range value; non-action categories hide it. The shared header row uses two shrinkable grid columns and mobile spacing. Root reports successful native checks at 390 px; this review's independent assessment is of the source and tests.

### Drafts, uploads, and tests

Apart from the category migration issue, the content buffer, local capture, intentional-empty behavior, legacy migration ownership, pending-upload waits, submission snapshots, acknowledgement, and post-submit editing protections remain unchanged. The updated fixtures now emit the category button's delegated click instead of writing the removed range, while retaining their persistence assertions.

The existing regression set covers empty edits, exact Markdown, legacy consumption, isolated child drafts, storage failures, in-flight edits, uploads before submission/close, and late-upload recovery. The new focus file also verifies the four categories, duration bounds/default, category duration visibility, and child restrictions.

## Validation record

The implementation agent's initial report records **113 passed, 0 failed, 0 skipped** for its focused seven-file suite plus successful syntax and whitespace checks. I did not rerun that suite. I ran the targeted custom-category fixture reproduction above to resolve a concrete concern raised by inspection, then ran this narrow fix-verification command:

```sh
node --test --test-isolation=none --test-name-pattern='restored custom-category note drafts' tests/cloud/task-workflow.cjs
```

Result: **1 passed, 0 failed**. The test contains both current-draft and legacy-draft scenarios. This is a fresh reviewer-observed result.

After the correction, root reports that creation checks remain green in the 114-test shared set, with five unrelated `editor-day-sheet` fixture failures introduced by the in-progress timeline integration and assigned to its owner. This review does not claim the full shared tree currently passes.

## Final disposition

The creation implementation is accepted within the defined review scope. The initially identified semantic regression is fixed and covered. Full integrated validation remains with root and the timeline owner.
