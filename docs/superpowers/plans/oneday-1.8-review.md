# OneDay 1.8 — Final integration review

## Verdict

**Clean. No outstanding concrete correctness, specification, or code-quality finding remains in the changed 1.8 behavior.**

This verdict combines the completed shortcut and creation reviews with the final Day implementation review. The custom-category draft issue identified during the creation review was fixed and independently verified before this final review; that settled finding is not reopened here.

## Review scope and references

- Final package: tracked Day source/CSS/test diff against baseline `e6991cbe6d0e25701f221bf0b13af60e09be5fa2`.
- Requirements: `docs/superpowers/specs/2026-10-28-oneday-1.8-design.md` and `docs/superpowers/plans/oneday-1.8-task-1-brief.md`.
- Implementation report: `docs/superpowers/plans/oneday-1.8-task-1-report.md`.
- Earlier review records: `docs/superpowers/plans/oneday-1.8-shortcuts-review.md` and `docs/superpowers/plans/oneday-1.8-creation-review.md`.

The final pass examined the changed Day source and CSS, pointer integration regressions, Day fixture changes, and interactions with the reviewed composition root and creation dialog. It also checked the remaining tracked source/test changes: backend health/backup version strings, paginated-backup version metadata, settings version labels, and matching backend assertions. Those remaining changes only update the displayed/exported product version to 1.8/1.8.0.

## Specification and integration assessment

### Day creation and focus

`L.openDayTimeline()` exposes `api.createRecord()` during synchronous mounting and adds a visible header + button that invokes it. The callback returns `L.openCreationSheet()` without scheduling arguments, preserving generic creation semantics. The existing blank-time handler continues to supply date/start/end/parent context separately.

The callback cancels an active gesture first, allowing its normal restoration and teardown callbacks to remove temporary feedback. It rejects creation while Day is closing or closed. It does not close Day or intentionally repaint its timeline/detail to open the new sheet.

The composition root delegates `/`, `+`, and the global create action only to an eligible top modal. A nested creation or unrelated modal blocks access to an underlying Day. Synchronous delegation preserves the creation editor's focus call within the initiating activation. The generic modal fallback guards prevent parent, disconnected, and already-focused dialogs from taking focus afterward.

### Continuous cyclic motion

Coverflow now derives translation, depth, and rotation from a fractional position rather than applying only a capped horizontal offset. The responsive step is read from the track's CSS at gesture start. Its bounded slot window maintains neighbors across wrap boundaries, including repeated neighbors for short task lists.

Release uses a shared nearest-card settling path. Buttons and arrow keys use that path too; successive navigation builds on the pending target. New gestures, full Day paints, and close cancel an old animation frame. Reduced-motion preference takes the immediate completion path.

Browsing mutates the coverflow track and counter, without calling the full Day painter or replacing the detail editor and timeline. Rebuilding the small track window when its center crosses a slot does not lose gesture tracking: the pointer lifecycle captures the stable dialog root. Normalization at settlement preserves the visible cyclic arrangement.

Diagonal promotion remains coherent. A horizontal browse becomes a drag after entering the timeline/trash region or leaving the coverflow vertically; the originally grabbed task remains the record being scheduled or deleted. Existing optimistic schedule/delete paths remain in use.

### Whole-card touch and scroll boundaries

The card-body path uses the shared pointer lifecycle with an 8 px touch threshold and no native-pan allowance. Card CSS supplies `touch-action:none`. Resize edges retain their distinct role and smaller threshold, while the former right-hand grip is hidden.

Empty timeline space retains its separate `allowPan:touch` path and native pan CSS. Movement there cancels tap creation without drawing a selection band or submitting a task. Tap selection and repeat-tap/child expansion remain available on task cards. Pointer cancellation restores the original task geometry and prevents a stale release from committing it.

### Time feedback and haptics

The time bubble is fixed and attached to the modal backdrop, outside the clipped timeline scroller. Its placement uses the visual viewport when available, clamps to viewport edges, and anchors above the card/finger. It displays full start/end values and day-relative context for cross-midnight intervals.

Move and resize previews feed the same full interval into the final schedule path. The clipped-edge resize correction applies the visible snapped delta to the full endpoint, retaining an existing portion on the adjacent day.

The existing pointer lifecycle guarantees end callbacks on commit and cancellation. Those callbacks remove time feedback, drop previews, drag ghosts, and drag classes. Close cancels the gesture and clears remaining feedback; creation handoff also cancels before opening the new modal. Todo/trash targets remove the time bubble while retaining the relevant drop feedback.

Vibration capability is read and bound once at the Day interaction boundary. Only touch changes to the snapped interval request a 7 ms pulse. Repeated geometry and mouse movement remain silent. A refused or throwing capability is disabled without interrupting scheduling or displaying a warning.

## Regression quality

The new pointer tests exercise production Day and gesture handlers through a browser-shaped DOM/event boundary. They check submitted schedule patches, threshold behavior, blank-space movement, bubble geometry/cleanup, cross-midnight ranges, vibration call frequency/binding, fractional and intermediate animation positions, cyclic cancellation, reduced motion, and object identity for the retained editor and timeline.

The fixture changes add the actual header, element creation, geometry, and frame-time boundaries needed by the new behavior. They do not insert production fallbacks to accommodate incomplete mocks. The existing scheduling, conflict, draft, upload, and cancellation assertions remain in place.

The already-reviewed creation tests cover synchronous focus and deferred focus retention, exact categories and duration, storage/draft lifecycles, uploads, and the corrected custom-category migration. No additional dependency or competing gesture engine was introduced.

## Validation evidence

This final review did not repeat passed tests: inspection raised no new concrete concern requiring a targeted reproduction.

Reported implementation/root evidence:

- Day owner: **88/88 passed** across `editor-day-sheet.cjs`, `timeline-gestures.cjs`, and `timeline-pointer-integration.cjs`, with clean scoped whitespace checks.
- Root scheduling integration: **26/26 passed** after shared fixture updates.
- Root fresh full suite: **386/386 passed** with:

```sh
node --test --test-isolation=none tests/core.test.cjs tests/lite/core.test.cjs tests/lite/store.test.cjs tests/cloud/*.cjs tests/cloud/backend.test.mjs
```

Root also reports native browser checks showing that Day + and `/` synchronously focus creation, closing creation retains the selected task and timeline scroll position, coverflow dragging and rapid previous navigation wrap while retaining detail, and body dragging moves the scheduled interval correctly. Root's earlier 390 px creation checks confirmed category/duration layout and focus. These are parent-observed results; this reviewer did not independently run browser automation.

## Final disposition and limits

The changed 1.8 implementation is accepted by code review. Production assembly, the official Sites build, and publication remain root's final workflow gates; this report does not claim their completion.

Physical vibration and automatic mobile keyboard presentation remain browser/OS/device dependent. The implementation and test reports accurately distinguish requesting those capabilities from observing them on hardware.
