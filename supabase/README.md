# Development database setup

The application is currently pointed at the MediShop **development** Supabase project. Its API reports that the base tables are not present yet, so the app correctly keeps the pharmacy-only fields in compatibility mode until the schema exists.

1. Open the development project's Supabase dashboard, then **SQL Editor**.
2. Open `dev-setup.sql` from this folder, paste the complete file into a new query, and run it once.
3. Create the development super-admin and owner accounts through the app's existing account workflow. This setup script intentionally contains no accounts, passwords, or production data.
4. Reload the app. Pharmacy metadata, receipts, cash reconciliation, returns, audit history, and refill reminders will become available automatically.

`dev-setup.sql` combines the original Dukan schema and every additive migration, including the MediShop pharmacy workflows. It is for development only. Do not run it against production.
