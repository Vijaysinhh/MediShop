import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const schema = fs
  .readFileSync(new URL('../supabase/medishop-clean-schema.sql', import.meta.url), 'utf8')
  // PGlite ships without the extension package; Supabase PostgreSQL provides it.
  .replace('create extension if not exists pgcrypto;', '');

test('clean MediShop schema installs without legacy Dukan tables or password columns', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (
        id uuid PRIMARY KEY,
        email text,
        phone text,
        raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
      );
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
    `);
    await db.exec(schema);

    const tables = await db.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    assert.ok(tables.rows.some((row) => row.table_name === 'medicines'));
    assert.ok(tables.rows.some((row) => row.table_name === 'medicine_batches'));
    assert.ok(tables.rows.some((row) => row.table_name === 'shop_memberships'));
    assert.ok(!tables.rows.some((row) => row.table_name === 'items'));

    const passwordColumns = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'password'
    `);
    assert.equal(passwordColumns.rows.length, 0);

    const roles = await db.query(`
      SELECT unnest(enum_range(NULL::public.shop_role))::text AS role
    `);
    assert.deepEqual(roles.rows.map((row) => row.role), ['owner', 'manager', 'cashier', 'worker']);
  } finally {
    await db.close();
  }
});
