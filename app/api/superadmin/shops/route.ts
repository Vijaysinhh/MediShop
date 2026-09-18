import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type CreateShopInput = {
  pharmacyName?: string;
  legalName?: string;
  drugLicense?: string;
  address?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPassword?: string;
  planCode?: string;
  billingPeriod?: "trial" | "monthly" | "yearly" | "custom";
  subscriptionEndsAt?: string | null;
};

type UpdateShopInput = CreateShopInput & { shopId?: string };

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function getSubscriptionEnd(start: Date, period: NonNullable<CreateShopInput["billingPeriod"]>, customEnd?: string | null) {
  if (customEnd) {
    const parsed = new Date(customEnd);
    if (Number.isNaN(parsed.getTime()) || parsed <= start) return null;
    return parsed;
  }
  const end = new Date(start);
  if (period === "trial") end.setUTCDate(end.getUTCDate() + 14);
  if (period === "monthly") end.setUTCMonth(end.getUTCMonth() + 1);
  if (period === "yearly") end.setUTCFullYear(end.getUTCFullYear() + 1);
  if (period === "custom") return null;
  return end;
}

async function findAuthUserByEmail(admin: any, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const match = data.users.find((user: any) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 100) break;
  }
  return null;
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serverSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !serverSecretKey) {
    return fail("Server onboarding is not configured. Add SUPABASE_SECRET_KEY to the server environment.", 503);
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail("Sign in again before creating a pharmacy.", 401);

  const callerClient = createClient(url, publishableKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: caller, error: callerError } = await callerClient.auth.getUser(token);
  if (callerError || !caller.user) return fail("Your sign-in session is no longer valid.", 401);
  const { data: isAdmin, error: adminError } = await callerClient.rpc("is_platform_admin");
  if (adminError || !isAdmin) return fail("Only a MediShop platform administrator can create pharmacies.", 403);

  const input = await request.json() as CreateShopInput;
  const pharmacyName = input.pharmacyName?.trim();
  const ownerName = input.ownerName?.trim();
  const ownerEmail = input.ownerEmail?.trim().toLowerCase();
  const ownerPassword = input.ownerPassword || "";
  const billingPeriod = input.billingPeriod || "trial";
  const planCode = input.planCode?.trim() || billingPeriod;
  const startsAt = new Date();
  const endsAt = getSubscriptionEnd(startsAt, billingPeriod, input.subscriptionEndsAt);
  if (!pharmacyName || pharmacyName.length < 2) return fail("Enter a pharmacy name.");
  if (!ownerName || !ownerEmail) return fail("Enter the owner name and email.");
  if (!/^\S+@\S+\.\S+$/.test(ownerEmail)) return fail("Enter a valid owner email.");
  if (ownerPassword.length < 8) return fail("Owner temporary password must be at least 8 characters.");
  if (!endsAt) return fail("Choose a valid future end date for the custom subscription.");

  const admin = createClient(url, serverSecretKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: createdOwner, error: ownerError } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
    user_metadata: { full_name: ownerName },
  });
  let ownerUser = createdOwner.user;
  let createdOwnerNow = Boolean(createdOwner.user && !ownerError);
  if (ownerError || !ownerUser) {
    const isDuplicateEmail = /already (?:been )?registered|already exists/i.test(ownerError?.message || "");
    if (!isDuplicateEmail) return fail(ownerError?.message || "Could not create the owner account.", 409);
    try {
      const existingUser = await findAuthUserByEmail(admin, ownerEmail);
      if (!existingUser) return fail("The owner email exists in Auth but could not be recovered.", 409);
      const [{ count: membershipCount, error: membershipError }, { data: platformAdmin, error: platformAdminError }] = await Promise.all([
        admin.from("shop_memberships").select("shop_id", { count: "exact", head: true }).eq("user_id", existingUser.id),
        admin.from("platform_admins").select("user_id").eq("user_id", existingUser.id).maybeSingle(),
      ]);
      if (membershipError) return fail(membershipError.message, 500);
      if (platformAdminError) return fail(platformAdminError.message, 500);
      if (platformAdmin || (membershipCount || 0) > 0) return fail("This email belongs to an active MediShop account. Use a different owner email or edit that account.", 409);
      const { data: recovered, error: recoveryError } = await admin.auth.admin.updateUserById(existingUser.id, {
        email: ownerEmail, password: ownerPassword, email_confirm: true, user_metadata: { ...existingUser.user_metadata, full_name: ownerName },
      });
      if (recoveryError || !recovered.user) return fail(recoveryError?.message || "Could not recover the previous owner account.", 409);
      ownerUser = recovered.user;
      createdOwnerNow = false;
      const { error: profileError } = await admin.from("profiles").upsert({ id: ownerUser.id, full_name: ownerName });
      if (profileError) return fail(profileError.message, 500);
    } catch (error: any) {
      return fail(error?.message || "Could not inspect the existing owner account.", 500);
    }
  }

  const rollbackOwner = async () => { if (createdOwnerNow && ownerUser) await admin.auth.admin.deleteUser(ownerUser.id); };
  const { data: shop, error: shopError } = await admin.from("shops").insert({
    name: pharmacyName, legal_name: input.legalName?.trim() || null,
    drug_license_number: input.drugLicense?.trim() || null, address: input.address?.trim() || null,
    subscription_plan: planCode, subscription_ends_at: endsAt.toISOString(),
    owner_onboarded_at: new Date().toISOString(),
  }).select("id,name").single();
  if (shopError || !shop) { await rollbackOwner(); return fail(shopError?.message || "Could not create the pharmacy."); }

  const setupResults = await Promise.all([
    admin.from("shop_settings").insert({ shop_id: shop.id }),
    admin.from("shop_memberships").insert({ shop_id: shop.id, user_id: ownerUser.id, role: "owner" }),
    admin.from("shop_subscriptions").insert({
      shop_id: shop.id, plan_code: planCode,
      billing_period: billingPeriod, status: billingPeriod === "trial" ? "trial" : "active",
      starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), created_by: caller.user.id,
    }),
  ]);
  const setupError = setupResults.find((result) => result.error)?.error;
  if (setupError) {
    await admin.from("shops").delete().eq("id", shop.id);
    await rollbackOwner();
    return fail(setupError.message || "Could not complete pharmacy onboarding.");
  }
  return Response.json({ shop, ownerId: ownerUser.id, recoveredOwner: !createdOwnerNow }, { status: 201 });
}

async function getAdminContext(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serverSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !serverSecretKey) return { error: fail("Server onboarding is not configured. Add SUPABASE_SECRET_KEY to the server environment.", 503) };
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: fail("Sign in again before managing pharmacies.", 401) };
  const callerClient = createClient(url, publishableKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: caller, error: callerError } = await callerClient.auth.getUser(token);
  if (callerError || !caller.user) return { error: fail("Your sign-in session is no longer valid.", 401) };
  const { data: isAdmin, error: adminError } = await callerClient.rpc("is_platform_admin");
  if (adminError || !isAdmin) return { error: fail("Only a MediShop platform administrator can manage pharmacies.", 403) };
  return {
    caller: caller.user,
    admin: createClient(url, serverSecretKey, { auth: { autoRefreshToken: false, persistSession: false } }),
  };
}

export async function GET(request: Request) {
  const context = await getAdminContext(request);
  if ("error" in context) return context.error;
  const { admin } = context;
  const [{ data: shops, error: shopsError }, { data: memberships, error: membershipsError }, { data: subscriptions }] = await Promise.all([
    admin.from("shops").select("id,name,legal_name,drug_license_number,address,status,subscription_plan,subscription_ends_at,created_at").order("created_at", { ascending: false }),
    admin.from("shop_memberships").select("shop_id,user_id,profiles(full_name)").eq("role", "owner").eq("is_active", true),
    admin.from("shop_subscriptions").select("shop_id,billing_period,created_at").order("created_at", { ascending: false }),
  ]);
  if (shopsError) return fail(shopsError.message, 500);
  if (membershipsError) return fail(membershipsError.message, 500);

  const ownerByShop = new Map((memberships || []).map((membership: any) => [membership.shop_id, membership]));
  const periodByShop = new Map<string, string>();
  (subscriptions || []).forEach((subscription: any) => {
    if (!periodByShop.has(subscription.shop_id)) periodByShop.set(subscription.shop_id, subscription.billing_period);
  });
  const rows = await Promise.all((shops || []).map(async (shop: any) => {
    const membership: any = ownerByShop.get(shop.id);
    const authResult = membership ? await admin.auth.admin.getUserById(membership.user_id) : null;
    const profile = Array.isArray(membership?.profiles) ? membership.profiles[0] : membership?.profiles;
    return {
      ...shop,
      owner_id: membership?.user_id || null,
      owner_name: profile?.full_name || authResult?.data.user?.user_metadata?.full_name || null,
      owner_email: authResult?.data.user?.email || null,
      billing_period: periodByShop.get(shop.id) || "custom",
    };
  }));
  return Response.json({ shops: rows });
}

export async function PATCH(request: Request) {
  const context = await getAdminContext(request);
  if ("error" in context) return context.error;
  const { admin, caller } = context;
  const input = await request.json() as UpdateShopInput;
  const shopId = input.shopId?.trim();
  const pharmacyName = input.pharmacyName?.trim();
  const ownerName = input.ownerName?.trim();
  const ownerEmail = input.ownerEmail?.trim().toLowerCase();
  if (!shopId || !pharmacyName || pharmacyName.length < 2) return fail("Enter a valid pharmacy name.");
  if (!ownerName || !ownerEmail || !/^\S+@\S+\.\S+$/.test(ownerEmail)) return fail("Enter a valid owner name and email.");
  if (input.ownerPassword && input.ownerPassword.length < 8) return fail("The new password must be at least 8 characters.");

  const { data: membership, error: membershipError } = await admin.from("shop_memberships")
    .select("user_id").eq("shop_id", shopId).eq("role", "owner").eq("is_active", true).limit(1).maybeSingle();
  if (membershipError) return fail(membershipError.message, 500);
  if (!membership) return fail("This pharmacy does not have an active owner account.", 404);

  const authAttributes: Record<string, unknown> = { email: ownerEmail, email_confirm: true, user_metadata: { full_name: ownerName } };
  if (input.ownerPassword) authAttributes.password = input.ownerPassword;
  const { error: authError } = await admin.auth.admin.updateUserById(membership.user_id, authAttributes);
  if (authError) return fail(authError.message, 409);

  const endsAt = input.subscriptionEndsAt ? new Date(input.subscriptionEndsAt) : null;
  if (endsAt && Number.isNaN(endsAt.getTime())) return fail("Enter a valid subscription end date.");
  const { error: shopError } = await admin.from("shops").update({
    name: pharmacyName,
    legal_name: input.legalName?.trim() || null,
    drug_license_number: input.drugLicense?.trim() || null,
    address: input.address?.trim() || null,
    ...(input.planCode?.trim() ? { subscription_plan: input.planCode.trim() } : {}),
    ...(endsAt ? { subscription_ends_at: endsAt.toISOString() } : {}),
  }).eq("id", shopId);
  if (shopError) return fail(shopError.message, 500);
  const { error: profileError } = await admin.from("profiles").update({ full_name: ownerName }).eq("id", membership.user_id);
  if (profileError) return fail(profileError.message, 500);

  if (endsAt && input.planCode?.trim()) {
    const billingPeriod = input.billingPeriod || "custom";
    const { error: subscriptionError } = await admin.from("shop_subscriptions").insert({
      shop_id: shopId,
      plan_code: input.planCode.trim(),
      billing_period: billingPeriod,
      starts_at: new Date().toISOString(),
      ends_at: endsAt.toISOString(),
      status: endsAt > new Date() ? (billingPeriod === "trial" ? "trial" : "active") : "expired",
      notes: "Subscription edited by Superadmin",
      created_by: caller.id,
    });
    if (subscriptionError) return fail(subscriptionError.message, 500);
  }
  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  const context = await getAdminContext(request);
  if ("error" in context) return context.error;
  const { admin } = context;
  const input = await request.json() as { shopId?: string };
  const shopId = input.shopId?.trim();
  if (!shopId) return fail("A medical shop ID is required.");

  const { data: memberships, error: membershipsError } = await admin.from("shop_memberships")
    .select("user_id").eq("shop_id", shopId);
  if (membershipsError) return fail(membershipsError.message, 500);

  const { data: deletedShop, error: deleteError } = await admin.from("shops")
    .delete().eq("id", shopId).select("id,name").maybeSingle();
  if (deleteError) return fail(deleteError.message, 500);
  if (!deletedShop) return fail("Medical shop was not found.", 404);

  const cleanupErrors: string[] = [];
  for (const membership of memberships || []) {
    const [{ count, error: countError }, { data: platformAdmin, error: platformAdminError }] = await Promise.all([
      admin.from("shop_memberships").select("shop_id", { count: "exact", head: true }).eq("user_id", membership.user_id),
      admin.from("platform_admins").select("user_id").eq("user_id", membership.user_id).maybeSingle(),
    ]);
    if (countError || platformAdminError) {
      cleanupErrors.push(countError?.message || platformAdminError?.message || "Could not verify an account.");
      continue;
    }
    if (!platformAdmin && (count || 0) === 0) {
      const { error } = await admin.auth.admin.deleteUser(membership.user_id);
      if (error) cleanupErrors.push(error.message);
    }
  }

  if (cleanupErrors.length) {
    return Response.json({
      error: "The shop was deleted, but one or more unused Auth accounts could not be removed.",
      shopDeleted: true,
      details: cleanupErrors,
    }, { status: 500 });
  }
  return Response.json({ success: true, deletedShop });
}
