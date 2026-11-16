# OneDay 1.7.0 · Release and source handoff

Prepared on **2026-10-27** from `c46ee335ea06ea8d64618332ce6ac8454d9cda2d` (1.6.0 / Site version 3). This document describes the reviewed implementation; the publication receipt is recorded separately after the exact source commit is pushed.

- Existing project: `[redacted-site-id]`.
- Existing URL: [OneDay]([redacted-site-url]
- Publish to the original owner-private Site, with its existing database and file bindings.

## What changed

1. **Immediate scheduling.** Timeline movement and resizing show their resulting position immediately while persistence runs. Pending store projections sit over confirmed data, so an older acknowledgement cannot erase a newer move. Failed writes roll back to confirmed data. Conflict decisions continue to revalidate before writing.
2. **Markdown tools and typography.** Shared editors now expose H1/H2/H3, bold, italic, strike, checklist, unordered and ordered lists, quotation, link, inline code, code block, divider and attachments. Settings provide global Markdown line-height, space-before and space-after sliders, live preview and reset. The preference applies throughout the current device and persists locally.
3. **Separate pending Coverflow.** Cyclic cards sit above the Day workspace. Horizontal swipes and arrows cycle; a drag into either timeline schedules the same record. Diagonal gestures can become drops after initially moving horizontally. Returning a task to Coverflow clears its dates and returns it to pending via the existing status API. Dragging to the top trash target soft-deletes with immediate undo; action toasts remain available for nine seconds. The previous parking strip is removed from the rendered Day view.
4. **Usable subtasks.** Double click/tap or the child control expands a child timeline. Users can add, edit, select and schedule children independently. Unscheduled children display their parent's range with an explicit inherited label; this display does not silently write dates. Overlapping children receive separate lanes. Narrow screens show the child lane with a back control. Cross-midnight task segments retain their full duration when moved.
5. **Task details.** Two centered tabs, 任务内容 and 任务日志, support directional swipes on noninteractive areas. The editor fills the remaining pane height. A draggable status rail, urgent/important quadrant and inline tags sit above it; the old properties tab and header start/check actions are removed from Day.
6. **One creation flow and record library.** The main library is named **记录**. `/` and `+` open one editor with a category rail defaulting to **待办** and an **添加** button. All captures appear in the unified library. Existing task and note storage is reused without duplicating records or bulk migration. Category changes retain one editor buffer, upload lifecycle and draft. Legacy drafts migrate independently and do not reappear after an intentional clear or successful submission.
7. **Four new themes.** 暖纸, 雾蓝, 松间 and 深海 are added alongside previous choices. Existing saved theme IDs remain valid; new installations default to 雾蓝.
8. **Work reporting.** 统计 joins 日历 and 看板. Week, month, quarter, half-year, year and custom ranges use explicit Beijing time boundaries. The page summarizes recorded execution time, confirmed completions, activity dates, tags, notes and trends. Parallel/parent-child execution intervals are deduplicated. Editable report drafts include evidence, completed and ongoing work, recorded progress, risks and next plans, with preview, copy and Markdown export. Per-range edits persist locally. Historical deleted-task activity remains labeled; plans are not counted as executed work.

## Verification

The final integrated Node suite passed **361 / 361**, with zero failures, cancellations or skipped tests. Production HTML assembly passed JavaScript syntax and no-demo-data checks. The official Sites production build succeeded after both QA-only pages were removed; neither the public source nor built client output contains those fixtures:

```bash
node --test --test-isolation=none tests/core.test.cjs tests/lite/core.test.cjs tests/lite/store.test.cjs tests/cloud/*.cjs tests/cloud/backend.test.mjs
```

Meaningful new regressions cover delayed and failed writes, rapid status changes against server-generated timestamps, deletion/undo and retained logs, diagonal Coverflow dragging, cross-midnight estimates, child lanes, category/upload/draft lifecycle, Markdown selection, typography persistence, report period boundaries, interval unions, report actions and refreshing directly into the statistics view.

Native browser acceptance used the official managed preview with isolated example data. Writes were deliberately delayed by 1,600 ms in the desktop fixture; this delay and the fixture are not included in the deployed application.

| Flow | Observed result |
| --- | --- |
| Coverflow to timeline | Diagonal drag placed the existing task at 12:00–13:00. |
| Resize and move | Resized to 12:00–13:30, then moved to 13:00–14:30, preserving the new duration. |
| Back to pending | Schedule cleared, task returned to Coverflow and status became 待开始. |
| Top trash and undo | Dropped card disappeared and immediate undo restored it. |
| Subtasks | Inherited child was independently placed at 11:20–12:20; double-click toggled its lane. |
| Detail interaction | Horizontal swipe opened logs; progress text persisted; native status and quadrant dragging worked. |
| Record capture | `/` opened one editor; formatting and category changes retained text; 70-minute capture appeared in the unified library. |
| Typography and themes | Sliders updated computed line height and preview; theme preferences survived reload. |
| Reporting | Week/quarter/half/year switching retained edited weekly text; preview contained the saved task progress; refreshing statistics resumed correctly. |
| Responsive layouts | Statistics, Day, creation and settings had no page-level horizontal overflow at 390 px. |

The export action produced the application's success feedback. The browser automation connection did not expose a downloadable file event, so actual file receipt is not asserted; export content/naming and clipboard success/fallback paths passed focused tests. The narrow-layout check is a 390 px iframe, not a physical-device touch/IME test. Production user-data mutation and an actual Workers-runtime test were not part of this acceptance run.

![Day workspace using isolated example data](../qa/oneday-1.7-day.jpg)

![Statistics using isolated example data](../qa/oneday-1.7-stats.jpg)

## Source map

| Module | Responsibility |
| --- | --- |
| `src/lite/store.js` | Confirmed data, pending projections, serialized status transitions, recoverable task deletion. |
| `src/lite/dialogs.js` | Unified creation, independent legacy-draft migration, scheduling review and shared deletion. |
| `src/lite/timeline.js`, `day-workspace.css` | Coverflow, child timelines, immediate gesture presentation and two-tab detail pane. |
| `src/lite/editor.js` | Shared Markdown editor, formatting, link popover, selections and uploads. |
| `src/lite/appearance.js`, `appearance.css`, `themes.js` | Typography settings, preview and palettes. |
| `src/lite/reports.js`, `reports.css` | Evidence-backed period reports, charts, draft persistence and export actions. |
| `src/lite/views.js`, `records.css` | Unified record library, report mount lifecycle and responsive cards. |
| `src/lite/app.js`, `ui.js`, `shell.html` | Navigation, keyboard entry, UI preferences and notifications. |
| `tools/build_lite_sites.py`, `app/oneday.html` | Production source assembly. |

No dependencies or database tables were added. Existing authentication, project bindings and sharing audience are preserved by the publication workflow.
