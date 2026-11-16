# OneDay 1.6.0 · Release and handoff

Prepared on **2026-10-27**. Implementation and local browser acceptance are complete; **publication is pending at document authoring**.

- Baseline: `4e45cec1f44028c9e61d9d765b301dd4e4a41dfb` (1.5.0).
- Existing project: `[redacted-site-id]`.
- Existing URL: [[redacted-site-url]
- Preserve the existing project, URL, and **owner-private** audience when publishing. This note does not establish a deployed version or deployment result.

## Delivered behavior

- **One task document:** creation has one large “要做什么” Markdown editor, with no separate title, date, start, or end inputs. Full content is retained; its first line derives the plain-text list title, capped at 300 characters. Existing separate titles and bodies are combined on read without a bulk migration.
- **Planned duration:** “计划干多久” uses a slider with a 10-minute minimum, 10-minute steps, 480-minute maximum, and 60-minute default. Draft text and selected duration survive reopening.
- **Creation context:** global **+**, **/**, ordinary creation, and subtask creation produce unscheduled tasks. A timeline click supplies the current start; end is start plus duration, including rollover into the next day. Saved draft timestamps cannot override a new click or make global creation scheduled.
- **Shared editing:** ordinary task detail and Day use the same live Markdown editor, retaining drafts, autosave, and attachments. Paragraph breaks, caret restoration, formatting controls, checklist changes, and clean Markdown paste received targeted fixes. Unified title/content saves now preserve one logical document when an older client changes the separate title field.
- **Day scheduling:** undated active tasks appear in the top parking area with an explicit “安排” action. Moving, resizing, and timeline creation use 10-minute increments. Drag/resize no longer triggers an accidental backdrop close, and editing/repainting preserves the timeline scroll position.
- **Readability:** larger task/time text and a more distinct selected-task editing panel improve desktop and narrow-screen use.
- **Recoverable deletion:** ordinary detail and Day expose a visible delete action. Confirmation discloses descendants and running tasks; running tasks pause and retain their time logs before trashing. Drafts and descendant uploads finish before deletion. Cancellation, recycle-bin restoration, and undo remain available; a failed pause prevents deletion.

## Verification

The final release Node regression run passed **294/294 tests**, with zero failures, cancellations, or skipped tests. The official Sites production build succeeded after the temporary QA pages were removed. Production HTML assembly also passed its inline JavaScript syntax and no-demo-data checks.

```bash
node --test --test-isolation=none tests/core.test.cjs tests/lite/core.test.cjs tests/lite/store.test.cjs tests/cloud/*.cjs tests/cloud/backend.test.mjs
```

Native browser checks ran on the **official managed preview**, using an **isolated local-data adapter**:

| Flow | Observed result |
| --- | --- |
| Global + and / | Both opened creation; a 70-minute task saved without scheduled start/end. |
| Task content | First-line title and checklist state persisted after reopening. |
| Ordinary deletion | Cancel retained the task; confirm moved it to the recycle bin; restore recovered it. |
| Day deletion | Delete and undo restored the task. |
| Explicit arrangement | A 70-minute undated task defaulted to `09:00 → 10:10`. |
| Timeline gestures | Native drag and resize kept Day open. |
| Scroll retention | Timeline `scrollTop` remained `535 → 535`. |
| Markdown replacement | Ctrl+A and paste produced a clean heading/checklist, preserved after reopening. |
| Contextual creation | Clicking `17:20` with 70 minutes produced `18:30` as the end. |
| Narrow layout | Creation and Day had no horizontal overflow in a 390px-wide iframe. |

The narrow-layout check is **viewport coverage**, not physical-device acceptance. Physical-device IME behavior and authenticated production-data mutation were not part of this QA. The Node result above does not claim a Miniflare or actual Workers-runtime run.

![Desktop acceptance view using isolated test data](../qa/oneday-1.6-desktop.jpg)

## Source handoff

| Entry point | Responsibility |
| --- | --- |
| `src/lite/core.js` | `taskTitle`, `taskContent`, duration and timeline calculations. |
| `src/lite/dialogs.js` | Creation, unified draft sessions, ordinary detail, arrangement, shared `deleteTask`. |
| `src/lite/editor.js` | Shared live Markdown surface, serialization, selection, composition and attachments. |
| `src/lite/timeline.js` | Day workspace, parking, descendant draft/upload lifecycle and gestures. |
| `src/lite/ui.js`, `src/lite/app.js` | Backdrop behavior, global entry points and action routing. |
| `src/lite/styles.css` | Readability, selected editor contrast and responsive layout. |
| `tools/build_lite_sites.py`, `app/oneday.html` | Sites page assembly and generated application payload. |
| `server/api.mjs`, `src/lite/cloud.js` | Application/backup version metadata updated to `1.6.0`. |

Existing editor edge limits remain around forced flush during active IME composition and native undo across Markdown DOM refreshes. The targeted fixes and viewport checks do not establish complete coverage of those browser/device paths.

Publish through the existing Sites source workflow, retaining the owner-private audience. Record the resulting saved version and deployment status separately, and use the returned deployment evidence for the final publication claim.
