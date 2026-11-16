# Task 2 report — Creation sheet focus and compact controls

## Status

Implemented the scoped creation-sheet changes. The creation/editor/draft/task-workflow regression set passes **97/97**. Root's native 390 px QA confirmed the controls share a row, there is no horizontal page overflow, and the editor retains focus. A wider run including Day-sheet tests found five fixture failures after concurrent timeline changes; details are below. Final integration tests, physical-device keyboard observation, and publication remain with root as assigned in the task brief.

**Root integration update:** the Day owner updated its DOM fixture, and root updated the independent scheduling fixture. The final integrated suite now passes **386/386**, including all five previously failing Day cases; no failure remains. Official production assembly/build and desktop/390 px browser QA also passed. The historical parallel-edit failures below are retained as the agent's original test record.

## Changes

### Focus lifecycle

`src/lite/ui.js` keeps the existing 50 ms generic dialog fallback, including its explicit `autofocus` and default close-button behavior. Before focusing, the fallback now checks that its dialog is connected, is the top modal, is outside inert ancestors, and does not already contain the focused element. This prevents the timer from replacing synchronous editor focus, focusing a parent below a nested modal, or attempting focus after close.

`src/lite/dialogs.js` retains creation-editor focus directly inside synchronous `onMount`. A comment records why this call must remain in the opening activation event. No delayed click or delayed keyboard-opening workaround was introduced. The shared editor implementation did not require modification.

### Categories and duration

Creation renders exactly four category buttons: **待办 / 灵感 / 记录 / 引用**. Existing note categories no longer add buttons. The category range, its input listener, its value synchronization, the duplicated active-category label, and the corresponding range CSS have been removed.

The category buttons retain the existing click contract: `data-record-category="0"` through `"3"`, in the order above. Their selected state remains exposed through `aria-pressed`; the group has an accessible category label. Parent/child creation continues to disable the three non-task buttons.

Category and duration controls now share `.creation-controls-row` before the content editor. `src/lite/records.css` uses two `minmax(0, 1fr)` columns, constrained range width, and compact mobile spacing. Duration remains **10–480 minutes**, step **10**, default **60**. Switching to a non-task category hides duration and lets the category group occupy the row. Returning to 待办 retains the duration value. The save button remains **添加**.

Restored drafts with a nonempty category outside those four normalize to **记录**, preserving their note type rather than converting them into tasks. This covers both unified `newrecord.root` drafts and legacy `newnote.root` drafts. Missing/new categories and child creation continue to default to 待办. Existing saved notes and their custom categories are untouched.

The editor mount, attachment ownership, pending-upload wait, submission acknowledgement, scheduling, and close/capture flows retain their existing implementation.

## Test evidence

### Red phase

Before production edits, ran:

```sh
node --test --test-isolation=none tests/cloud/creation-sheet-focus.cjs
```

Result: **2 passed, 5 failed**. The failures reproduced these concrete behaviors:

- The fallback replaced creation-editor focus after the activation handler returned.
- A parent fallback attempted focus while a nested dialog was active.
- A closed dialog's timer still attempted focus on its detached target.
- An existing custom note category appended a fifth creation button.
- Creation exposed both the category range and the duration range.

The ordinary-dialog autofocus/default-focus and child-category restrictions already passed and protect those existing behaviors.

### Green phase and regression set

After the behavioral changes, the new focus file plus draft-session tests passed **34/34**. The wider focused run initially exposed two obsolete range-based fixtures in `tests/cloud/task-workflow.cjs`; those fixtures were updated to deliver the existing category-button click event. Their persistence assertions remain intact. That run then passed **113/113**.

Root requested preserving the note type of unsupported custom-category drafts. A narrow regression covering unified and legacy custom-category drafts failed first because a task was created (`1 !== 0` task rows), then passed after the fallback was changed to 记录. It also checks exact body text, unchanged saved notes, and consumed drafts.

Final focused command:

```sh
node --test --test-isolation=none \
  tests/cloud/creation-sheet-focus.cjs \
  tests/cloud/editor-draft-sessions.cjs \
  tests/cloud/editor-dom.cjs \
  tests/cloud/editor-reliability.cjs \
  tests/cloud/editor-draft-registry.cjs \
  tests/cloud/task-workflow.cjs
```

Result: **97 passed, 0 failed, 0 skipped**. This includes intentional empty edits, exact Markdown retention, legacy draft migration and consumption, isolated child drafts, failed local storage, edits made during submission, attachment completion before submission/close, and late-upload recovery.

The same command with `tests/cloud/editor-day-sheet.cjs` included most recently returned **109 passed, 5 failed** after the concurrent timeline implementation began calling `document.createElement` during mount. Its older DOM host does not implement that API. All five failures report `TypeError: document.createElement is not a function` at `src/lite/timeline.js:152`:

- `the Day Sheet binds title and body edits to the recoverable task session before tab changes`
- `the Day Sheet close handler waits for a failed save and honors cancel without destroying drafts`
- `the Day Sheet status menu routes through the shared task-status action`
- `the Day save-state label acknowledges a successful Sites cloud write`
- `parent Day deletion waits for a retired child upload and saves its content before trash`

These integration failures were reported to root with the exact stack location. This task did not edit the timeline or its Day-sheet host while another agent owned that work.

Syntax and whitespace checks also completed with exit code 0:

```sh
node --check src/lite/ui.js
node --check src/lite/dialogs.js
node --check tests/cloud/creation-sheet-focus.cjs
git diff --check
```

The new focus suite executes the production `L.dialog`, creation sheet, editor, draft registry, and handlers together through a small DOM boundary. It does not stub `L.dialog` or the editor. Focus attempts on inert/disconnected targets are recorded so the guards are verified even when the DOM boundary rejects those attempts. The CSS layout is left to native QA rather than checked through source-string assertions.

## Integration notes and limits

- Changed source files: `src/lite/dialogs.js` creation portion, `src/lite/ui.js` initial-focus fallback, and `src/lite/records.css`.
- Added `tests/cloud/creation-sheet-focus.cjs`; updated category-event fixtures in `tests/cloud/editor-draft-sessions.cjs` and `tests/cloud/task-workflow.cjs`.
- Root was notified of the replacement click contract for its owned scheduling fixtures. Shared `tests/cloud/scheduling.cjs` was not edited by this task.
- Root reported native 390 px measurements: both controls at top **129.5 px**, each **179 px** wide; document `scrollWidth` and `clientWidth` both **390**; active element remains `newTaskBody`. Native browser QA was not run by this agent, per ownership.
- Synchronous focus preserves the activation-event opportunity for a mobile browser to show its keyboard. Keyboard presentation remains controlled by the browser and operating system. The Node suite proves focus timing and retention; it cannot prove that a physical phone displays its virtual keyboard.
- The custom-category draft edge case was resolved using root's explicit migration rule: unsupported nonempty categories become 记录; missing/new and parent categories remain 待办. No additional tabs are added.

No commit or publication was performed by this task.
