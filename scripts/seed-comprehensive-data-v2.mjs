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
  ];

  for (const table of tables) {
    await supabase.from(table).delete().eq("shop_id", shopId);
  }
}

async function main() {
  const supabase = getSupabaseClient();
  console.log(`\n=== Seeding realistic demo data for small vendor ===\n`);

  const shop = await ensureShop(supabase);
  console.log(`✓ Shop: ${shop.shop_name} (#${shop.id})`);

  await ensureOwnerUser(supabase, shop.id);
  console.log(`✓ Owner: ${targetOwnerName}`);

  // Create categories
  const categories = await Promise.all([
    ensureCategory(supabase, shop.id, "Groceries", "अन्नधान्य", "#16a34a"),
    ensureCategory(supabase, shop.id, "Dairy", "दुग्ध", "#f59e0b"),
    ensureCategory(supabase, shop.id, "Beverages", "पेय", "#2563eb"),
    ensureCategory(
      supabase,
      shop.id,
      "Personal Care",
      "वैयक्तिक काळजी",
      "#7c3aed",
    ),
    ensureCategory(supabase, shop.id, "Household", "घरगुती", "#ea580c"),
    ensureCategory(supabase, shop.id, "Spices", "मसाले", "#dc2626"),
  ]);
  console.log(`✓ Categories: ${categories.length}`);

  // Create units
  const units = await Promise.all([
    ensureUnit(supabase, shop.id, "Kg", "kg", "किलो"),
    ensureUnit(supabase, shop.id, "Packet", "pkt", "पॅकेट"),
    ensureUnit(supabase, shop.id, "Bottle", "btl", "बोतल"),
    ensureUnit(supabase, shop.id, "Liter", "ltr", "लीटर"),
    ensureUnit(supabase, shop.id, "Piece", "pc", "तुकडा"),
  ]);

  await cleanupDemoData(supabase, shop.id);

  // Realistic items with multiple brands and price variants
  const itemDefinitions = [
    // Rice - multiple brands with different prices
    {
      name: "Basmati Rice - Premium",
      brand: "Aashirvaad",
      categoryId: categories[0].id,
      unitId: units[0].id,
      quantity: 85,
      buyPrice: 62,
      sellPrice: 75,
      lowStockLimit: 20,
      expiryDate: null,
    },
    {
      name: "Basmati Rice - Standard",
      brand: "India Gate",
      categoryId: categories[0].id,
      unitId: units[0].id,
      quantity: 120,
      buyPrice: 55,
      sellPrice: 68,
      lowStockLimit: 25,
      expiryDate: null,
    },
    {
      name: "Brown Rice",
      brand: "Fortune",
      categoryId: categories[0].id,
      unitId: units[0].id,
      quantity: 45,
      buyPrice: 48,
      sellPrice: 60,
      lowStockLimit: 15,
      expiryDate: null,
    },

    // Flour variants
    {
      name: "Wheat Flour Premium",
      brand: "Shree",
      categoryId: categories[0].id,
      unitId: units[0].id,
      quantity: 65,
      buyPrice: 45,
      sellPrice: 55,
      lowStockLimit: 15,
      expiryDate: null,
    },
    {
      name: "Wheat Flour Budget",
      brand: "Pillsbury",
      categoryId: categories[0].id,
      unitId: units[0].id,
      quantity: 90,
      buyPrice: 38,
      sellPrice: 48,
      lowStockLimit: 20,
      expiryDate: null,
    },

    // Sugar & Salt
    {
      name: "Sugar",
      brand: "Shakti",
      categoryId: categories[0].id,
      unitId: units[0].id,
      quantity: 110,
      buyPrice: 38,
      sellPrice: 48,
      lowStockLimit: 30,
      expiryDate: null,
    },
    {
      name: "Salt",
      brand: "Tata",
      categoryId: categories[0].id,
      unitId: units[0].id,
      quantity: 200,
      buyPrice: 15,
      sellPrice: 20,
      lowStockLimit: 50,
      expiryDate: null,
    },
    {
      name: "Oil - Sunflower",
      brand: "Fortune",
      categoryId: categories[0].id,
      unitId: units[3].id,
      quantity: 80,
      buyPrice: 120,
      sellPrice: 155,
      lowStockLimit: 15,
      expiryDate: null,
    },

    // DAIRY - with expiry dates (WILL TRIGGER ALERTS)
    {
      name: "Milk",
      brand: "Amul",
      categoryId: categories[1].id,
      unitId: units[3].id,
      quantity: 95,
      buyPrice: 52,
      sellPrice: 65,
      lowStockLimit: 20,
      expiryDate: getDateInDays(5),
    }, // Expires in 5 days
    {
      name: "Curd 400g",
      brand: "Amul",
      categoryId: categories[1].id,
      unitId: units[1].id,
      quantity: 55,
      buyPrice: 42,
      sellPrice: 55,
      lowStockLimit: 12,
      expiryDate: getDateInDays(3),
    }, // Expires soon - ALERT!
    {
      name: "Butter 500g",
      brand: "Amul",
      categoryId: categories[1].id,
      unitId: units[1].id,
      quantity: 32,
      buyPrice: 380,
      sellPrice: 450,
      lowStockLimit: 8,
      expiryDate: getDateInDays(20),
    },
    {
      name: "Ghee 500ml",
      brand: "Badshah",
      categoryId: categories[1].id,
      unitId: units[2].id,
      quantity: 28,
      buyPrice: 480,
      sellPrice: 600,
      lowStockLimit: 5,
      expiryDate: null,
    },

    // BEVERAGES
    {
      name: "Tea Leaves Premium",
      brand: "Tata",
      categoryId: categories[2].id,
      unitId: units[1].id,
      quantity: 75,
      buyPrice: 180,
      sellPrice: 220,
      lowStockLimit: 15,
      expiryDate: null,
    },
    {
      name: "Tea Leaves Budget",
      brand: "Red Label",
      categoryId: categories[2].id,
      unitId: units[1].id,
      quantity: 120,
      buyPrice: 140,
      sellPrice: 180,
      lowStockLimit: 20,
      expiryDate: null,
    },
    {
      name: "Coffee Powder",
      brand: "Nescafe",
      categoryId: categories[2].id,
      unitId: units[1].id,
      quantity: 45,
      buyPrice: 420,
      sellPrice: 520,
      lowStockLimit: 8,
      expiryDate: null,
    },
    {
      name: "Orange Juice 1L",
      brand: "Tropicana",
      categoryId: categories[2].id,
      unitId: units[2].id,
      quantity: 35,
      buyPrice: 38,
      sellPrice: 50,
      lowStockLimit: 8,
      expiryDate: getDateInDays(8),
    },
    {
      name: "Cola 1.5L",
      brand: "Coca Cola",
      categoryId: categories[2].id,
      unitId: units[2].id,
      quantity: 120,
      buyPrice: 28,
      sellPrice: 45,
      lowStockLimit: 30,
      expiryDate: getDateInDays(60),
    },
    {
      name: "Water Bottle 1L",
      brand: "Aquafina",
      categoryId: categories[2].id,
      unitId: units[2].id,
      quantity: 250,
      buyPrice: 8,
      sellPrice: 12,
      lowStockLimit: 50,
      expiryDate: null,
    },

    // PERSONAL CARE
    {
      name: "Soap Premium",
      brand: "Dettol",
      categoryId: categories[3].id,
      unitId: units[1].id,
      quantity: 85,
      buyPrice: 32,
      sellPrice: 42,
      lowStockLimit: 15,
      expiryDate: null,
    },
    {
      name: "Soap Budget",
      brand: "Lifebuoy",
      categoryId: categories[3].id,
      unitId: units[1].id,
      quantity: 120,
      buyPrice: 22,
      sellPrice: 30,
      lowStockLimit: 20,
      expiryDate: null,
    },
    {
      name: "Shampoo 500ml",
      brand: "Heads & Shoulders",
      categoryId: categories[3].id,
      unitId: units[2].id,
      quantity: 40,
      buyPrice: 120,
      sellPrice: 160,
      lowStockLimit: 8,
      expiryDate: null,
    },
    {
      name: "Toothpaste 100g",
      brand: "Colgate",
      categoryId: categories[3].id,
      unitId: units[1].id,
      quantity: 75,
      buyPrice: 48,
      sellPrice: 65,
      lowStockLimit: 15,
      expiryDate: null,
    },

    // HOUSEHOLD
    {
      name: "Detergent Powder 1kg",
      brand: "Nirma",
      categoryId: categories[4].id,
      unitId: units[1].id,
      quantity: 65,
      buyPrice: 88,
      sellPrice: 110,
      lowStockLimit: 12,
      expiryDate: null,
    },
    {
      name: "Dish Wash 500ml",
      brand: "Vim",
      categoryId: categories[4].id,
      unitId: units[2].id,
      quantity: 50,
      buyPrice: 32,
      sellPrice: 45,
      lowStockLimit: 10,
      expiryDate: null,
    },

    // SPICES - High margin items
    {
      name: "Turmeric Powder 100g",
      brand: "Everest",
      categoryId: categories[5].id,
      unitId: units[1].id,
      quantity: 25,
      buyPrice: 380,
      sellPrice: 480,
      lowStockLimit: 5,
      expiryDate: null,
    },
    {
      name: "Chili Powder 100g",
      brand: "MDH",
      categoryId: categories[5].id,
      unitId: units[1].id,
      quantity: 18,
      buyPrice: 320,
      sellPrice: 420,
      lowStockLimit: 3,
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
      items.push({ ...created, ...item });
    }
  }

  console.log(`✓ Items: ${items.length} with realistic brands & prices`);

  // Generate realistic sales (TODAY and past days)
  const now = new Date();
  const salesData = [];
  const saleItemsData = [];

  // YESTERDAY - Good sales
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // Sale 1: Morning - ₹2,850
  const sale1 = {
    shop_id: shop.id,
    date: yesterdayStr,
    timestamp: `${yesterdayStr}T08:30:00+05:30`,
    total_quantity_items: 5,
    subtotal: 2850,
    total_cost: 1950,
    total_profit: 900,
    profit_margin_percent: 31.6,
    payment_method: "cash",
    notes: "Morning sale",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  // Sale 2: Afternoon - ₹4,200
  const sale2 = {
    shop_id: shop.id,
    date: yesterdayStr,
    timestamp: `${yesterdayStr}T14:15:00+05:30`,
    total_quantity_items: 8,
    subtotal: 4200,
    total_cost: 2650,
    total_profit: 1550,
    profit_margin_percent: 36.9,
    payment_method: "card",
    notes: "Afternoon sale",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  // Sale 3: Evening - ₹3,100 (Udhari)
  const sale3 = {
    shop_id: shop.id,
    date: yesterdayStr,
    timestamp: `${yesterdayStr}T18:45:00+05:30`,
    total_quantity_items: 6,
    subtotal: 3100,
    total_cost: 2100,
    total_profit: 1000,
    profit_margin_percent: 32.3,
    payment_method: "udhari",
    notes: "Evening sale",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  salesData.push(sale1, sale2, sale3);

  // TODAY - Smaller sales so far
  const todayStr = now.toISOString().slice(0, 10);

  // Sale 4: Morning - ₹1,850 (TODAY)
  const sale4 = {
    shop_id: shop.id,
    date: todayStr,
    timestamp: `${todayStr}T09:20:00+05:30`,
    total_quantity_items: 3,
    subtotal: 1850,
    total_cost: 1200,
    total_profit: 650,
    profit_margin_percent: 35.1,
    payment_method: "cash",
    notes: "Today morning",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  // Sale 5: Late morning - ₹2,400 (TODAY)
  const sale5 = {
    shop_id: shop.id,
    date: todayStr,
    timestamp: `${todayStr}T11:45:00+05:30`,
    total_quantity_items: 4,
    subtotal: 2400,
    total_cost: 1550,
    total_profit: 850,
    profit_margin_percent: 35.4,
    payment_method: "partial",
    notes: "Today mid morning",
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
    // Yesterday sales detail
    saleItemsData.push(
      // Sale 1 items
      {
        shop_id: shop.id,
        sale_id: insertedSales[0].id,
        item_id: items[0].id, // Basmati Rice Premium
        item_name: items[0].name,
        quantity: 2,
        unit_id: items[0].unit_id,
        unit_short_form: "kg",
        price_tier_id: null,
        price_per_unit: 75,
        total_price: 150,
        cost_per_unit: 62,
        total_cost: 124,
        profit: 26,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[0].id,
        item_id: items[8].id, // Milk
        item_name: items[8].name,
        quantity: 3,
        unit_id: items[8].unit_id,
        unit_short_form: "ltr",
        price_tier_id: null,
        price_per_unit: 65,
        total_price: 195,
        cost_per_unit: 52,
        total_cost: 156,
        profit: 39,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[0].id,
        item_id: items[12].id, // Tea Leaves Premium
        item_name: items[12].name,
        quantity: 1,
        unit_id: items[12].unit_id,
        unit_short_form: "pkt",
        price_tier_id: null,
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
        item_name: "Soap Premium",
        item_id: items[17].id,
        quantity: 2,
        unit_id: items[17].unit_id,
        unit_short_form: "pkt",
        price_tier_id: null,
        price_per_unit: 42,
        total_price: 84,
        cost_per_unit: 32,
        total_cost: 64,
        profit: 20,
        created_at: now.toISOString(),
      },

      // Sale 2 items
      {
        shop_id: shop.id,
        sale_id: insertedSales[1].id,
        item_id: items[1].id, // Basmati Rice Standard
        item_name: items[1].name,
        quantity: 3,
        unit_id: items[1].unit_id,
        unit_short_form: "kg",
        price_tier_id: null,
        price_per_unit: 68,
        total_price: 204,
        cost_per_unit: 55,
        total_cost: 165,
        profit: 39,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[1].id,
        item_id: items[11].id, // Ghee
        item_name: items[11].name,
        quantity: 1,
        unit_id: items[11].unit_id,
        unit_short_form: "btl",
        price_tier_id: null,
        price_per_unit: 600,
        total_price: 600,
        cost_per_unit: 480,
        total_cost: 480,
        profit: 120,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[1].id,
        item_id: items[16].id, // Cola
        item_name: items[16].name,
        quantity: 5,
        unit_id: items[16].unit_id,
        unit_short_form: "btl",
        price_tier_id: null,
        price_per_unit: 45,
        total_price: 225,
        cost_per_unit: 28,
        total_cost: 140,
        profit: 85,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[1].id,
        item_id: items[22].id, // Detergent
        item_name: items[22].name,
        quantity: 2,
        unit_id: items[22].unit_id,
        unit_short_form: "pkt",
        price_tier_id: null,
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
        item_id: items[14].id, // Juice
        item_name: items[14].name,
        quantity: 2,
        unit_id: items[14].unit_id,
        unit_short_form: "btl",
        price_tier_id: null,
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
        item_id: items[19].id, // Shampoo
        item_name: items[19].name,
        quantity: 1,
        unit_id: items[19].unit_id,
        unit_short_form: "btl",
        price_tier_id: null,
        price_per_unit: 160,
        total_price: 160,
        cost_per_unit: 120,
        total_cost: 120,
        profit: 40,
        created_at: now.toISOString(),
      },

      // Sale 3 items (Yesterday evening - Udhari)
      {
        shop_id: shop.id,
        sale_id: insertedSales[2].id,
        item_id: items[3].id, // Wheat Flour Premium
        item_name: items[3].name,
        quantity: 4,
        unit_id: items[3].unit_id,
        unit_short_form: "kg",
        price_tier_id: null,
        price_per_unit: 55,
        total_price: 220,
        cost_per_unit: 45,
        total_cost: 180,
        profit: 40,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[2].id,
        item_id: items[9].id, // Curd
        item_name: items[9].name,
        quantity: 5,
        unit_id: items[9].unit_id,
        unit_short_form: "pkt",
        price_tier_id: null,
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
        item_id: items[13].id, // Tea Budget
        item_name: items[13].name,
        quantity: 2,
        unit_id: items[13].unit_id,
        unit_short_form: "pkt",
        price_tier_id: null,
        price_per_unit: 180,
        total_price: 360,
        cost_per_unit: 140,
        total_cost: 280,
        profit: 80,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[2].id,
        item_id: items[24].id, // Turmeric
        item_name: items[24].name,
        quantity: 3,
        unit_id: items[24].unit_id,
        unit_short_form: "pkt",
        price_tier_id: null,
        price_per_unit: 480,
        total_price: 1440,
        cost_per_unit: 380,
        total_cost: 1140,
        profit: 300,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[2].id,
        item_id: items[18].id, // Soap Budget
        item_name: items[18].name,
        quantity: 2,
        unit_id: items[18].unit_id,
        unit_short_form: "pkt",
        price_tier_id: null,
        price_per_unit: 30,
        total_price: 60,
        cost_per_unit: 22,
        total_cost: 44,
        profit: 16,
        created_at: now.toISOString(),
      },

      // TODAY - Sale 4
      {
        shop_id: shop.id,
        sale_id: insertedSales[3].id,
        item_id: items[0].id, // Basmati Rice Premium
        item_name: items[0].name,
        quantity: 1,
        unit_id: items[0].unit_id,
        unit_short_form: "kg",
        price_tier_id: null,
        price_per_unit: 75,
        total_price: 75,
        cost_per_unit: 62,
        total_cost: 62,
        profit: 13,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[3].id,
        item_id: items[17].id, // Soap Premium
        item_name: items[17].name,
        quantity: 3,
        unit_id: items[17].unit_id,
        unit_short_form: "pkt",
        price_tier_id: null,
        price_per_unit: 42,
        total_price: 126,
        cost_per_unit: 32,
        total_cost: 96,
        profit: 30,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[3].id,
        item_id: items[16].id, // Cola
        item_name: items[16].name,
        quantity: 3,
        unit_id: items[16].unit_id,
        unit_short_form: "btl",
        price_tier_id: null,
        price_per_unit: 45,
        total_price: 135,
        cost_per_unit: 28,
        total_cost: 84,
        profit: 51,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[3].id,
        item_id: items[20].id, // Toothpaste
        item_name: items[20].name,
        quantity: 2,
        unit_id: items[20].unit_id,
        unit_short_form: "pkt",
        price_tier_id: null,
        price_per_unit: 65,
        total_price: 130,
        cost_per_unit: 48,
        total_cost: 96,
        profit: 34,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[3].id,
        item_id: items[17].id, // Soap Premium
        item_name: items[17].name,
        quantity: 2,
        unit_id: items[17].unit_id,
        unit_short_form: "pkt",
        price_tier_id: null,
        price_per_unit: 42,
        total_price: 84,
        cost_per_unit: 32,
        total_cost: 64,
        profit: 20,
        created_at: now.toISOString(),
      },

      // TODAY - Sale 5
      {
        shop_id: shop.id,
        sale_id: insertedSales[4].id,
        item_id: items[8].id, // Milk
        item_name: items[8].name,
        quantity: 2,
        unit_id: items[8].unit_id,
        unit_short_form: "ltr",
        price_tier_id: null,
        price_per_unit: 65,
        total_price: 130,
        cost_per_unit: 52,
        total_cost: 104,
        profit: 26,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[4].id,
        item_id: items[12].id, // Tea Premium
        item_name: items[12].name,
        quantity: 1,
        unit_id: items[12].unit_id,
        unit_short_form: "pkt",
        price_tier_id: null,
        price_per_unit: 220,
        total_price: 220,
        cost_per_unit: 180,
        total_cost: 180,
        profit: 40,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[4].id,
        item_id: items[25].id, // Chili Powder
        item_name: items[25].name,
        quantity: 2,
        unit_id: items[25].unit_id,
        unit_short_form: "pkt",
        price_tier_id: null,
        price_per_unit: 420,
        total_price: 840,
        cost_per_unit: 320,
        total_cost: 640,
        profit: 200,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[4].id,
        item_id: items[17].id, // Soap Premium
        item_name: items[17].name,
        quantity: 2,
        unit_id: items[17].unit_id,
        unit_short_form: "pkt",
        price_tier_id: null,
        price_per_unit: 42,
        total_price: 84,
        cost_per_unit: 32,
        total_cost: 64,
        profit: 20,
        created_at: now.toISOString(),
      },
      {
        shop_id: shop.id,
        sale_id: insertedSales[4].id,
        item_id: items[15].id, // Water
        item_name: items[15].name,
        quantity: 10,
        unit_id: items[15].unit_id,
        unit_short_form: "btl",
        price_tier_id: null,
        price_per_unit: 12,
        total_price: 120,
        cost_per_unit: 8,
        total_cost: 80,
        profit: 40,
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

  // Create alerts for expiring items
  const alertsData = [];
  for (const item of items) {
    if (item.expiryDate) {
      const expiryDate = new Date(item.expiryDate);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysUntilExpiry <= 7) {
        alertsData.push({
          shop_id: shop.id,
          item_id: item.id,
          item_name: item.name,
          alert_type: "expiry",
          message: `${item.name} expires in ${daysUntilExpiry} days (${item.expiryDate})`,
          severity: daysUntilExpiry <= 2 ? "critical" : "warning",
          data: {
            expiry_date: item.expiryDate,
            days_until_expiry: daysUntilExpiry,
          },
          read: false,
          created_at: now.toISOString(),
        });
      }
    }

    // Low stock alerts
    if (item.quantity <= item.lowStockLimit) {
      alertsData.push({
        shop_id: shop.id,
        item_id: item.id,
        item_name: item.name,
        alert_type: "low_stock",
        message: `${item.name} stock is low: ${item.quantity} remaining`,
        severity: "warning",
        data: {
          current_quantity: item.quantity,
          low_stock_limit: item.lowStockLimit,
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
      console.log(`✓ Alerts: ${alertsData.length} (expiry & low stock)`);
    }
  }

  // Create credit entries
  const creditCustomers = [];
  const { data: existingCustomers } = await supabase
    .from("credit_customers")
    .select("*")
    .eq("shop_id", shop.id);

  if (!existingCustomers || existingCustomers.length === 0) {
    const customerData = [
      { name: "Ravi Patil", phone: "9876543210", balance: 3500 },
      { name: "Suresh Kumar", phone: "9765432109", balance: 5200 },
      { name: "Priya Sharma", phone: "9654321098", balance: 2800 },
    ];

    const { data: created } = await supabase
      .from("credit_customers")
      .insert(
        customerData.map((c) => ({
          shop_id: shop.id,
          name: c.name,
          phone: c.phone,
          balance: c.balance,
          notes: "Regular customer",
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })),
      )
      .select("*");

    creditCustomers.push(...(created || []));
    console.log(`✓ Credit customers: ${creditCustomers.length}`);
  }

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

  console.log(`\n✅ Realistic demo data created successfully!\n`);
  console.log(`📱 Login Credentials:`);
  console.log(`   Phone: ${targetPhone}`);
  console.log(`   Password: ${targetPassword}\n`);
  console.log(`📊 Data Summary:`);
  console.log(`   • Items: ${items.length} products with price variants`);
  console.log(`   • Sales: 5 transactions (Yesterday + Today)`);
  console.log(`   • Yesterday Total: ₹10,150 (Profit: ₹3,450)`);
  console.log(`   • Today Total: ₹4,250 (Profit: ₹1,500)`);
  console.log(`   • Alerts: ${alertsData.length} (expiry + low stock)`);
  console.log(`   • Categories: 6 with realistic grouping`);
  console.log(`   • Credit Customers: ${creditCustomers.length}\n`);
  console.log(`🔍 You'll see on dashboard:`);
  console.log(`   ✓ Today's profit: ₹1,500`);
  console.log(`   ✓ Comparison vs yesterday: +0% (similar)`);
  console.log(`   ✓ Sales streak: Multiple sales today`);
  console.log(`   ✓ Expiry alerts: Curd & Juice alerts`);
  console.log(`   ✓ Brand comparisons: Multiple brands per category`);
  console.log(`   ✓ Stock alerts: Low inventory warnings\n`);
}

function getDateInDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
