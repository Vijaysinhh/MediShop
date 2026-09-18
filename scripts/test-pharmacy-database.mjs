import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = fs.readFileSync(new URL('../supabase/migrations/20260917_pharmacy_workflows.sql', import.meta.url), 'utf8');
const base = fs.readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
  .replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/g, '')
  .replace(/INSERT INTO users\s*\(username, password, role\)[\s\S]*?;/g, '');
const partial = fs.readFileSync(new URL('../supabase/migrations/20260910_partial_payments.sql', import.meta.url), 'utf8');

test('pharmacy migration and transactional workflows on PostgreSQL', async (t) => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
    await db.exec(base);
    await db.exec(partial);
    await db.exec(migration);
    await db.exec(migration); // Safe to run twice.
    await db.exec(`
      INSERT INTO shops(id,owner_name,shop_name,phone_number,password) VALUES(1,'Owner','Test Pharmacy','0000000000','test-only'),(2,'Owner 2','Other Pharmacy','1111111111','test-only');
      INSERT INTO users(id,shop_id,username,password,role) VALUES(1,1,'test-owner','test-only','owner'),(2,2,'other-owner','test-only','owner');
      INSERT INTO items(id,shop_id,name,quantity,buy_price,sell_price,supplier_name,batch_number) VALUES(1,1,'Medicine',20,5,10,'Supplier','B1');
      INSERT INTO batches(shop_id,item_id,item_name,batch_number,purchase_date,quantity_received,quantity_available,cost_per_unit,status) VALUES(1,1,'Medicine','B1',now(),20,20,5,'active');
      INSERT INTO sales(shop_id,date,timestamp,subtotal,total_cost,total_profit,payment_method,paid_amount,due_amount,paid_via)
        VALUES(1,'2026-09-17',now(),100,50,50,'cash',100,0,'cash'),(1,'2026-09-17',now(),200,100,100,'card',200,0,'card'),(1,'2026-09-17',now(),100,50,50,'partial',40,60,'cash'),(2,'2026-09-17',now(),500,250,250,'cash',500,0,'cash');
    `);
    await t.test('cash includes partial cash receipts and excludes other shops/online', async () => {
      const {rows} = await db.query("SELECT * FROM reconcile_pharmacy_cash(1,'2026-09-17',139,1)");
      assert.equal(Number(rows[0].expected_amount),140); assert.equal(Number(rows[0].difference),-1);
      await db.query("SELECT * FROM reconcile_pharmacy_cash(1,'2026-09-17',140,1)");
      assert.equal((await db.query('SELECT * FROM cash_reconciliations')).rows.length,1);
      await assert.rejects(db.query("SELECT * FROM reconcile_pharmacy_cash(1,'2026-09-17',-1,1)"));
      await assert.rejects(db.query("SELECT * FROM reconcile_pharmacy_cash(1,'2026-09-17',140,2)"));
    });
    await t.test('return removes stock/batch units once and records pending credit', async () => {
      const query="SELECT * FROM send_pharmacy_return(1,1,4,1,'00000000-0000-0000-0000-000000000001')";
      const {rows}=await db.query(query); assert.equal(rows[0].status,'sent');assert.equal(Number(rows[0].expected_credit),20);
      await db.query(query);
      assert.equal(Number((await db.query('SELECT quantity FROM items WHERE id=1')).rows[0].quantity),16);
      assert.equal(Number((await db.query('SELECT quantity_available FROM batches WHERE item_id=1')).rows[0].quantity_available),16);
      assert.equal((await db.query('SELECT * FROM stock_history')).rows.length,1);
      await db.query('SELECT * FROM credit_pharmacy_return(1,1,18,1)');
      assert.equal(Number((await db.query('SELECT received_credit FROM medicine_returns WHERE id=1')).rows[0].received_credit),18);
      await assert.rejects(db.query('SELECT * FROM credit_pharmacy_return(1,1,18,1)'));
    });
    await t.test('invalid returns roll back without changing inventory', async () => {
      await assert.rejects(db.query("SELECT * FROM send_pharmacy_return(1,1,100,1,'00000000-0000-0000-0000-000000000002')"));
      await assert.rejects(db.query("SELECT * FROM send_pharmacy_return(1,1,-1,1,'00000000-0000-0000-0000-000000000002')"));
      await assert.rejects(db.query("SELECT * FROM send_pharmacy_return(2,1,1,2,'00000000-0000-0000-0000-000000000002')"));
      assert.equal(Number((await db.query('SELECT quantity FROM items WHERE id=1')).rows[0].quantity),16);
    });
    await t.test('audit records never contain account passwords', async () => {
      const {rows}=await db.query("SELECT new_data FROM audit_logs WHERE table_name='users'");
      assert.equal(rows.length,2); assert.ok(rows.every(row=>!JSON.stringify(row).includes('test-only')));
    });
  } finally { await db.close(); }
});
