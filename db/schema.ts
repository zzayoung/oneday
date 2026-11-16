import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Schema-only migrations: the Sites edition starts with an empty personal
// database. Legacy table semantics remain in the lossless JSON payload.
export const oneDayRecords = sqliteTable('oneday_records', {
  ownerId: text('owner_id').notNull(),
  tableName: text('table_name').notNull(),
  recordId: text('record_id').notNull(),
  payload: text('payload').notNull(),
  version: integer('version').notNull().default(1),
  deleted: integer('deleted').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, table => [
  primaryKey({ columns: [table.ownerId, table.tableName, table.recordId] }),
  index('oneday_records_list').on(table.ownerId, table.tableName, table.deleted, table.recordId),
]);

// A receipt is inserted under the mutation's complete CAS condition. Every
// subsequent statement in the same D1 batch is gated by its execution ID.
// Retaining receipts and record tombstones makes retries safe after restarts.
export const oneDayReceipts = sqliteTable('oneday_receipts', {
  ownerId: text('owner_id').notNull(),
  requestId: text('request_id').notNull(),
  operation: text('operation').notNull(),
  requestHash: text('request_hash').notNull(),
  response: text('response').notNull(),
  executionId: text('execution_id').notNull(),
  createdAt: text('created_at').notNull(),
}, table => [primaryKey({ columns: [table.ownerId, table.requestId] })]);

export const oneDayRevisions = sqliteTable('oneday_revisions', {
  ownerId: text('owner_id').primaryKey().notNull(),
  revision: integer('revision').notNull().default(0),
});

export const oneDayFiles = sqliteTable('oneday_files', {
  ownerId: text('owner_id').notNull(),
  fileId: text('file_id').notNull(),
  objectKey: text('object_key').notNull(),
  name: text('name').notNull(),
  size: integer('size').notNull(),
  type: text('type').notNull(),
  association: text('association'),
  createdAt: text('created_at').notNull(),
}, table => [primaryKey({ columns: [table.ownerId, table.fileId] })]);
