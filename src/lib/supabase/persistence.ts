/**
 * src/lib/supabase/persistence.ts
 *
 * Server-only persistence layer for Ask Arun visitor conversation data.
 *
 * Architecture:
 *   visitor_sessions → conversations → messages
 *
 * All database access uses the service_role key via createSupabaseAdminClient().
 * RLS is enabled on all tables but intentionally has no public policies.
 * Ownership verification (session ↔ conversation) is enforced in application
 * code because service_role bypasses RLS.
 *
 * NEVER import this file in Client Components.
 * NEVER create an ai_memories table or move arun-memory.md to Supabase.
 */

import { createSupabaseAdminClient } from "./admin";

/* ── Types ────────────────────────────────────────────────────────────────── */

export interface PersistenceResult<T> {
  data: T | null;
  error: string | null;
}

export interface ConversationRow {
  id: string;
  visitor_session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

/* ── UUID validation ──────────────────────────────────────────────────────── */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/* ── Session helpers ─────────────────────────────────────────────────────── */

/**
 * Ensures a visitor_session row exists for the given UUID.
 * Refreshes last_seen_at on each call (fire-and-forget).
 *
 * @returns The session id, or null on DB error.
 */
export async function ensureVisitorSession(
  sessionId: string
): Promise<PersistenceResult<string>> {
  if (!isValidUUID(sessionId)) {
    return { data: null, error: "Invalid session ID format." };
  }

  const supabase = createSupabaseAdminClient();

  // Try to find an existing session
  const { data: existing, error: fetchError } = await supabase
    .from("visitor_sessions")
    .select("id")
    .eq("id", sessionId)
    .maybeSingle();

  if (fetchError) {
    console.error("[Persistence] ensureVisitorSession fetch error:", fetchError.message);
    return { data: null, error: fetchError.message };
  }

  if (existing) {
    // Refresh last_seen_at (fire-and-forget)
    void supabase
      .from("visitor_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", sessionId);

    return { data: sessionId, error: null };
  }

  // Create a new session with the provided UUID
  const { data: created, error: insertError } = await supabase
    .from("visitor_sessions")
    .insert({ id: sessionId })
    .select("id")
    .single();

  if (insertError || !created) {
    console.error("[Persistence] ensureVisitorSession insert error:", insertError?.message);
    return { data: null, error: insertError?.message ?? "Failed to create session." };
  }

  return { data: created.id as string, error: null };
}

/* ── Conversation helpers ────────────────────────────────────────────────── */

/**
 * Finds the most recent conversation for a visitor session,
 * or creates a new one.
 *
 * @param sessionId  The visitor_sessions.id UUID.
 * @param title      Title for a newly created conversation (optional).
 */
export async function getOrCreateConversation(
  sessionId: string,
  title = "Ask Arun Chat"
): Promise<PersistenceResult<ConversationRow>> {
  if (!isValidUUID(sessionId)) {
    return { data: null, error: "Invalid session ID format." };
  }

  const supabase = createSupabaseAdminClient();

  // Look for the most recent conversation for this session
  const { data: existing, error: fetchError } = await supabase
    .from("conversations")
    .select("*")
    .eq("visitor_session_id", sessionId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error("[Persistence] getOrCreateConversation fetch error:", fetchError.message);
    return { data: null, error: fetchError.message };
  }

  if (existing) {
    return { data: existing as ConversationRow, error: null };
  }

  // Create a new conversation
  const { data: created, error: insertError } = await supabase
    .from("conversations")
    .insert({ visitor_session_id: sessionId, title })
    .select("*")
    .single();

  if (insertError || !created) {
    console.error("[Persistence] getOrCreateConversation insert error:", insertError?.message);
    return { data: null, error: insertError?.message ?? "Failed to create conversation." };
  }

  return { data: created as ConversationRow, error: null };
}

/**
 * Verifies that a conversation belongs to the given visitor session.
 * MUST be called before any read/write when using service_role (bypasses RLS).
 */
export async function verifyOwnership(
  conversationId: string,
  sessionId: string
): Promise<boolean> {
  if (!isValidUUID(conversationId) || !isValidUUID(sessionId)) {
    return false;
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("conversations")
    .select("visitor_session_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !data) return false;

  return (data.visitor_session_id as string) === sessionId;
}

/* ── Message helpers ─────────────────────────────────────────────────────── */

/**
 * Persists a single message (user or assistant) to the database.
 */
export async function persistMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string
): Promise<PersistenceResult<MessageRow>> {
  if (!isValidUUID(conversationId)) {
    return { data: null, error: "Invalid conversation ID format." };
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, role, content })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[Persistence] persistMessage error:", error?.message);
    return { data: null, error: error?.message ?? "Failed to persist message." };
  }

  return { data: data as MessageRow, error: null };
}

/**
 * Retrieves recent messages for a conversation, ordered oldest-first.
 * Capped at `limit` messages to avoid context-window overflow.
 *
 * @param conversationId  The conversation UUID (already ownership-verified).
 * @param limit           Maximum number of messages to return (default: 20).
 */
export async function getRecentMessages(
  conversationId: string,
  limit = 20
): Promise<PersistenceResult<MessageRow[]>> {
  if (!isValidUUID(conversationId)) {
    return { data: null, error: "Invalid conversation ID format." };
  }

  const supabase = createSupabaseAdminClient();

  // Fetch the most recent `limit` messages, then reverse to get oldest-first order
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Persistence] getRecentMessages error:", error.message);
    return { data: null, error: error.message };
  }

  // Reverse so the AI sees oldest → newest (natural conversation order)
  const ordered = ((data ?? []) as MessageRow[]).reverse();

  return { data: ordered, error: null };
}

/**
 * Updates the conversation title based on the first user message.
 * Fire-and-forget — never awaited on the critical path.
 */
export function setConversationTitle(
  conversationId: string,
  firstUserMessage: string
): void {
  if (!isValidUUID(conversationId)) return;

  // Derive a short title from the first user message
  const title = firstUserMessage.trim().slice(0, 60).replace(/\s+/g, " ");
  if (!title) return;

  const supabase = createSupabaseAdminClient();
  void supabase
    .from("conversations")
    .update({ title })
    .eq("id", conversationId);
}
