import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const runtime = "nodejs";

// Handles Supabase Email Magic Link callback.
// Supabase redirects here after the user clicks the magic link in their email.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    const params = new URLSearchParams({ error, error_description: errorDescription ?? "" });
    return NextResponse.redirect(`${origin}/login?${params.toString()}`);
  }

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      const params = new URLSearchParams({ error: "exchange_failed", error_description: exchangeError.message });
      return NextResponse.redirect(`${origin}/login?${params.toString()}`);
    }

    return response;
  }

  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
