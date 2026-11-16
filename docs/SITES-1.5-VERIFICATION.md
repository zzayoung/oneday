# OneDay Lite 1.5 · Sites verification

Verification record prepared on 2026-10-19 for application/server version `1.5.0`. The target remains the existing private OneDay Site, project `[redacted-site-id]`.

This record covers the completed source, runtime, browser and formal-build checks immediately before publication. The native Sites saved version and deployment record identify the published source and its final deployment status.

## Automated regression

The combined release suite completed with **253 tests passed, 0 failed, 0 skipped; exit 0**.

```bash
node --test --test-isolation=none tests/core.test.cjs tests/lite/core.test.cjs tests/lite/store.test.cjs tests/cloud/*.cjs tests/cloud/backend.test.mjs
```

Coverage includes the retained core, store, editor/draft and cloud regressions; scheduling review and retry behavior; pointer gesture cancellation; and the actual Day Sheet event handler through a small VM DOM boundary. The latter exercises touch-body and blank-track swipes, taps, deliberate move/resize gestures, competing pointers, keyboard selection, refresh during editing, and close cleanup.

The refused-close regression uses the real draft close path: title and body are edited, the Store save fails, and the close confirmation is declined. It checks that the sheet remains editable, the drafts remain available, no scheduling fields are written, and the canceled conflict panel disappears.

Relevant regression files include `tests/cloud/timeline-gestures.cjs` and `tests/cloud/timeline-pointer-integration.cjs`. The suite result above is the completed release run; final packaging is recorded separately below.

## Actual Workers, D1 and R2 runtime

```bash
node tests/cloud/backend-runtime.test.mjs
```

Result: **passed; exit 0** in the actual local Workers runtime. The checks cover D1 operations and transaction behavior, R2 bytes, record-version compare-and-swap (CAS), import, receipt replay, and persistence across runtime restart.

These checks use controlled local data and explicit test identities. They do not establish acceptance in an authenticated user's production account.

## HTTP integration through the managed Site preview

The managed-preview HTTP smoke suite completed **12 checks; all passed**. Two independent local clients exercised:

- Authentication boundaries and owner isolation.
- Exact-minute task times and task body persistence.
- Stale-version conflict handling.
- Atomic task-status and activity-log changes.
- Actual PNG and text bytes stored in and retrieved from R2.
- Import behavior.

The recovered checkout initially selected the portable execution profile. The official `configure-execution-profile.mjs` workflow restored `managed-linux`, after which managed-preview access and the HTTP smoke checks succeeded. Only the existing migration was applied locally during preview setup. This verification did not mutate production schema or production data.

## Browser UI verification

The actual managed browser opened the normal OneDay entry without an authenticated session and displayed the account/sign-in requirement. Interaction checks then used temporary local QA pages populated with controlled sample records and a separate QA storage scope.

The following checks were completed at mobile viewports of **390 × 844** and **360 × 640**, using browser mouse input:

| Area | Observed result |
| --- | --- |
| Notes collection | The list contained 26 notes and could be scrolled through to the last row. |
| New long note | An 18-paragraph draft could be scrolled to its end, edited there, saved, and reopened with the full content retained. |
| Existing note | The editor could be scrolled to the end while the Markdown toolbar, Done control, and pin action remained reachable. |
| Exact-time creation conflict | A proposed `10:10–10:20` task showed the existing `10:00–11:00` conflict. Cancel retained the creation draft. |
| Offered available slot | Accepting `11:00–11:10` saved successfully; reopening retained those exact times and the ten-minute duration. |
| Day detail and guidance | The selected task's properties were visible alongside the timeline, and the touch-interaction hint was fully visible. |

The final Notes toolbar padding refinement was visually verified at 360 pixels wide after scrolling to the end. The editor host and toolbar both started at `156.203125px`; `scrollTop 1555 + clientHeight 371 = scrollHeight 1926` confirmed the end was reached. The last paragraph, Done control, and pin action were visible.

A 1280-pixel-wide desktop Day properties screenshot was also inspected and the layout was readable. That review identified an oversized, centered checkbox inherited from the existing grid styling. A shared flex-alignment rule and 20-pixel checkbox correction were applied and visually rechecked. The final DOM measurements confirmed `display: flex`, centered alignment and a `20 × 20px` checkbox beside its label. No JavaScript changed after the reported 253-test pass.

These are actual browser layout, mouse-input, scrolling, and persistence checks at mobile dimensions. Physical touch gestures, a real mobile Chinese keyboard/IME, and authenticated phone/desktop use across devices are **not claimed as completed**. Automated pointer tests supplement this browser coverage but do not replace physical-device acceptance.

## Independent review and resolved issues

Four independently reviewed issues were corrected:

| Issue | Resolution |
| --- | --- |
| Parent-change race during scheduling | The final authoritative scheduling check includes the task's parent/scope fields before the versioned write, so a changed parent cannot silently reuse an obsolete review. |
| Hidden scheduling prompt after switching Task to Note | Switching modes cancels the outstanding task choice, lets the note save, and retains the task draft. |
| Move grip filling a narrow card | A shared `min(26px,35%)` cap limits the move grip and the resize inset; clipped grip contents preserve the intended hit area. |
| Stale conflict prompt after a refused close | Failed-close cleanup repaints after restoring editability, removing the canceled conflict while retaining title/body drafts. |

Pending creation replay was also checked: after an unconfirmed/lost response, retry uses the original request ID, record ID, and complete payload. A previously selected available slot or parallel setting is preserved instead of being replaced by a newly computed proposal.

## Final build and publication preparation

| Release check | Completed result |
| --- | --- |
| Combined automated regression | Passed: 253 / 253; no failures or skips. |
| Actual local Workers runtime | Passed. |
| Managed-preview HTTP smoke | Passed: 12 / 12 checks. |
| Browser interaction checks listed above | Completed with controlled local fixtures and mouse input. |
| Final Notes toolbar padding visual recheck | Passed at 360 pixels wide, including the editor's end and the Done/pin controls. |
| Final desktop Day checkbox alignment visual recheck | Passed at 1280 pixels wide. |
| Removal of temporary `public/__qa.html`, `public/__qa-mobile.html`, and `dist/lite` | Completed before the final build. |
| CSS parsing and `git diff --check` | Passed. |
| Final generated Sites HTML | 349,844 bytes; all inline JavaScript syntax checks passed; no demo database. |
| Final formal Sites build | Passed; all five Vinext build stages completed, exit 0. |

The final HTML was generated with `python3 tools/build_lite_sites.py`, followed by the official Sites `build-site.mjs` helper. The final CSS refinements are included in this build. No application build input changed afterward.

The publication target is the same project and existing owner-private audience. The official source workflow saves and pushes this source and packages its build output; native private publication then creates the corresponding saved version and deployment. Successful publication and the production URL must be taken from that native deployment result. Post-publication verification checks the application version, D1/R2 health, entry response and authentication boundary through read-only requests, without creating production records.

## Acceptance boundary

Scheduling refreshes records on the client and protects the edited record with per-record CAS. It does **not** reserve time atomically across multiple tasks; concurrent edits to different tasks can still produce an overlap after separate successful checks.

Exact typed task times are preserved. The existing bar rendering geometry, including its minimum visible height, remains in place; the mobile short-card change prioritizes title visibility within that geometry. Existing all-day and cross-day items retain their established parked-item behavior.

Cloud runtime tests, independent local HTTP clients, and controlled local browser fixtures establish the completed coverage described here. They do not establish authenticated production cross-device acceptance, physical-touch/IME acceptance, or migration of existing WorkBuddy data and attachment bytes.
