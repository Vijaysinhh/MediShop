# Clean MediShop schema

`medishop-clean-schema.sql` is the replacement target for the copied Dukan schema. It is intentionally separate from the existing development setup so no current data is deleted while the application is being migrated.

It contains pharmacy-only tables, Supabase Auth profiles, shop memberships, strict Row Level Security, pharmacy stock batches, purchases, sales, supplier/customer ledgers, returns, refills, cash reconciliation, and safe audit records.

It deliberately does not contain:

- Dukan tables such as `items`, `users`, `categories`, or `units`
- plaintext password columns or default accounts
- grocery starter catalogues or Marathi application fields
- permissive `USING (true)` policies
- destructive `DROP` statements

Before applying it, create a new empty Supabase development project. Apply the SQL, sign up the initial account with Supabase Auth, and then insert that account's UUID into `platform_admins` using the bootstrap statement at the end of the schema. Do not use this schema on the current Dukan-backed project.

The next implementation phase is to migrate the application from custom Dukan authentication and integer IDs to Supabase Auth, membership roles, and UUID shop-scoped records.
