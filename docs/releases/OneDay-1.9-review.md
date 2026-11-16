# OneDay 1.9 review record


Final root regression: 457/457 passed, 0 failed/skipped. Production assembly 500,455 bytes; official Sites build passed. Native desktop and 390×844 phone layout checks documented in OneDay-1.9.0.md.


## Recorded rulings
Ruling: Parallel bounded file ownership is appropriate under higher-level developer instruction — independent modules save time; shared files have one owner.
Ruling: Proceed without plan approval — user explicitly requested start of 1.9 and existing Site sync, and developer directs autonomous continuation.
Ruling: Current/future rescheduling of a completed task reopens pending; no automatic timer start — schedule is intention, not measured execution.
Ruling: Recorded “直接打卡” means direct card opening in its explicit remove-Open-button context, as previously documented; no new check-in model.
Ruling: Preserve Tab indentation required by user; Escape then Tab/Shift+Tab provides keyboard focus escape.


---

# OneDay 1.9 final whole-branch review

Reviewed base `3134f99a61fc7e1e708ebb97e9cb2f2d82e0f605` through `d8deb07`, against the 1.9 plan and design spec. Read-only review of application/source/history; this report is the only reviewer-written file. No subagents or broad test reruns.

## Strengths

- The integration retains the existing store, draft, and actual-time accounting paths. Automatic schedule status is derived after conflict resolution; a rejected schedule does not independently persist completion, and a failed subsequent status write reports partial success. Pending work is not treated as execution duration.
- Navigation keeps the outgoing DOM alive and uses inert incoming snapshots. Main/Day renders defer while gestures settle, cancellation restores the original nodes, and Day cleanup releases its controller. The `2d83035` capture fix checks the actual capture target before treating lost capture as cancellation; the callback-destruction guard from `87a5cd6` also prevents a commit after disposal.
- Keyboard changes cover nested list serialization, visual caret positions within inline formatting/images, composition exclusion, grouped list indentation without converting selected headings/code, history, format-menu dismissal, heading continuation, and literal BR preservation in code blocks. These are substantive behavioral regressions rather than only source-shape assertions.
- Calendar arrangements are explicitly year-scoped, solar terms have a separately documented supported range, and user markers retain priority. Current-week weighting and phone holiday captions are integrated without changing the actual-execution basis of calendar water.
- The numeric-offset correction `d73973d` removes both `Z` and colon-form numeric suffixes before local wall-clock comparison and preserves seconds/milliseconds. Its regression explicitly covers positive/negative offsets and endpoint precision.
- Both assemblers register the new modules in the required order. Fullscreen controls use the common dialog path and observe native fullscreen exit; record card nested controls are excluded from card-body opening.

## Issues

### Critical (Must Fix)

None found.

### Important (Should Fix)

1. **Automatic status can apply to a newer schedule from another device.**
   - **Files:** `src/lite/store.js:79–80`, `src/lite/store.js:105–109`.
   - **Reproduction:** Device A saves a past schedule. Between the schedule update and `transitionRaw`'s fresh read, Device B changes that same task to a future schedule without changing its status/start timestamp. `transitionRaw` only checks status/start, accepts the freshly fetched version, and completes the future task. A narrow Node reproduction with a Sites-shaped adapter produced a final row scheduled for `2026-10-30T10:00:00Z`–`11:00:00Z` with status `完成`.
   - **Effect:** A stale scheduling decision overwrites the meaning of a newer schedule, contradicting the final-accepted-schedule rule. The use of `expectedVersion: t._version` does not detect the race because `t` is already the newer row.
   - **Recommendation:** Give the automatic transition a scoped guard against the schedule that was just saved, checked on its fresh row before any early success/transition. Compare the saved schedule guard fields, or enforce the saved version if rejecting unrelated intervening edits is acceptable. Keep the subsequent atomic endpoint version check so edits after this check are rejected too. On conflict, retain/report partial schedule success and do not write automatic status.
   - **Regression:** Inject a remote future reschedule after the schedule update but before the automatic transition read. Assert no status call, no invented log, the remote schedule remains intact, and the caller receives the existing partial-success error. Preserve normal rapid local past→future behavior.

2. **Legacy tasks with an absent status fail automatic completion after their schedule has saved.**
   - **File:** `src/lite/store.js:108` (entered by the new path at line 80).
   - **Reproduction:** Reschedule an existing row without `任务状态` into an elapsed interval. The transition normalizes the fresh row's missing status to `C.STATUS[0]`, then compares it with the unnormalized `expected['任务状态']`, so the row conflicts with its own snapshot. Root's final full run independently reproduced this in `tests/cloud/task-workflow.cjs:102` (`parking assignment previews the selected date and estimate, and only schedules on save`).
   - **Effect:** The schedule is saved, but the requested automatic status fails with a false other-device warning. This breaks the existing legacy fixture and compatibility with imported/older records.
   - **Recommendation:** Normalize the expected status with the same pending fallback as the actual status when checking transition identity. Retain the start-time guard and genuine status conflict detection.
   - **Regression:** Test absent status on both current and expected row, including elapsed scheduling through the real save path; also retain an assertion that a genuinely different remote status is rejected.

3. **Phone fullscreen collapses the two-row record header and clips global controls.**
   - **Files:** `src/lite/fullscreen.css:5`, interacting with `src/lite/navigation.css:7–8`.
   - **Reproduction:** At 390 px, switch to Records and enter fullscreen/expanded fallback. The later `.app-expanded .topbar { height:48px }` overrides the record header's 104 px height while leaving its 46 px bottom padding and the absolute category strip. Root confirmed in native browser QA that brand/search/fullscreen/settings controls are clipped at the top; only their lower portions remain visible.
   - **Effect:** The fullscreen layout obscures primary controls, including the control used to exit fullscreen, and reverses the mobile record-header fix.
   - **Recommendation:** Preserve the record header's reserved second row in expanded mode through a scoped mobile notes/fullscreen rule, or restrict the compact fullscreen height to the single-row task header. Keep category scrolling and phone search available.
   - **Regression:** Check 390 px Records in normal and expanded states with the real CSS cascade; verify both rows and all global buttons fit and remain usable, then check task-mode fullscreen still uses its intended compact header.

### Minor (Nice to Have)

None raised. Cosmetic observations were not promoted into blockers.

## Recommendations

Resolve the three related integration findings in one bounded fix wave, then perform scoped re-review of the transition guard/legacy normalization and mobile expanded header. Root owns the final suite and native browser acceptance; do not substitute source-pattern assertions for the real CSS-layout check. No dependency or data-schema change is needed.

## Evidence and limits

- Inspected the complete review package's production modules in passes, the plan/spec, progress ledger, changed regression coverage, and surrounding store/draft/report integrations.
- Independently reproduced the inter-device schedule/status race using a small in-memory adapter, without editing application or test files.
- Root reports full suite results: 452 tests, 451 passing, one failing legacy-status case described above. The reviewer did not rerun the broad suite.
- Phone fullscreen clipping is corroborated by root's native 390 px QA after the reviewer identified the concrete cascade conflict. Root's latest heading/code-BR browser results and ongoing Day draft/mobile checks are evidence from the executor, not independently rerun here.

## Declined to judge

- Final release/version metadata, production `app/oneday.html` assembly, removal of temporary QA pages, exact published source commit, deployment/access verification, and source ZIP: explicitly pending root-owned release steps, not implementation bugs in this review range.
- Real physical phone keyboard, vibration, and OS-specific fullscreen behavior: requires hardware/runtime evidence beyond this read-only source review; executor must state the actual tested environment.
- Legacy agenda-only `plan-today` action: the new active calendar renderer does not render the agenda, so this dormant preexisting action was not treated as a user-reachable 1.9 scheduling regression. If the agenda is restored later, route its scheduling action through the shared schedule acceptance/status path.

## Assessment

**Ready to merge? With fixes.**

The branch substantially implements the planned 1.9 behaviors and preserves the key draft and actual-time boundaries. Fix the concurrent schedule/status race, legacy status normalization, and confirmed phone fullscreen header regression before publication; the current one-failure full-suite result is not a clean release gate.



---

# OneDay 1.9 bounded final-review fixes

## Scope and commit

Completed the single fix wave requested from `final-review.md` against `d8deb07`.

Commit: `396a37c` — `fix: guard automatic schedule status and phone fullscreen`

Committed files only:

- `src/lite/store.js`
- `src/lite/fullscreen.css`
- `tests/cloud/schedule-status.cjs`

Root-owned release/version metadata, generated application HTML, QA pages, browser artifacts, backend tests, and release documents were neither edited nor staged by this worker. This report is in the existing ignored review directory.

## Changes

1. **Saved schedule guard survives the second read.** `patch` keeps the caller's schedule guard fields separate from its status/start checks, then forwards the schedule guard fields with the confirmed saved task to `transitionRaw`. The fresh transition row is checked against that saved task before reading its effective status, before the already-at-target early return, and before a status operation. A remote reschedule therefore preserves the existing partial-success error and cannot be automatically completed using the stale schedule decision. The atomic endpoint still receives the fresh row's `expectedVersion` for changes occurring after this check.
2. **Legacy status identity is normalized symmetrically.** The expected snapshot now uses the same pending fallback as the current row. Missing statuses no longer cause a task to conflict with itself. The genuine status difference and start-time checks remain in place.
3. **Phone Records retains its second header row in expanded mode.** A scoped `max-width:640px` rule restores the 104 px height for `.app-expanded .notes-mode .topbar`. The existing 48 px expanded task header rule remains unchanged. No source-pattern CSS test was added; native acceptance belongs to root.

## Reproduction and focused verification

The new tests were added before production edits. Before the fixes:

- The new elapsed-scheduling case with absent current/expected status failed with the false other-device partial-success error.
- Both post-save remote-reschedule cases failed with a missing expected rejection: one entered the native status operation; the other took the already-at-target success path.
- The existing `parking assignment previews the selected date and estimate, and only schedules on save` test failed with the same legacy-status error.
- New status/start conflict regressions and the existing rapid local past-to-future test already passed.

After the minimal fixes, these complete focused files were run separately and all passed:

| Command | Result |
| --- | --- |
| `node tests/cloud/schedule-status.cjs` | 16 passed, 0 failed |
| `node tests/cloud/task-workflow.cjs` | 18 passed, 0 failed |
| `node tests/cloud/store-cloud.cjs` | 4 passed, 0 failed |

Total: **38 passed, 0 failed**.

The schedule race tests assert partial success, no native status call, no new log, one schedule write, and retention of the newer remote schedule/status. Other focused coverage verifies rapid queued past-to-future moves, accepted free-slot status, write failures, genuine status/start conflicts, server CAS forwarding, legacy parking assignment, and actual execution segment meaning. `git diff --check` passed for all three committed files before commit.

## Limits and remaining root-owned gates

- No broad suite, browser automation, build, assembly, publication, or source archive was run by this worker, as requested.
- Root should perform the real 390 px CSS-cascade check for Records in normal/expanded modes and task-mode fullscreen. The layout rule has been changed, but this worker does not claim native visual acceptance.
- Final full-suite and release acceptance remain with root. No dependencies, schema changes, additional helpers, or unrelated refactors were introduced.



---

# OneDay 1.9 scoped final re-review

Range: `d8deb07..396a37c`. Scope: the three original final-review findings and regressions introduced by their fix. Reviewed the fix package, implementation report, actual call sites, changed tests, and mobile QA image. No application/index/HEAD changes; this report is the only reviewer-written file for this pass.

## Strengths

- The automatic transition receives the confirmed saved task and the caller's schedule guard fields. `src/lite/store.js:105` checks the fresh row before the `cur === next` early return, closing both the stale-write and false-success variants of the original race. `src/lite/dialogs.js:84` supplies the complete schedule field set to this path. The endpoint still receives the freshly checked row's version, preserving CAS protection for changes after the check.
- Legacy normalization is symmetric at `src/lite/store.js:109`, and the separate status-start timestamp guard remains intact. New regressions explicitly verify both genuine status and timestamp conflicts remain rejected.
- The expanded Records height override at `src/lite/fullscreen.css:6` is narrowly scoped to the same phone breakpoint as the two-row layout. It leaves the compact expanded Tasks header intact.
- New race coverage checks the actual remote row and verifies zero transition calls/logs, one schedule write, and the partial-success contract, including when another device has already set the target status.

## Original findings

| Finding | Result | Evidence |
| --- | --- | --- |
| Concurrent remote reschedule followed by stale automatic completion | Resolved | Fresh schedule guard precedes early success and status write; both race variants pass. |
| Absent legacy status falsely conflicts with its own snapshot | Resolved | Symmetric pending fallback; elapsed scheduling passes while genuine status/start conflicts remain rejected. |
| Phone expanded Records header clips primary controls | Resolved | Scoped 104 px override; reviewer inspected `docs/qa/oneday-1.9-records-expanded-mobile.jpg`, which shows both header rows and global controls visible. Root additionally measured normal/expanded Records outer height 104 px and Tasks expanded outer height 48 px and verified exit restores normal layout. |

## Issues

### Critical (Must Fix)

None.

### Important (Should Fix)

None remaining in this scoped fix wave.

### Minor (Nice to Have)

None raised.

## Verification

- Reviewer independently ran `node tests/cloud/schedule-status.cjs`: **16 passed, 0 failed**, including both new race cases, legacy normalization/conflict cases, accepted free-slot behavior, partial failures, actual running-time closure, numeric-offset precision, and rapid local past-to-future moves.
- `git diff --check d8deb07..396a37c` passed.
- The fix worker reports the related task-workflow and store-cloud files also pass; root owns the full-suite run, which was still in progress when this scoped review began.
- Visual review used the executor's retained native-browser screenshot, not a reviewer-controlled browser rerun. Root's measured geometry and exit check corroborate the screenshot.

## Recommendations

No additional implementation changes are requested. Complete the already planned root-owned full-suite and release/publish gates against the final assembled source.

## Declined to judge

- Broad unchanged application behavior: already covered by the prior whole-branch review; this pass is explicitly limited to the three fixes and their new regressions.
- Release metadata, generated production HTML, removal of QA pages, deployment/access/source verification, and source archive: pending root-owned release work outside this fix range.
- Physical-device keyboard/vibration/OS-specific fullscreen behavior: not established by this source review or the retained browser screenshot; retain the stated environment limitations.

## Assessment

**Ready to merge? Yes.**

All three original findings are addressed by narrowly scoped changes with appropriate regression evidence, and this review found no new regression in the fix wave. This approval clears the code-review findings; final full-suite and publication gates remain with root.
