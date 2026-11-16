# Task 2 — Creation sheet focus and compact controls

Work in `[redacted-workspace-path]`. Baseline OneDay 1.7.0, current branch `oneday-1.8`.

## Ownership

Own `src/lite/dialogs.js` creation portion, `src/lite/ui.js` generic modal initial focus, `src/lite/records.css`, and relevant creation/focus/draft tests (including `tests/cloud/editor-draft-sessions.cjs` if needed). Root owns app.js; another agent owns timeline.js/gestures.js/day-workspace.css and pointer tests. Do not edit shared `tests/cloud/scheduling.cjs`. Prefer leaving editor.js untouched; notify root if required. Do not commit, publish, run browser automation or spawn agents.

## Requirements

1. New creation dialog focuses its content editor synchronously in the actual activation event so mobile browser can open its keyboard. `L.dialog` currently runs a 50 ms fallback that focuses the first input after `onMount` focused the editor; fix this focus steal and ensure a parent modal's delayed focus does not jump into an inert/underlying dialog. Keep normal autofocus/initial focus behavior for other dialogs.
2. Category control contains exactly four tabs: 待办 / 灵感 / 记录 / 引用. Remove the category range input and its redundant handlers/state. Preserve current note data; creation does not append extra tabs from existing custom categories.
3. Put 计划干多久 duration control on the same header row as the category control, including at a 390 px mobile width without horizontal overflow. Preserve 10–480 min, step 10, default 60; current category semantics can hide/disable duration for non-待办. Save button text stays 添加.
4. Preserve creation drafts, intentional empty edits, legacy draft migration, child-task creation, uploads and in-flight edits through submission. Touch keyboard focus must not rely on delayed synthetic clicks. Describe actual platform limitation honestly.

## Validation

Exercise real dialog focus lifecycle: content focus remains after fallback timer; opening a nested modal cannot focus parent; four category buttons and duration work; creation/draft/upload tests remain green. Use test-first for meaningful behavior changes, avoid layout-source mirror tests. Node tests require `--test-isolation=none`. Root handles native desktop/mobile QA and final full suite.

## Report

Write full report to `docs/superpowers/plans/oneday-1.8-task-2-report.md` with changes, command/results, remaining limitations and integration notes. Return only status, short test summary and concerns. Keep cohesive functions and limited scope.
