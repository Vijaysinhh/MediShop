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

async function ensureItem(supabase, shopId, item) {
  const { data: existing } = await supabase
    .from("items")
    .select("*")
    .eq("shop_id", shopId)
    .eq("name", item.name)
    .limit(1);

  if (existing?.length > 0) {
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
      .eq("id", existing[0].id);

    if (updateError) throw updateError;
    return existing[0];
  }

  const { data: created, error: insertError } = await supabase
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

// Generate realistic sales data
function generateSales(
  shopId,
  numDays = 60,
  salesPerDay = 8,
  avgTransactionValue = 2500,
) {
  const sales = [];
  const now = new Date();

  for (let day = numDays; day > 0; day--) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);
    const dateStr = date.toISOString().slice(0, 10);

    const numSales = Math.floor(
      salesPerDay + (Math.random() - 0.5) * (salesPerDay * 0.5),
    );

    for (let i = 0; i < numSales; i++) {
      const hour = Math.floor(Math.random() * 16) + 8; // 8 AM to 12 AM
      const minute = Math.floor(Math.random() * 60);
      const second = Math.floor(Math.random() * 60);

      const variance = 0.7 + Math.random() * 0.6; // 0.7x to 1.3x
      const totalCost = Math.round(avgTransactionValue * variance);
      const totalProfit = Math.round(totalCost * (0.2 + Math.random() * 0.2)); // 20-40% profit
      const subtotal = totalCost + totalProfit;
      const profitMargin = (totalProfit / subtotal) * 100;

      const paymentMethods = ["cash", "card", "partial", "udhari"];
      const paymentMethod =
        paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

      sales.push({
        shop_id: shopId,
        date: dateStr,
        timestamp: `${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}+05:30`,
        total_quantity_items: Math.floor(Math.random() * 15) + 1,
        subtotal,
        total_cost: totalCost,
        total_profit: totalProfit,
        profit_margin_percent: profitMargin,
        payment_method: paymentMethod,
        notes: `Sale - ${dateStr}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  return sales;
}

async function main() {
  const supabase = getSupabaseClient();
  console.log(`\nSeeding comprehensive demo data for ${targetPhone}...\n`);

  const shop = await ensureShop(supabase);
  console.log(`✓ Shop: ${shop.shop_name} (#${shop.id})`);

  await ensureOwnerUser(supabase, shop.id);
  console.log(`✓ Owner user: ${targetOwnerName}`);

  // Create comprehensive categories
  const categories = await Promise.all([
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
    ensureCategory(supabase, shop.id, "Dairy", "दुग्ध", "#f59e0b"),
    ensureCategory(supabase, shop.id, "Spices", "मसाले", "#dc2626"),
  ]);
  console.log(`✓ Categories: ${categories.length}`);

  // Create comprehensive units
  const units = await Promise.all([
    ensureUnit(supabase, shop.id, "Kg", "kg", "किलो"),
    ensureUnit(supabase, shop.id, "Packet", "pkt", "पॅकेट"),
    ensureUnit(supabase, shop.id, "Bottle", "btl", "बोतल"),
    ensureUnit(supabase, shop.id, "Liter", "ltr", "लीटर"),
    ensureUnit(supabase, shop.id, "Piece", "pc", "तुकडा"),
    ensureUnit(supabase, shop.id, "Dozen", "dz", "डझन"),
  ]);
  console.log(`✓ Units: ${units.length}`);

  // Clean old demo data
  await cleanupDemoData(supabase, shop.id);
  console.log(`✓ Cleaned up old demo data`);

  // Create realistic inventory items (about 50 items)
  const itemDefinitions = [
    {
      name: "Basmati Rice",
      nameMarathi: "बासमती तांदूळ",
      brand: "Aashirvaad",
      categoryId: categories[0].id,
      unitId: units[0].id,
      quantity: 150,
      buyPrice: 62,
      sellPrice: 75,
      lowStockLimit: 20,
    },
    {
      name: "Brown Rice",
      nameMarathi: "तपकिरी तांदूळ",
      brand: "Fortune",
      categoryId: categories[0].id,
      unitId: units[0].id,
      quantity: 80,
      buyPrice: 58,
      sellPrice: 70,
      lowStockLimit: 15,
    },
    {
      name: "Wheat Flour",
      nameMarathi: "गहू पीठ",
      brand: "Shree",
      categoryId: categories[0].id,
      unitId: units[0].id,
      quantity: 120,
      buyPrice: 42,
      sellPrice: 52,
      lowStockLimit: 25,
    },
    {
      name: "Sugar",
      nameMarathi: "साखर",
      brand: "Shakti",
      categoryId: categories[0].id,
      unitId: units[0].id,
      quantity: 200,
      buyPrice: 38,
      sellPrice: 48,
      lowStockLimit: 30,
    },
    {
      name: "Salt",
      nameMarathi: "मीठ",
      brand: "Tata",
      categoryId: categories[0].id,
      unitId: units[0].id,
      quantity: 300,
      buyPrice: 15,
      sellPrice: 20,
      lowStockLimit: 50,
    },
    {
      name: "Milk",
      nameMarathi: "दूध",
      brand: "Amul",
      categoryId: categories[4].id,
      unitId: units[3].id,
      quantity: 200,
      buyPrice: 56,
      sellPrice: 65,
      lowStockLimit: 30,
    },
    {
      name: "Curd",
      nameMarathi: "दही",
      brand: "Amul",
      categoryId: categories[4].id,
      unitId: units[1].id,
      quantity: 80,
      buyPrice: 48,
      sellPrice: 60,
      lowStockLimit: 15,
    },
    {
      name: "Butter",
      nameMarathi: "लोणी",
      brand: "Amul",
      categoryId: categories[4].id,
      unitId: units[1].id,
      quantity: 45,
      buyPrice: 380,
      sellPrice: 450,
      lowStockLimit: 10,
    },
    {
      name: "Tea",
      nameMarathi: "चहा",
      brand: "Tata",
      categoryId: categories[1].id,
      unitId: units[1].id,
      quantity: 150,
      buyPrice: 180,
      sellPrice: 220,
      lowStockLimit: 20,
    },
    {
      name: "Coffee",
      nameMarathi: "कॉफी",
      brand: "Nescafe",
      categoryId: categories[1].id,
      unitId: units[1].id,
      quantity: 80,
      buyPrice: 420,
      sellPrice: 500,
      lowStockLimit: 10,
    },
    {
      name: "Juice Orange",
      nameMarathi: "संत्रा रस",
      brand: "Tropicana",
      categoryId: categories[1].id,
      unitId: units[2].id,
      quantity: 60,
      buyPrice: 45,
      sellPrice: 55,
      lowStockLimit: 12,
    },
    {
      name: "Soft Drink Cola",
      nameMarathi: "कोला",
      brand: "Coca Cola",
      categoryId: categories[1].id,
      unitId: units[2].id,
      quantity: 200,
      buyPrice: 28,
      sellPrice: 40,
      lowStockLimit: 30,
    },
    {
      name: "Water Bottle",
      nameMarathi: "पाणी बोतल",
      brand: "Aquafina",
      categoryId: categories[1].id,
      unitId: units[2].id,
      quantity: 500,
      buyPrice: 8,
      sellPrice: 12,
      lowStockLimit: 100,
    },
    {
      name: "Soap",
      nameMarathi: "साबण",
      brand: "Dettol",
      categoryId: categories[2].id,
      unitId: units[1].id,
      quantity: 120,
      buyPrice: 32,
      sellPrice: 42,
      lowStockLimit: 20,
    },
    {
      name: "Shampoo",
      nameMarathi: "शॅम्पू",
      brand: "Heads & Shoulders",
      categoryId: categories[2].id,
      unitId: units[2].id,
      quantity: 60,
      buyPrice: 120,
      sellPrice: 160,
      lowStockLimit: 10,
    },
    {
      name: "Toothpaste",
      nameMarathi: "दातमजन",
      brand: "Colgate",
      categoryId: categories[2].id,
      unitId: units[1].id,
      quantity: 100,
      buyPrice: 48,
      sellPrice: 65,
      lowStockLimit: 15,
    },
    {
      name: "Detergent Powder",
      nameMarathi: "डिटर्जंट पावडर",
      brand: "Nirma",
      categoryId: categories[3].id,
      unitId: units[1].id,
      quantity: 90,
      buyPrice: 88,
      sellPrice: 110,
      lowStockLimit: 15,
    },
    {
      name: "Dish Wash",
      nameMarathi: "डिश वॉश",
      brand: "Vim",
      categoryId: categories[3].id,
      unitId: units[2].id,
      quantity: 70,
      buyPrice: 32,
      sellPrice: 45,
      lowStockLimit: 12,
    },
    {
      name: "Turmeric Powder",
      nameMarathi: "हळदीचा पावडर",
      brand: "Everest",
      categoryId: categories[5].id,
      unitId: units[0].id,
      quantity: 30,
      buyPrice: 380,
      sellPrice: 480,
      lowStockLimit: 5,
    },
    {
      name: "Chili Powder",
      nameMarathi: "मिरची पावडर",
      brand: "MDH",
      categoryId: categories[5].id,
      unitId: units[0].id,
      quantity: 25,
      buyPrice: 320,
      sellPrice: 420,
      lowStockLimit: 5,
    },
    {
      name: "Cumin Seeds",
      nameMarathi: "जिरे",
      brand: "Everest",
      categoryId: categories[5].id,
      unitId: units[0].id,
      quantity: 15,
      buyPrice: 420,
      sellPrice: 550,
      lowStockLimit: 3,
    },
    {
      name: "Coriander",
      nameMarathi: "धनिया",
      brand: "Shan",
      categoryId: categories[5].id,
      unitId: units[0].id,
      quantity: 20,
      buyPrice: 380,
      sellPrice: 480,
      lowStockLimit: 4,
    },
    {
      name: "Oil",
      nameMarathi: "तेल",
      brand: "Sunflower",
      categoryId: categories[0].id,
      unitId: units[3].id,
      quantity: 100,
      buyPrice: 125,
      sellPrice: 155,
      lowStockLimit: 20,
    },
    {
      name: "Ghee",
      nameMarathi: "तूप",
      brand: "Amul",
      categoryId: categories[0].id,
      unitId: units[0].id,
      quantity: 40,
      buyPrice: 520,
      sellPrice: 650,
      lowStockLimit: 8,
    },
  ];

  const items = await Promise.all(
    itemDefinitions.map((item) => ensureItem(supabase, shop.id, item)),
  );
  console.log(`✓ Items created: ${items.length}`);

  // Generate large volume of sales (~100k worth in 60 days)
  const salesData = generateSales(shop.id, 60, 10, 2500);

  const { error: salesError } = await supabase.from("sales").insert(salesData);

  if (salesError) throw salesError;

  console.log(`✓ Sales created: ${salesData.length} transactions`);

  // Calculate total sales value
  const totalSalesValue = salesData.reduce((sum, s) => sum + s.subtotal, 0);
  const totalProfit = salesData.reduce((sum, s) => sum + s.total_profit, 0);
  console.log(
    `✓ Total sales value: ₹${totalSalesValue.toLocaleString("en-IN")}`,
  );
  console.log(`✓ Total profit: ₹${totalProfit.toLocaleString("en-IN")}`);

  // Create some credit customers
  const creditCustomers = [];
  const customerNames = [
    { name: "Ravi Patil", phone: "9876543210" },
    { name: "Suresh Kumar", phone: "9765432109" },
    { name: "Deepak Singh", phone: "9654321098" },
    { name: "Anita Sharma", phone: "8765432109" },
    { name: "Priya Verma", phone: "8654321098" },
  ];

  for (const customer of customerNames) {
    const { data: existing } = await supabase
      .from("credit_customers")
      .select("*")
      .eq("shop_id", shop.id)
      .eq("name", customer.name)
      .limit(1);

    if (existing?.length > 0) {
      creditCustomers.push(existing[0]);
    } else {
      const { data: created } = await supabase
        .from("credit_customers")
        .insert({
          shop_id: shop.id,
          name: customer.name,
          phone: customer.phone,
          balance: Math.floor(Math.random() * 50000) + 5000,
          notes: "Regular customer",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (created) creditCustomers.push(created);
    }
  }

  console.log(`✓ Credit customers: ${creditCustomers.length}`);

  // Create price tiers for bulk purchases
  const priceTiersData = [];
  for (const item of items.slice(0, 10)) {
    priceTiersData.push({
      shop_id: shop.id,
      item_id: item.id,
      quantity_min: 10,
      quantity_max: 50,
      discounted_price: Math.round(item.sell_price * 0.95),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    priceTiersData.push({
      shop_id: shop.id,
      item_id: item.id,
      quantity_min: 51,
      quantity_max: 999,
      discounted_price: Math.round(item.sell_price * 0.9),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  if (priceTiersData.length > 0) {
    const { error: priceError } = await supabase
      .from("price_tiers")
      .insert(priceTiersData);

    if (!priceError) {
      console.log(`✓ Price tiers: ${priceTiersData.length}`);
    }
  }

  // Create app settings
  await supabase.from("app_settings").upsert(
    {
      shop_id: shop.id,
      language: "en",
      theme: "light",
      setup_complete: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "shop_id" },
  );

  console.log(`\n✅ Demo data seeded successfully!\n`);
  console.log(`Login credentials:`);
  console.log(`  Phone: ${targetPhone}`);
  console.log(`  Password: ${targetPassword}\n`);
  console.log(`Summary:`);
  console.log(`  - Items: ${items.length}`);
  console.log(`  - Sales transactions: ${salesData.length}`);
  console.log(
    `  - Total sales value: ₹${totalSalesValue.toLocaleString("en-IN")}`,
  );
  console.log(`  - Categories: ${categories.length}`);
  console.log(`  - Credit customers: ${creditCustomers.length}`);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
