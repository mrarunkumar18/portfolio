/**
 * src/lib/visitor-session.ts
 *
 * Anonymous visitor session engine (Phase 6C).
 *
 * Identity model:
 *   - Each visitor gets a UUID stored in an HttpOnly, Secure, SameSite=Strict
 *     cookie named "ask_arun_sid".
 *   - The UUID is opaque: zero PII (no IP, no email, no fingerprint).
 *   - The UUID is ONLY used to associate conversations with a session.
 *   - It is NOT used for authentication, privilege, or rate-limiting.
 *
 * Security properties:
 *   - HttpOnly: JS cannot read the cookie (XSS protection).
 *   - Secure: only sent over HTTPS in production.
 *   - SameSite=Strict: CSRF protection.
 *   - Path=/api: cookie only sent to API routes, not page navigations.
 *   - Max-Age: 30 days rolling window (refreshed on each request).
 *
 * Ownership verification:
 *   - Every conversation API call verifies that the conversation''s
 *     visitor_session_id matches the resolved session UUID.
 *   - This check happens in application code (not RLS), because service_role
 *     bypasses RLS. The check MUST NOT be omitted.
 */

import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/* ── Constants ─────────────────────────────────────────────────────────────── */

const COOKIE_NAME = "ask_arun_sid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* ── Types ──────────────────────────────────────────────────────────────────── */

export interface VisitorSession {
  /** The visitor_sessions.id UUID. */
  id: string;
  /** Whether this session was freshly created (vs. existing). */
  isNew: boolean;
}

export interface SessionResolutionResult {
  session: VisitorSession | null;
  /** Set-Cookie header value to include in the response. */
  setCookieHeader: string | null;
  /** True if Supabase was unavailable. Callers should return 503. */
  dbError: boolean;
}

/* ── Public API ─────────────────────────────────────────────────────────────── */

/**
 * Resolves or creates an anonymous visitor session from the request cookies.
 *
 * Call this at the start of every /api/conversations and /api/chat route.
 * Include the returned setCookieHeader in the response if non-null.
 *
 * @returns SessionResolutionResult
 */
export async function resolveVisitorSession(): Promise<SessionResolutionResult> {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(COOKIE_NAME)?.value ?? null;

  // Validate UUID format to prevent injection / path traversal
  const existingId =
    rawCookie && UUID_REGEX.test(rawCookie) ? rawCookie : null;

  const supabase = createSupabaseAdminClient();

  try {
    if (existingId) {
      // ── Try to fetch existing session ─────────────────────────────────────
      const { data: row, error } = await supabase
        .from("visitor_sessions")
        .select("id")
        .eq("id", existingId)
        .maybeSingle();

      if (error) {
        console.error("[VisitorSession] DB error fetching session:", error.message);
        return { session: null, setCookieHeader: null, dbError: true };
      }

      if (row) {
        // Refresh last_seen_at (fire-and-forget — don't await to save latency)
        void supabase
          .from("visitor_sessions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", existingId);

        return {
          session: { id: row.id as string, isNew: false },
          setCookieHeader: buildCookieHeader(existingId),
          dbError: false,
        };
      }
      // Session UUID not found in DB — treat as new (may have been purged)
    }

    // ── Create new session ─────────────────────────────────────────────────
    const { data: newRow, error: insertError } = await supabase
      .from("visitor_sessions")
      .insert({})
      .select("id")
      .single();

    if (insertError || !newRow) {
      console.error(
        "[VisitorSession] DB error creating session:",
        insertError?.message ?? "no row returned"
      );
      return { session: null, setCookieHeader: null, dbError: true };
    }

    const newId = newRow.id as string;
    return {
      session: { id: newId, isNew: true },
      setCookieHeader: buildCookieHeader(newId),
      dbError: false,
    };
  } catch (err) {
    console.error("[VisitorSession] Unexpected error:", err instanceof Error ? err.message : err);
    return { session: null, setCookieHeader: null, dbError: true };
  }
}

/**
 * Verifies that a conversation belongs to the given visitor session.
 * MUST be called before any conversation read/write in application code
 * because service_role bypasses RLS.
 *
 * @returns true if ownership is confirmed, false if not found or mismatch.
 */
export async function verifyConversationOwnership(
  conversationId: string,
  visitorSessionId: string
): Promise<boolean> {
  if (!UUID_REGEX.test(conversationId) || !UUID_REGEX.test(visitorSessionId)) {
    return false;
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("conversations")
    .select("visitor_session_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !data) return false;

  return (data.visitor_session_id as string) === visitorSessionId;
}

/* ── Private helpers ────────────────────────────────────────────────────────── */

function buildCookieHeader(sessionId: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=${sessionId}`,
    `Path=/api`,
    `Max-Age=${COOKIE_MAX_AGE}`,
    `SameSite=Strict`,
    `HttpOnly`,
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}
