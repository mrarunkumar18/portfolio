/**
 * src/lib/supabase/admin.ts
 *
 * Server-only Supabase client using the service_role key.
 * Bypasses Row Level Security entirely — use only in server-side API routes.
 *
 * NEVER import in Client Components. SUPABASE_SERVICE_ROLE_KEY must NOT
 * be prefixed with NEXT_PUBLIC_.
 *
 * URL resolution order:
 *   1. SUPABASE_URL         (server-only, preferred — not in any client bundle)
 *   2. NEXT_PUBLIC_SUPABASE_URL  (fallback for backward compatibility)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let _adminClient: SupabaseClient<Database> | null = null;

export function createSupabaseAdminClient(): SupabaseClient<Database> {
  if (_adminClient) return _adminClient;

  // Prefer the server-only alias; fall back to the public one (URL is not a secret).
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "[Supabase] SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and " +
        "SUPABASE_SERVICE_ROLE_KEY must be set for admin operations."
    );
  }

  _adminClient = createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return _adminClient;
}
