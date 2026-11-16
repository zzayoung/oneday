# OneDay Lite 1.5 · Schedule and mobile interaction

An incremental release of the existing private OneDay Site at `[redacted-site-url] continuing the original Tasks / + / Notes workflow.

## Scheduling

- Creation, the plan editor, calendar date moves, parent changes and Day time changes use one conflict-review path. Ordinary tasks share the main track; child tasks are checked against siblings under the same parent.
- A conflicting proposal shows its exact time, the overlapping tasks, a concrete available slot when one exists, and explicit cancel / use slot / parallel actions. Only the candidate task is changed after a confirmed choice.
- Typed times retain their exact duration. Suggested slots start on a 15-minute boundary, and existing wall-clock timestamps are interpreted consistently without shifting legacy `Z` values into another local hour.
- The controller refreshes records before reviewing a proposal and again after a choice. A final authoritative read guards every scheduling field before the versioned update. If the edited task's scheduling fields changed on another device, it stops with a recoverable conflict; independent title edits still merge.
- An unconfirmed creation is retried with its original request ID, record ID and complete payload before another conflict review. This also preserves a previously chosen available slot or parallel setting after a lost response and reload.
- Switching a conflicted task creation to Note cancels the hidden scheduling choice, allows the note to save, and retains the task draft.

## Day on a phone

- A card tap selects it; card-body and blank-track swipes browse the time axis. The selected card exposes a move handle and start / end grips for deliberate scheduling.
- An active gesture belongs to one pointer. Cancellation, lost capture, window blur, Escape and closing the sheet clean up the preview without saving it. A release within the same snapped interval skips the write.
- If saving fails and the user keeps the Day sheet open, the canceled scheduling prompt is removed, the sheet becomes editable again, and the title/body drafts remain available.
- Background refresh waits for the active gesture to finish. The eventual schedule request retains the task snapshot captured at gesture start.
- A touch double tap opens or closes the child axes. Enter and Space select a focused task card, with visible keyboard focus and a full title/time accessible label.
- The Day sheet keeps its time axis and detail pane together on narrow screens, with larger controls and text. Short cards prioritize their title while preserving the existing bar geometry. The move handle is capped relative to its card width so narrow parallel lanes keep a body and resize area; exact fields remain available in the detail pane.

## Notes and editing

- The Notes list scrolls through every row. Long existing notes and new-note drafts scroll inside their editor while metadata, type controls and the Markdown toolbar remain reachable.
- Phone text and form controls are larger, with more usable spacing. The existing recoverable draft and attachment lifecycle continues to handle failed saves and pending uploads.

## Release boundary

Application and backup metadata report `1.5.0`. Source and deployment stay attached to project `[redacted-site-id]` and its existing owner-private audience.

Scheduling checks are client-side reviews of freshly read records, with record-version protection for the edited task. They do not provide an atomic reservation across multiple tasks. Existing all-day and cross-day items keep their established parked-item behavior outside the exact-time track.

See `SITES-1.5-VERIFICATION.md` for the executed checks and the browser acceptance boundary for this release.
