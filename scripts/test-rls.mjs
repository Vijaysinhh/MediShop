import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const values = {};
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      values[key] = value;
    }
    return values;
  } catch {
    return {};
  }
}

function resolveEnv() {
  const cwd = process.cwd();
  const candidates = [".env.production.local", ".env.production", ".env.local"];
  const loaded = {};
  for (const candidate of candidates) {
    const filePath = path.join(cwd, candidate);
    Object.assign(loaded, loadEnvFile(filePath));
  }
  return loaded;
}

async function testRLS() {
  const envValues = resolveEnv();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || envValues.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    envValues.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    envValues.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing Supabase credentials");
  }

  // Create two clients: one with anon key (like the app), one with service role
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey || anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("\n=== TESTING RLS POLICIES ===\n");
  console.log("Testing if the PUBLIC (anon) key can read data...\n");

  const shopId = 3;
  const tables = [
    "shops",
    "users",
    "items",
    "categories",
    "units",
    "sales",
    "sale_items",
  ];

  for (const table of tables) {
    try {
      const { data, error } = await anonClient
        .from(table)
        .select("count", { count: "exact" })
        .eq("shop_id", shopId);

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
        if (
          error.message.includes("RLS") ||
          error.message.includes("policy")
        ) {
          console.log(`   → This is an RLS policy issue`);
        }
      } else {
        console.log(`✅ ${table}: Readable (${data?.length || 0} rows)`);
      }
    } catch (e) {
      console.log(`❌ ${table}: ${e.message}`);
    }
  }

  console.log(
    "\nIf tables show ❌ with RLS errors, you need to update the policies."
  );
  console.log("Check: Security → Policies in Supabase dashboard.\n");
}

testRLS().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
