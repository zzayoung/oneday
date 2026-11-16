# OneDay Lite 1.4 · Sites verification

Verified on 2026-10-19 against the source used to generate `app/oneday.html`.

## Automated regression

```bash
node --test --test-isolation=none tests/core.test.cjs tests/lite/core.test.cjs tests/lite/store.test.cjs tests/cloud/*.cjs tests/cloud/backend.test.mjs
```

Result: **200 tests passed; 0 failed; exit 0**.

The set contains 96 retained tests, 60 editor/draft regressions, 21 cloud adapter/store/backup regressions, and 23 SQLite integration tests. Assertions cover source compatibility, Markdown table preservation, selection and IME behavior, in-flight uploads, failed-save recovery, acknowledged-only draft clearing, scoped storage, exact record versions, retry IDs, complete pagination, UTF-8 import batch bounds, ambiguous legacy IDs, and manual execution-time correction.

## Actual Workers, D1 and R2 runtime

```bash
node tests/cloud/backend-runtime.test.mjs
```

Result: **passed; exit 0**, using Miniflare and the generated deployment migration. This checks real D1 transaction behavior, competing status updates with one log, multi-megabyte imports, private R2 bytes, record and attachment persistence after Worker restart, receipt replay, attachment inventory, and a corrected 45-minute execution interval.

The runtime uses a disposable local directory and explicit test identities. It does not authenticate as the user's real ChatGPT account.

## HTTP integration through the managed Site preview

```bash
node tests/cloud/http-smoke.mjs
```

Result: **12 checks passed; exit 0**. Two independently constructed clients accessed the same local Worker through HTTP. The checks include an unsigned 401, a separate owner's empty space, a stale-version rejection, atomic task/log state changes, PNG/text byte equality, protected attachment access, all seven backup tables, and import conflict protection.

The test identity headers are confined to the local smoke client. Production code only reads the trusted Sites dispatch identity; no demo identity, request-auth override, or test-data initialization is shipped.

## Browser UI verification

The supported managed browser opened the production entry without a session and displayed the sign-in requirement. The business API did not fall back to browser data.

For interaction QA, temporary internal pages used the retained original local adapter with non-production sample records. Checked the desktop creation sheet; real typing and saving of Markdown heading/checklists/table; reopening that saved task in Day; 390px-wide calendar, Day, note and settings sheets; bottom navigation; all five theme options; Night theme; and the horizontal mobile board. These checks verify the actual retained UI, not authenticated cross-device cloud use.

The temporary `public/__qa*` files and `dist/lite` outputs were removed before the final build. `tools/build_lite_sites.py` confirms valid script syntax and absence of the demo database marker.

## Independent review

A separate reviewer reproduced and rechecked the resolved issues: legacy task-detail upload arguments; closing after both cloud and local saving fail; inconsistent import ID aliases; and a manual-time-correction race after another device paused the segment. Final verdict: no remaining code-review blocker to private publication.

## Deployment and acceptance boundary

Source and build packaging use the native Sites source workflow for project `[redacted-site-id]`. Publication uses the confirmed owner-private audience. The deployment service supplies the final version, deployment status, and literal URL after this source is committed.

The live health endpoint checks provisioned D1 tables and R2 availability without returning personal data. A service bypass by itself does not supply a visitor identity; business APIs must still reject it with 401.

Actual sign-in in the user's account, simultaneous phone/desktop browser acceptance, physical touch dragging and a real Chinese mobile keyboard are **not claimed as completed**. Cloud tests use independent clients and a genuine local runtime; UI tests use controlled local fixtures. Existing WorkBuddy data and attachment bytes have not been automatically migrated.
