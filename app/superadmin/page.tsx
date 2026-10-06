import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SuperAdminDashboard from "@/app/super-admin/page";

export const dynamic = "force-dynamic";

export default async function SuperadminRoute() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) redirect("/login?error=configuration");

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write refreshed cookies; route admission remains fail-closed.
        }
      },
    },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) redirect("/login");
  const { data: isPlatformAdmin, error: roleError } = await supabase.rpc("is_platform_admin");
  if (roleError || !isPlatformAdmin) redirect("/dashboard");

  return <SuperAdminDashboard />;
}
