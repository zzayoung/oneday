/** OneDay Sites: authenticated, owner-scoped D1 records and private R2 bytes. */
const TABLES = ['tasks', 'logs', 'notes', 'tags', 'links', 'sets', 'cal'];
const STATUSES = ['收集（未开始）', '进行中', '暂停', '完成', '结束（未完成）'];
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const RECORD_META = new Set(['_id', '_version', 'id', 'record_id']);
const WRAPPERS = new Set(['text', 'select', 'date', 'number', 'checkbox']);
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_RECORD_BYTES = 512 * 1024;
const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const encoder = new TextEncoder();

class ApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message); this.status = status; this.code = code; this.details = details;
  }
}
const fail = (status, code, message, details) => { throw new ApiError(status, code, message, details); };
const invalid = message => fail(400, 'BAD_REQUEST', message);
const conflict = (message = '其他设备已修改这条记录。未覆盖您的内容，请保留草稿并重新读取后再试。', details) => fail(409, 'CONFLICT', message, details);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const terminal = status => status === '完成' || status === '结束（未完成）';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: {
    'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff', 'pragma': 'no-cache',
  } });
}

function identity(request) {
  const owner = request.headers.get('oai-authenticated-user-id');
  if (!owner || owner.length > 1024 || /[\x00-\x1f\x7f]/.test(owner)) fail(401, 'UNAUTHENTICATED', '请先通过 ChatGPT 登录，再读取或保存 OneDay 数据。');
  return owner;
}

function protectMutation(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if ((origin && origin !== new URL(request.url).origin) || (site && !['same-origin', 'none'].includes(site))) {
    fail(403, 'CROSS_ORIGIN', '已拒绝来自其他网站的写入请求，请在 OneDay 页面内操作。');
  }
}

function identifier(value, label = '记录 ID') {
  if (typeof value !== 'string' || !value.trim() || value.length > 256 || /[\x00-\x1f\x7f]/.test(value)) invalid(`${label}无效。`);
  return value;
}
function expectedVersion(value) {
  if (!Number.isSafeInteger(value) || value < 1) invalid('缺少有效记录版本，请重新读取后再保存。');
  return value;
}
function tableName(value) {
  if (!TABLES.includes(value)) invalid('未知数据表。');
  return value;
}
function fieldName(key, top = false) {
  if (!key || key.length > 160 || /[\x00-\x1f\x7f]/.test(key) || BAD_KEYS.has(key) || (top && RECORD_META.has(key))) invalid('记录中包含不安全或保留的字段名称。');
}

function clean(value, depth = 0, budget = { entries: 0 }) {
  if (depth > 14 || ++budget.entries > 100000) invalid('记录结构过于复杂。');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (encoder.encode(value).byteLength > MAX_RECORD_BYTES) invalid('单个字段内容超过 512 KiB。');
    return value;
  }
  if (typeof value === 'number') { if (!Number.isFinite(value)) invalid('数字字段必须是有限数值。'); return value; }
  if (Array.isArray(value)) {
    if (value.length > 10000) invalid('数组字段内容过多。');
    return value.map(item => clean(item, depth + 1, budget));
  }
  if (!isObject(value)) invalid('字段值必须是有效 JSON。');
  const result = Object.create(null);
  for (const key of Object.keys(value).sort()) { fieldName(key); result[key] = clean(value[key], depth + 1, budget); }
  return result;
}
function canonical(value) { return JSON.stringify(clean(value)); }
function payloadString(value) {
  const serialized = canonical(value);
  if (encoder.encode(serialized).byteLength > MAX_RECORD_BYTES) invalid('单条记录超过 512 KiB，请缩短文字或使用附件。');
  return serialized;
}
function properties(value) {
  if (!isObject(value) || Object.keys(value).length > 500) invalid('properties 必须是字段对象，且不超过 500 个字段。');
  const result = Object.create(null);
  for (const [key, wrapped] of Object.entries(value)) {
    fieldName(key, true);
    if (!isObject(wrapped) || Object.keys(wrapped).length !== 1) invalid(`字段「${key}」必须使用单一类型包装。`);
    const type = Object.keys(wrapped)[0];
    if (!WRAPPERS.has(type)) invalid(`字段「${key}」类型无效。`);
    const item = wrapped[type];
    if (item !== null && ((['text', 'select', 'date'].includes(type) && typeof item !== 'string') ||
        (type === 'number' && (typeof item !== 'number' || !Number.isFinite(item))) ||
        (type === 'checkbox' && typeof item !== 'boolean'))) invalid(`字段「${key}」的值与类型不符。`);
    result[key] = clean(item);
  }
  payloadString(result);
  return result;
}

async function readLimited(request, max) {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > max)) fail(413, 'PAYLOAD_TOO_LARGE', '请求内容过大，请缩小后重试。');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) { await reader.cancel(); fail(413, 'PAYLOAD_TOO_LARGE', '请求内容过大，请缩小后重试。'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
async function readJson(request) {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) invalid('请使用 JSON 请求格式。');
  const bytes = await readLimited(request, MAX_JSON_BYTES);
  let body;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { invalid('JSON 内容无效。'); }
  if (!isObject(body)) invalid('请求内容必须是对象。');
  for (const key of Object.keys(body)) fieldName(key);
  return body;
}
async function hash(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(typeof value === 'string' ? value : canonical(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

const rowSelect = 'SELECT record_id, payload, version, deleted FROM oneday_records WHERE owner_id = ? AND table_name = ? AND record_id = ?';
async function readRow(DB, owner, table, id, includeDeleted = false) {
  return DB.prepare(`${rowSelect}${includeDeleted ? '' : ' AND deleted = 0'}`).bind(owner, table, id).first();
}
function record(row) {
  return { _id: row.record_id, _version: Number(row.version), ...JSON.parse(row.payload) };
}
function rowRequired(row) { if (!row || row.deleted) fail(404, 'NOT_FOUND', '记录不存在，或您无权访问。'); return row; }

async function priorReceipt(DB, owner, requestId, requestHash) {
  const row = await DB.prepare('SELECT request_hash, response FROM oneday_receipts WHERE owner_id = ? AND request_id = ?').bind(owner, requestId).first();
  if (!row) return null;
  if (row.request_hash !== requestHash) conflict('此请求编号已用于不同的内容。请重新读取后再提交。');
  return JSON.parse(row.response);
}
const receiptGate = 'EXISTS (SELECT 1 FROM oneday_receipts WHERE owner_id = ? AND request_id = ? AND execution_id = ?)';
const liveGuard = 'EXISTS (SELECT 1 FROM oneday_records WHERE owner_id = ? AND table_name = ? AND record_id = ? AND deleted = 0 AND version = ?)';

/**
 * D1 batch() is one SQL transaction. The receipt is inserted only if every
 * precondition still holds. Every write uses its unique execution token; a
 * retry that finds a prior receipt cannot perform any second mutation.
 */
async function transaction(DB, { owner, requestId, requestHash, operation, response, responseSQL, responseParams = [], guard, guardParams = [], writes, changed = true }) {
  const executionId = crypto.randomUUID();
  const gateParams = [owner, requestId, executionId];
  const now = new Date().toISOString();
  const insert = DB.prepare(`INSERT INTO oneday_receipts
    (owner_id, request_id, operation, request_hash, response, execution_id, created_at)
    SELECT ?, ?, ?, ?, ${responseSQL || '?'}, ?, ?
    WHERE (${guard}) AND NOT EXISTS (SELECT 1 FROM oneday_receipts WHERE owner_id = ? AND request_id = ?)`)
    .bind(owner, requestId, operation, requestHash, ...(responseSQL ? responseParams : [JSON.stringify(response)]), executionId, now,
      ...guardParams, owner, requestId);
  const statements = [insert, ...writes(receiptGate, gateParams)];
  if (changed) {
    const extra = changed === 'import' ? " AND CAST(json_extract(response, '$.imported') AS INTEGER) > 0" : '';
    const gate = extra ? `EXISTS (SELECT 1 FROM oneday_receipts WHERE owner_id = ? AND request_id = ? AND execution_id = ?${extra})` : receiptGate;
    statements.push(DB.prepare(`INSERT INTO oneday_revisions (owner_id, revision) SELECT ?, 1 WHERE ${gate}
      ON CONFLICT(owner_id) DO UPDATE SET revision = oneday_revisions.revision + 1`).bind(owner, ...gateParams));
  }
  await DB.batch(statements);
  const receipt = await priorReceipt(DB, owner, requestId, requestHash);
  if (!receipt) conflict();
  return receipt;
}

function encodeCursor(table, id) {
  const bytes = encoder.encode(JSON.stringify({ table, id }));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function decodeCursor(value, table) {
  if (!value || value.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(value)) invalid('分页游标无效，请重新读取。');
  try {
    const text = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
    const cursor = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(text, char => char.charCodeAt(0))));
    if (cursor.table !== table) invalid('分页游标与数据表不匹配。');
    return identifier(cursor.id);
  } catch (error) { if (error instanceof ApiError) throw error; invalid('分页游标无效，请重新读取。'); }
}

async function listRecords(DB, owner, table, url) {
  const rawLimit = url.searchParams.get('limit') || '200';
  if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 200) invalid('每页记录数必须为 1 至 200。');
  const limit = Number(rawLimit), cursor = url.searchParams.get('cursor');
  const after = cursor ? decodeCursor(cursor, table) : '';
  const result = await DB.prepare(`WITH page AS (
    SELECT record_id, payload, version FROM oneday_records WHERE owner_id = ? AND table_name = ? AND deleted = 0 AND record_id > ? ORDER BY record_id LIMIT ?
  ), sized AS (
    SELECT *, SUM(length(CAST(payload AS BLOB))) OVER (ORDER BY record_id ROWS UNBOUNDED PRECEDING) AS cumulative_bytes FROM page
  ) SELECT record_id, payload, version, (SELECT COUNT(*) FROM page) AS candidate_count
    FROM sized WHERE cumulative_bytes <= ? ORDER BY record_id`)
    .bind(owner, table, after, limit + 1, MAX_PAGE_BYTES).all();
  const hasMore = Number(result.results[0]?.candidate_count ?? 0) > Math.min(limit, result.results.length);
  const rows = result.results.slice(0, limit);
  return json({ results: rows.map(record), hasMore, nextCursor: hasMore ? encodeCursor(table, rows.at(-1).record_id) : null });
}

async function createRecord(request, DB, owner, table) {
  const body = await readJson(request), id = identifier(body.recordId), requestId = identifier(body.requestId, '请求编号');
  const fields = properties(body.properties), serialized = payloadString(fields);
  const requestHash = await hash({ operation: 'create', table, id, fields });
  const prior = await priorReceipt(DB, owner, requestId, requestHash);
  if (prior) return json(prior, 201);
  const now = new Date().toISOString(), result = { record: { _id: id, _version: 1, ...fields } };
  const response = await transaction(DB, {
    owner, requestId, requestHash, operation: `create:${table}`, response: result,
    guard: 'NOT EXISTS (SELECT 1 FROM oneday_records WHERE owner_id = ? AND table_name = ? AND record_id = ?)', guardParams: [owner, table, id],
    writes: (gate, params) => [DB.prepare(`INSERT INTO oneday_records (owner_id, table_name, record_id, payload, version, deleted, created_at, updated_at)
      SELECT ?, ?, ?, ?, 1, 0, ?, ? WHERE ${gate}`).bind(owner, table, id, serialized, now, now, ...params)],
  });
  return json(response, 201);
}

async function patchRecord(request, DB, owner, table, id) {
  const body = await readJson(request), version = expectedVersion(body.expectedVersion), requestId = identifier(body.requestId, '请求编号');
  const fields = properties(body.properties);
  const requestHash = await hash({ operation: 'patch', table, id, version, fields });
  const prior = await priorReceipt(DB, owner, requestId, requestHash);
  if (prior) return json(prior);
  const row = rowRequired(await readRow(DB, owner, table, id));
  if (Number(row.version) !== version) conflict();
  const current = record(row);
  if (table === 'tasks' && current['回收站'] && fields['回收站'] !== false) conflict('任务已在回收站，请先恢复后再修改。');
  const next = { ...JSON.parse(row.payload), ...fields }, serialized = payloadString(next), now = new Date().toISOString();
  return json(await transaction(DB, {
    owner, requestId, requestHash, operation: `patch:${table}`, response: { record: { _id: id, _version: version + 1, ...next } },
    guard: liveGuard, guardParams: [owner, table, id, version],
    writes: (gate, params) => [DB.prepare(`UPDATE oneday_records SET payload = ?, version = version + 1, updated_at = ?
      WHERE owner_id = ? AND table_name = ? AND record_id = ? AND ${gate}`).bind(serialized, now, owner, table, id, ...params)],
  }));
}

async function deleteRecord(request, DB, owner, table, id) {
  const body = await readJson(request), version = expectedVersion(body.expectedVersion), requestId = identifier(body.requestId, '请求编号');
  const requestHash = await hash({ operation: 'delete', table, id, version });
  const prior = await priorReceipt(DB, owner, requestId, requestHash);
  if (prior) return json(prior);
  const row = rowRequired(await readRow(DB, owner, table, id));
  if (Number(row.version) !== version) conflict();
  return json(await transaction(DB, {
    owner, requestId, requestHash, operation: `delete:${table}`, response: { ok: true }, guard: liveGuard, guardParams: [owner, table, id, version],
    writes: (gate, params) => [DB.prepare(`UPDATE oneday_records SET deleted = 1, version = version + 1, updated_at = ?
      WHERE owner_id = ? AND table_name = ? AND record_id = ? AND ${gate}`).bind(new Date().toISOString(), owner, table, id, ...params)],
  }));
}

async function changeStatus(request, DB, owner, id) {
  const body = await readJson(request), version = expectedVersion(body.expectedVersion), requestId = identifier(body.requestId, '请求编号');
  const nextStatus = body.status;
  if (!STATUSES.includes(nextStatus)) invalid('未知任务状态。');
  const requestHash = await hash({ operation: 'status', id, version, nextStatus, ...(body.endedAt !== undefined ? { endedAt: body.endedAt } : {}) });
  const prior = await priorReceipt(DB, owner, requestId, requestHash);
  if (prior) return json(prior);
  const row = rowRequired(await readRow(DB, owner, 'tasks', id));
  if (Number(row.version) !== version) conflict('其他设备已修改任务，请重新读取后再切换状态。');
  const task = record(row), currentStatus = task['任务状态'] || STATUSES[0];
  if (task['回收站']) conflict('任务已在回收站，请先恢复。');
  const auditNow = new Date().toISOString(), start = Date.parse(task['状态开始时间']);
  let now = auditNow;
  if (body.endedAt !== undefined) {
    if (currentStatus !== '进行中' || !['暂停', '完成'].includes(nextStatus)) invalid('修正结束时间仅用于暂停或完成当前正在执行的任务。');
    if (typeof body.endedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(body.endedAt)) invalid('请选择有效的实际结束时间。');
    const chosenEnd = Date.parse(body.endedAt);
    if (!Number.isFinite(chosenEnd) || !Number.isFinite(start) || chosenEnd <= start) invalid('实际结束时间必须晚于本次开始时间。');
    if (chosenEnd > Date.parse(auditNow) + 60000) invalid('实际结束时间不能在未来。');
    now = new Date(chosenEnd).toISOString();
  }
  if (currentStatus === nextStatus) return json(await transaction(DB, {
    owner, requestId, requestHash, operation: 'status', response: { task, log: null },
    guard: liveGuard, guardParams: [owner, 'tasks', id, version], writes: () => [], changed: false,
  }));

  const end = Date.parse(now);
  if (Number.isFinite(start) && end < start) invalid('状态开始时间晚于服务器当前时间，请先核对原记录。');
  const next = { ...JSON.parse(row.payload), '任务状态': nextStatus, '状态开始时间': now, '状态结束时间': terminal(nextStatus) ? now : null };
  if (nextStatus === '完成') next['任务进度'] = 100;
  else if (terminal(currentStatus)) next['任务进度'] = 0;
  const nextPayload = payloadString(next);

  let log = null, open = null, logPayload = null;
  if (Number.isFinite(start) && end > start && !terminal(currentStatus)) {
    const candidates = await DB.prepare(`SELECT record_id, payload, version FROM oneday_records
      WHERE owner_id = ? AND table_name = 'logs' AND deleted = 0
      AND json_extract(payload, '$.任务ID') = ? AND json_extract(payload, '$.状态') = ?
      AND (json_extract(payload, '$.结束时间') IS NULL OR json_extract(payload, '$.结束时间') = '')
      ORDER BY record_id LIMIT 1001`).bind(owner, id, currentStatus).all();
    if (candidates.results.length > 1000) conflict('此任务有过多未结束日志，请整理后再切换状态。');
    open = candidates.results.find(candidate => Date.parse(JSON.parse(candidate.payload)['开始时间']) === start) || null;
    const logFields = { ...(open ? JSON.parse(open.payload) : {
      '日志标题': `${task['任务标题'] || ''} · ${currentStatus}`, '任务ID': id,
      '任务标题': task['任务标题'] || '', '任务类型': task['任务类型'] || '主任务',
      '状态': currentStatus, '开始时间': new Date(start).toISOString(),
    }), '结束时间': now, '持续时长': Math.round((end - start) / 3600000 * 10000) / 10000 };
    logPayload = payloadString(logFields);
    log = { _id: open ? open.record_id : crypto.randomUUID(), _version: open ? Number(open.version) + 1 : 1, ...logFields };
  }

  let guard = liveGuard, guardParams = [owner, 'tasks', id, version];
  if (open) { guard += ` AND ${liveGuard}`; guardParams.push(owner, 'logs', open.record_id, Number(open.version)); }
  else if (log) {
    guard += ' AND NOT EXISTS (SELECT 1 FROM oneday_records WHERE owner_id = ? AND table_name = ? AND record_id = ?)';
    guardParams.push(owner, 'logs', log._id);
  }
  return json(await transaction(DB, {
    owner, requestId, requestHash, operation: 'status', response: { task: { _id: id, _version: version + 1, ...next }, log }, guard, guardParams,
    writes: (gate, params) => {
      const statements = [DB.prepare(`UPDATE oneday_records SET payload = ?, version = version + 1, updated_at = ?
        WHERE owner_id = ? AND table_name = 'tasks' AND record_id = ? AND ${gate}`).bind(nextPayload, auditNow, owner, id, ...params)];
      if (open) statements.push(DB.prepare(`UPDATE oneday_records SET payload = ?, version = version + 1, updated_at = ?
        WHERE owner_id = ? AND table_name = 'logs' AND record_id = ? AND ${gate}`).bind(logPayload, auditNow, owner, open.record_id, ...params));
      else if (log) statements.push(DB.prepare(`INSERT INTO oneday_records (owner_id, table_name, record_id, payload, version, deleted, created_at, updated_at)
        SELECT ?, 'logs', ?, ?, 1, 0, ?, ? WHERE ${gate}`).bind(owner, log._id, logPayload, auditNow, auditNow, ...params));
      return statements;
    },
  }));
}

function importRecords(tables) {
  if (!isObject(tables)) invalid('备份必须包含 tables 对象。');
  const rows = [], seen = new Map(); let duplicateSkipped = 0, total = 0;
  for (const [table, records] of Object.entries(tables)) {
    tableName(table);
    if (!Array.isArray(records)) invalid(`数据表 ${table} 必须是数组。`);
    total += records.length;
    if (total > 100) invalid('每次最多导入 100 条记录，请分批导入。');
    for (const source of records) {
      if (!isObject(source)) invalid('导入记录必须是对象。');
      const id = identifier(source._id ?? source.id ?? source.record_id);
      for (const alias of ['_id', 'id', 'record_id']) if (source[alias] !== undefined && String(source[alias]) !== id) invalid('记录的 ID 别名不一致，请核对备份。');
      if (Object.keys(source).length > 504) invalid('单条记录字段过多。');
      const fields = Object.create(null);
      for (const [key, value] of Object.entries(source)) {
        if (RECORD_META.has(key)) continue;
        fieldName(key, true); fields[key] = clean(value);
      }
      const payload = payloadString(fields), key = JSON.stringify([table, id]);
      if (seen.has(key)) {
        if (seen.get(key) !== payload) conflict('同一导入批次包含内容不同的重复 ID，尚未写入任何记录。', { conflicts: [{ table, id }] });
        duplicateSkipped++; continue;
      }
      seen.set(key, payload); rows.push({ table, id, payload });
    }
  }
  return { rows, duplicateSkipped, total };
}

function importGroups(rows) {
  // D1 limits an individual bound string to 2,000,000 bytes. Splitting only the
  // SQL bindings keeps the whole <=100-record import inside one transaction.
  const groups = []; let current = [], bytes = 2;
  for (const row of rows) {
    const value = JSON.stringify(row), size = encoder.encode(value).byteLength + 1;
    if (current.length && bytes + size > 1750000) { groups.push(`[${current.join(',')}]`); current = []; bytes = 2; }
    current.push(value); bytes += size;
  }
  if (current.length || !groups.length) groups.push(`[${current.join(',')}]`);
  return groups;
}
const importConflicts = source => `SELECT r.table_name AS table_name, r.record_id AS record_id FROM (${source}) AS incoming
  JOIN oneday_records AS r ON r.owner_id = ? AND r.table_name = json_extract(incoming.value, '$.table')
  AND r.record_id = json_extract(incoming.value, '$.id')
  WHERE r.deleted != 0 OR r.payload != json_extract(incoming.value, '$.payload')`;
const importNewCount = source => `(SELECT COUNT(*) FROM (${source}) AS incoming WHERE NOT EXISTS
  (SELECT 1 FROM oneday_records AS r WHERE r.owner_id = ? AND r.table_name = json_extract(incoming.value, '$.table')
  AND r.record_id = json_extract(incoming.value, '$.id')))`;

async function importBackup(request, DB, owner) {
  const body = await readJson(request), requestId = identifier(body.requestId, '请求编号');
  const { rows, total } = importRecords(body.tables), groups = importGroups(rows);
  const source = groups.map(() => 'SELECT value FROM json_each(?)').join(' UNION ALL ');
  const conflictSQL = importConflicts(source), countSQL = importNewCount(source);
  const requestHash = await hash({ operation: 'import', rows, total });
  const prior = await priorReceipt(DB, owner, requestId, requestHash);
  if (prior) return json(prior);
  const findConflicts = async () => (await DB.prepare(conflictSQL).bind(...groups, owner).all()).results.map(row => ({ table: row.table_name, id: row.record_id }));
  const conflicts = await findConflicts();
  if (conflicts.length) conflict('已有相同 ID 的记录内容不同。本批次未写入，也不会覆盖；请核对备份与云端记录。', { conflicts });
  const now = new Date().toISOString();
  try {
    return json(await transaction(DB, {
      owner, requestId, requestHash, operation: 'import',
      responseSQL: `json_object('imported', ${countSQL}, 'skipped', ? - ${countSQL}, 'conflicts', json('[]'))`,
      responseParams: [...groups, owner, total, ...groups, owner],
      guard: `NOT EXISTS (${conflictSQL})`, guardParams: [...groups, owner], changed: 'import',
      writes: (gate, params) => [DB.prepare(`INSERT INTO oneday_records
        (owner_id, table_name, record_id, payload, version, deleted, created_at, updated_at)
        SELECT ?, json_extract(value, '$.table'), json_extract(value, '$.id'), json_extract(value, '$.payload'), 1, 0, ?, ?
        FROM (${source}) WHERE ${gate} ON CONFLICT(owner_id, table_name, record_id) DO NOTHING`).bind(owner, now, now, ...groups, ...params)],
    }));
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CONFLICT' && !error.details.conflicts) {
      const latest = await findConflicts();
      if (latest.length) conflict('其他设备刚写入了内容不同的相同 ID。本批次未写入，请重新预检。', { conflicts: latest });
    }
    throw error;
  }
}

const FILE_TYPES = {
  png: ['image/png'], jpg: ['image/jpeg'], jpeg: ['image/jpeg'], webp: ['image/webp'], gif: ['image/gif'],
  pdf: ['application/pdf'], doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'], xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ppt: ['application/vnd.ms-powerpoint'], pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  txt: ['text/plain'], csv: ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'],
  md: ['text/markdown', 'text/plain', 'text/x-markdown'], zip: ['application/zip', 'application/x-zip-compressed'],
};
function safeFilename(name, extension) {
  const stem = String(name).normalize('NFC').replace(/[\x00-\x1f\x7f/\\<>:"|?*\u202a-\u202e\u2066-\u2069]/g, '_').replace(/^\.+/, '').trim();
  const base = (stem.slice(0, -(extension.length + 1)) || '附件').slice(0, 160);
  return `${base}.${extension}`;
}
function disposition(name, inline) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(name).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
function starts(bytes, prefix) { return prefix.every((byte, i) => bytes[i] === byte); }
async function validateFile(file) {
  if (!file || typeof file.name !== 'string' || typeof file.stream !== 'function' || !Number.isSafeInteger(file.size)) invalid('请选择一个文件。');
  if (file.size > MAX_FILE_BYTES) fail(413, 'PAYLOAD_TOO_LARGE', '单个附件最大为 20 MiB。');
  const extension = file.name.split('.').at(-1).toLowerCase();
  if (!Object.hasOwn(FILE_TYPES, extension) || !file.name.includes('.')) invalid('不支持此文件类型。可上传 PNG/JPEG/WebP/GIF 图片及 PDF、Office、文本或 ZIP 文档。');
  const declared = String(file.type || '').split(';')[0].trim().toLowerCase();
  if (declared && declared !== 'application/octet-stream' && !FILE_TYPES[extension].includes(declared)) invalid('文件类型与扩展名不一致。');
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = new TextDecoder().decode(bytes);
  const isZip = starts(bytes, [0x50, 0x4b, 0x03, 0x04]) || starts(bytes, [0x50, 0x4b, 0x05, 0x06]) || starts(bytes, [0x50, 0x4b, 0x07, 0x08]);
  const checks = {
    png: starts(bytes, [137, 80, 78, 71, 13, 10, 26, 10]), jpg: starts(bytes, [255, 216, 255]), jpeg: starts(bytes, [255, 216, 255]),
    gif: ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a'), webp: ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP',
    pdf: ascii.startsWith('%PDF-'), doc: starts(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    xls: starts(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), ppt: starts(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    docx: isZip, xlsx: isZip, pptx: isZip, zip: isZip,
  };
  if (Object.hasOwn(checks, extension) && !checks[extension]) invalid('文件内容与声明的类型不符，请选择原始文件。');
  if (['txt', 'csv', 'md'].includes(extension) && (bytes.includes(0) || ascii.startsWith('MZ') || starts(bytes, [0x7f, 0x45, 0x4c, 0x46]))) invalid('文本附件不能包含可执行文件或二进制内容。');
  return { name: safeFilename(file.name, extension), type: FILE_TYPES[extension][0] };
}

async function uploadFile(request, env, owner) {
  if (!env.BUCKET) fail(503, 'STORAGE_UNAVAILABLE', '附件存储尚未连接，请稍后重试。');
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) invalid('附件必须使用 multipart/form-data 上传。');
  const bytes = await readLimited(request, MAX_FILE_BYTES + 64 * 1024);
  let form;
  try { form = await new Response(bytes, { headers: { 'content-type': contentType } }).formData(); } catch { invalid('附件上传格式无效。'); }
  if (form.getAll('file').length !== 1) invalid('每次请选择一个附件。');
  const file = form.get('file'), { name, type } = await validateFile(file);
  let association = null;
  if (form.has('owner')) {
    const raw = form.get('owner');
    if (typeof raw !== 'string' || raw.length > 2048) invalid('附件关联信息无效。');
    try { association = canonical(JSON.parse(raw)); } catch (error) { if (error instanceof ApiError) throw error; invalid('附件关联信息必须是 JSON。'); }
  }
  const id = crypto.randomUUID(), objectKey = `oneday/${await hash(owner)}/${id}`, now = new Date().toISOString();
  await env.BUCKET.put(objectKey, file.stream(), { httpMetadata: { contentType: type }, customMetadata: { filename: encodeURIComponent(name) } });
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO oneday_files (owner_id, file_id, object_key, name, size, type, association, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(owner, id, objectKey, name, file.size, type, association, now),
      env.DB.prepare('INSERT INTO oneday_revisions (owner_id, revision) VALUES (?, 1) ON CONFLICT(owner_id) DO UPDATE SET revision = oneday_revisions.revision + 1').bind(owner),
    ]);
  } catch (error) {
    try { await env.BUCKET.delete(objectKey); } catch { /* Unreferenced bytes remain inaccessible; never return a false success. */ }
    throw error;
  }
  return json({ url: `/api/oneday/files/${id}`, name, id, size: file.size, type }, 201);
}

async function getFile(env, owner, id) {
  const file = await env.DB.prepare('SELECT object_key, name, size, type FROM oneday_files WHERE owner_id = ? AND file_id = ?').bind(owner, id).first();
  if (!file) fail(404, 'NOT_FOUND', '附件不存在，或您无权访问。');
  if (!env.BUCKET) fail(503, 'STORAGE_UNAVAILABLE', '附件存储尚未连接，请稍后重试。');
  const object = await env.BUCKET.get(file.object_key);
  if (!object) fail(404, 'FILE_UNAVAILABLE', '附件字节暂不可用，请保留原始文件并稍后重试。');
  return new Response(object.body, { headers: {
    'content-type': file.type, 'content-length': String(file.size),
    'content-disposition': disposition(file.name, ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)),
    'cache-control': 'private, no-store', 'pragma': 'no-cache', 'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; sandbox", 'cross-origin-resource-policy': 'same-origin',
  } });
}

async function listFiles(DB, owner, url) {
  const rawLimit = url.searchParams.get('limit') || '200';
  if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 200) invalid('每页附件数必须为 1 至 200。');
  const limit = Number(rawLimit), cursor = url.searchParams.get('cursor');
  const after = cursor ? decodeCursor(cursor, 'files') : '';
  const result = await DB.prepare('SELECT file_id, name, size, type FROM oneday_files WHERE owner_id = ? AND file_id > ? ORDER BY file_id LIMIT ?')
    .bind(owner, after, limit + 1).all();
  const hasMore = result.results.length > limit, rows = result.results.slice(0, limit);
  return json({ results: rows.map(file => ({ id: file.file_id, name: file.name, size: Number(file.size), type: file.type,
    url: `/api/oneday/files/${encodeURIComponent(file.file_id)}` })), hasMore,
    nextCursor: hasMore ? encodeCursor('files', rows.at(-1).file_id) : null });
}

async function backup(DB, owner) {
  const size = await DB.prepare('SELECT COALESCE(SUM(length(CAST(payload AS BLOB))), 0) AS bytes, COUNT(*) AS count FROM oneday_records WHERE owner_id = ? AND deleted = 0').bind(owner).first();
  if (Number(size.bytes) > MAX_BACKUP_BYTES || Number(size.count) > 100000) fail(413, 'BACKUP_TOO_LARGE', '数据超过当前单次备份上限（20 MiB 文字记录），请先分批整理附件或记录。未返回截断的备份。');
  // The three reads share a transaction, so exported records, file metadata,
  // and the owner revision describe one committed database snapshot.
  const [rows, files, revision] = await DB.batch([
    DB.prepare('SELECT table_name, record_id, payload, version FROM oneday_records WHERE owner_id = ? AND deleted = 0 ORDER BY table_name, record_id').bind(owner),
    DB.prepare('SELECT file_id, name, size, type FROM oneday_files WHERE owner_id = ? ORDER BY file_id').bind(owner),
    DB.prepare('SELECT revision FROM oneday_revisions WHERE owner_id = ?').bind(owner),
  ]);
  const tables = Object.fromEntries(TABLES.map(table => [table, []]));
  for (const row of rows.results) if (Object.hasOwn(tables, row.table_name)) tables[row.table_name].push(record(row));
  return json({ app: 'OneDay', edition: 'Sites', version: '1.9.0', exportedAt: new Date().toISOString(),
    revision: String(revision.results[0]?.revision ?? 0), tables,
    attachments: files.results.map(file => ({ id: file.file_id, name: file.name, size: Number(file.size), type: file.type, url: `/api/oneday/files/${encodeURIComponent(file.file_id)}` })),
    attachmentBytesIncluded: false, attachmentNotice: '此 JSON 包含附件清单与受保护地址；附件原始字节需另行下载保存。',
  });
}

export async function handleOneDay(request, env) {
  try {
    const url = new URL(request.url);
    // Operational health only: private Sites still enforces its platform
    // access boundary. This exposes no visitor identity or personal data.
    if (request.method === 'GET' && url.pathname === '/api/oneday/health') {
      if (!env?.DB || !env?.BUCKET) fail(503, 'STORAGE_UNAVAILABLE', '云端存储尚未连接。');
      const schema = await env.DB.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('oneday_records', 'oneday_receipts', 'oneday_revisions', 'oneday_files')").first();
      if (Number(schema?.count) !== 4) fail(503, 'SCHEMA_UNAVAILABLE', '云端数据库结构尚未就绪。');
      await env.BUCKET.list({ limit: 1 });
      return json({ ok: true, database: true, files: true, version: '1.9.0' });
    }
    const owner = identity(request);
    protectMutation(request);
    if (!url.pathname.startsWith('/api/oneday/')) fail(404, 'NOT_FOUND', '接口不存在。');
    let path;
    try { path = url.pathname.slice('/api/oneday/'.length).split('/').filter(Boolean).map(decodeURIComponent); } catch { invalid('请求路径无效。'); }
    const method = request.method;
    if (path.length === 1 && path[0] === 'session' && method === 'GET') {
      let fullName = request.headers.get('oai-authenticated-user-full-name') || '';
      if (request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
        try { fullName = decodeURIComponent(fullName); } catch { fullName = ''; }
      }
      return json({ userId: owner, displayName: (fullName || request.headers.get('oai-authenticated-user-email') || 'OneDay 用户').slice(0, 160) });
    }
    if (!env?.DB) fail(503, 'STORAGE_UNAVAILABLE', '云端数据库尚未连接，未执行保存，请稍后重试。');
    const DB = env.DB;
    if (path.length === 1 && path[0] === 'revision' && method === 'GET') {
      const row = await DB.prepare('SELECT revision FROM oneday_revisions WHERE owner_id = ?').bind(owner).first();
      return json({ revision: String(row?.revision ?? 0) });
    }
    if (path[0] === 'records' && [2, 3].includes(path.length)) {
      const table = tableName(path[1]);
      if (path.length === 2 && method === 'GET') return await listRecords(DB, owner, table, url);
      if (path.length === 2 && method === 'POST') return await createRecord(request, DB, owner, table);
      if (path.length === 3) {
        const id = identifier(path[2]);
        if (method === 'GET') return json({ record: record(rowRequired(await readRow(DB, owner, table, id))) });
        if (method === 'PATCH') return await patchRecord(request, DB, owner, table, id);
        if (method === 'DELETE') return await deleteRecord(request, DB, owner, table, id);
      }
      fail(405, 'METHOD_NOT_ALLOWED', '此接口不支持该请求方法。');
    }
    if (path.length === 3 && path[0] === 'tasks' && path[2] === 'status' && method === 'POST') return await changeStatus(request, DB, owner, identifier(path[1]));
    if (path.length === 1 && path[0] === 'files' && method === 'GET') return await listFiles(DB, owner, url);
    if (path.length === 1 && path[0] === 'files' && method === 'POST') return await uploadFile(request, env, owner);
    if (path.length === 2 && path[0] === 'files' && method === 'GET') return await getFile(env, owner, identifier(path[1], '附件 ID'));
    if (path.length === 1 && path[0] === 'backup' && method === 'GET') return await backup(DB, owner);
    if (path.length === 1 && path[0] === 'import' && method === 'POST') return await importBackup(request, DB, owner);
    fail(404, 'NOT_FOUND', '接口不存在。');
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message, message: error.message, code: error.code, ...error.details }, error.status);
    console.error('OneDay storage request failed:', error?.name || 'Error');
    return json({ error: '云端操作未完成，请保留草稿后重试。', message: '云端操作未完成，请保留草稿后重试。', code: 'STORAGE_ERROR' }, 503);
  }
}
