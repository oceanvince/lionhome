import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Lightweight access log: client IP + geo. Vercel injects these headers at the
  // edge; locally they're absent (ip = "unknown"). NOTE: client IP is personal
  // data (PDPA/GDPR) — this is for ops/traffic analysis, keep retention short.
  // Skip RSC prefetches to avoid double-logging a single navigation.
  if (!request.nextUrl.searchParams.has("_rsc")) {
    const ip =
      request.headers.get("x-vercel-forwarded-for") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    console.log(
      JSON.stringify({
        tag: "access",
        ip,
        country: request.headers.get("x-vercel-ip-country") ?? "",
        city: request.headers.get("x-vercel-ip-city") ?? "",
        method: request.method,
        path: request.nextUrl.pathname,
      })
    );
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session so it doesn't expire on the client
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
