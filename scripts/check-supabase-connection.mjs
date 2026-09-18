import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      }),
  );
}

const env = {
  ...loadEnvFile(".env.development.local"),
  ...loadEnvFile(".env.local"),
  ...process.env,
};

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("FAIL configuration: missing Supabase URL or anon key");
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tables = [
  "shops",
  "users",
  "categories",
  "units",
  "items",
  "price_tiers",
  "sales",
  "sale_items",
  "stock_history",
  "batches",
  "alerts",
  "credit_customers",
  "credit_entries",
  "app_settings",
  "subscriptions",
  "shop_payment_info",
  "audit_logs",
  "user_roles",
  "system_health_checks",
];

let failed = 0;

for (const table of tables) {
  const startedAt = performance.now();
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  const duration = Math.round(performance.now() - startedAt);

  if (error) {
    failed += 1;
    console.error(`FAIL ${table}: ${error.message}`);
  } else {
    console.log(`OK   ${table}: ${count ?? 0} rows (${duration} ms)`);
  }
}

if (failed) {
  console.error(`Supabase check failed for ${failed} table(s).`);
  process.exit(1);
}

console.log(`Supabase check passed for all ${tables.length} tables.`);
