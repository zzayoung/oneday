# Task 1 — Day timeline interactions

Work in `[redacted-workspace-path]`. Baseline is OneDay 1.7.0 at `e6991cbe6d0e25701f221bf0b13af60e09be5fa2`, current branch `oneday-1.8`.

## Ownership

Own `src/lite/timeline.js`, `src/lite/day-workspace.css`, `src/lite/gestures.js` only if necessary, and relevant Day/pointer test files. Do not edit `app.js`, `dialogs.js`, `ui.js`, `records.css`, version/build files or shared `tests/cloud/scheduling.cjs`. Other agents are editing concurrently. Do not commit or publish or run browser automation. Root handles final integration and tests. Do not spawn additional agents.

## Requirements

1. Put a visible + button in the timeline popup header. In the Day dialog onMount expose `api.createRecord()` that synchronously opens `L.openCreationSheet()` without scheduling parameters, retaining Day popup state. Button uses that callback. Root routes / and + keyboard shortcuts into it. Existing time-slot creation remains contextual.
2. Coverflow must follow pointer motion continuously and settle smoothly on release with cyclic switching. Avoid rebuilding the entire Day page or remounting the detail editor to change cards. Keep 1.7 diagonal promotion from cycling to timeline/trash dragging, both scheduling directions and immediate writes. No new gesture library. Respect reduced motion.
3. Moving/resizing task cards shows HH:mm–HH:mm in a fixed floating bubble above the card/finger, outside timeline clipping, clamped into viewport. Preserve full cross-midnight range semantics. Remove feedback on commit/cancel/close. Touch-only vibration: short 6–8 ms pulse when snapped 10-minute time changes, not per pixel. Detect/bind navigator.vibrate once at Day interaction boundary; unsupported device stays silent. Check capability errors without exposing user warnings.
4. Touch drag starts from the whole task card after the usual small movement threshold, without requiring the right grip or long press. Resize edges still resize. Empty timeline still scrolls; tap and child expansion work. Update mobile help copy to describe this.

## Validation

Use meaningful real handler tests for card-body touch movement, fixed time feedback and cleanup, haptic tick frequency/no mouse pulses, smooth coverflow settling without editor remount, and Day + interface. Avoid tests that only mirror source strings. Existing Node tests require `--test-isolation=none`. Root runs full suite after integration.

## Report

Write full report to `docs/superpowers/plans/oneday-1.8-task-1-report.md`: changed behavior/files, tests with commands/results, exact remaining limitations and any integration contract. Return only status, short test summary and concerns. Keep functions cohesive and scope limited to these requests.
