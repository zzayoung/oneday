# OneDay Lite 1.3 Rich Workspace — Design Spec

## 1. Goal

OneDay Lite 1.3 keeps the product intentionally small—**Tasks + Notes**—but makes both surfaces mature enough for long-term daily use. The primary experience is not a dashboard and not a sequence of nested pages. It is one compact workspace where the user can see the month, open any day as a bottom sheet, understand that day's schedule at a glance, inspect/edit the selected task in place, and store durable notes with the same editing quality.

Success means:

- The month view gives immediate monthly situational awareness without duplicated task lists or dashboard cards.
- Opening a day feels like lifting a work surface over the calendar, not navigating away.
- The day sheet provides strong control of all tasks through the timeline itself; task detail is always one click away on the right.
- Task and note content are directly editable with live Markdown rendering and attachments.
- Common actions have one natural entry point; the app does not duplicate equivalent controls across header, card, menu, and sheet.
- Styling is not limited to the current restrained monochrome theme; themes may have distinct material, color, lighting and motion while keeping the same information architecture.

## 2. Product principles

### 2.1 One action, one natural entry point

Do not duplicate equivalent actions for convenience.

- Global create: bottom-center `+` only (and `/` as the keyboard shortcut to that same action).
- Create a task inside a day sheet: click/drag empty timeline space only.
- Select/open task detail: click a timeline task block.
- Schedule/reschedule: drag/resize on the timeline.
- Expand child scheduling: double-click a parent task that has children.
- Open a note: click its note card.
- Create a note from the Notes root view: bottom-center `+`, defaulting to Note.

The day sheet therefore **must not** add another top-bar “new task” button.

### 2.2 Use screen space; do not create empty space for formality

The UI should feel compact, calm, and dense enough to be useful. Mobile and desktop share the same information architecture. Desktop can use more width but does not invent side dashboards, secondary navigation, or redundant toolbars.

### 2.3 Layers, not page hopping

The root surfaces are Tasks and Notes. Contextual work opens in a bottom sheet layer over the current root surface.

- Calendar day -> Day Sheet.
- Note card -> Note Sheet.
- Global `+` -> Creation Sheet.

Sheets slide upward, cover the bottom root tab bar, keep the background perceptible, and close back to the exact previous scroll/month/selection state.

## 3. Root navigation and creation

Bottom navigation is always:

`Tasks | + | Notes`

The `+` button opens the same Creation Sheet everywhere on a root surface.

- On Tasks root, it defaults to **Task**.
- On Notes root, it defaults to **Note**.
- The Creation Sheet can switch between Task and Note.
- `/` opens this same sheet when focus is not inside an editable control.
- `/` is disabled as a global-create shortcut while a Day Sheet or Note Sheet is open, because those layers already have context-specific creation/editing semantics.
- `Esc` closes the topmost sheet.

Creation Sheet, Day Sheet and Note Sheet use the same animation language, top radius, dimming, drag-to-close treatment, and focus trapping.

## 4. Tasks root — calendar and board

### 4.1 Header

Single compact header:

- Left: OneDay mark.
- Center: `Calendar | Board` segmented control.
- Right: search and settings.

Do not include a page title, dashboard summary, quick-create input, or current-day task list.

### 4.2 Calendar layout

The calendar is a 7-column card grid, not a table.

Each date is a distinct glass/card tile with visible space between tiles. Narrow screens reduce padding, typography and content density, but **never remove the tile boundary**. Cell identity remains obvious at every supported width.

Each day tile may contain:

- date number;
- holiday/weekend/workday/leave labels;
- up to a small responsive number of task summaries or dots;
- execution-water visualization;
- `+N` overflow indicator if necessary.

The grid itself uses available screen height. No redundant “selected day tasks” section appears under or beside it.

### 4.3 Execution water

Actual execution time is integrated into the day tile as a subtle “water fill” inside the glass tile. It is not shown as a separate KPI card.

For 1.3, the visual scale is a fixed 8-hour reference for daily effort:

`fill = clamp(actual union execution minutes / 480, 0, 1)`

- Uses execution interval union, so concurrent task execution does not double-count the day.
- Zero execution means **no visible water line**.
- Over 8 hours saturates at full height; a small duration label may still show the exact total.
- The fill is informative, not a completion percentage.

### 4.4 Glass light sweep

The calendar group supports an occasional low-key reflected-light sweep across the glass tiles, inspired by the earliest design direction.

- One diagonal highlight passes across the calendar as a group, not every tile independently.
- It is occasional, not continuous; implementation may schedule a sweep roughly every 18–35 seconds with jitter.
- It does not block pointer events.
- `prefers-reduced-motion` disables the sweep entirely.
- Themes may vary or disable this material effect.

### 4.5 Calendar labels and personal leave

Use the existing calendar-marker table.

- Saturday/Sunday: automatic weekend label.
- Existing `法定节假日`: show holiday title such as 中秋节/国庆节.
- Existing `调休上班`: show workday override.
- Existing `请假`: show personal leave label, including on a weekday.
- `自定义`: show a compact custom label when configured.

Manual leave marking edits/adds the existing calendar-marker table; no new table is introduced.

### 4.6 Opening a day

Clicking a date tile slides the Day Sheet upward over the calendar. The calendar remains rendered underneath; this must not feel like route navigation.

The Day Sheet covers the root bottom navigation completely.

## 5. Day Sheet — daily control surface

### 5.1 Purpose

The Day Sheet exists for **global control of the day**:

- scroll the timeline to understand all scheduled work;
- see unscheduled daily to-dos at the top;
- click a task block to immediately inspect/edit its detail;
- arrange work directly on the timeline.

There is no duplicate task list.

### 5.2 Header

A compact informational line only:

- selected date + weekday;
- optional previous/next day controls;
- number of tasks;
- planned total duration;
- actual union execution duration;
- close control.

No create-task button appears here.

### 5.3 Unscheduled daily shelf

The top of the timeline reserves a compact shelf for tasks assigned to the selected day but without a defined exact time range.

- It is visually part of the timeline, not a second list view.
- Compact task chips/cards show title, priority/status affordance as needed.
- Dragging one from the shelf into the timed axis schedules it at the dropped snapped time with a default duration (use task estimate if available, otherwise 60 minutes).
- It disappears from the shelf after scheduling.
- A task with no selected-day association does not appear merely because it is globally unscheduled.

### 5.4 Default single-track schedule with explicit parallel tasks

The planning model is **single-track by default, explicit parallel when intended**.

Default behavior:

- Ordinary tasks should not silently overlap another ordinary task.
- Dropping/resizing into a conflict previews the conflict and defaults to single-track conflict handling rather than automatic lane creation.
- 1.3 should favor a clear “move/shift around conflict” interaction. It must never silently change another task without an obvious preview.

Explicit parallel:

- A task property `允许并行` permits it to occupy the same time range as another task.
- Only explicit parallel tasks render in a secondary narrow lane when overlap occurs.
- Parallel is exceptional and visually distinct, preserving the sense that a day is primarily one chronological track.

Execution statistics remain separate:

- per-task time is calculated for each task;
- daily actual effort uses interval union and therefore does not double-count parallel execution.

### 5.5 Timed axis interaction

Preserve the mature 1.2 timeline behavior where compatible:

- 24-hour scale with current-time line;
- 15-minute snap;
- task top = planned start;
- task height = planned duration;
- drag task body to move whole interval;
- drag top/bottom handle to edit start/end;
- release commits the database write; pointer movement does not continuously save;
- click empty space creates a default-duration task at that time;
- drag empty space creates a task using the selected time range;
- cross-day/all-day legacy records stay out of the timed lane unless the user explicitly schedules them.

### 5.6 Parent/child expansion

Default layout:

`Parent timeline | Task detail`

Single-clicking a task selects it and changes the detail pane. It does not expand child scheduling.

Double-clicking a parent task that actually has child tasks expands the left region into:

`Parent timeline | Child timeline | Task detail`

Requirements:

- parent and child axes share identical vertical time coordinates;
- both vertical scroll positions stay synchronized;
- the selected child updates the same right detail pane;
- double-clicking again, or using a compact collapse affordance associated with the expanded axis, restores the single parent axis;
- no new route/page/modal is opened.

The 1.2 double-click regression is treated as a release blocker.

### 5.7 Task detail pane

The detail pane is directly editable. It is not a read-only preview requiring a separate edit modal.

Three horizontal tabs:

`内容 | 属性 | 日志`

- click tab to switch;
- horizontal swipe within the detail content switches adjacent tabs;
- the timeline remains visible and does not move to another page.

Frequent execution controls (status, actual elapsed, start/pause/resume/complete) may live in a compact persistent detail header because they belong to the selected task; they are not duplicated on the timeline card.

## 6. Task content editor

### 6.1 Content model

A task contains:

- title;
- Markdown content body (`任务详情`, with legacy fallback from `任务描述`);
- attachments referenced from the content and, where supported, mirrored in `任务附件`.

The title is directly editable in the detail pane.

### 6.2 Live Markdown editing

Do not present separate “Edit” and “Preview” modes.

Use one live document editor that stores canonical Markdown while rendering the result in-place. Supported 1.3 subset:

- headings;
- bold / italic / strike;
- unordered and ordered lists;
- task checkboxes;
- blockquote;
- inline code and fenced code block;
- links;
- images;
- file attachment chips/links;
- horizontal rule.

Typing common Markdown triggers should transform/render naturally in the same surface. Paste of plain Markdown should preserve the Markdown semantics. The implementation may use a block-oriented `contenteditable` editor but must serialize predictably back to Markdown.

Autosave remains debounced and conflict-aware; failure preserves the local draft and does not claim success.

### 6.3 Images

Images can be:

- pasted from clipboard;
- dragged/dropped into the editor;
- chosen from file picker.

Current WorkBuddy contract already exposes `db.uploadImage`; use it for supported image types. Insert the returned safe URL into the canonical Markdown and render the image inline.

### 6.4 Documents and other attachments

Target behavior: selected/pasted documents are uploaded into the previously planned WorkBuddy attachment storage area (`TODO工作台-附件`) and inserted in the editor as attachment chips/Markdown links.

Current source evidence is important:

- the task table already has a `任务附件` attachment field in the merged schema;
- the existing page has a known attachment-folder URL;
- the currently verified browser SDK contract exposes `uploadImage`, **not yet a verified generic file/folder upload API**.

Therefore 1.3 architecture introduces an `AttachmentService` boundary:

- `uploadImage(file)` — implemented using the verified image upload contract;
- `uploadFile(file, owner)` — implemented only when the actual WorkBuddy host exposes a verified generic attachment/file upload contract that can target the designated folder or return a file token/URL accepted by the task attachment field;
- formal UI must never fake a document upload into local storage or report success when the host capability is unavailable.

Local preview uses a deterministic mock attachment URL and clearly labels it as preview-only. Real WorkBuddy release acceptance requires host verification of the document upload path.

For Notes, because the existing note table has no attachment field, canonical links live in note Markdown; the binary still belongs in the same WorkBuddy attachment folder/service.

## 7. Task attributes

The Attributes tab should stay compact but useful. 1.3 exposes:

### Existing / already compatible

- status;
- priority;
- planned date/time range;
- parent task / task type;
- tags (existing tag + link tables, with tag color/category shown as chips).

### New task-management attributes

1. **最后期限 (deadline)** — a true deadline independent from the scheduled time block.
2. **预计时长 (estimate minutes)** — useful before a task has an exact timeline slot; used as the default duration when an unscheduled task is dropped onto the timeline.
3. **允许并行 (checkbox)** — explicit opt-in to parallel scheduling.

These require three backward-compatible task-table fields in WorkBuddy. They do not require a new table:

- `最后期限` (date)
- `预计时长` (number, minutes)
- `允许并行` (checkbox)

The app must gracefully read old data where these fields are absent/empty. Formal WorkBuddy deployment must add/verify these columns before enabling writes to them.

### Tags

Do not create a second competing “labels” system. Existing tags remain the flexible categorization system.

Use existing tag metadata to surface color/category. UI may group tag suggestions by existing categories (工作、学习、生活、健康、项目、其他), but tasks continue to store association through the tag-link table.

## 8. Board

Board remains four status columns using the existing five stored statuses and current presentation mapping.

### 8.1 Pointer-based animated drag

Replace jarring reorder behavior with a pointer-based drag system that works with mouse and touch.

During drag:

- dragged card lifts into a ghost/overlay;
- destination placeholder has the card's real height;
- surrounding cards animate out of the way in real time using FLIP-style transforms;
- crossing columns animates both source closure and destination insertion;
- auto-scroll activates near a scroll-container edge;
- drop persists `任务状态` when column changes and `排序序号` for order;
- cancel restores original position without persistence.

The animation is direct feedback for spatial reordering, not decorative motion. `prefers-reduced-motion` shortens/removes displacement animation while keeping placement feedback.

The board does not add another inline “new task” button; root `+` owns global creation.

## 9. Notes -> Notes as durable knowledge

UI terminology changes from **便签** to **笔记**. Storage table/field names remain unchanged for compatibility.

### 9.1 Notes root

- Header follows the same compact root pattern.
- List/grid toggle may remain if useful.
- Search/filter may live in the root header tools.
- Do **not** include a duplicate “new note” card/button inside the note list/grid.
- Bottom `+` defaults to Note on this root surface.

### 9.2 Note Sheet

Clicking a note opens a full-height-ish bottom sheet using the same interaction/material system as Day Sheet and Creation Sheet, not a small centered modal.

The note is directly editable in the sheet.

Content capabilities match task content:

- live Markdown rendering/editing;
- paste/drop/upload images;
- document attachment links through `AttachmentService`;
- title inferred from explicit first heading/first non-empty line unless/until a dedicated title field is later added;
- existing category, pin, archive status and task association stay available as secondary metadata.

This makes Notes suitable for both temporary capture and durable reference material without introducing a second document subsystem.

## 10. Themes and visual system

The current restrained minimal theme becomes only one theme, not the global aesthetic constraint.

1.3 ships a token-driven theme system where changing theme may alter:

- page background;
- calendar/card material;
- borders, shadow and radius;
- accent/status/priority colors;
- water fill;
- sheet material;
- board card material;
- Markdown typography;
- highlight/reflection treatment;
- motion intensity.

Built-in themes:

1. **Glass Day** — default for 1.3; luminous glass tiles, subtle depth/reflection, richer than current neutral theme.
2. **Paper** — warm paper, ink-like typography, excellent for long notes.
3. **Night** — dark, low-glare, clear status colors.
4. **Color Block** — richer colored task/card identity inspired by earlier OneDay versions.
5. **Minimal** — preserves the current restrained light style for users who prefer it.

Theme changes never change information architecture or functional placement.

## 11. Data and migration

Keep the same seven WorkBuddy tables. No eighth table is introduced.

Existing persistence rules remain:

- full-read snapshot replacement only after all seven tables succeed;
- single-device write queue;
- field-level optimistic conflict check before patch;
- no claim of true cross-device CAS/transaction safety;
- formal build never falls back to a fake cloud database;
- local drafts survive write failure.

Schema extension required on task table:

- `最后期限` date;
- `预计时长` number;
- `允许并行` checkbox.

UI naming changes (`便签` -> `笔记`) do not rename WorkBuddy tables/fields in 1.3.

## 12. Error handling

- If Markdown autosave fails, keep editor content and show an unobtrusive unsaved/draft state.
- If image upload fails, do not insert a broken Markdown image node.
- If document upload capability is unavailable, tell the user that this host cannot upload that document yet; do not pretend the file was stored.
- If a timeline move conflicts with another single-track task, keep the pre-drop schedule unless the user accepts the displayed conflict resolution.
- If schema fields for new attributes are not present in the formal WorkBuddy table, disable only those controls and explain the migration requirement; existing fields remain editable.
- If board status update succeeds but reorder persistence fails (or vice versa), report partial success and refresh/reconcile; do not silently show a state that was not persisted.

## 13. Testing and release acceptance

### Core/data tests

Cover:

- daily water fill based on execution union;
- zero fill produces no visible water state;
- unscheduled task classification and default duration;
- single-track overlap detection;
- explicit-parallel lane assignment;
- parent/child double-click expansion state;
- new attribute parsing/persistence and backward compatibility;
- Markdown safe serialization/rendering;
- attachment URL sanitization;
- calendar label precedence (holiday/workday/leave/weekend);
- board reorder indices.

### Chromium interaction tests

Cover both desktop and mobile:

- root header and bottom navigation are unchanged by viewport width;
- calendar tiles remain visibly separated at narrow widths;
- Day Sheet slides over calendar and covers root tab bar;
- unscheduled shelf is visible when relevant;
- empty timeline click/drag creates a task and no other create button exists in Day Sheet;
- click task -> editable detail;
- edit title/body/attributes persists;
- horizontal swipe changes Content/Attributes/Log tabs;
- double-click a parent with children -> child axis appears and sync-scrolls;
- double-click a task without children does not create an empty child axis;
- explicit parallel vs default single-track behavior;
- note card -> Note Sheet, no small modal;
- Notes root contains no duplicate new-note button;
- root `+` defaults correctly by current root tab;
- `/` opens the same Creation Sheet on roots and is suppressed inside sheets/editors;
- board reorder animates displacement and persists order/status;
- theme switching changes tokens without changing layout;
- reduced-motion disables light sweep / displacement animation.

### Real WorkBuddy acceptance (cannot be faked locally)

Before calling 1.3 fully deployed:

- verify new task columns exist and are writable;
- verify `db.uploadImage` on the real shared page;
- discover/verify the real generic document upload + attachment-folder contract;
- confirm uploaded documents land in the intended `TODO工作台-附件` location or equivalent verified WorkBuddy storage destination;
- confirm task content and notes containing attachment links work from both phone and PC;
- test concurrent edits on two devices and document observed behavior;
- verify touch drag on actual mobile browsers.

## 14. Explicit non-goals for 1.3

- No dashboard/home page.
- No second label taxonomy separate from existing tags.
- No new database/table unless a future requirement cannot be represented safely in the seven-table model.
- No automatic AI parsing or cloud dependency.
- No recurring-task engine in this release.
- No fake generic document upload in local-only code.
- No duplicate create buttons inside Day Sheet, Board columns, or Notes list.
