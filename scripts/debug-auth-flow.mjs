/**
 * Debug script to test the auth flow and check if currentShopId is derived correctly.
 * This simulates what happens in the auth-provider when a user logs in.
 */

const targetPhone = "8605094584";
const targetPassword = "pratap123";

// Simulate Supabase responses
const mockShop = {
  id: 3,
  shop_name: "Zopolo",
  phone_number: targetPhone,
  password: targetPassword,
  owner_name: "Pratapsinh",
};

const mockOwner = {
  id: 14,
  shop_id: 3,
  username: "Pratapsinh",
  password: targetPassword,
  role: "owner",
  created_at: "2026-06-27T21:25:12.949+00:00",
  updated_at: "2026-06-27T21:25:12.949+00:00",
};

// Simulate the mapUser function from auth-provider
function mapUser(user) {
  return {
    ...user,
    createdAt: new Date(user.created_at).getTime(),
    updatedAt: new Date(user.updated_at).getTime(),
    shopId: user.shop_id, // ← This should be set
  };
}

// Simulate the mapShop function
function mapShop(shop) {
  return {
    ...shop,
    createdAt: new Date(shop.created_at || new Date()).getTime(),
    updatedAt: new Date(shop.updated_at || new Date()).getTime(),
  };
}

console.log("\n=== SIMULATING LOGIN FLOW ===\n");

// After login succeeds, the auth provider sets:
const currentShop = mapShop(mockShop);
const user = mapUser(mockOwner);

console.log("1. After login, user object has:");
console.log(`   - id: ${user.id}`);
console.log(`   - shop_id: ${user.shop_id}`);
console.log(`   - shopId: ${user.shopId}`);
console.log("   ✓ shopId field exists:", !!user.shopId);

console.log("\n2. After login, currentShop object has:");
console.log(`   - id: ${currentShop.id}`);
console.log("   ✓ currentShop.id exists:", !!currentShop.id);

// Simulate the currentShopId computation from AuthContext
const currentShopId =
  currentShop?.id ?? user?.shop_id ?? user?.shopId ?? undefined;

console.log("\n3. currentShopId computation:");
console.log(
  `   currentShopId = currentShop?.id ?? user?.shop_id ?? user?.shopId ?? undefined`,
);
console.log(
  `   currentShopId = ${currentShop?.id} ?? ${user?.shop_id} ?? ${user?.shopId} ?? undefined`,
);
console.log(`   → currentShopId = ${currentShopId}`);
console.log(
  currentShopId
    ? "   ✓ currentShopId is correctly set"
    : "   ✗ ERROR: currentShopId is undefined!",
);

console.log("\n4. Data loading hooks would receive:");
console.log(`   useItems(${currentShopId})`);
console.log(`   useSales(${currentShopId})`);
console.log(`   useCategories(${currentShopId})`);

if (!currentShopId) {
  console.log(
    "\n⚠️  PROBLEM: If currentShopId is undefined, the data hooks won't load data!",
  );
  console.log("\nPossible issues:");
  console.log(
    "   1. currentShop is not being set after login (check auth-provider setCurrentShop)",
  );
  console.log(
    "   2. user.shop_id is not being set correctly (check mapUser function)",
  );
  console.log("   3. Login is not actually completing successfully");
} else {
  console.log(
    "\n✅ Auth flow appears correct. currentShopId should be passed to data hooks.",
  );
  console.log("\nIf data still doesn't show:");
  console.log("   1. Check browser console for fetch errors");
  console.log("   2. Verify Supabase credentials are correct");
  console.log("   3. Check if RLS policies allow reading from items/sales/etc");
}

console.log("\n=== END DEBUG ===\n");
