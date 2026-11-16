# OneDay 1.8 — Scoped shortcut integration review

## Verdict

**Clean within the requested scope. No concrete correctness, specification, or code-quality issue found.**

This is a review of `/tmp/oneday18-shortcuts-review.diff` against `docs/superpowers/specs/2026-10-28-oneday-1.8-design.md`. It does not approve the independently in-progress timeline, creation-sheet, focus, or layout implementations.

## Scope examined

- `src/lite/app.js`: `actions['global-create']` and the document keydown routing.
- `src/lite/panels.js`: help content and the displayed version change.
- `src/lite/shell.html` and `src/lite/views.js`: creation shortcut labels.
- `tests/cloud/scheduling.cjs`: the composition-root test host, category event adaptation, extracted calendar-drag setup, and shortcut regressions.
- Surrounding dialog, editor, and timeline contracts were read only as necessary to assess the changed call sites.

## Specification checks

The global create action checks only the top modal for its `createRecord()` capability. A nested modal without that capability blocks access to an underlying Day dialog. With no modal, an open task detail still blocks generic creation. The action leaves the existing Day mounted and delegates its creation behavior instead of closing or rebuilding it.

Both `/` and `+` use the same action. Their handling remains synchronous within the initiating keydown event, which preserves the downstream creation sheet's ability to focus its editor during user activation. Typing in an input, textarea, select, or content-editable element is excluded. IME composition, Ctrl, Meta, Alt, and repeated keydown are excluded. Shift is permitted so that `+` remains available on keyboard layouts where it requires Shift.

Search, Escape, Tab trapping, view shortcuts, and grid-cell activation retain their prior context boundaries. The new early return for `/` and `+` prevents those creation keys from falling through to unrelated handlers.

The help text and creation-button titles advertise `/` and `+` consistently. The help's Ctrl/Command+Enter submission instruction matches the creation editor's existing submit handler. The advertised full-card touch dragging and time feedback remain subject to the separately reviewed timeline implementation.

## Code and regression assessment

The change reuses the existing action map and modal capability contract. It adds no package, global parallel routing mechanism, or asynchronous gap at the shortcut boundary. The new action returns the Day delegate result, so the existing click dispatcher can observe a returned promise if the delegate later provides one.

The test host executes the real composition root against the existing production-store fixture. The shortcut cases cover both keys, retained Day identity, blocking of subsequent shortcuts by a nested creation sheet, main-page creation, explicit global-action delegation, typing and composition guards, modifier/repeat guards, unrelated top modals, and task-detail blocking. Extracting `appHost()` preserves the calendar-drag conflict test's real store and scheduling path.

The category regression now drives the delegated button click corresponding to the new category control. It continues to assert cancellation of an unresolved scheduling prompt, preservation and single submission of the document, the selected note category, and cleanup of the saved creation draft.

## Validation and limits

No test was rerun during this read-only review: the parent reported **26 passing scheduling tests** before the independent creation-agent edits, and inspection raised no concrete concern requiring another run. This review does not claim a fresh final integrated test result or browser QA result.

Final acceptance still depends on the complete timeline and creation packages providing the reviewed contracts, followed by the planned integrated tests, build, and browser checks.
