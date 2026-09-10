-- ============================================================
-- Ask Arun — Initial Schema Migration
-- Phase 6A: Visitor conversation persistence tables only.
-- ai_memories is NOT stored in the database (file-based instead).
-- Phase 6B: Row Level Security policies
-- ============================================================

-- ── 1. visitor_sessions ─────────────────────────────────────────────────────
-- Stores opaque anonymous visitor session identifiers.
-- No PII: no IP address, no email, no username.
-- The UUID is generated server-side and stored in an HttpOnly cookie.

CREATE TABLE IF NOT EXISTS visitor_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL    DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL    DEFAULT now()
);

-- ── 2. conversations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_session_id  UUID        NOT NULL
                        REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  title               TEXT        NOT NULL    DEFAULT 'New Conversation',
  created_at          TIMESTAMPTZ NOT NULL    DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL    DEFAULT now()
);

-- ── 3. messages ─────────────────────────────────────────────────────────────
-- role is constrained to 'user' or 'assistant' only.
CREATE TABLE IF NOT EXISTS messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID        NOT NULL
                     REFERENCES conversations(id) ON DELETE CASCADE,
  role             TEXT        NOT NULL
                     CHECK (role IN ('user', 'assistant')),
  content          TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conversations_visitor_session_id
  ON conversations(visitor_session_id);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
  ON conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at
  ON messages(conversation_id, created_at ASC);

-- ── Triggers: auto-update updated_at ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Bump conversation.updated_at when a new message is inserted
CREATE OR REPLACE FUNCTION bump_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
     SET updated_at = now()
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_messages_bump_conversation
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION bump_conversation_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
-- All tables: RLS enabled, no anon/authenticated policies.
-- All server access uses service_role key (bypasses RLS entirely).
-- Visitor isolation is enforced in application code via verifyConversationOwnership().

ALTER TABLE visitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages         ENABLE ROW LEVEL SECURITY;

-- ── Comments ─────────────────────────────────────────────────────────────────
COMMENT ON TABLE visitor_sessions IS 'Anonymous visitor sessions. Zero PII. UUID stored in HttpOnly cookie.';
COMMENT ON TABLE conversations    IS 'Chat conversation threads owned by a visitor session.';
COMMENT ON TABLE messages         IS 'Individual chat messages. role in {user, assistant} only.';
