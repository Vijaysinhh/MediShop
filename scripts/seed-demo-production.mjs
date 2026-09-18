import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const targetPhone = process.env.DEMO_TARGET_PHONE || "8605094584";
const targetPassword = process.env.DEMO_TARGET_PASSWORD || "pratap123";
const targetShopName = process.env.DEMO_SHOP_NAME || "Zopolo";
const targetOwnerName = process.env.DEMO_OWNER_NAME || "Pratapsinh";
const targetAddress = process.env.DEMO_ADDRESS || "Tirhe North Solapur Solapur";

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

async function ensureShop(supabase) {
  const { data: existingShop, error: existingShopError } = await supabase
    .from("shops")
    .select("*")
    .eq("phone_number", targetPhone)
    .maybeSingle();

  if (existingShopError && existingShopError.code !== "PGRST116") {
    throw existingShopError;
  }

  if (existingShop) {
    const { error: updateError } = await supabase
      .from("shops")
      .update({
        owner_name: targetOwnerName,
        shop_name: targetShopName,
        address: targetAddress,
        password: targetPassword,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingShop.id);

    if (updateError) throw updateError;

    const { data: refreshedShop, error: refreshError } = await supabase
      .from("shops")
      .select("*")
      .eq("id", existingShop.id)
      .single();

    if (refreshError) throw refreshError;
    return refreshedShop;
  }

  const { data: createdShop, error: insertError } = await supabase
    .from("shops")
    .insert({
      owner_name: targetOwnerName,
      shop_name: targetShopName,
      address: targetAddress,
      phone_number: targetPhone,
      password: targetPassword,
      is_paused: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return createdShop;
}

async function ensureOwnerUser(supabase, shopId) {
  const { data: existingUser, error: existingUserError } = await supabase
    .from("users")
    .select("*")
    .eq("shop_id", shopId)
    .eq("role", "owner")
    .maybeSingle();

  if (existingUserError && existingUserError.code !== "PGRST116") {
    throw existingUserError;
  }

  if (existingUser) {
    const { error: updateError } = await supabase
      .from("users")
      .update({
        username: targetOwnerName,
        password: targetPassword,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingUser.id);

    if (updateError) throw updateError;
    const { data: refreshedUser, error: refreshError } = await supabase
      .from("users")
      .select("*")
      .eq("id", existingUser.id)
      .single();
    if (refreshError) throw refreshError;
    return refreshedUser;
  }

  const { data: insertedUser, error: insertError } = await supabase
    .from("users")
    .insert({
      shop_id: shopId,
      username: targetOwnerName,
      password: targetPassword,
      role: "owner",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return insertedUser;
}

async function ensureCategory(supabase, shopId, name, nameMarathi, color) {
  const { data: existingCategory, error: existingError } = await supabase
    .from("categories")
    .select("*")
    .eq("shop_id", shopId)
    .eq("name", name)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  if (existingCategory) {
    return existingCategory;
  }

  const { data: insertedCategory, error: insertError } = await supabase
    .from("categories")
    .insert({
      shop_id: shopId,
      name,
      name_marathi: nameMarathi,
      color,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return insertedCategory;
}

async function ensureUnit(supabase, shopId, name, shortForm, nameMarathi) {
  const { data: existingUnit, error: existingError } = await supabase
    .from("units")
    .select("*")
    .eq("shop_id", shopId)
    .eq("name", name)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  if (existingUnit) {
    return existingUnit;
  }

  const { data: insertedUnit, error: insertError } = await supabase
    .from("units")
    .insert({
      shop_id: shopId,
      name,
      name_marathi: nameMarathi,
      short_form: shortForm,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return insertedUnit;
}

async function ensureItem(supabase, shopId, item) {
  const { data: existingItem, error: existingError } = await supabase
    .from("items")
    .select("*")
    .eq("shop_id", shopId)
    .eq("name", item.name)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  if (existingItem) {
    const { error: updateError } = await supabase
      .from("items")
      .update({
        name_marathi: item.nameMarathi,
        brand: item.brand,
        category_id: item.categoryId,
        unit_id: item.unitId,
        quantity: item.quantity,
        expiry_date: item.expiryDate,
        buy_price: item.buyPrice,
        sell_price: item.sellPrice,
        low_stock_limit: item.lowStockLimit,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingItem.id);

    if (updateError) throw updateError;

    const { data: refreshedItem, error: refreshError } = await supabase
      .from("items")
      .select("*")
      .eq("id", existingItem.id)
      .single();

    if (refreshError) throw refreshError;
    return refreshedItem;
  }

  const { data: insertedItem, error: insertError } = await supabase
    .from("items")
    .insert({
      shop_id: shopId,
      name: item.name,
      name_marathi: item.nameMarathi,
      brand: item.brand,
      category_id: item.categoryId,
      unit_id: item.unitId,
      quantity: item.quantity,
      expiry_date: item.expiryDate,
      buy_price: item.buyPrice,
      sell_price: item.sellPrice,
      low_stock_limit: item.lowStockLimit,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return insertedItem;
}

async function cleanupDemoData(supabase, shopId) {
  const cleanupTargets = [
    { table: "alerts", field: "message", value: "%Demo seed%", useLike: true },
    {
      table: "stock_history",
      field: "reference",
      value: "demo-seed",
      useLike: false,
    },
    { table: "sale_items", field: "item_name", value: "%Demo%", useLike: true },
    { table: "sales", field: "notes", value: "Demo seed", useLike: true },
    {
      table: "credit_entries",
      field: "note",
      value: "Demo seed",
      useLike: true,
    },
  ];

  for (const target of cleanupTargets) {
    const baseQuery = supabase
      .from(target.table)
      .delete()
      .eq("shop_id", shopId);
    if (target.useLike) {
      await baseQuery.ilike(target.field, target.value);
    } else {
      await baseQuery.eq(target.field, target.value);
    }
  }
}

async function main() {
  const supabase = getSupabaseClient();
  console.log(
    `Seeding demo data for phone ${targetPhone} and password ${targetPassword}...`,
  );

  const shop = await ensureShop(supabase);
  console.log(`Shop ready: ${shop.shop_name} (#${shop.id})`);

  await ensureOwnerUser(supabase, shop.id);

  const [
    categoryGroceries,
    categoryBeverages,
    categoryPersonal,
    categoryHousehold,
  ] = await Promise.all([
    ensureCategory(supabase, shop.id, "Groceries", "अन्नधान्य", "#16a34a"),
    ensureCategory(supabase, shop.id, "Beverages", "पेय", "#2563eb"),
    ensureCategory(
      supabase,
      shop.id,
      "Personal Care",
      "वैयक्तिक काळजी",
      "#7c3aed",
    ),
    ensureCategory(supabase, shop.id, "Household", "घरगुती", "#ea580c"),
  ]);

  const [unitKg, unitPacket, unitBottle] = await Promise.all([
    ensureUnit(supabase, shop.id, "Kg", "kg", "किलो"),
    ensureUnit(supabase, shop.id, "Packet", "pkt", "पॅकेट"),
    ensureUnit(supabase, shop.id, "Bottle", "btl", "बोतल"),
  ]);

  await cleanupDemoData(supabase, shop.id);

  const items = await Promise.all([
    ensureItem(supabase, shop.id, {
      name: "Basmati Rice",
      nameMarathi: "बासमती तांदूळ",
      brand: "Aashirvaad",
      categoryId: categoryGroceries.id,
      unitId: unitKg.id,
      quantity: 18,
      expiryDate: null,
      buyPrice: 62,
      sellPrice: 74,
      lowStockLimit: 10,
    }),
    ensureItem(supabase, shop.id, {
      name: "Wheat Flour",
      nameMarathi: "गहू पीठ",
      brand: "Shree",
      categoryId: categoryGroceries.id,
      unitId: unitKg.id,
      quantity: 7,
      expiryDate: null,
      buyPrice: 42,
      sellPrice: 49,
      lowStockLimit: 8,
    }),
    ensureItem(supabase, shop.id, {
      name: "Milk",
      nameMarathi: "दूध",
      brand: "Amul",
      categoryId: categoryBeverages.id,
      unitId: unitBottle.id,
      quantity: 12,
      expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6)
        .toISOString()
        .slice(0, 10),
      buyPrice: 56,
      sellPrice: 64,
      lowStockLimit: 8,
    }),
    ensureItem(supabase, shop.id, {
      name: "Soap",
      nameMarathi: "साबण",
      brand: "Dettol",
      categoryId: categoryPersonal.id,
      unitId: unitPacket.id,
      quantity: 15,
      expiryDate: null,
      buyPrice: 32,
      sellPrice: 38,
      lowStockLimit: 6,
    }),
    ensureItem(supabase, shop.id, {
      name: "Detergent Powder",
      nameMarathi: "डिटर्जंट पावडर",
      brand: "Nirma",
      categoryId: categoryHousehold.id,
      unitId: unitPacket.id,
      quantity: 9,
      expiryDate: null,
      buyPrice: 88,
      sellPrice: 102,
      lowStockLimit: 6,
    }),
    ensureItem(supabase, shop.id, {
      name: "Tea",
      nameMarathi: "चहा",
      brand: "Tata",
      categoryId: categoryBeverages.id,
      unitId: unitPacket.id,
      quantity: 20,
      expiryDate: null,
      buyPrice: 180,
      sellPrice: 210,
      lowStockLimit: 8,
    }),
  ]);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 1000 * 60 * 60 * 24)
    .toISOString()
    .slice(0, 10);

  const { data: sales, error: salesError } = await supabase
    .from("sales")
    .insert([
      {
        shop_id: shop.id,
        date: yesterday,
        timestamp: `${yesterday}T10:30:00+05:30`,
        total_quantity_items: 3,
        subtotal: 2840,
        total_cost: 2140,
        total_profit: 700,
        profit_margin_percent: 24.6,
        payment_method: "cash",
        notes: "Demo seed",
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        date: today,
        timestamp: `${today}T18:30:00+05:30`,
        total_quantity_items: 4,
        subtotal: 1760,
        total_cost: 1320,
        total_profit: 440,
        profit_margin_percent: 25.0,
        payment_method: "partial",
        notes: "Demo seed",
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        date: today,
        timestamp: `${today}T20:05:00+05:30`,
        total_quantity_items: 2,
        subtotal: 640,
        total_cost: 480,
        total_profit: 160,
        profit_margin_percent: 25.0,
        payment_method: "udhari",
        notes: "Demo seed",
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ])
    .select("*");

  if (salesError) throw salesError;

  const saleRows = sales || [];
  await supabase.from("sale_items").insert([
    {
      shop_id: shop.id,
      sale_id: saleRows[0].id,
      item_id: items[0].id,
      item_name: items[0].name,
      quantity: 2,
      unit_id: unitKg.id,
      unit_short_form: unitKg.short_form,
      price_tier_id: null,
      price_per_unit: items[0].sell_price,
      total_price: 148,
      cost_per_unit: items[0].buy_price,
      total_cost: 124,
      profit: 24,
      created_at: now.toISOString(),
    },
    {
      shop_id: shop.id,
      sale_id: saleRows[0].id,
      item_id: items[2].id,
      item_name: items[2].name,
      quantity: 1,
      unit_id: unitBottle.id,
      unit_short_form: unitBottle.short_form,
      price_tier_id: null,
      price_per_unit: items[2].sell_price,
      total_price: 64,
      cost_per_unit: items[2].buy_price,
      total_cost: 56,
      profit: 8,
      created_at: now.toISOString(),
    },
    {
      shop_id: shop.id,
      sale_id: saleRows[1].id,
      item_id: items[3].id,
      item_name: items[3].name,
      quantity: 2,
      unit_id: unitPacket.id,
      unit_short_form: unitPacket.short_form,
      price_tier_id: null,
      price_per_unit: items[3].sell_price,
      total_price: 76,
      cost_per_unit: items[3].buy_price,
      total_cost: 64,
      profit: 12,
      created_at: now.toISOString(),
    },
    {
      shop_id: shop.id,
      sale_id: saleRows[1].id,
      item_id: items[5].id,
      item_name: items[5].name,
      quantity: 2,
      unit_id: unitPacket.id,
      unit_short_form: unitPacket.short_form,
      price_tier_id: null,
      price_per_unit: items[5].sell_price,
      total_price: 420,
      cost_per_unit: items[5].buy_price,
      total_cost: 360,
      profit: 60,
      created_at: now.toISOString(),
    },
    {
      shop_id: shop.id,
      sale_id: saleRows[2].id,
      item_id: items[4].id,
      item_name: items[4].name,
      quantity: 1,
      unit_id: unitPacket.id,
      unit_short_form: unitPacket.short_form,
      price_tier_id: null,
      price_per_unit: items[4].sell_price,
      total_price: 102,
      cost_per_unit: items[4].buy_price,
      total_cost: 88,
      profit: 14,
      created_at: now.toISOString(),
    },
  ]);

  await supabase.from("stock_history").insert([
    {
      shop_id: shop.id,
      item_id: items[0].id,
      item_name: items[0].name,
      type: "sale",
      quantity_changed: -2,
      quantity_before: 20,
      quantity_after: 18,
      reason: "Demo seed sale",
      cost_per_unit: items[0].buy_price,
      reference: "demo-seed",
      created_at: now.toISOString(),
    },
    {
      shop_id: shop.id,
      item_id: items[1].id,
      item_name: items[1].name,
      type: "purchase",
      quantity_changed: 10,
      quantity_before: 0,
      quantity_after: 10,
      reason: "Demo seed purchase",
      cost_per_unit: 40,
      reference: "demo-seed",
      created_at: now.toISOString(),
    },
    {
      shop_id: shop.id,
      item_id: items[3].id,
      item_name: items[3].name,
      type: "adjustment",
      quantity_changed: -2,
      quantity_before: 17,
      quantity_after: 15,
      reason: "Demo seed stock check",
      cost_per_unit: items[3].buy_price,
      reference: "demo-seed",
      created_at: now.toISOString(),
    },
  ]);

  const { data: customer, error: customerError } = await supabase
    .from("credit_customers")
    .select("*")
    .eq("shop_id", shop.id)
    .eq("name", "Ravi Patil")
    .maybeSingle();

  let creditCustomer = customer;
  if (customerError && customerError.code !== "PGRST116") throw customerError;

  if (!creditCustomer) {
    const { data: insertedCustomer, error: insertedCustomerError } =
      await supabase
        .from("credit_customers")
        .insert({
          shop_id: shop.id,
          name: "Ravi Patil",
          phone: "9876543210",
          balance: 950,
          notes: "Demo seed customer",
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select("*")
        .single();

    if (insertedCustomerError) throw insertedCustomerError;
    creditCustomer = insertedCustomer;
  }

  await supabase.from("credit_entries").insert({
    shop_id: shop.id,
    customer_id: creditCustomer.id,
    customer_name: creditCustomer.name,
    type: "credit",
    amount: 950,
    note: "Demo seed",
    sale_id: saleRows[2].id,
    bill_items: [{ item: items[4].name, amount: 102 }],
    date: today,
    timestamp: `${today}T20:05:00+05:30`,
    created_at: now.toISOString(),
  });

  await supabase.from("alerts").insert({
    shop_id: shop.id,
    item_id: items[1].id,
    item_name: items[1].name,
    alert_type: "low_stock",
    message: "Demo seed: Stock is low for Wheat Flour",
    severity: "warning",
    data: { low_stock_limit: 8, current_quantity: 7 },
    read: false,
    created_at: now.toISOString(),
  });

  await supabase.from("app_settings").upsert(
    {
      shop_id: shop.id,
      language: "en",
      theme: "light",
      setup_complete: true,
      updated_at: now.toISOString(),
    },
    { onConflict: "shop_id" },
  );

  console.log("Demo data seeded successfully.");
  console.log(`Login with mobile: ${targetPhone}`);
  console.log(`Password: ${targetPassword}`);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
