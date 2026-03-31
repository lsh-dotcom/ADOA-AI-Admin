import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Untyped Supabase client for API routes.
 * Avoids strict type inference issues with complex queries.
 */
export function createAdminClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component - ignored with middleware
          }
        },
      },
    }
  );
}
