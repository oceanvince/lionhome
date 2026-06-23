import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

export type ServerClient = ReturnType<typeof createServerClient<Database>>;

interface CookieToSet {
  name: string;
  value: string;
  options?: CookieOptions;
}

/**
 * Server-side Supabase client bound to the current request's cookies.
 * Use this in Server Components, Route Handlers, and Server Actions.
 */
export async function getSupabaseServerClient(): Promise<ServerClient> {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot mutate cookies; safe to ignore here.
        }
      },
    },
  });
}

/**
 * Service-role client for trusted server-side operations only.
 * NEVER expose this client to the browser.
 */
export function getSupabaseServiceRoleClient(): ServerClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createServerClient<Database>(url, serviceKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // no-op for service-role
      },
    },
  });
}
