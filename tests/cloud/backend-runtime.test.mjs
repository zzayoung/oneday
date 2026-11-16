import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Miniflare } from 'miniflare';

test('actual Workers runtime: D1 CAS/import and R2 bytes remain private and survive restart', { timeout: 60000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'oneday-workers-'));
  const script = `${await readFile(new URL('../../server/api.mjs', import.meta.url), 'utf8')}\nexport default { fetch: handleOneDay };`;
  const options = { modules: true, script, compatibilityDate: '2026-05-15',
    d1Databases: { DB: 'oneday-test-database' }, d1Persist: join(directory, 'd1'),
    r2Buckets: { BUCKET: 'oneday-test-files' }, r2Persist: join(directory, 'r2'),
    cf: false, host: '127.0.0.1', port: 0,
  };
  let runtime = new Miniflare(options);
  t.after(async () => { await runtime.dispose(); await rm(directory, { recursive: true, force: true }); });
  const DB = await runtime.getD1Database('DB');
  const migrationDirectory = new URL('../../drizzle/', import.meta.url);
  const migrations = (await readdir(migrationDirectory)).filter(name => name.endsWith('.sql')).sort();
  assert.ok(migrations.length, 'deployment migrations must exist');
  for (const file of migrations) {
    const statements = (await readFile(new URL(file, migrationDirectory), 'utf8')).split('--> statement-breakpoint').map(sql => sql.trim()).filter(Boolean);
    await DB.batch(statements.map(sql => DB.prepare(sql)));
  }
  async function call(path, { method = 'GET', body, user = 'device-owner', headers = {} } = {}) {
    const requestHeaders = new Headers(headers);
    if (user) requestHeaders.set('oai-authenticated-user-id', user);
    let serialized;
    if (body instanceof FormData) {
      const form = new Response(body);
      requestHeaders.set('content-type', form.headers.get('content-type'));
      serialized = await form.arrayBuffer();
    } else if (body !== undefined) { requestHeaders.set('content-type', 'application/json'); serialized = JSON.stringify(body); }
    const response = await runtime.dispatchFetch(`https://oneday.example/api/oneday${path}`, { method, headers: Object.fromEntries(requestHeaders), body: serialized });
    const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
    return { response, status: response.status, data };
  }

  const health = await call('/health', { user: null });
  assert.equal(health.status, 200, JSON.stringify(health.data));
  assert.deepEqual(health.data, { ok: true, database: true, files: true, version: '1.9.0' });
  assert.equal((await call('/records/tasks', { user: null })).status, 401);

  const createBody = { recordId: 'persist-task', requestId: 'create-persist-task', properties: {
    '任务标题': { text: '云端任务' }, '任务状态': { select: '进行中' },
    '状态开始时间': { date: new Date(Date.now() - 3600000).toISOString() },
    '计划开始时间': { date: '2026-10-19T09:00:00Z' }, '回收站': { checkbox: false },
  } };
  const created = await call('/records/tasks', { method: 'POST', body: createBody });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.record._version, 1);
  assert.deepEqual((await call('/records/tasks', { method: 'POST', body: createBody })).data, created.data);

  const race = await Promise.all(['暂停', '完成'].map((status, i) => call('/tasks/persist-task/status', {
    method: 'POST', body: { status, expectedVersion: 1, requestId: `status-${i}` },
  })));
  assert.deepEqual(race.map(result => result.status).sort(), [200, 409], JSON.stringify(race.map(result => result.data)));
  const logs = await call('/records/logs');
  assert.equal(logs.data.results.length, 1);
  assert.ok(Math.abs(logs.data.results[0]['持续时长'] - 1) < 0.01);
  assert.equal((await call('/records/tasks/persist-task', { user: 'different-owner' })).status, 404);

  const correctedStart = new Date(Date.now() - 2 * 3600000).toISOString(), correctedEnd = new Date(Date.parse(correctedStart) + 2700000).toISOString();
  const correctionTask = await call('/records/tasks', { method: 'POST', body: { recordId: 'corrected-task', requestId: 'create-correction', properties: {
    '任务标题': { text: '修正本次实际结束时间' }, '任务状态': { select: '进行中' }, '状态开始时间': { date: correctedStart }, '回收站': { checkbox: false },
  } } });
  assert.equal(correctionTask.status, 201);
  const correctionBody = { status: '完成', expectedVersion: 1, requestId: 'correct-runtime-time', endedAt: correctedEnd };
  const correction = await call('/tasks/corrected-task/status', { method: 'POST', body: correctionBody });
  assert.equal(correction.status, 200);assert.equal(correction.data.log['结束时间'], correctedEnd);assert.equal(correction.data.log['持续时长'], 0.75);
  assert.deepEqual((await call('/tasks/corrected-task/status', { method: 'POST', body: correctionBody })).data, correction.data);

  // More than 2 MB of total import data verifies the per-binding split against
  // the actual D1/SQLite RPC implementation, not only the Node SQL adapter.
  const tables = { notes: Array.from({ length: 6 }, (_, i) => ({ _id: `large-${i}`, text: 'x'.repeat(400000) })) };
  const imported = await call('/import', { method: 'POST', body: { tables, requestId: 'runtime-import' } });
  assert.equal(imported.status, 200, JSON.stringify(imported.data));
  assert.deepEqual(imported.data, { imported: 6, skipped: 0, conflicts: [] });
  const repeated = await call('/import', { method: 'POST', body: { tables, requestId: 'runtime-import-repeat' } });
  assert.deepEqual(repeated.data, { imported: 0, skipped: 6, conflicts: [] });
  const conflict = await call('/import', { method: 'POST', body: { tables: { notes: [{ _id: 'must-not-appear', text: 'new' }, { _id: 'large-0', text: 'changed' }] }, requestId: 'runtime-import-conflict' } });
  assert.equal(conflict.status, 409);
  assert.equal((await call('/records/notes/must-not-appear')).status, 404);

  const bytes = new TextEncoder().encode('%PDF-1.4\nOneDay persistent attachment\n%%EOF');
  const form = new FormData(); form.set('file', new File([bytes], '持久附件.pdf', { type: 'application/pdf' }));
  const upload = await call('/files', { method: 'POST', body: form });
  assert.equal(upload.status, 201, JSON.stringify(upload.data));
  assert.equal(upload.data.size, bytes.length);
  const downloaded = await call(`/files/${upload.data.id}`);
  assert.equal(downloaded.status, 200);
  assert.deepEqual(new Uint8Array(await downloaded.response.arrayBuffer()), bytes);
  assert.match(downloaded.response.headers.get('content-disposition'), /^attachment;/);
  assert.equal((await call(`/files/${upload.data.id}`, { user: 'different-owner' })).status, 404);
  assert.equal((await call(`/files/${upload.data.id}`, { user: null })).status, 401);

  const versionBefore = (await call('/revision')).data.revision;
  await runtime.dispose();
  runtime = new Miniflare({ ...options, script: `${script}\n// Worker restarted with unchanged schema and durable bindings.` });
  const afterRestart = await call('/records/tasks/persist-task');
  assert.equal(afterRestart.status, 200);
  assert.equal(afterRestart.data.record._version, 2);
  assert.equal(afterRestart.data.record['计划开始时间'], '2026-10-19T09:00:00Z');
  assert.equal((await call('/revision')).data.revision, versionBefore);
  assert.deepEqual((await call('/records/tasks', { method: 'POST', body: createBody })).data, created.data);
  const persistedFile = await call(`/files/${upload.data.id}`);
  assert.deepEqual(new Uint8Array(await persistedFile.response.arrayBuffer()), bytes);
  const backup = await call('/backup');
  assert.equal(backup.status, 200, JSON.stringify(backup.data)?.slice(0, 250));
  assert.equal(backup.data.tables.tasks.length, 2);
  assert.equal(backup.data.tables.notes.length, 6);
  assert.equal(backup.data.attachments.length, 1);
  assert.equal(backup.data.attachmentBytesIncluded, false);
  assert.equal((await call('/backup', { user: 'different-owner' })).data.attachments.length, 0);
  const fileList = await call('/files?limit=1');
  assert.equal(fileList.data.results[0].id, upload.data.id);
  assert.equal(fileList.data.hasMore, false);
  assert.deepEqual((await call('/files', { user: 'different-owner' })).data.results, []);
});
