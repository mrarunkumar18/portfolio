/**
 * GET /api/conversations
 *
 * Returns the recent conversation history for the current visitor session,
 * so the client can restore chat history after a page refresh.
 *
 * Security:
 *  - Session is resolved from the HttpOnly ask_arun_sid cookie (server-side).
 *  - No data is returned if the session cookie is absent or invalid.
 *  - Only messages belonging to this visitor's session are returned.
 *  - service_role key is server-only; never exposed to the client.
 *  - No PII is collected.
 *  - Supabase is optional: if not configured, returns empty history gracefully.
 */

import { NextResponse } from "next/server";
import { resolveVisitorSession } from "@/lib/visitor-session";
import {
  getOrCreateConversation,
  getRecentMessages,
  verifyOwnership,
} from "@/lib/supabase/persistence";

const MAX_RESTORE_MESSAGES = parseInt(
  process.env.AI_MAX_HISTORY_MESSAGES ?? "20",
  10
);

/** Whether Supabase credentials are configured. */
const isSupabaseConfigured = Boolean(
  (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  if (!isSupabaseConfigured) {
    // Supabase not configured — return empty (dev without credentials)
    return NextResponse.json(
      { messages: [], conversationId: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  // ── 1. Resolve visitor session from cookie ─────────────────────────────
  let sessionResult;
  try {
    sessionResult = await resolveVisitorSession();
  } catch {
    return NextResponse.json(
      { messages: [], conversationId: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (sessionResult.dbError || !sessionResult.session) {
    // No session yet — return empty (client will create one on first message)
    return NextResponse.json(
      { messages: [], conversationId: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const sessionId = sessionResult.session.id;

  // ── 2. Get the most recent conversation for this session ───────────────
  const convResult = await getOrCreateConversation(sessionId);

  if (convResult.error || !convResult.data) {
    return NextResponse.json(
      { messages: [], conversationId: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const conversationId = convResult.data.id;

  // ── 3. Verify ownership (belt-and-suspenders; service_role bypasses RLS) ─
  const owned = await verifyOwnership(conversationId, sessionId);
  if (!owned) {
    return NextResponse.json(
      { messages: [], conversationId: null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  // ── 4. Fetch recent messages ───────────────────────────────────────────
  const msgResult = await getRecentMessages(conversationId, MAX_RESTORE_MESSAGES);

  if (msgResult.error || !msgResult.data) {
    return NextResponse.json(
      { messages: [], conversationId },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const messages = msgResult.data.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: new Date(m.created_at).getTime(),
    status: "complete" as const,
  }));

  // ── 5. Build response with refreshed session cookie ────────────────────
  const responseHeaders: Record<string, string> = {
    "Cache-Control": "no-store",
  };
  if (sessionResult.setCookieHeader) {
    responseHeaders["Set-Cookie"] = sessionResult.setCookieHeader;
  }

  return NextResponse.json(
    { messages, conversationId },
    { status: 200, headers: responseHeaders }
  );
}

export async function POST() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
