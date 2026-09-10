/**
 * src/lib/supabase/client.ts
 *
 * Browser-side Supabase client (Phase 6C).
 * Used only in Client Components for Supabase Auth UI flows.
 * Database queries that touch visitor data MUST go through server-side
 * API routes — never call supabase.from() on visitor tables from the browser.
 */

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "[Supabase] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set."
    );
  }

  return createBrowserClient(url, key);
}
