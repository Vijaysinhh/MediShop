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
  const { data: shops } = await supabase
    .from("shops")
    .select("*")
    .eq("phone_number", targetPhone)
    .limit(1);

  if (shops?.length > 0) {
    return shops[0];
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
  const { data: existingUsers } = await supabase
    .from("users")
    .select("*")
    .eq("shop_id", shopId)
    .eq("role", "owner")
    .limit(1);

  if (existingUsers?.length > 0) {
    return existingUsers[0];
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
  const { data: existing } = await supabase
    .from("categories")
    .select("*")
    .eq("shop_id", shopId)
    .eq("name", name)
    .limit(1);

  if (existing?.length > 0) return existing[0];

  const { data: created, error } = await supabase
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

  if (error) throw error;
  return created;
}

async function ensureUnit(supabase, shopId, name, shortForm, nameMarathi) {
  const { data: existing } = await supabase
    .from("units")
    .select("*")
    .eq("shop_id", shopId)
    .eq("name", name)
    .limit(1);

  if (existing?.length > 0) return existing[0];

  const { data: created, error } = await supabase
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

  if (error) throw error;
  return created;
}

async function cleanupDemoData(supabase, shopId) {
  const tables = [
    "sales",
    "sale_items",
    "stock_history",
    "credit_entries",
    "alerts",
    "price_tiers",
  ];

  for (const table of tables) {
    await supabase.from(table).delete().eq("shop_id", shopId);
  }
}

function getDateInDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function main() {
  const supabase = getSupabaseClient();
  console.log(
    `\n=== Seeding realistic data for brand comparison & inventory showcase ===\n`,
  );

  const shop = await ensureShop(supabase);
  console.log(`✓ Shop: ${shop.shop_name} (#${shop.id})`);

  await ensureOwnerUser(supabase, shop.id);

  // Create categories
  const categories = await Promise.all([
    ensureCategory(supabase, shop.id, "Dairy", "दुग्ध", "#f59e0b"),
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

  // Create units
  const units = await Promise.all([
    ensureUnit(supabase, shop.id, "Liter", "ltr", "लीटर"),
    ensureUnit(supabase, shop.id, "Kg", "kg", "किलो"),
    ensureUnit(supabase, shop.id, "Packet", "pkt", "पॅकेट"),
    ensureUnit(supabase, shop.id, "Bottle", "btl", "बोतल"),
  ]);

  await cleanupDemoData(supabase, shop.id);
  console.log(`✓ Categories & Units created`);

  const now = new Date();

  // ITEMS WITH SAME PRODUCT NAME, DIFFERENT BRANDS (FOR BRAND COMPARISON)
  const itemDefinitions = [
    // === MILK - 3 BRANDS ===
    {
      name: "Milk",
      brand: "Amul",
      categoryId: categories[0].id,
      unitId: units[0].id,
      quantity: 8,
      buyPrice: 52,
      sellPrice: 65,
      lowStockLimit: 10,
      expiryDate: getDateInDays(3),
    },
    {
      name: "Milk",
      brand: "Heritage",
      categoryId: categories[0].id,
      unitId: units[0].id,
      quantity: 5,
      buyPrice: 50,
      sellPrice: 62,
      lowStockLimit: 10,
      expiryDate: getDateInDays(4),
    },
    {
      name: "Milk",
      brand: "Aavin",
      categoryId: categories[0].id,
      unitId: units[0].id,
      quantity: 3,
      buyPrice: 48,
      sellPrice: 60,
      lowStockLimit: 10,
      expiryDate: getDateInDays(5),
    },

    // === TEA - 3 BRANDS ===
    {
      name: "Tea",
      brand: "Tata",
      categoryId: categories[2].id,
      unitId: units[2].id,
      quantity: 45,
      buyPrice: 180,
      sellPrice: 220,
      lowStockLimit: 20,
      expiryDate: null,
    },
    {
      name: "Tea",
      brand: "Red Label",
      categoryId: categories[2].id,
      unitId: units[2].id,
      quantity: 32,
      buyPrice: 140,
      sellPrice: 180,
      lowStockLimit: 15,
      expiryDate: null,
    },
    {
      name: "Tea",
      brand: "Lipton",
      categoryId: categories[2].id,
      unitId: units[2].id,
      quantity: 8,
      buyPrice: 200,
      sellPrice: 250,
      lowStockLimit: 15,
      expiryDate: null,
    },

    // === SOAP - 4 BRANDS ===
    {
      name: "Soap",
      brand: "Dettol",
      categoryId: categories[3].id,
      unitId: units[2].id,
      quantity: 45,
      buyPrice: 32,
      sellPrice: 42,
      lowStockLimit: 20,
      expiryDate: null,
    },
    {
      name: "Soap",
      brand: "Lifebuoy",
      categoryId: categories[3].id,
      unitId: units[2].id,
      quantity: 60,
      buyPrice: 22,
      sellPrice: 30,
      lowStockLimit: 25,
      expiryDate: null,
    },
    {
      name: "Soap",
      brand: "Lux",
      categoryId: categories[3].id,
      unitId: units[2].id,
      quantity: 5,
      buyPrice: 38,
      sellPrice: 50,
      lowStockLimit: 15,
      expiryDate: null,
    },
    {
      name: "Soap",
      brand: "Dove",
      categoryId: categories[3].id,
      unitId: units[2].id,
      quantity: 2,
      buyPrice: 48,
      sellPrice: 65,
      lowStockLimit: 10,
      expiryDate: null,
    },

    // === RICE - 3 BRANDS ===
    {
      name: "Rice",
      brand: "Aashirvaad",
      categoryId: categories[1].id,
      unitId: units[1].id,
      quantity: 42,
      buyPrice: 62,
      sellPrice: 75,
      lowStockLimit: 20,
      expiryDate: null,
    },
    {
      name: "Rice",
      brand: "India Gate",
      categoryId: categories[1].id,
      unitId: units[1].id,
      quantity: 58,
      buyPrice: 55,
      sellPrice: 68,
      lowStockLimit: 25,
      expiryDate: null,
    },
    {
      name: "Rice",
      brand: "Fortune",
      categoryId: categories[1].id,
      unitId: units[1].id,
      quantity: 12,
      buyPrice: 58,
      sellPrice: 72,
      lowStockLimit: 20,
      expiryDate: null,
    },

    // === DETERGENT - 3 BRANDS ===
    {
      name: "Detergent",
      brand: "Nirma",
      categoryId: categories[4].id,
      unitId: units[2].id,
      quantity: 25,
      buyPrice: 88,
      sellPrice: 110,
      lowStockLimit: 15,
      expiryDate: null,
    },
    {
      name: "Detergent",
      brand: "Tide",
      categoryId: categories[4].id,
      unitId: units[2].id,
      quantity: 8,
      buyPrice: 128,
      sellPrice: 160,
      lowStockLimit: 10,
      expiryDate: null,
    },
    {
      name: "Detergent",
      brand: "Surf",
      categoryId: categories[4].id,
      unitId: units[2].id,
      quantity: 4,
      buyPrice: 95,
      sellPrice: 118,
      lowStockLimit: 10,
      expiryDate: null,
    },

    // === CURD - 2 BRANDS WITH EXPIRY ===
    {
      name: "Curd",
      brand: "Amul",
      categoryId: categories[0].id,
      unitId: units[2].id,
      quantity: 15,
      buyPrice: 42,
      sellPrice: 55,
      lowStockLimit: 8,
      expiryDate: getDateInDays(2),
    }, // CRITICAL EXPIRY
    {
      name: "Curd",
      brand: "Mother Dairy",
      categoryId: categories[0].id,
      unitId: units[2].id,
      quantity: 8,
      buyPrice: 44,
      sellPrice: 58,
      lowStockLimit: 8,
      expiryDate: getDateInDays(1),
    }, // CRITICAL EXPIRY

    // === JUICE - 2 BRANDS ===
    {
      name: "Juice",
      brand: "Tropicana",
      categoryId: categories[2].id,
      unitId: units[3].id,
      quantity: 12,
      buyPrice: 38,
      sellPrice: 50,
      lowStockLimit: 10,
      expiryDate: getDateInDays(6),
    },
    {
      name: "Juice",
      brand: "Real",
      categoryId: categories[2].id,
      unitId: units[3].id,
      quantity: 6,
      buyPrice: 35,
      sellPrice: 48,
      lowStockLimit: 10,
      expiryDate: getDateInDays(7),
    },

    // === ADDITIONAL ITEMS ===
    {
      name: "Flour",
      brand: "Shree",
      categoryId: categories[1].id,
      unitId: units[1].id,
      quantity: 28,
      buyPrice: 45,
      sellPrice: 55,
      lowStockLimit: 15,
      expiryDate: null,
    },
    {
      name: "Sugar",
      brand: "Shakti",
      categoryId: categories[1].id,
      unitId: units[1].id,
      quantity: 65,
      buyPrice: 38,
      sellPrice: 48,
      lowStockLimit: 20,
      expiryDate: null,
    },
    {
      name: "Oil",
      brand: "Fortune",
      categoryId: categories[1].id,
      unitId: units[0].id,
      quantity: 35,
      buyPrice: 125,
      sellPrice: 155,
      lowStockLimit: 10,
      expiryDate: null,
    },
    {
      name: "Toothpaste",
      brand: "Colgate",
      categoryId: categories[3].id,
      unitId: units[2].id,
      quantity: 32,
      buyPrice: 48,
      sellPrice: 65,
      lowStockLimit: 10,
      expiryDate: null,
    },
    {
      name: "Shampoo",
      brand: "H&S",
      categoryId: categories[3].id,
      unitId: units[3].id,
      quantity: 18,
      buyPrice: 120,
      sellPrice: 160,
      lowStockLimit: 8,
      expiryDate: null,
    },
    {
      name: "Water",
      brand: "Aquafina",
      categoryId: categories[2].id,
      unitId: units[3].id,
      quantity: 150,
      buyPrice: 8,
      sellPrice: 12,
      lowStockLimit: 50,
      expiryDate: null,
    },
  ];

  // Insert items
  const items = [];
  for (const item of itemDefinitions) {
    const now = new Date().toISOString();
    const { data: created } = await supabase
      .from("items")
      .insert({
        shop_id: shop.id,
        name: item.name,
        name_marathi: "",
        brand: item.brand,
        brand_marathi: "",
        category_id: item.categoryId,
        unit_id: item.unitId,
        quantity: item.quantity,
        expiry_date: item.expiryDate,
        buy_price: item.buyPrice,
        sell_price: item.sellPrice,
        margin_amount: item.sellPrice - item.buyPrice,
        margin_percent:
          ((item.sellPrice - item.buyPrice) / item.buyPrice) * 100,
        low_stock_limit: item.lowStockLimit,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (created) {
      items.push(created);
    }
  }

  console.log(`✓ Items: ${items.length} (with brand comparisons)`);

  // === CREATE SALES TRANSACTIONS ===
  const salesData = [];
  const saleItemsData = [];

  // YESTERDAY - Good sales
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // Sale 1: Morning - ₹3,250
  const sale1 = {
    shop_id: shop.id,
    date: yesterdayStr,
    timestamp: `${yesterdayStr}T08:30:00+05:30`,
    total_quantity_items: 6,
    subtotal: 3250,
    total_cost: 2150,
    total_profit: 1100,
    profit_margin_percent: 33.8,
    payment_method: "cash",
    notes: "Morning sale",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  // Sale 2: Afternoon - ₹5,800
  const sale2 = {
    shop_id: shop.id,
    date: yesterdayStr,
    timestamp: `${yesterdayStr}T14:15:00+05:30`,
    total_quantity_items: 10,
    subtotal: 5800,
    total_cost: 3650,
    total_profit: 2150,
    profit_margin_percent: 37.1,
    payment_method: "card",
    notes: "Afternoon sale",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  // Sale 3: Evening - ₹4,100 (Udhari/Credit)
  const sale3 = {
    shop_id: shop.id,
    date: yesterdayStr,
    timestamp: `${yesterdayStr}T18:45:00+05:30`,
    total_quantity_items: 8,
    subtotal: 4100,
    total_cost: 2700,
    total_profit: 1400,
    profit_margin_percent: 34.1,
    payment_method: "udhari",
    notes: "Evening udhari sale",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  salesData.push(sale1, sale2, sale3);

  // TODAY - Sales so far
  const todayStr = now.toISOString().slice(0, 10);

  // Sale 4: Morning - ₹2,400 (TODAY)
  const sale4 = {
    shop_id: shop.id,
    date: todayStr,
    timestamp: `${todayStr}T09:20:00+05:30`,
    total_quantity_items: 4,
    subtotal: 2400,
    total_cost: 1550,
    total_profit: 850,
    profit_margin_percent: 35.4,
    payment_method: "cash",
    notes: "Today morning",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  // Sale 5: Late morning - ₹3,100 (TODAY)
  const sale5 = {
    shop_id: shop.id,
    date: todayStr,
    timestamp: `${todayStr}T11:45:00+05:30`,
    total_quantity_items: 5,
    subtotal: 3100,
    total_cost: 2000,
    total_profit: 1100,
    profit_margin_percent: 35.5,
    payment_method: "partial",
    notes: "Today partial payment",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  salesData.push(sale4, sale5);

  // Insert sales
  const { data: insertedSales } = await supabase
    .from("sales")
    .insert(salesData)
    .select("*");

  console.log(`✓ Sales: ${insertedSales?.length || 0} transactions`);

  // Create detailed sale items
  if (insertedSales && insertedSales.length > 0) {
    saleItemsData.push(
      // Yesterday Sale 1
      {
        shop_id: shop.id,
        sale_id: insertedSales[0].id,
        item_id: items[0].id,
        item_name: "Milk - Amul",
        quantity: 2,
        unit_id: units[0].id,
        unit_short_form: "ltr",
        price_per_unit: 65,
        total_price: 130,
        cost_per_unit: 52,
        total_cost: 104,
        profit: 26,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[0].id,
        item_id: items[7].id,
        item_name: "Soap - Lifebuoy",
        quantity: 3,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 30,
        total_price: 90,
        cost_per_unit: 22,
        total_cost: 66,
        profit: 24,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[0].id,
        item_id: items[10].id,
        item_name: "Rice - India Gate",
        quantity: 2,
        unit_id: units[1].id,
        unit_short_form: "kg",
        price_per_unit: 68,
        total_price: 136,
        cost_per_unit: 55,
        total_cost: 110,
        profit: 26,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[0].id,
        item_id: items[3].id,
        item_name: "Tea - Tata",
        quantity: 1,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 220,
        total_price: 220,
        cost_per_unit: 180,
        total_cost: 180,
        profit: 40,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[0].id,
        item_id: items[20].id,
        item_name: "Water - Aquafina",
        quantity: 3,
        unit_id: units[3].id,
        unit_short_form: "btl",
        price_per_unit: 12,
        total_price: 36,
        cost_per_unit: 8,
        total_cost: 24,
        profit: 12,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[0].id,
        item_id: items[24].id,
        item_name: "Toothpaste - Colgate",
        quantity: 2,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 65,
        total_price: 130,
        cost_per_unit: 48,
        total_cost: 96,
        profit: 34,
        created_at: now.toISOString(),
      },

      // Yesterday Sale 2
      {
        shop_id: shop.id,
        sale_id: insertedSales[1].id,
        item_id: items[1].id,
        item_name: "Milk - Heritage",
        quantity: 3,
        unit_id: units[0].id,
        unit_short_form: "ltr",
        price_per_unit: 62,
        total_price: 186,
        cost_per_unit: 50,
        total_cost: 150,
        profit: 36,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[1].id,
        item_id: items[4].id,
        item_name: "Tea - Red Label",
        quantity: 2,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 180,
        total_price: 360,
        cost_per_unit: 140,
        total_cost: 280,
        profit: 80,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[1].id,
        item_id: items[6].id,
        item_name: "Soap - Dettol",
        quantity: 3,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 42,
        total_price: 126,
        cost_per_unit: 32,
        total_cost: 96,
        profit: 30,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[1].id,
        item_id: items[12].id,
        item_name: "Rice - Aashirvaad",
        quantity: 2,
        unit_id: units[1].id,
        unit_short_form: "kg",
        price_per_unit: 75,
        total_price: 150,
        cost_per_unit: 62,
        total_cost: 124,
        profit: 26,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[1].id,
        item_id: items[18].id,
        item_name: "Detergent - Nirma",
        quantity: 2,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 110,
        total_price: 220,
        cost_per_unit: 88,
        total_cost: 176,
        profit: 44,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[1].id,
        item_id: items[22].id,
        item_name: "Juice - Tropicana",
        quantity: 2,
        unit_id: units[3].id,
        unit_short_form: "btl",
        price_per_unit: 50,
        total_price: 100,
        cost_per_unit: 38,
        total_cost: 76,
        profit: 24,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[1].id,
        item_id: items[25].id,
        item_name: "Shampoo - H&S",
        quantity: 1,
        unit_id: units[3].id,
        unit_short_form: "btl",
        price_per_unit: 160,
        total_price: 160,
        cost_per_unit: 120,
        total_cost: 120,
        profit: 40,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[1].id,
        item_id: items[21].id,
        item_name: "Oil - Fortune",
        quantity: 1,
        unit_id: units[0].id,
        unit_short_form: "ltr",
        price_per_unit: 155,
        total_price: 155,
        cost_per_unit: 125,
        total_cost: 125,
        profit: 30,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[1].id,
        item_id: items[8].id,
        item_name: "Soap - Lux",
        quantity: 1,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 50,
        total_price: 50,
        cost_per_unit: 38,
        total_cost: 38,
        profit: 12,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[1].id,
        item_id: items[2].id,
        item_name: "Milk - Aavin",
        quantity: 1,
        unit_id: units[0].id,
        unit_short_form: "ltr",
        price_per_unit: 60,
        total_price: 60,
        cost_per_unit: 48,
        total_cost: 48,
        profit: 12,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[1].id,
        item_id: items[5].id,
        item_name: "Tea - Lipton",
        quantity: 1,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 250,
        total_price: 250,
        cost_per_unit: 200,
        total_cost: 200,
        profit: 50,
        created_at: now.toISOString(),
      },

      // Yesterday Sale 3 (Udhari)
      {
        shop_id: shop.id,
        sale_id: insertedSales[2].id,
        item_id: items[16].id,
        item_name: "Curd - Amul",
        quantity: 5,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 55,
        total_price: 275,
        cost_per_unit: 42,
        total_cost: 210,
        profit: 65,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[2].id,
        item_id: items[11].id,
        item_name: "Detergent - Tide",
        quantity: 1,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 160,
        total_price: 160,
        cost_per_unit: 128,
        total_cost: 128,
        profit: 32,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[2].id,
        item_id: items[23].id,
        item_name: "Juice - Real",
        quantity: 2,
        unit_id: units[3].id,
        unit_short_form: "btl",
        price_per_unit: 48,
        total_price: 96,
        cost_per_unit: 35,
        total_cost: 70,
        profit: 26,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[2].id,
        item_id: items[19].id,
        item_name: "Flour - Shree",
        quantity: 3,
        unit_id: units[1].id,
        unit_short_form: "kg",
        price_per_unit: 55,
        total_price: 165,
        cost_per_unit: 45,
        total_cost: 135,
        profit: 30,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[2].id,
        item_id: items[9].id,
        item_name: "Soap - Dove",
        quantity: 2,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 65,
        total_price: 130,
        cost_per_unit: 48,
        total_cost: 96,
        profit: 34,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[2].id,
        item_id: items[14].id,
        item_name: "Rice - Fortune",
        quantity: 2,
        unit_id: units[1].id,
        unit_short_form: "kg",
        price_per_unit: 72,
        total_price: 144,
        cost_per_unit: 58,
        total_cost: 116,
        profit: 28,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[2].id,
        item_id: items[20].id,
        item_name: "Sugar - Shakti",
        quantity: 2,
        unit_id: units[1].id,
        unit_short_form: "kg",
        price_per_unit: 48,
        total_price: 96,
        cost_per_unit: 38,
        total_cost: 76,
        profit: 20,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[2].id,
        item_id: items[13].id,
        item_name: "Detergent - Surf",
        quantity: 1,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 118,
        total_price: 118,
        cost_per_unit: 95,
        total_cost: 95,
        profit: 23,
        created_at: now.toISOString(),
      },

      // TODAY Sale 4
      {
        shop_id: shop.id,
        sale_id: insertedSales[3].id,
        item_id: items[0].id,
        item_name: "Milk - Amul",
        quantity: 1,
        unit_id: units[0].id,
        unit_short_form: "ltr",
        price_per_unit: 65,
        total_price: 65,
        cost_per_unit: 52,
        total_cost: 52,
        profit: 13,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[3].id,
        item_id: items[7].id,
        item_name: "Soap - Lifebuoy",
        quantity: 2,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 30,
        total_price: 60,
        cost_per_unit: 22,
        total_cost: 44,
        profit: 16,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[3].id,
        item_id: items[3].id,
        item_name: "Tea - Tata",
        quantity: 1,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 220,
        total_price: 220,
        cost_per_unit: 180,
        total_cost: 180,
        profit: 40,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[3].id,
        item_id: items[10].id,
        item_name: "Rice - India Gate",
        quantity: 1,
        unit_id: units[1].id,
        unit_short_form: "kg",
        price_per_unit: 68,
        total_price: 68,
        cost_per_unit: 55,
        total_cost: 55,
        profit: 13,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[3].id,
        item_id: items[24].id,
        item_name: "Toothpaste - Colgate",
        quantity: 1,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 65,
        total_price: 65,
        cost_per_unit: 48,
        total_cost: 48,
        profit: 17,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[3].id,
        item_id: items[20].id,
        item_name: "Water - Aquafina",
        quantity: 5,
        unit_id: units[3].id,
        unit_short_form: "btl",
        price_per_unit: 12,
        total_price: 60,
        cost_per_unit: 8,
        total_cost: 40,
        profit: 20,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[3].id,
        item_id: items[6].id,
        item_name: "Soap - Dettol",
        quantity: 1,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 42,
        total_price: 42,
        cost_per_unit: 32,
        total_cost: 32,
        profit: 10,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[3].id,
        item_id: items[12].id,
        item_name: "Rice - Aashirvaad",
        quantity: 1,
        unit_id: units[1].id,
        unit_short_form: "kg",
        price_per_unit: 75,
        total_price: 75,
        cost_per_unit: 62,
        total_cost: 62,
        profit: 13,
        created_at: now.toISOString(),
      },

      // TODAY Sale 5
      {
        shop_id: shop.id,
        sale_id: insertedSales[4].id,
        item_id: items[4].id,
        item_name: "Tea - Red Label",
        quantity: 2,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 180,
        total_price: 360,
        cost_per_unit: 140,
        total_cost: 280,
        profit: 80,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[4].id,
        item_id: items[1].id,
        item_name: "Milk - Heritage",
        quantity: 1,
        unit_id: units[0].id,
        unit_short_form: "ltr",
        price_per_unit: 62,
        total_price: 62,
        cost_per_unit: 50,
        total_cost: 50,
        profit: 12,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[4].id,
        item_id: items[18].id,
        item_name: "Detergent - Nirma",
        quantity: 1,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 110,
        total_price: 110,
        cost_per_unit: 88,
        total_cost: 88,
        profit: 22,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[4].id,
        item_id: items[22].id,
        item_name: "Juice - Tropicana",
        quantity: 1,
        unit_id: units[3].id,
        unit_short_form: "btl",
        price_per_unit: 50,
        total_price: 50,
        cost_per_unit: 38,
        total_cost: 38,
        profit: 12,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[4].id,
        item_id: items[15].id,
        item_name: "Curd - Mother Dairy",
        quantity: 3,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 58,
        total_price: 174,
        cost_per_unit: 44,
        total_cost: 132,
        profit: 42,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[4].id,
        item_id: items[25].id,
        item_name: "Shampoo - H&S",
        quantity: 1,
        unit_id: units[3].id,
        unit_short_form: "btl",
        price_per_unit: 160,
        total_price: 160,
        cost_per_unit: 120,
        total_cost: 120,
        profit: 40,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[4].id,
        item_id: items[8].id,
        item_name: "Soap - Lux",
        quantity: 2,
        unit_id: units[2].id,
        unit_short_form: "pkt",
        price_per_unit: 50,
        total_price: 100,
        cost_per_unit: 38,
        total_cost: 76,
        profit: 24,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[4].id,
        item_id: items[14].id,
        item_name: "Rice - Fortune",
        quantity: 1,
        unit_id: units[1].id,
        unit_short_form: "kg",
        price_per_unit: 72,
        total_price: 72,
        cost_per_unit: 58,
        total_cost: 58,
        profit: 14,
        created_at: now.toISOString(),
      },
    );

    const { error: saleItemsError } = await supabase
      .from("sale_items")
      .insert(saleItemsData);

    if (!saleItemsError) {
      console.log(`✓ Sale line items: ${saleItemsData.length}`);
    }
  }

  // === CREATE ALERTS FOR SHOWCASE ===
  const alertsData = [];

  for (const item of items) {
    if (item.expiry_date) {
      const expiryDate = new Date(item.expiry_date);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysUntilExpiry <= 7) {
        alertsData.push({
          shop_id: shop.id,
          item_id: item.id,
          item_name: item.name,
          alert_type: "expiry",
          message: `${item.name} (${item.brand}) expires in ${daysUntilExpiry} days`,
          severity: daysUntilExpiry <= 2 ? "critical" : "warning",
          data: {
            expiry_date: item.expiry_date,
            days_until_expiry: daysUntilExpiry,
          },
          read: false,
          created_at: now.toISOString(),
        });
      }
    }

    if (item.quantity <= item.low_stock_limit) {
      alertsData.push({
        shop_id: shop.id,
        item_id: item.id,
        item_name: item.name,
        alert_type: "low_stock",
        message: `${item.name} (${item.brand}) stock LOW: ${item.quantity}/${item.low_stock_limit}`,
        severity: item.quantity === 0 ? "critical" : "warning",
        data: {
          current_quantity: item.quantity,
          low_stock_limit: item.low_stock_limit,
        },
        read: false,
        created_at: now.toISOString(),
      });
    }
  }

  if (alertsData.length > 0) {
    const { error: alertsError } = await supabase
      .from("alerts")
      .insert(alertsData);

    if (!alertsError) {
      console.log(`✓ Alerts: ${alertsData.length} (expiry + low stock)`);
    }
  }

  // === CREATE CREDIT ENTRIES (LONG PENDING UDHARI) ===
  const creditCustomers = [];
  const { data: existingCustomers } = await supabase
    .from("credit_customers")
    .select("*")
    .eq("shop_id", shop.id);

  if (!existingCustomers || existingCustomers.length === 0) {
    // Create customers with different ages of pending payments
    const customerData = [
      {
        name: "Ravi Patil",
        phone: "9876543210",
        balance: 12500,
        pendingDays: 35,
      }, // CRITICAL - 35 days pending
      {
        name: "Suresh Kumar",
        phone: "9765432109",
        balance: 18900,
        pendingDays: 28,
      }, // HIGH RISK - 28 days
      {
        name: "Priya Sharma",
        phone: "9654321098",
        balance: 7600,
        pendingDays: 21,
      }, // MEDIUM - 21 days
      {
        name: "Amit Singh",
        phone: "8765432109",
        balance: 5400,
        pendingDays: 14,
      }, // MEDIUM - 14 days
      {
        name: "Deepak Rao",
        phone: "7654321098",
        balance: 3200,
        pendingDays: 8,
      }, // LOW RISK - 8 days
      {
        name: "Vishnu Desai",
        phone: "6543210987",
        balance: 2800,
        pendingDays: 3,
      }, // FRESH - 3 days
    ];

    const creditEntries = [];

    const { data: created } = await supabase
      .from("credit_customers")
      .insert(
        customerData.map((c) => ({
          shop_id: shop.id,
          name: c.name,
          phone: c.phone,
          balance: c.balance,
          notes: `Pending for ${c.pendingDays} days`,
          created_at: new Date(
            now.getTime() - c.pendingDays * 24 * 60 * 60 * 1000,
          ).toISOString(),
          updated_at: now.toISOString(),
        })),
      )
      .select("*");

    if (created) {
      creditCustomers.push(...created);

      // Create detailed credit entries for each customer with different dates
      for (let i = 0; i < created.length; i++) {
        const customer = created[i];
        const customer_data = customerData[i];
        const creditDate = new Date(
          now.getTime() - customer_data.pendingDays * 24 * 60 * 60 * 1000,
        );
        const creditDateStr = creditDate.toISOString().slice(0, 10);

        creditEntries.push({
          shop_id: shop.id,
          customer_id: customer.id,
          customer_name: customer.name,
          type: "credit",
          amount: customer.balance,
          note: `Pending ${customer_data.pendingDays} days - ⚠️ High Risk`,
          sale_id: null,
          bill_items: [],
          date: creditDateStr,
          timestamp: `${creditDateStr}T18:00:00+05:30`,
          created_at: creditDate.toISOString(),
        });
      }

      await supabase.from("credit_entries").insert(creditEntries);
    }

    console.log(
      `✓ Credit customers: ${creditCustomers.length} with pending balances`,
    );
    creditCustomers.forEach((c) => {
      const cData = customerData.find((d) => d.name === c.name);
      const risk =
        cData.pendingDays > 30
          ? "🔴 CRITICAL"
          : cData.pendingDays > 20
            ? "🟡 HIGH"
            : cData.pendingDays > 10
              ? "🟠 MEDIUM"
              : "🟢 LOW";
      console.log(
        `   ${risk}: ${c.name} - ₹${c.balance} (${cData.pendingDays} days)`,
      );
    });
  }

  // Settings
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

  console.log(`\n✅ Complete realistic demo data created!\n`);
  console.log(`📱 Login Credentials:`);
  console.log(`   Phone: ${targetPhone}`);
  console.log(`   Password: ${targetPassword}\n`);
  console.log(`📊 Data Summary:`);
  console.log(`   ✓ Items: ${items.length} products`);
  console.log(`   ✓ Brand Comparisons: Same products with different brands`);
  console.log(`     - Milk: 3 brands (Amul ₹65 | Heritage ₹62 | Aavin ₹60)`);
  console.log(
    `     - Tea: 3 brands (Tata ₹220 | Red Label ₹180 | Lipton ₹250)`,
  );
  console.log(
    `     - Soap: 4 brands (Dettol ₹42 | Lifebuoy ₹30 | Lux ₹50 | Dove ₹65)`,
  );
  console.log(
    `     - Rice: 3 brands (Aashirvaad ₹75 | India Gate ₹68 | Fortune ₹72)`,
  );
  console.log(
    `   ✓ Low Stock Items: ${items.filter((i) => i.quantity <= i.low_stock_limit).length} products`,
  );
  console.log(
    `   ✓ Expiry Alerts: ${items.filter((i) => i.expiry_date && new Date(i.expiry_date) < new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)).length} items expiring soon`,
  );
  console.log(`   ✓ Sales: 5 transactions (Yesterday ₹13,150 + Today ₹5,500)`);
  console.log(`   ✓ Profit: Yesterday ₹4,650 | Today ₹1,950`);
  console.log(
    `   ✓ Credit Customers: ${creditCustomers.length} with pending payments`,
  );
  console.log(
    `   ✓ Total Pending Udhari: ₹${creditCustomers.reduce((sum, c) => sum + c.balance, 0)}\n`,
  );
  console.log(`📋 Pending Customer Payments (Udhari) - Age-Based Risk:`);
  console.log(`   🔴 CRITICAL (35+ days): 1 customer - ₹12,500 (HIGH RISK!)`);
  console.log(`   🟡 HIGH (20-35 days): 2 customers - ₹26,500`);
  console.log(`   🟠 MEDIUM (10-20 days): 2 customers - ₹12,800`);
  console.log(`   🟢 LOW (<10 days): 1 customer - ₹6,000\n`);
  console.log(`🎯 App Features Showcase:`);
  console.log(`   ✅ Brand Comparison - Multiple brands of same product`);
  console.log(`   ✅ Low Stock Alerts - Items running out`);
  console.log(`   ✅ Expiry Alerts - Items about to expire`);
  console.log(`   ✅ Profit Dashboard - Daily profit tracking`);
  console.log(`   ✅ Sales Trends - Compare today vs yesterday`);
  console.log(
    `   ✅ Udhari (Credit) Management - Track pending payments by age`,
  );
  console.log(`   ✅ Risk Alerts - 35-day pending payment CRITICAL alert!\n`);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
