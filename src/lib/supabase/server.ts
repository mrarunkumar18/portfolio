/**
 * src/lib/supabase/server.ts
 *
 * Server-side Supabase client using the anon key + cookie-based session (Phase 6C).
 * Used in Server Components, Route Handlers, and Server Actions where you need
 * to act ON BEHALF of the authenticated admin user (e.g. admin dashboard reads).
 *
 * For privileged backend tasks (reading visitor data, inserting messages, reading
 * ai_memories in the chat API), use createSupabaseAdminClient() from admin.ts
 * instead — it uses the service_role key and bypasses RLS entirely.
 *
 * IMPORTANT: Must be called inside a Next.js Server Component / Route Handler
 * where `cookies()` from next/headers is available.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "[Supabase] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll called from a Server Component — cookies cannot be set.
          // This is expected if middleware handles session refresh.
        }
      },
    },
  });
}
