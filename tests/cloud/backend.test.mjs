import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleOneDay } from '../../server/api.mjs';

// This adapter executes the production SQL in SQLite, including transactional
// batches. It intentionally does not pretend that separate queries are atomic.
const bootstrap = `
CREATE TABLE oneday_records (owner_id TEXT NOT NULL, table_name TEXT NOT NULL, record_id TEXT NOT NULL,
 payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, deleted INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(owner_id, table_name, record_id));
CREATE TABLE oneday_receipts (owner_id TEXT NOT NULL, request_id TEXT NOT NULL, operation TEXT NOT NULL,
 request_hash TEXT NOT NULL, response TEXT NOT NULL, execution_id TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(owner_id, request_id));
CREATE TABLE oneday_revisions (owner_id TEXT PRIMARY KEY NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
CREATE TABLE oneday_files (owner_id TEXT NOT NULL, file_id TEXT NOT NULL, object_key TEXT NOT NULL,
 name TEXT NOT NULL, size INTEGER NOT NULL, type TEXT NOT NULL, association TEXT, created_at TEXT NOT NULL,
 PRIMARY KEY(owner_id, file_id));`;

class SQLiteD1 {
  constructor(filename = ':memory:', initialize = true) {
    this.raw = new DatabaseSync(filename);
    if (initialize) this.raw.exec(bootstrap);
  }
  prepare(sql) {
    const db = this;
    const statement = {
      sql, values: [],
      bind(...values) { this.values = values; return this; },
      async first(column) {
        const row = db.raw.prepare(sql).get(...this.values);
        return row ? column ? row[column] : { ...row } : null;
      },
      async all() { return db.execute(this); },
      async run() { return db.execute(this); },
    };
    return statement;
  }
  execute(statement) {
    const query = this.raw.prepare(statement.sql);
    if (query.columns().length) return { success: true, results: query.all(...statement.values).map(row => ({ ...row })), meta: { changes: 0 } };
    const result = query.run(...statement.values);
    return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
  async batch(statements) {
    if (this.beforeBatch) { const hook = this.beforeBatch; this.beforeBatch = null; hook(this.raw); }
    this.raw.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(statement => this.execute(statement));
      this.raw.exec('COMMIT');
      return results;
    } catch (error) { this.raw.exec('ROLLBACK'); throw error; }
  }
  close() { this.raw.close(); }
}

class ByteBucket {
  objects = new Map();
  async put(key, value, options) {
    const bytes = value instanceof ArrayBuffer ? value.slice(0) : await new Response(value).arrayBuffer();
    this.objects.set(key, { bytes, options });
    return { key, size: bytes.byteLength };
  }
  async get(key) {
    const object = this.objects.get(key);
    return object ? { body: new Blob([object.bytes]).stream(), size: object.bytes.byteLength } : null;
  }
  async delete(key) { this.objects.delete(key); }
  async list() { return { objects: [...this.objects.keys()].slice(0, 1).map(key => ({ key })), truncated: false }; }
}

function setup(t) {
  const env = { DB: new SQLiteD1(), BUCKET: new ByteBucket() };
  t.after(() => env.DB.close());
  return env;
}

async function call(env, path, { method = 'GET', user = 'alice', body, headers = {} } = {}) {
  const h = new Headers(headers);
  if (user) h.set('oai-authenticated-user-id', user);
  if (body !== undefined && !(body instanceof FormData)) h.set('content-type', 'application/json');
  const request = new Request(`https://oneday.example/api/oneday${path}`, {
    method, headers: h, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const response = await handleOneDay(request, env);
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
  return { status: response.status, data, response };
}

const props = (title = '写作') => ({ '任务标题': { text: title }, '任务状态': { select: '收集（未开始）' }, '回收站': { checkbox: false } });
async function create(env, table = 'tasks', recordId = crypto.randomUUID(), properties = props(), requestId = crypto.randomUUID()) {
  return call(env, `/records/${table}`, { method: 'POST', body: { recordId, properties, requestId } });
}

test('identity is mandatory on every API and session never invents a user', async t => {
  const env = setup(t);
  for (const path of ['/session', '/revision', '/records/tasks', '/files', '/files/x', '/backup']) {
    const result = await call(env, path, { user: null });
    assert.equal(result.status, 401, path);
  }
  const session = await call(env, '/session', { headers: {
    'oai-authenticated-user-full-name': encodeURIComponent('小明'),
    'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8',
  } });
  assert.deepEqual(session.data, { userId: 'alice', displayName: '小明' });
  assert.equal((await call(env, '/records/tasks')).data.results.length, 0);
});

test('health checks schema and R2 without returning any personal data', async t => {
  const env = setup(t);
  await create(env, 'notes', 'secret', { '便签内容': { text: 'private content' } });
  const health = await call(env, '/health', { user: null });
  assert.equal(health.status, 200);
  assert.deepEqual(health.data, { ok: true, database: true, files: true, version: '1.9.0' });
  assert.equal((await call({ DB: env.DB }, '/health', { user: null })).status, 503);
  assert.equal((await call(env, '/health', { method: 'POST', user: null, body: {} })).status, 401);
});

test('all record operations are owner-scoped; create is idempotent and plan strings survive', async t => {
  const env = setup(t);
  const properties = { ...props(), '计划开始时间': { date: '2026-10-19T09:30:00Z' }, '自定义': { text: '保留' } };
  const made = await create(env, 'tasks', 'task-a', properties, 'create-a');
  assert.equal(made.status, 201);
  assert.equal(made.data.record._version, 1);
  assert.equal(made.data.record['计划开始时间'], '2026-10-19T09:30:00Z');
  assert.deepEqual((await create(env, 'tasks', 'task-a', properties, 'create-a')).data, made.data);
  assert.equal((await create(env, 'tasks', 'task-b', properties, 'create-a')).status, 409);
  assert.equal((await call(env, '/revision')).data.revision, '1');
  assert.equal((await call(env, '/revision', { user: 'bob' })).data.revision, '0');
  assert.deepEqual((await call(env, '/records/tasks', { user: 'bob' })).data.results, []);
  assert.equal((await call(env, '/records/tasks/task-a', { user: 'bob' })).status, 404);
  assert.equal((await call(env, '/records/tasks/task-a', { method: 'PATCH', user: 'bob', body: { properties: props('偷改'), expectedVersion: 1, requestId: 'bob-change' } })).status, 404);
  assert.equal((await call(env, '/records/tasks/task-a', { method: 'DELETE', user: 'bob', body: { expectedVersion: 1, requestId: 'bob-delete' } })).status, 404);
  assert.equal((await call(env, '/records/tasks/task-a')).data.record['任务标题'], '写作');
});

test('pagination is stable, scoped, bounded, and cursor errors are explicit', async t => {
  const env = setup(t);
  for (const id of ['a', 'b', 'c']) await create(env, 'notes', id, { '便签内容': { text: id } });
  const first = await call(env, '/records/notes?limit=2');
  assert.deepEqual(first.data.results.map(row => row._id), ['a', 'b']);
  assert.equal(first.data.hasMore, true);
  const second = await call(env, `/records/notes?limit=2&cursor=${encodeURIComponent(first.data.nextCursor)}`);
  assert.deepEqual(second.data.results.map(row => row._id), ['c']);
  assert.equal(second.data.hasMore, false);
  assert.equal((await call(env, '/records/notes?limit=10000')).status, 400);
  assert.equal((await call(env, '/records/notes?cursor=not-a-cursor')).status, 400);
  assert.equal((await call(env, '/records/secrets')).status, 400);
});

test('concurrent updates with the same base version have exactly one winner', async t => {
  const env = setup(t);
  await create(env, 'tasks', 'task-a');
  const results = await Promise.all(['设备 A', '设备 B'].map((title, i) => call(env, '/records/tasks/task-a', {
    method: 'PATCH', body: { properties: { '任务标题': { text: title } }, expectedVersion: 1, requestId: `change-${i}` },
  })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal(results.find(r => r.status === 409).data.code, 'CONFLICT');
  assert.equal((await call(env, '/records/tasks/task-a')).data.record._version, 2);
  assert.equal((await call(env, '/revision')).data.revision, '2');
  const winner = results.findIndex(r => r.status === 200);
  const replay = await call(env, '/records/tasks/task-a', { method: 'PATCH', body: {
    properties: { '任务标题': { text: ['设备 A', '设备 B'][winner] } }, expectedVersion: 1, requestId: `change-${winner}`,
  } });
  assert.deepEqual(replay.data, results[winner].data);
  assert.equal((await call(env, '/revision')).data.revision, '2');
});

test('delete uses CAS and a durable tombstone; replay never deletes a newer record', async t => {
  const env = setup(t);
  await create(env, 'links', 'link-a', { '任务ID': { text: 'a' } });
  assert.equal((await call(env, '/records/links/link-a', { method: 'DELETE', body: { requestId: 'missing-version' } })).status, 400);
  const body = { expectedVersion: 1, requestId: 'delete-a' };
  assert.equal((await call(env, '/records/links/link-a', { method: 'DELETE', body })).status, 200);
  assert.equal((await call(env, '/records/links/link-a', { method: 'DELETE', body })).status, 200);
  assert.equal((await call(env, '/records/links/link-a')).status, 404);
  assert.equal((await create(env, 'links', 'link-a')).status, 409);
  assert.equal((await call(env, '/revision')).data.revision, '2');
});

test('mutations reject cross-origin requests and unsafe fields before any write', async t => {
  const env = setup(t);
  const body = { recordId: 'unsafe', properties: props(), requestId: 'unsafe' };
  for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' }]) {
    assert.equal((await call(env, '/records/tasks', { method: 'POST', body, headers })).status, 403);
  }
  assert.equal((await call(env, '/records/tasks', { method: 'POST', body, headers: { origin: 'https://oneday.example', 'sec-fetch-site': 'same-origin' } })).status, 201);
  const dangerous = new Request('https://oneday.example/api/oneday/records/notes', { method: 'POST', headers: {
    'content-type': 'application/json', 'oai-authenticated-user-id': 'alice',
  }, body: '{"recordId":"pollution","requestId":"pollution","properties":{"__proto__":{"text":"bad"}}}' });
  assert.equal((await handleOneDay(dangerous, env)).status, 400);
  assert.equal((await create(env, 'notes', 'bad-wrapper', { content: { html: '<p>bad</p>' } })).status, 400);
  assert.equal((await call(env, '/records/notes')).data.results.length, 0);
});

test('status transition stores one elapsed log in hours, atomically, with repeat-safe response', async t => {
  const env = setup(t);
  const start = new Date(Date.now() - 2 * 3600000).toISOString();
  await create(env, 'tasks', 'timed', { ...props(), '任务状态': { select: '进行中' }, '状态开始时间': { date: start },
    '计划开始时间': { date: '2026-10-19T09:30:00Z' }, '任务类型': { select: '子任务' }, '父任务ID': { text: 'parent' } });
  const body = { status: '完成', expectedVersion: 1, requestId: 'finish' };
  const completed = await call(env, '/tasks/timed/status', { method: 'POST', body });
  assert.equal(completed.status, 200);
  assert.equal(completed.data.task['任务进度'], 100);
  assert.equal(completed.data.task._version, 2);
  assert.equal(completed.data.task['计划开始时间'], '2026-10-19T09:30:00Z');
  assert.equal(completed.data.log['任务ID'], 'timed');
  assert.equal(completed.data.log['状态'], '进行中');
  assert.ok(Math.abs(completed.data.log['持续时长'] - 2) < 0.01);
  assert.deepEqual((await call(env, '/tasks/timed/status', { method: 'POST', body })).data, completed.data);
  assert.equal((await call(env, '/records/logs')).data.results.length, 1);
  assert.equal((await call(env, '/revision')).data.revision, '2');
  const noop = await call(env, '/tasks/timed/status', { method: 'POST', body: { status: '完成', expectedVersion: 2, requestId: 'noop' } });
  assert.equal(noop.data.task._version, 2);
  assert.equal(noop.data.log, null);
  assert.equal((await call(env, '/revision')).data.revision, '2');
  const reopen = await call(env, '/tasks/timed/status', { method: 'POST', body: { status: '进行中', expectedVersion: 2, requestId: 'reopen' } });
  assert.equal(reopen.data.task['任务进度'], 0);
  assert.equal(reopen.data.log, null);
});

test('manual time correction stores the chosen end and cannot silently substitute server now', async t => {
  const env = setup(t), start = new Date(Date.now() - 3 * 3600000).toISOString(), endedAt = new Date(Date.parse(start) + 90 * 60000).toISOString();
  await create(env, 'tasks', 'corrected', { ...props(), '任务状态': { select: '进行中' }, '状态开始时间': { date: start } });
  const body = { status: '暂停', expectedVersion: 1, requestId: 'correct-time', endedAt };
  const result = await call(env, '/tasks/corrected/status', { method: 'POST', body });
  assert.equal(result.status, 200);assert.equal(result.data.log['结束时间'], endedAt);assert.equal(result.data.log['持续时长'], 1.5);assert.equal(result.data.task['状态开始时间'], endedAt);
  assert.deepEqual((await call(env, '/tasks/corrected/status', { method: 'POST', body })).data, result.data);
  assert.equal((await call(env, '/tasks/corrected/status', { method: 'POST', body: { ...body, endedAt: start } })).status, 409);
});

test('invalid manual end times reject before writing any task or log', async t => {
  const env = setup(t), start = new Date(Date.now() - 3600000).toISOString();
  await create(env, 'tasks', 'corrected', { ...props(), '任务状态': { select: '进行中' }, '状态开始时间': { date: start } });
  for (const endedAt of ['invalid', start, new Date(Date.parse(start) - 1000).toISOString(), new Date(Date.now() + 300000).toISOString()]) {
    assert.equal((await call(env, '/tasks/corrected/status', { method: 'POST', body: { status: '暂停', expectedVersion: 1, requestId: crypto.randomUUID(), endedAt } })).status, 400);
  }
  assert.equal((await call(env, '/tasks/corrected/status', { method: 'POST', body: { status: '收集（未开始）', expectedVersion: 1, requestId: 'wrong-target', endedAt: new Date().toISOString() } })).status, 400);
  assert.equal((await call(env, '/records/tasks/corrected')).data.record._version, 1);
  assert.equal((await call(env, '/records/logs')).data.results.length, 0);
});

test('competing status transitions cannot leave an orphan log', async t => {
  const env = setup(t);
  await create(env, 'tasks', 'timed', { ...props(), '任务状态': { select: '进行中' }, '状态开始时间': { date: new Date(Date.now() - 3600000).toISOString() } });
  const results = await Promise.all(['暂停', '完成'].map((status, i) => call(env, '/tasks/timed/status', {
    method: 'POST', body: { status, expectedVersion: 1, requestId: `status-${i}` },
  })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal((await call(env, '/records/logs')).data.results.length, 1);
  assert.equal((await call(env, '/records/tasks/timed')).data.record._version, 2);
});

test('closing an existing open log preserves its identity and rejects a concurrent log edit', async t => {
  const env = setup(t);
  const start = new Date(Date.now() - 3600000).toISOString();
  await create(env, 'tasks', 'timed', { ...props(), '任务状态': { select: '进行中' }, '状态开始时间': { date: start } });
  await create(env, 'logs', 'open-log', { '任务ID': { text: 'timed' }, '状态': { select: '进行中' }, '开始时间': { date: start }, '备注': { text: '保留' } });
  env.DB.beforeBatch = raw => raw.prepare("UPDATE oneday_records SET version=2 WHERE owner_id='alice' AND table_name='logs' AND record_id='open-log'").run();
  assert.equal((await call(env, '/tasks/timed/status', { method: 'POST', body: { status: '暂停', expectedVersion: 1, requestId: 'race-open' } })).status, 409);
  assert.equal((await call(env, '/records/tasks/timed')).data.record._version, 1);
  const closed = await call(env, '/tasks/timed/status', { method: 'POST', body: { status: '暂停', expectedVersion: 1, requestId: 'close-open' } });
  assert.equal(closed.status, 200);
  assert.equal(closed.data.log._id, 'open-log');
  assert.equal(closed.data.log._version, 3);
  assert.equal(closed.data.log['备注'], '保留');
  assert.equal((await call(env, '/records/logs')).data.results.length, 1);
});

test('recycled tasks reject status changes and server time rejects future starts', async t => {
  const env = setup(t);
  await create(env, 'tasks', 'recycled', { ...props(), '回收站': { checkbox: true } });
  assert.equal((await call(env, '/tasks/recycled/status', { method: 'POST', body: { status: '进行中', expectedVersion: 1, requestId: 'recycled' } })).status, 409);
  await create(env, 'tasks', 'future', { ...props(), '状态开始时间': { date: new Date(Date.now() + 3600000).toISOString() } });
  assert.equal((await call(env, '/tasks/future/status', { method: 'POST', body: { status: '进行中', expectedVersion: 1, requestId: 'future' } })).status, 400);
  assert.equal((await call(env, '/records/logs')).data.results.length, 0);
});

test('import preserves all seven tables and unknown fields, skips equal records, and never overwrites', async t => {
  const env = setup(t);
  const tables = Object.fromEntries(['tasks', 'logs', 'notes', 'tags', 'links', 'sets', 'cal'].map(table => [table, [{
    _id: `old-${table}`, _version: 99, '自定义字段': { list: [1, '中文', null], nested: { checked: true } }, '原文': '**保留 Markdown**',
  }]]));
  const first = await call(env, '/import', { method: 'POST', body: { tables, requestId: 'import-1' } });
  assert.equal(first.status, 200);
  assert.deepEqual(first.data, { imported: 7, skipped: 0, conflicts: [] });
  assert.deepEqual((await call(env, '/import', { method: 'POST', body: { tables, requestId: 'import-1' } })).data, first.data);
  assert.deepEqual((await call(env, '/import', { method: 'POST', body: { tables, requestId: 'import-2' } })).data, { imported: 0, skipped: 7, conflicts: [] });
  const read = (await call(env, '/records/tasks/old-tasks')).data.record;
  assert.equal(read._version, 1);
  assert.deepEqual(read['自定义字段'], tables.tasks[0]['自定义字段']);
  const conflicting = await call(env, '/import', { method: 'POST', body: { tables: { tasks: [{ _id: 'new' }, { _id: 'old-tasks', '原文': '不同' }] }, requestId: 'conflict-import' } });
  assert.equal(conflicting.status, 409);
  assert.equal(conflicting.data.code, 'CONFLICT');
  assert.equal((await call(env, '/records/tasks/new')).status, 404);
  assert.equal((await call(env, '/records/tasks/old-tasks')).data.record['原文'], '**保留 Markdown**');
  assert.equal((await call(env, '/revision')).data.revision, '1');
  const backup = (await call(env, '/backup')).data;
  assert.equal(backup.app, 'OneDay');
  assert.equal(backup.edition, 'Sites');
  assert.equal(backup.version, '1.9.0');
  assert.equal(Object.values(backup.tables).flat().length, 7);
  assert.equal(Object.values((await call(env, '/backup', { user: 'bob' })).data.tables).flat().length, 0);
});

test('import is atomic even when a differing ID arrives between preflight and batch', async t => {
  const env = setup(t);
  env.DB.beforeBatch = raw => raw.prepare('INSERT INTO oneday_records VALUES(?,?,?,?,1,0,?,?)').run('alice', 'notes', 'race', '{"text":"other device"}', 'now', 'now');
  const result = await call(env, '/import', { method: 'POST', body: { requestId: 'import-race', tables: { notes: [{ _id: 'new', text: 'new' }, { _id: 'race', text: 'my draft' }] } } });
  assert.equal(result.status, 409);
  assert.equal((await call(env, '/records/notes/new')).status, 404);
  assert.equal((await call(env, '/records/notes/race')).data.record.text, 'other device');
});

test('import normalizes legacy ID aliases and validates the full chunk', async t => {
  const env = setup(t);
  const one = await call(env, '/import', { method: 'POST', body: { requestId: 'aliases', tables: { notes: [{ id: 'legacy', record_id: 'legacy', _version: 5, text: 'x' }] } } });
  assert.equal(one.status, 200);
  assert.deepEqual((await call(env, '/records/notes/legacy')).data.record, { _id: 'legacy', _version: 1, text: 'x' });
  const tooMany = await call(env, '/import', { method: 'POST', body: { requestId: 'big-import', tables: { notes: Array.from({ length: 101 }, (_, i) => ({ _id: String(i) })) } } });
  assert.equal(tooMany.status, 400);
  const invalid = await call(env, '/import', { method: 'POST', body: { requestId: 'invalid-import', tables: { notes: [{ _id: 'safe' }, { _id: 'bad', extra: JSON.parse('{"constructor":{"polluted":true}}') }] } } });
  assert.equal(invalid.status, 400);
  assert.equal((await call(env, '/records/notes/safe')).status, 404);
});

test('large import bindings stay below D1 string limits and record pages stay bounded', async t => {
  const env = setup(t);
  const tables = { notes: Array.from({ length: 12 }, (_, i) => ({ _id: `long-${String(i).padStart(2, '0')}`, text: 'x'.repeat(400000) })) };
  const imported = await call(env, '/import', { method: 'POST', body: { requestId: 'large-fields', tables } });
  assert.equal(imported.status, 200);
  assert.equal(imported.data.imported, 12);
  const page = await call(env, '/records/notes?limit=200');
  assert.equal(page.data.hasMore, true);
  assert.equal(page.data.results.length, 10);
  const next = await call(env, `/records/notes?cursor=${page.data.nextCursor}`);
  assert.equal(next.data.results.length, 2);
  assert.equal(next.data.hasMore, false);
});

test('oversized streamed requests are rejected before any database write', async t => {
  const env = setup(t);
  const request = new Request('https://oneday.example/api/oneday/import', { method: 'POST', headers: {
    'content-type': 'application/json', 'oai-authenticated-user-id': 'alice',
  }, body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1)); controller.close(); } }), duplex: 'half' });
  assert.equal((await handleOneDay(request, env)).status, 413);
  assert.equal((await call(env, '/revision')).data.revision, '0');
});

test('file upload persists actual bytes, uses protected URLs, and enforces owner access', async t => {
  const env = setup(t);
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
  const form = new FormData();
  form.set('file', new File([bytes], '图片.png', { type: 'image/png' }));
  form.set('owner', JSON.stringify({ ownerId: 'bob', type: 'tasks', id: 'task-a' }));
  const upload = await call(env, '/files', { method: 'POST', body: form });
  assert.equal(upload.status, 201);
  assert.match(upload.data.url, /^\/api\/oneday\/files\/[a-zA-Z0-9-]+$/);
  assert.equal(upload.data.size, bytes.length);
  assert.equal(env.BUCKET.objects.size, 1);
  const fetchFile = await call(env, `/files/${upload.data.id}`);
  assert.equal(fetchFile.status, 200);
  assert.deepEqual(new Uint8Array(await fetchFile.response.arrayBuffer()), bytes);
  assert.match(fetchFile.response.headers.get('content-disposition'), /^inline;/);
  assert.equal(fetchFile.response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(fetchFile.response.headers.get('cache-control'), /private.*no-store/);
  assert.equal((await call(env, `/files/${upload.data.id}`, { user: 'bob' })).status, 404);
  assert.equal((await call(env, `/files/${upload.data.id}`, { user: null })).status, 401);
  const backup = (await call(env, '/backup')).data;
  assert.equal(backup.attachments[0].id, upload.data.id);
  assert.equal((await call(env, '/backup', { user: 'bob' })).data.attachments.length, 0);
});

test('unsafe and disguised uploads are refused; documents download as attachments', async t => {
  const env = setup(t);
  for (const [name, type, bytes] of [
    ['x.html', 'text/html', '<script>alert(1)</script>'], ['x.svg', 'image/svg+xml', '<svg/>'],
    ['x.exe', 'application/octet-stream', 'MZ'], ['fake.png', 'image/png', '<script>x</script>'],
    ['x.txt', 'application/javascript', 'alert(1)'],
  ]) {
    const form = new FormData(); form.set('file', new File([bytes], name, { type }));
    assert.equal((await call(env, '/files', { method: 'POST', body: form })).status, 400, name);
  }
  const form = new FormData(); form.set('file', new File(['%PDF-1.4\ncontent'], '../report.pdf', { type: 'application/pdf' }));
  const upload = await call(env, '/files', { method: 'POST', body: form });
  assert.equal(upload.status, 201);
  const result = await call(env, `/files/${upload.data.id}`);
  assert.match(result.response.headers.get('content-disposition'), /^attachment;/);
  assert.equal(await result.response.text(), '%PDF-1.4\ncontent');
  assert.equal(upload.data.name.includes('/'), false);
});

test('attachment metadata pagination is complete and scoped without reading R2 bytes', async t => {
  const env = setup(t);
  const uploaded = [];
  for (let i = 0; i < 3; i++) {
    const form = new FormData(); form.set('file', new File([`note ${i}`], `note-${i}.txt`, { type: 'text/plain' }));
    uploaded.push((await call(env, '/files', { method: 'POST', body: form })).data.id);
  }
  env.BUCKET.get = () => { throw new Error('metadata listing must never fetch bytes'); };
  const first = await call(env, '/files?limit=2');
  assert.equal(first.status, 200);
  assert.equal(first.data.hasMore, true);
  const next = await call(env, `/files?limit=2&cursor=${first.data.nextCursor}`);
  assert.equal(next.data.hasMore, false);
  assert.deepEqual([...first.data.results, ...next.data.results].map(file => file.id).sort(), uploaded.sort());
  for (const file of first.data.results) assert.deepEqual(Object.keys(file).sort(), ['id', 'name', 'size', 'type', 'url']);
  assert.deepEqual((await call(env, '/files?limit=2', { user: 'bob' })).data.results, []);
  assert.equal((await call(env, '/files?limit=201')).status, 400);
  assert.equal((await call(env, '/files?cursor=invalid')).status, 400);
});

test('records and revision survive closing and reopening the SQLite database', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'oneday-persistence-'));
  const filename = join(directory, 'data.sqlite');
  let DB = new SQLiteD1(filename);
  try {
    await create({ DB }, 'notes', 'persistent', { '便签内容': { text: '跨设备读取' } });
    DB.close(); DB = new SQLiteD1(filename, false);
    const env = { DB };
    assert.equal((await call(env, '/records/notes/persistent')).data.record['便签内容'], '跨设备读取');
    assert.equal((await call(env, '/revision')).data.revision, '1');
  } finally { DB.close(); await rm(directory, { recursive: true, force: true }); }
});

test('generated deployment migrations create the same required columns as the SQLite harness', async t => {
  const directory = new URL('../../drizzle/', import.meta.url);
  const migrations = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
  if (!migrations.length) return t.skip('Root will generate deployment migrations after schema implementation.');
  const deployed = new DatabaseSync(':memory:');
  const expected = new DatabaseSync(':memory:');
  try {
    expected.exec(bootstrap);
    for (const migration of migrations) deployed.exec(await readFile(new URL(migration, directory), 'utf8'));
    for (const table of ['oneday_records', 'oneday_receipts', 'oneday_revisions', 'oneday_files']) {
      const columns = db => db.prepare(`PRAGMA table_info(${table})`).all().map(({ name, type, notnull, pk }) => ({ name, type, notnull, pk }));
      assert.deepEqual(columns(deployed), columns(expected), table);
    }
  } finally { deployed.close(); expected.close(); }
});
