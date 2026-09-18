import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request) {
  const pathname = request.nextUrl.pathname;

  // Superadmin API routes authenticate their Bearer token inside each handler.
  // Let them return JSON 401/403 responses instead of redirecting fetch calls
  // to an HTML login page.
  const publicRoutes = ["/login", "/login/superadmin", "/api/auth", "/api/superadmin", "/offline"];
  const publicFiles = [
    "/sw.js",
    "/manifest.json",
    "/favicon.ico",
    "/icon.svg",
    "/apple-icon.png",
    "/icon-192x192.png",
    "/icon-512x512.png",
    "/icon-light-32x32.png",
    "/icon-dark-32x32.png",
  ];

  const isPublicRoute =
    pathname === "/" ||
    publicRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
  const isPublicFile = publicFiles.includes(pathname);

  if (isPublicRoute || isPublicFile) {
    const response = NextResponse.next();
    // Apply security headers to all responses
    addSecurityHeaders(response);
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("error", "configuration");
    const response = NextResponse.redirect(redirectUrl);
    addSecurityHeaders(response);
    return response;
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) =>
      redirectResponse.cookies.set(cookie),
    );
    addSecurityHeaders(redirectResponse);
    return redirectResponse;
  }

  addSecurityHeaders(supabaseResponse);
  return supabaseResponse;
}

function addSecurityHeaders(response) {
  // Security Headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy (CSP)
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://vitals.vercel-insights.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self';",
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon|manifest.json|sw.js).*)",
  ],
};
