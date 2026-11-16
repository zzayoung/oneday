# OneDay Lite 1.4 · Private Sites edition

## Product continuity

This is an incremental continuation of OneDay Lite 1.3 Rich Workspace, recovered from the original deployment handoff. The bottom tasks / + / notes navigation, calendar and board, Day time axis, parent/child tasks, explicit parallel scheduling, five themes and live Markdown remain. The original WorkBuddy build is retained as a separate build target.

## Cloud records and files

- All seven original logical tables preserve record IDs, relationships and safe unknown fields.
- D1 stores confirmed records; R2 stores real attachment bytes. Every business and attachment request requires a trusted Sites user identity and is scoped to it.
- Record updates and deletes use versions; task state and elapsed logs commit atomically. Idempotency receipts protect retries, including uncertain creation acknowledgements.
- Revision polling refreshes other clients while coherent reads prevent mixed snapshots. Offline or rejected writes remain errors with recoverable local drafts.
- Manual execution-end correction preserves the chosen UTC instant and rejects a segment changed on another device.

## Editing reliability

- Markdown tables survive editing; unmodified table source is retained.
- Input method composition and selection survive editor refreshes.
- Uploads preserve text entered while they are pending. Images completing after task-sheet closure are kept with the original task's draft.
- Task, Day, Note and Creation drafts capture synchronously on lifecycle events. Only acknowledged content is cleared. When neither cloud nor local saving succeeds, the sheet stays open.

## Data portability

Settings provide complete server record export, an attachment inventory and explicit legacy JSON import. Large exports read every page and require one stable revision. Imports preflight conflicting IDs, skip identical rows and merge new records in size-bounded batches without overwriting existing content. Interrupted import can be resumed with the same backup.

The JSON includes attachment URLs and metadata, not attachment bytes. Old links are preserved as provided; old attachment contents are not copied automatically. New Sites data starts empty.
