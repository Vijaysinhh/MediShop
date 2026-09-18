import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const targetPhone = process.env.DEMO_TARGET_PHONE || "8605094584";

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

function getSupabaseClient() {
  const envValues = resolveEnv();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || envValues.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    envValues.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    envValues.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase URL or anon key. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function main() {
  const supabase = getSupabaseClient();
  console.log(`\n=== VERIFYING SEEDED DATA FOR PHONE: ${targetPhone} ===\n`);

  // Step 1: Check if shop exists
  console.log("1. Checking if shop exists...");
  const { data: shops, error: shopsError } = await supabase
    .from("shops")
    .select("*")
    .eq("phone_number", targetPhone);

  if (shopsError) {
    console.error("❌ Error querying shops:", shopsError);
    return;
  }

  if (!shops || shops.length === 0) {
    console.error("❌ No shop found with phone:", targetPhone);
    return;
  }

  const shop = shops[0];
  console.log("✅ Shop found:", {
    id: shop.id,
    name: shop.shop_name,
    phone: shop.phone_number,
    created_at: shop.created_at,
  });

  // Step 2: Check owner user
  console.log("\n2. Checking if owner user exists...");
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("*")
    .eq("shop_id", shop.id)
    .eq("role", "owner");

  if (usersError) {
    console.error("❌ Error querying users:", usersError);
    return;
  }

  if (!users || users.length === 0) {
    console.error("❌ No owner user found for shop", shop.id);
    return;
  }

  const owner = users[0];
  console.log("✅ Owner user found:", {
    id: owner.id,
    username: owner.username,
    shop_id: owner.shop_id,
    created_at: owner.created_at,
  });

  // Step 3: Count items
  console.log("\n3. Checking items...");
  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select("*")
    .eq("shop_id", shop.id);

  if (itemsError) {
    console.error("❌ Error querying items:", itemsError);
    return;
  }

  console.log(`✅ Found ${items?.length || 0} items:`);
  items?.slice(0, 5).forEach((item) => {
    console.log(`   - ${item.name} (qty: ${item.quantity})`);
  });
  if ((items?.length || 0) > 5) {
    console.log(`   ... and ${(items?.length || 0) - 5} more`);
  }

  // Step 4: Count sales
  console.log("\n4. Checking sales...");
  const { data: sales, error: salesError } = await supabase
    .from("sales")
    .select("*")
    .eq("shop_id", shop.id);

  if (salesError) {
    console.error("❌ Error querying sales:", salesError);
    return;
  }

  console.log(`✅ Found ${sales?.length || 0} sales`);

  // Step 5: Count categories
  console.log("\n5. Checking categories...");
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("*")
    .eq("shop_id", shop.id);

  if (categoriesError) {
    console.error("❌ Error querying categories:", categoriesError);
    return;
  }

  console.log(`✅ Found ${categories?.length || 0} categories`);
  categories?.forEach((cat) => {
    console.log(`   - ${cat.name}`);
  });

  // Step 6: Count units
  console.log("\n6. Checking units...");
  const { data: units, error: unitsError } = await supabase
    .from("units")
    .select("*")
    .eq("shop_id", shop.id);

  if (unitsError) {
    console.error("❌ Error querying units:", unitsError);
    return;
  }

  console.log(`✅ Found ${units?.length || 0} units`);
  units?.forEach((unit) => {
    console.log(`   - ${unit.name} (${unit.short_form})`);
  });

  console.log("\n=== ALL DATA VERIFIED SUCCESSFULLY ===");
  console.log("\nLogin credentials:");
  console.log(`  Phone: ${targetPhone}`);
  console.log(`  Password: ${process.env.DEMO_TARGET_PASSWORD || "pratap123"}`);
  console.log("\nIf data is verified but not showing in the app:");
  console.log("  1. Clear browser cache (Ctrl+Shift+Delete)");
  console.log("  2. Check browser console for errors (F12)");
  console.log("  3. Verify currentShopId is being set in auth context");
}

main().catch((error) => {
  console.error("\nVerification failed:", error);
  process.exit(1);
});
