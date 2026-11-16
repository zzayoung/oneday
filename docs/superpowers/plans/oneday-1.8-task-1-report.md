# OneDay 1.8 Task 1 — Day timeline interactions

## Status

Implementation complete within the assigned ownership. The focused Day, pointer, and gesture regression run passes **88/88 tests**. Root owns the full integrated test run, browser QA, build, versioning, and publication. This agent did not commit, publish, or run browser automation.

## Changed files

- `src/lite/timeline.js`
- `src/lite/day-workspace.css`
- `tests/cloud/timeline-pointer-integration.cjs`
- `tests/cloud/editor-day-sheet.cjs`
- This report.

`gestures.js` did not need modification. No dependency was added. No shared scheduling test, composition-root, creation-sheet, or version/build source was edited.

## Behavior delivered

### Day creation interface

Day's `onMount` now exposes `api.createRecord()`. The callback synchronously calls `L.openCreationSheet()` with **no arguments**, returning its result. It first cancels an active pointer interaction so temporary drag feedback is removed. A closing or closed Day returns `null` without opening another dialog.

The visible header + button carries `data-day-action="create"` and calls the same API through the Day click handler. It has an accessible “新建记录” label and a shortcut hint. Header spacing reserves room for both + and close at desktop and phone widths. Opening generic creation does not repaint Day or replace its editor, selected task, timeline scroll, or draft session. The existing blank-time creation route still passes its contextual date, start time, and optional parent/end.

**Root integration contract:** route eligible `/` and `+` key activations to the top Day dialog's `createRecord()` directly in the activation handler. Modal, typing, composition, modifier, and repeat guards belong to the composition root. Do not await a close or add scheduling arguments before calling this API.

### Continuous cyclic coverflow

Coverflow now maintains a fractional card position. Pointer movement changes the card translation, depth, and rotation together using the responsive CSS spacing: 185 px on desktop and 120 px at the phone breakpoint. Horizontal travel is no longer capped at 180 px and can cross a complete cycle in one gesture.

Release settles to the nearest cyclic card with a 220 ms cubic ease-out animation. Buttons and arrow keys use the same settle path. Reduced-motion preference skips that release animation. Cancellation returns to the gesture's original nearest card. New gestures, whole-page refreshes, and close cancel any previous settle frame.

Only the coverflow track is updated during browsing. Its bounded seven-slot window has five central cards plus fading edge slots; small collections repeat visual neighbors to support seamless cycling. Only the current front card and its schedule button are keyboard-accessible. Timeline nodes, scroll positions, editor host, and active editor remain the same objects during a swipe or previous/next action.

The 1.7 promotion rule remains: an initial horizontal browse can turn into a drag when the pointer enters a timeline, top trash, or exits the coverflow vertically. The originally grabbed task remains the scheduled/deleted record even when the visual center changed during the earlier browse. Both scheduling directions, immediate local presentation, and existing asynchronous writes are retained.

### Floating time feedback and haptics

Moving or resizing a timeline task shows a fixed `HH:mm–HH:mm` bubble attached to the modal backdrop, outside the timeline's clipped scroller. Placement follows the card/finger from above and clamps to all viewport edges with an 8 px inset. The visual viewport is used when available. Coverflow-to-timeline scheduling also shows the full proposed interval.

The bubble uses full interval endpoints, including previous/next-day context, instead of truncating a cross-midnight range to the current visible segment. A clipped resize edge now applies its snapped delta to the original full endpoint; it no longer discards an existing next-day segment. The existing visible-day movement/resize bounds and ten-minute minimum/snapping rules remain in force.

Commit, cancellation, return-to-todo/trash targets, creation handoff, and close remove the temporary feedback. The card's visible range still updates during manipulation.

Vibration support is read and bound once when Day mounts. Touch changes to a snapped start/end range request a **7 ms** pulse; multiple pointer events within the same snapped range, repeated release geometry, and mouse gestures do not pulse. A throwing or refused capability is disabled silently for that Day session. No capability warning is shown to the user.

### Whole-card touch manipulation

Touch movement on either a selected or unselected task body starts dragging after the existing small movement tolerance (8 px for body touch). It no longer requires the right grip or a long press. Resize edges retain their own handler, and CSS leaves them available while hiding the now-redundant grip. The card uses `touch-action:none`; empty timeline space retains native scrolling and the existing tap-to-create behavior.

Tap selection, repeat-tap/double-click child expansion, inherited child scheduling, and cancellation restoration retain their existing paths. Mobile help now says “拖动卡片 · 双击展开子任务”.

## Validation evidence

### Expected red run before implementation

```sh
node --test --test-isolation=none tests/cloud/timeline-pointer-integration.cjs
```

Result: 54 tests, 40 passing and 14 expected failures. The failures were the revised selected/unselected body-touch tests and new creation API, floating feedback, haptic, cross-midnight resize-feedback, continuous coverflow, cancellation, and reduced-motion cases. Existing scheduling/diagonal promotion/draft/cancellation cases passed. Failures represented missing behavior rather than fixture or syntax errors.

### Focused integration after implementation

```sh
node --test --test-isolation=none tests/cloud/timeline-pointer-integration.cjs
```

Result: **54/54 passing**.

### Final owned Day and gesture regression run

```sh
node --test --test-isolation=none tests/cloud/editor-day-sheet.cjs tests/cloud/timeline-gestures.cjs tests/cloud/timeline-pointer-integration.cjs
git diff --check -- src/lite/timeline.js src/lite/day-workspace.css tests/cloud/timeline-pointer-integration.cjs tests/cloud/editor-day-sheet.cjs
```

Result: **88/88 passing, zero failures**, and a clean whitespace check. The existing Day fixture was updated with the actual new header DOM boundary (`document.createElement`, header `append`, selector-specific `api.q`); production code was not guarded to accommodate incomplete mocks.

The new tests dispatch real pointer/click handlers through the production Day and gesture code. They verify literal schedule patches, bubble placement and teardown, bound vibration arguments/frequency, intermediate animation geometry, cyclic/cancel behavior, and object identity for the editor and timeline. No source-string assertions were added.

## Remaining validation and limitations

- Physical haptic output remains dependent on the browser, OS, and hardware. Tests prove the requested call and touch/snap gating, not physical vibration.
- This task agent did not run a browser, per the ownership brief. Root must verify the final composed CSS and touch behavior in desktop/390 px browser QA, including device-specific keyboard and vibration behavior where available.
- Full integrated suite, production assembly/build, and publication remain root's gates. The 88-test result above is the focused run, not a claim that the entire project has passed.
- Whole Day repaints still occur for task selection, scheduling/store changes, and other existing page-level actions. Coverflow browsing itself does not trigger them or remount the detail editor.
- Coverflow uses nearest-card easing, not a velocity-driven fling. The brief does not require momentum beyond the release position.

## Shared fixture handoff

Root was informed that `tests/cloud/scheduling.cjs` owns an independent `dayHost` and needs a browser-shaped boundary for the new header and floating feedback: `document.createElement` yielding attributes/style/content, `remove` and measurable geometry; a header with `append`; backdrop `append`; task-card geometry; and `innerWidth`/`innerHeight`. That shared file was not edited here.
