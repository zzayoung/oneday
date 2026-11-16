# OneDay Lite 1.3 Rich Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade OneDay Lite from the 1.2 calendar/day-sheet prototype into the approved 1.3 Tasks + Notes workspace with editable task detail, live Markdown/attachments, default-single-track timeline planning, durable Notes, animated board reorder, richer themes, and glass calendar metadata without adding another WorkBuddy table.

**Architecture:** Keep the existing single-file delivery model and seven-table persistence. Add small focused browser modules for rich editing, attachments, themes, and board dragging; keep task/calendar/timeline semantics in `core.js`, data writes in `store.js`, and view composition in the existing `views.js` / `timeline.js` surfaces. New WorkBuddy-only capabilities are guarded behind explicit host-capability checks so the local preview can mock them without formal builds pretending cloud success.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, current OneDay Lite global-module pattern, Node.js `node:test`, Python + Playwright Chromium, WorkBuddy `window.__SMART_PAGE__.database` SDK.

**Spec:** `docs/superpowers/specs/2026-09-24-oneday-lite-1.3-design.md`

## Global Constraints

- Preserve exactly the existing seven WorkBuddy database bindings; do not introduce an eighth table.
- Bottom root navigation remains `任务 | + | 笔记`; no duplicate inline new-task/new-note controls in root lists, board columns, Day Sheet header, or Note Sheet.
- Day Sheet creation entry is timeline empty-space click/drag only; `/` does not open Creation Sheet while Day Sheet or Note Sheet is open.
- Root desktop and mobile share the same information architecture; desktop may use more width but must not grow a dashboard/sidebar variant.
- Calendar day cells remain visually separated cards at all supported widths; execution water uses actual execution interval union / 480 minutes and is invisible at zero.
- Timeline planning is single-track by default. Only tasks with `允许并行=true` may occupy the explicit secondary parallel lane.
- New task fields are backward-compatible: `最后期限` (date), `预计时长` (number/minutes), `允许并行` (checkbox). Missing formal schema disables only those controls.
- Canonical task/note rich content is Markdown text stored in the existing text field; the editor must not create a second hidden HTML source of truth.
- Image upload may use the verified WorkBuddy `uploadImage` contract. Generic document upload may only report success after a real host contract returns a persistent URL/token; local preview must label mock URLs as preview-only.
- Every new behavior follows RED -> GREEN -> full-suite verification before commit.
- Formal release remains a new Lite page and must not overwrite or migrate the V10 full page without explicit user authorization.

## Review Focus

1. **Old WorkBuddy schema without the three new task fields** — existing task editing must still work; new controls render disabled with a schema-migration explanation instead of breaking all saves. Covered in Task 2 browser/data tests.
2. **Attachment host partially supports images but not generic files** — image insertion may succeed, document insertion must fail honestly without adding a fake Markdown link. Covered in Task 3 tests.
3. **Single-track drag into an occupied interval** — the original schedule must remain persisted until the user accepts a visible resolution; no silent overlap or silent move of another task. Covered in Task 5 tests.
4. **Parallel planning and execution accounting differ** — overlapping explicit-parallel tasks may render simultaneously but daily execution KPI must still use interval union. Covered in Tasks 1 and 5 tests.
5. **Narrow mobile Day Sheet / rich editor** — timeline, detail, tabs and editor must remain operable with no horizontal document overflow. Covered in Tasks 4 and 8 Chromium tests.

---

### Task 1: Core scheduling, calendar labels, and new attribute helpers

**Files:**
- Modify: `src/lite/core.js`
- Modify: `tests/lite/core.test.cjs`

**Interfaces:**
- Consumes: current task records, calendar-marker rows, timeline ranges, execution logs.
- Produces: `C.taskEstimateMinutes(task)`, `C.isParallel(task)`, `C.timelineConflicts(rows, ds, taskId, start, end)`, `C.timelinePlan(rows, ds, taskId, start, end)`, `C.calendarLabel(ds, markers)`, updated `C.timelineLayout()` lane semantics.

- [ ] **Step 1: Write failing tests for estimates, explicit parallel, conflicts, and calendar label precedence**

Add tests equivalent to:

```js
test('estimate defaults to 60 and accepts positive minutes', () => {
  assert.equal(C.taskEstimateMinutes({}), 60);
  assert.equal(C.taskEstimateMinutes({'预计时长': 45}), 45);
  assert.equal(C.taskEstimateMinutes({'预计时长': 0}), 60);
});

test('single-track conflict excludes explicit parallel tasks', () => {
  const day = '2026-09-24';
  const rows = [
    {_id:'a','任务类型':'主任务','计划开始时间':day+'T09:00:00Z','计划截止时间':day+'T10:00:00Z'},
    {_id:'b','任务类型':'主任务','计划开始时间':day+'T09:30:00Z','计划截止时间':day+'T10:30:00Z','允许并行':true}
  ];
  assert.deepEqual(C.timelineConflicts(rows, day, 'x', 570, 615).map(x=>x.id), ['a']);
});

test('calendar labels prefer personal leave over weekend and respect workday override', () => {
  const ds = '2026-09-26';
  assert.equal(C.calendarLabel(ds, [{'标记日期':ds,'标记类型':'请假','标记标题':'年假'}]).text, '年假');
  assert.equal(C.calendarLabel(ds, [{'标记日期':ds,'标记类型':'调休上班','标记标题':'调休'}]).kind, 'workday');
});
```

- [ ] **Step 2: Run the core test file and confirm RED**

Run:

```bash
node --test tests/lite/core.test.cjs
```

Expected: failures because the new helpers and parallel lane rules do not exist yet.

- [ ] **Step 3: Implement minimal pure helpers**

Implement these exact semantics:

```js
function taskEstimateMinutes(t){
  const n=Number(t&&t['预计时长']);
  return Number.isFinite(n)&&n>0?Math.max(TL_SNAP,Math.round(n/TL_SNAP)*TL_SNAP):60;
}
function isParallel(t){return !!(t&&t['允许并行']);}
function timelineConflicts(rows,ds,taskId,start,end){
  return timelineLayout(rows,ds,{role:'main'}).filter(b=>b.id!==taskId&&!isParallel(b.task)&&Math.max(start,b.start)<Math.min(end,b.end));
}
```

`timelineLayout()` must assign ordinary tasks to the main track and only explicit-parallel overlapping tasks to a secondary narrow lane; it must not auto-create arbitrary N-way lanes for ordinary tasks.

`calendarLabel(ds, markers)` precedence: `请假` -> `法定节假日` -> `调休上班` -> `自定义` -> weekend -> none.

- [ ] **Step 4: Re-run `tests/lite/core.test.cjs`, then full Node suite**

Run:

```bash
node --test tests/lite/core.test.cjs
node --test tests/core.test.cjs tests/lite/core.test.cjs tests/lite/store.test.cjs
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lite/core.js tests/lite/core.test.cjs
git commit -m "feat(lite): add 1.3 scheduling and calendar helpers"
```

---

### Task 2: Store schema compatibility and direct task attribute persistence

**Files:**
- Modify: `src/lite/store.js`
- Modify: `src/lite/demo.js`
- Modify: `todo-app/dev/schema-task.json`
- Modify: `todo-app/dev/schema-merged.json`
- Modify: `tests/lite/store.test.cjs`
- Modify: `tests/lite/experience.py`

**Interfaces:**
- Consumes: WorkBuddy task rows and current seven-table adapter.
- Produces: `store.capabilities.taskFields`, `store.updateTaskAttributes(id, values, base)`, `store.schemaHasTaskField(name)`, new task create/write support for deadline/estimate/parallel.

- [ ] **Step 1: Write failing store tests for old-schema read, new-field write, and disabled capability**

Use test cases equivalent to:

```js
test('old task rows remain readable when 1.3 fields are absent', async () => {
  const s=createStore(fakeDb({taskFields:['任务标题','任务状态']}));
  await s.read();
  assert.equal(s.schemaHasTaskField('允许并行'), false);
  assert.equal(s.get('tasks','t1')['任务标题'], '旧任务');
});

test('attribute update writes only supported new fields', async () => {
  const s=createStore(fakeDb({taskFields:['最后期限','预计时长','允许并行']}));
  await s.read();
  await s.updateTaskAttributes('t1', {deadline:'2026-09-30', estimate:90, parallel:true}, s.get('tasks','t1'));
  assert.equal(s.get('tasks','t1')['预计时长'], 90);
  assert.equal(s.get('tasks','t1')['允许并行'], true);
});
```

- [ ] **Step 2: Run store tests and confirm RED**

```bash
node --test tests/lite/store.test.cjs
```

- [ ] **Step 3: Add task-field capability discovery and writers**

Expose:

```js
function schemaHasTaskField(name){return capabilities.taskFields.has(name);}
async function updateTaskAttributes(id,{deadline,estimate,parallel},base){
  const props={};
  if(schemaHasTaskField('最后期限')) props['最后期限']={date:deadline||null};
  if(schemaHasTaskField('预计时长')) props['预计时长']={number:estimate?Number(estimate):null};
  if(schemaHasTaskField('允许并行')) props['允许并行']={checkbox:!!parallel};
  if(!Object.keys(props).length) throw Error('WorkBuddy 任务表尚未增加 1.3 属性字段');
  return patch('tasks',id,props,base);
}
```

The demo adapter must advertise all three fields. The formal adapter must default capabilities conservatively when host schema metadata is unavailable: existing fields work; new controls remain disabled until explicit schema support is present in the page/mock configuration.

- [ ] **Step 4: Add browser test that missing fields disable only new controls**

In `tests/lite/experience.py`, open a task under a mock schema without the three fields and assert title/body/status editing remains enabled while `[data-day-field="deadline"]`, `[data-day-field="estimate"]`, `[data-day-field="parallel"]` are disabled and show migration help.

- [ ] **Step 5: Run store + browser subset, then full Node suite**

```bash
node --test tests/lite/store.test.cjs
python tests/lite/experience.py --match task-attributes-schema
node --test tests/core.test.cjs tests/lite/core.test.cjs tests/lite/store.test.cjs
```

- [ ] **Step 6: Commit**

```bash
git add src/lite/store.js src/lite/demo.js todo-app/dev/schema-task.json todo-app/dev/schema-merged.json tests/lite/store.test.cjs tests/lite/experience.py
git commit -m "feat(lite): persist 1.3 task attributes safely"
```

---

### Task 3: Attachment service and single-source live Markdown editor

**Files:**
- Create: `src/lite/attachments.js`
- Create: `src/lite/editor.js`
- Modify: `src/lite/shell.html`
- Modify: `tools/build_lite.py`
- Modify: `src/lite/store.js`
- Modify: `src/lite/styles.css`
- Modify: `tests/lite/core.test.cjs`
- Modify: `tests/lite/experience.py`

**Interfaces:**
- Consumes: `C.markdown()`, `store.uploadImage`, WorkBuddy host SDK, canonical Markdown strings.
- Produces: `window.OneDayLiteAttachments.create(store)`, `window.OneDayLiteEditor.mount(root,{value,onChange,attachments,owner})`.

- [ ] **Step 1: Write failing tests for safe Markdown round-trip and attachment capability behavior**

Add core assertions for dangerous URLs and document links; add browser scenarios:

```python
@test('live-markdown-editor-keeps-one-canonical-value')
def _(p):
    open_day_task(p)
    ed=p.locator('[data-live-md]')
    ed.click();p.keyboard.type('## 标题\n- [ ] 检查项')
    p.wait_for_timeout(700)
    assert p.locator('[data-live-md] h2').inner_text()=='标题'
    assert '## 标题' in js(p,'return OneDayLite.detailSession().values["任务详情"]')

@test('document-upload-does-not-fake-success-when-host-lacks-capability')
def _(p):
    open_day_task(p)
    js(p,'delete __SMART_PAGE__.database.uploadFile')
    set_files(p,'[data-live-md-file]', ['sample.pdf'])
    assert '当前 WorkBuddy 环境尚未开放文档附件上传' in toast(p)
    assert 'sample.pdf' not in task(p)['任务详情']
```

- [ ] **Step 2: Run the new editor/attachment tests and confirm RED**

```bash
node --test tests/lite/core.test.cjs
python tests/lite/experience.py --match live-markdown
python tests/lite/experience.py --match document-upload
```

- [ ] **Step 3: Implement `AttachmentService`**

Expose:

```js
function create(store){
  return {
    canUploadImage:()=>typeof store.uploadImage==='function',
    canUploadFile:()=>typeof store.uploadFile==='function'&&store.canUploadFile?.(),
    async uploadImage(file,owner){return normalize(await store.uploadImage({file,owner}));},
    async uploadFile(file,owner){
      if(!this.canUploadFile()) throw Error('当前 WorkBuddy 环境尚未开放文档附件上传');
      return normalize(await store.uploadFile({file,owner,folder:'TODO工作台-附件'}));
    }
  };
}
```

Returned URLs must be `https:`, `http:` only for the local mock, or host-approved persistent schemes; reject `javascript:`, `data:text/html`, and empty results.

- [ ] **Step 4: Implement one-surface Markdown editor**

The editor uses one editable DOM surface and one canonical Markdown string. It must support:

```js
Editor.mount(node, {
  value,
  onChange(markdown){...},
  attachments,
  owner:{type:'task',id:'t1'}
});
```

Clipboard/drop/file input rules:
- plain text -> insert Markdown text;
- image file -> upload -> insert `![filename](url)`;
- document file -> uploadFile -> insert `[📎 filename](url)`;
- failed upload -> keep editor text unchanged and emit error.

Use `beforeinput`/`input` plus block serialization so there is no explicit Edit/Preview toggle. Checkbox clicks mutate Markdown source and repaint the same surface.

- [ ] **Step 5: Add build markers and styles**

Insert `attachments.js` and `editor.js` before views/dialog/timeline modules in `tools/build_lite.py` and `shell.html`. Add editor CSS for headings, lists, code blocks, inline images, attachment chips, selection/focus, and mobile overflow containment.

- [ ] **Step 6: Run editor tests, build, and release static check**

```bash
node --test tests/core.test.cjs tests/lite/core.test.cjs tests/lite/store.test.cjs
python tools/build_lite.py
python tools/check_lite.py
python tests/lite/experience.py --match live-markdown
python tests/lite/experience.py --match upload
```

- [ ] **Step 7: Commit**

```bash
git add src/lite/attachments.js src/lite/editor.js src/lite/shell.html tools/build_lite.py src/lite/store.js src/lite/styles.css tests/lite/core.test.cjs tests/lite/experience.py
git commit -m "feat(lite): add live Markdown and attachment services"
```

---

### Task 4: Editable Day Sheet detail, unscheduled shelf, and reliable parent/child expansion

**Files:**
- Modify: `src/lite/timeline.js`
- Modify: `src/lite/dialogs.js`
- Modify: `src/lite/ui.js`
- Modify: `src/lite/styles.css`
- Modify: `tests/lite/experience.py`

**Interfaces:**
- Consumes: Task 2 store attribute APIs, Task 3 editor/attachments, Task 1 estimate/parallel helpers.
- Produces: directly editable Day Sheet detail, `state.expandedParent`, unscheduled-daily shelf, swipeable Content/Attributes/Log tabs.

- [ ] **Step 1: Write browser failures for direct editing and double-click**

Add explicit scenarios:

```python
@test('day-sheet-task-detail-edits-title-body-and-attributes-in-place')
def _(p):
    open_day_task(p,'lite-t1')
    p.fill('[data-task-title-editor]','改过的标题')
    p.dispatch_event('[data-task-title-editor]','change')
    live_md_set(p,'更新后的 **Markdown** 内容')
    click(p,'[data-day-action="tab"][data-tab="props"]')
    p.fill('[data-day-field="estimate"]','90');p.dispatch_event('[data-day-field="estimate"]','change')
    wait(p)
    assert task(p)['任务标题']=='改过的标题'
    assert task(p)['预计时长']==90

@test('double-click-parent-expands-child-axis')
def _(p):
    add_child(p,'lite-t1')
    open_day(p)
    p.locator('[data-task-id="lite-t1"]').first.dblclick()
    assert p.locator('.day-sub-pane').is_visible()
```

Also test that single-click does not expand, childless double-click does not open empty axis, and detail tab swipe changes tabs.

- [ ] **Step 2: Run Day Sheet subset and confirm RED where 1.3 behavior is missing**

```bash
python tests/lite/experience.py --match day-sheet
```

- [ ] **Step 3: Replace read-only content pane with direct editor session**

The selected task detail must render:
- editable title input;
- persistent execution controls in the compact detail header;
- Task 3 live Markdown editor in Content;
- editable status/priority/date range/deadline/estimate/parallel/tags in Attributes;
- existing logs/worklog editor in Logs.

Changes use the existing draft/session conflict-aware debounced save mechanism; title/body/attributes must not invoke a second modal.

- [ ] **Step 4: Implement selected-day unscheduled shelf**

Classify shelf rows as tasks associated with `ds` but without `timelineRange(...).kind==='timed'`. Display compact chips above the ruler. Dragging a shelf task into the timed track uses `C.taskEstimateMinutes(task)` or 60 minutes and commits one `timelinePatch` on drop.

- [ ] **Step 5: Make parent expansion state deterministic**

On `dblclick`:

```js
if(hasChildren(id)) state.expandedParent = state.expandedParent===id ? '' : id;
```

Single click only assigns `state.selected=id`. Repaint must preserve synchronized main/sub scrollTop and selected detail.

- [ ] **Step 6: Add touch swipe for detail tabs without stealing editor horizontal gestures**

Track pointer/touch start/end only on the detail pane background/content wrapper, ignore starts inside code blocks, horizontal scrollers, inputs, contenteditable, attachment chips, and timeline. Threshold: horizontal delta >= 42px and greater than vertical delta.

- [ ] **Step 7: Run Day Sheet browser suite on desktop and 390px mobile**

```bash
python tests/lite/experience.py --match day-sheet
python tests/lite/experience.py --match single-day-timeline
```

Expected: direct edit, shelf scheduling, child-axis expansion, tab swipe, and no horizontal viewport overflow all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lite/timeline.js src/lite/dialogs.js src/lite/ui.js src/lite/styles.css tests/lite/experience.py
git commit -m "feat(lite): make Day Sheet a direct daily workspace"
```

---

### Task 5: Single-track conflict resolution and explicit parallel lane interaction

**Files:**
- Modify: `src/lite/timeline.js`
- Modify: `src/lite/core.js`
- Modify: `src/lite/styles.css`
- Modify: `tests/lite/core.test.cjs`
- Modify: `tests/lite/experience.py`

**Interfaces:**
- Consumes: `C.timelineConflicts`, `C.isParallel`, Day Sheet drag/resize operations.
- Produces: visible conflict preview, accept/cancel resolution, explicit secondary lane for parallel tasks.

- [ ] **Step 1: Add failing tests for conflict retention and parallel acceptance**

Browser assertions:

```python
@test('single-track-conflict-does-not-persist-until-resolution')
def _(p):
    open_day(p)
    before=task(p,'t2')['计划开始时间']
    drag_task_over_existing(p,'t2','t1')
    assert p.locator('[data-timeline-conflict]').is_visible()
    assert task(p,'t2')['计划开始时间']==before
    click(p,'[data-conflict-action="cancel"]')
    assert task(p,'t2')['计划开始时间']==before

@test('explicit-parallel-task-renders-in-secondary-lane')
def _(p):
    set_parallel(p,'t2',True)
    overlap_tasks(p,'t1','t2')
    assert p.locator('[data-task-id="t2"][data-lane="parallel"]').is_visible()
```

- [ ] **Step 2: Run timeline subset and confirm RED**

```bash
node --test tests/lite/core.test.cjs
python tests/lite/experience.py --match single-track
python tests/lite/experience.py --match parallel
```

- [ ] **Step 3: Implement conflict preview transaction**

During drag/resize, compute candidate interval without persistence. If conflicts exist and moving task is not explicit parallel:
- render candidate ghost in conflict state;
- show a compact anchored resolver with `取消`, `挪到下一个空档`, and `设为并行`;
- `取消` restores original DOM/state;
- `挪到下一个空档` computes nearest 15-minute non-overlapping slot and commits only the moving task;
- `设为并行` first persists `允许并行=true` (if schema available) then commits the requested interval;
- no other task is silently moved in 1.3.

- [ ] **Step 4: Render explicit parallel lane**

Ordinary main-track cards use the main width. Explicit-parallel overlapping cards use a narrow secondary lane with a clear parallel glyph/label. Do not create third/fourth automatic lanes; multiple explicit parallel cards may stack within the explicit parallel rail using the existing overlap subdivision only inside that rail.

- [ ] **Step 5: Verify daily execution union remains unchanged**

Add/retain a core test where two tasks execute for the same 60-minute interval: `summary.total === 120min`, `summary.unique === 60min`.

- [ ] **Step 6: Run timeline + full core/browser regression**

```bash
node --test tests/core.test.cjs tests/lite/core.test.cjs tests/lite/store.test.cjs
python tests/lite/experience.py --match timeline
python tests/lite/experience.py --match parallel
```

- [ ] **Step 7: Commit**

```bash
git add src/lite/timeline.js src/lite/core.js src/lite/styles.css tests/lite/core.test.cjs tests/lite/experience.py
git commit -m "feat(lite): enforce explicit parallel planning"
```

---

### Task 6: Notes -> durable Notes, Note Sheet, and context-sensitive Creation Sheet

**Files:**
- Modify: `src/lite/views.js`
- Modify: `src/lite/dialogs.js`
- Modify: `src/lite/panels.js`
- Modify: `src/lite/app.js`
- Modify: `src/lite/shell.html`
- Modify: `src/lite/styles.css`
- Modify: `tests/lite/experience.py`

**Interfaces:**
- Consumes: Task 3 editor/attachments, current notes table and `store.createNote`/patch operations.
- Produces: Notes root naming, full bottom Note Sheet, full bottom Creation Sheet defaulting by root context.

- [ ] **Step 1: Write failing browser tests for terminology, no duplicate create, and bottom-sheet behavior**

```python
@test('notes-root-has-no-duplicate-create-entry')
def _(p):
    click(p,'[data-tab="notes"]')
    assert '笔记' in p.inner_text('#mobileNav')
    assert p.locator('.notes-grid [data-act="capture-focus"]').count()==0

@test('global-create-sheet-defaults-to-current-root-type')
def _(p):
    click(p,'[data-tab="notes"]');click(p,'[data-act="global-create"]')
    assert p.locator('[data-create-kind="note"]').get_attribute('aria-selected')=='true'
    close_top_sheet(p)
    click(p,'[data-tab="tasks"]');click(p,'[data-act="global-create"]')
    assert p.locator('[data-create-kind="task"]').get_attribute('aria-selected')=='true'

@test('note-opens-full-bottom-sheet-with-live-editor')
def _(p):
    open_note(p)
    assert p.locator('.note-sheet').is_visible()
    assert p.locator('.note-sheet [data-live-md]').is_visible()
    assert sheet_covers_bottom_nav(p)
```

- [ ] **Step 2: Run Notes/creation subset and confirm RED**

```bash
python tests/lite/experience.py --match note
python tests/lite/experience.py --match global-create
```

- [ ] **Step 3: Rename UI copy from 便签 to 笔记 without changing storage field names**

Update shell, root tab, accessible labels, empty states, toasts and help copy. Keep WorkBuddy table/field names such as `便签内容` unchanged.

- [ ] **Step 4: Replace small note modal with Note Sheet**

Use the same sheet scaffold/material/close semantics as Day Sheet. Mount the Task 3 live editor for `便签内容`, keep category/pin/archive/task-link metadata secondary, debounce save through existing store patch queue, and preserve unsaved draft on failure.

- [ ] **Step 5: Replace task-only global create dialog with one Creation Sheet**

Creation Sheet tabs: `任务 | 笔记`.
- root `任务` -> defaults to Task;
- root `笔记` -> defaults to Note;
- `/` calls the same sheet when no contextual sheet/editor is active;
- Day Sheet / Note Sheet open -> `/` is ordinary text/no-op global shortcut;
- Task creation keeps date parser/priority/tags; Note creation uses live Markdown editor and note metadata.

- [ ] **Step 6: Run Notes + keyboard + mobile sheet regression**

```bash
python tests/lite/experience.py --match note
python tests/lite/experience.py --match create
python tests/lite/experience.py --match shortcut
```

- [ ] **Step 7: Commit**

```bash
git add src/lite/views.js src/lite/dialogs.js src/lite/panels.js src/lite/app.js src/lite/shell.html src/lite/styles.css tests/lite/experience.py
git commit -m "feat(lite): turn notes and creation into shared sheets"
```

---

### Task 7: Animated pointer board reorder

**Files:**
- Create: `src/lite/board.js`
- Modify: `src/lite/views.js`
- Modify: `src/lite/app.js`
- Modify: `src/lite/shell.html`
- Modify: `tools/build_lite.py`
- Modify: `src/lite/styles.css`
- Modify: `tests/lite/core.test.cjs`
- Modify: `tests/lite/experience.py`

**Interfaces:**
- Consumes: board card DOM, `store.patch`, task status/order fields.
- Produces: `OneDayLiteBoard.mount(root,L)` pointer reorder controller, order-index helper.

- [ ] **Step 1: Add failing pure order-index tests and Chromium drag tests**

Pure helper:

```js
test('reorder indices are dense after cross-column move', () => {
  assert.deepEqual(C.reorder(['a','b','c'],'b',['x','y'],1), {source:['a','c'],target:['x','b','y']});
});
```

Chromium test verifies a dragged card has a floating ghost, neighboring card transforms during hover, drop persists status and `排序序号`, cancel persists neither.

- [ ] **Step 2: Run board tests and confirm RED**

```bash
node --test tests/lite/core.test.cjs
python tests/lite/experience.py --match board-drag
```

- [ ] **Step 3: Implement pointer controller with FLIP**

On pointer down after a small movement threshold:
- snapshot all card rects;
- lift dragged clone/ghost to fixed overlay;
- insert real-height placeholder;
- on pointer move compute destination index/column;
- move placeholder and animate changed card rect deltas with transform -> zero;
- near edge, scroll board container;
- on pointer up persist target status and dense `排序序号` values;
- on Escape/pointercancel restore original DOM and write nothing.

Use Pointer Events so mouse/touch share one path. Under `prefers-reduced-motion`, placement updates immediately with no displacement tween.

- [ ] **Step 4: Remove legacy HTML5 card drag routing for board cards only**

Calendar drag behavior may retain its existing handler if still needed; board cards must route to the new controller and must not simultaneously fire native `dragstart`.

- [ ] **Step 5: Run board + full browser regression**

```bash
python tests/lite/experience.py --match board
python tests/lite/experience.py
```

- [ ] **Step 6: Commit**

```bash
git add src/lite/board.js src/lite/views.js src/lite/app.js src/lite/shell.html tools/build_lite.py src/lite/styles.css tests/lite/core.test.cjs tests/lite/experience.py
git commit -m "feat(lite): animate pointer board reordering"
```

---

### Task 8: Theme system, glass calendar cards, marker labels, and final release verification

**Files:**
- Create: `src/lite/themes.js`
- Modify: `src/lite/shell.html`
- Modify: `tools/build_lite.py`
- Modify: `src/lite/views.js`
- Modify: `src/lite/panels.js`
- Modify: `src/lite/app.js`
- Modify: `src/lite/styles.css`
- Modify: `src/lite/demo.js`
- Modify: `tests/lite/experience.py`
- Modify: `tests/lite/screenshots.py`
- Modify: `tools/check_lite.py`
- Modify: `README-LITE.md`
- Modify: `docs/lite/开发交接.md`
- Modify: `docs/lite/发布与验收.md`
- Modify: `docs/lite/使用说明.md`

**Interfaces:**
- Consumes: `C.calendarLabel`, settings storage/table, calendar grid renderer.
- Produces: five theme tokens, persistent theme setting, card-grid calendar with reflection sweep and editable leave marker.

- [ ] **Step 1: Add failing browser tests for themes, card boundaries, labels, and reduced motion**

Scenarios:

```python
@test('calendar-cards-stay-separated-at-390px')
def _(p):
    p.set_viewport_size({'width':390,'height':844});wait(p)
    cells=p.locator('.month-grid .day')
    a,b=cells.nth(0).bounding_box(),cells.nth(1).bounding_box()
    assert b['x']-(a['x']+a['width']) >= 2
    assert float(cells.nth(0).evaluate('e=>parseFloat(getComputedStyle(e).borderRadius)')) > 0

@test('theme-switch-keeps-layout-and-changes-material')
def _(p):
    before=p.locator('.month-grid').bounding_box()
    set_theme(p,'Color Block')
    after=p.locator('.month-grid').bounding_box()
    assert abs(before['width']-after['width'])<1
    assert p.locator('html').get_attribute('data-theme')=='color-block'
```

Also verify holiday/workday/leave labels and that `prefers-reduced-motion: reduce` produces no active sweep animation.

- [ ] **Step 2: Run visual behavior subset and confirm RED**

```bash
python tests/lite/experience.py --match calendar
python tests/lite/experience.py --match theme
```

- [ ] **Step 3: Implement token-driven themes**

`themes.js` exports exactly these ids: `glass-day`, `paper`, `night`, `color-block`, `minimal`. `apply(id)` sets `document.documentElement.dataset.theme=id`, updates `meta[name="theme-color"]`, and persists through existing settings/local preference. Theme CSS variables cover page/card/sheet/board/editor typography/water/reflection/status materials.

- [ ] **Step 4: Convert calendar to separated glass/card tiles and labels**

Use CSS grid gap at every breakpoint; never collapse to table borders. Each date renders `C.calendarLabel(date, marks)` plus weekend state, task summaries/dots, exact water data. Add a leave-marker action to the settings/date-context surface that writes the existing calendar marker table as `标记类型='请假'` with the chosen title.

- [ ] **Step 5: Add occasional group reflection sweep**

One pseudo/overlay highlight traverses the calendar group, pointer-events none. Schedule the next sweep with a deterministic bounded timer in runtime code (18–35 seconds); do not run when `matchMedia('(prefers-reduced-motion: reduce)').matches` or the current theme disables reflection.

- [ ] **Step 6: Run complete verification**

Run fresh, in this order:

```bash
python tools/build_lite.py
node --test tests/core.test.cjs tests/lite/core.test.cjs tests/lite/store.test.cjs
python tools/check_lite.py
python tests/lite/experience.py
python tests/lite/screenshots.py
```

Acceptance: zero command failures; no JavaScript syntax errors; no horizontal viewport overflow in screenshot targets; formal build contains no local fake-database fallback; root/Day/Note/Creation sheets obey single-entry rules.

- [ ] **Step 7: Update release docs with WorkBuddy migration boundaries**

Document exact required formal schema additions (`最后期限`, `预计时长`, `允许并行`), the attachment-folder target, verified image contract, still-unverified generic document upload contract, and cross-device acceptance steps. Do not claim generic document cloud upload passed until tested in the actual WorkBuddy host.

- [ ] **Step 8: Commit**

```bash
git add src/lite/themes.js src/lite/shell.html tools/build_lite.py src/lite/views.js src/lite/panels.js src/lite/app.js src/lite/styles.css src/lite/demo.js tests/lite/experience.py tests/lite/screenshots.py tools/check_lite.py README-LITE.md docs/lite/开发交接.md docs/lite/发布与验收.md docs/lite/使用说明.md
git commit -m "feat(lite): finish 1.3 rich workspace themes and release"
```

---

## Plan self-review result

- Spec coverage: all approved 1.3 sections map to Tasks 1–8.
- No extra database/table is introduced.
- Generic WorkBuddy document upload remains capability-gated and cannot be falsely reported as complete.
- Task/Note global creation and contextual Day Sheet creation have one-entry ownership.
- Timeline conflict policy does not silently move other tasks; 1.3 only moves the active task to a free slot or explicitly marks it parallel.
- Parent/child expansion has explicit regression coverage because 1.2 behavior was reported broken by the user.
- Mobile Day Sheet stays one layer with timeline + detail together and receives explicit overflow tests.
