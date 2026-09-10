"use client";

import { useState, useEffect, useRef, useCallback, useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChatMessage as ChatMessageComponent } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { QuickPrompts } from "./QuickPrompts";
import { TypingIndicator } from "./TypingIndicator";
import { type ChatMessage } from "./types";

/* ── Constants ─────────────────────────────────────────────────────────── */

const SESSION_KEY = "ask-arun-history";
const SESSION_ID_KEY = "ask-arun-session-id";
const MAX_SESSION_MESSAGES = 20;

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm Arun's portfolio assistant.\n\nAsk me about Arun's projects, cybersecurity journey, technical skills, resume, GitHub, or experience.",
  timestamp: Date.now(),
  status: "complete",
};

/* ── Session storage helpers (UX cache — fast restore on reopen) ──────── */

function loadCachedHistory(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ChatMessage[];
  } catch {
    return [];
  }
}

function saveCachedHistory(messages: ChatMessage[]) {
  try {
    const toSave = messages
      .filter((m) => m.id !== "welcome" && m.status === "complete")
      .slice(-MAX_SESSION_MESSAGES);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(toSave));
  } catch {
    // sessionStorage may be unavailable (private mode, quota exceeded) — ignore
  }
}

function clearCachedHistory() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_ID_KEY);
  } catch {
    // ignore
  }
}

/* ── Session ID (auxiliary rate-limit key, not for auth) ─────────────── */

function getOrCreateSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

/* ── API types ───────────────────────────────────────────────────────────── */

interface APIPayload {
  message: string;
  /** Only user/assistant messages — no secrets, no system prompts. */
  history: Array<{ role: "user" | "assistant"; content: string }>;
}

interface ConversationsResponse {
  messages: ChatMessage[];
  conversationId: string | null;
}

/* ── API calls ───────────────────────────────────────────────────────────── */

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

async function fetchHistory(): Promise<ConversationsResponse> {
  try {
    const res = await fetch("/api/conversations", {
      method: "GET",
      credentials: "include", // send ask_arun_sid cookie
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) return { messages: [], conversationId: null };

    const data = await res.json() as ConversationsResponse;
    return data;
  } catch {
    return { messages: [], conversationId: null };
  }
}

async function callChatAPI(payload: APIPayload): Promise<{ answer: string; conversationId: string | null }> {
  const sessionId = getOrCreateSessionId();
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-id": sessionId,
    },
    credentials: "include", // send ask_arun_sid cookie
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(35_000),
  });

  if (res.status === 429) {
    throw new RateLimitError("You're sending messages too quickly. Please wait a moment.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Request failed.");
  }

  const data = await res.json() as { answer: string; conversationId?: string | null };
  return { answer: data.answer, conversationId: data.conversationId ?? null };
}

/* ── Component ─────────────────────────────────────────────────────────── */

interface AskArunPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AskArunPanel({ isOpen, onClose }: AskArunPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Fast initial render: use sessionStorage cache if available
    const cached = loadCachedHistory();
    return cached.length > 0 ? [WELCOME_MESSAGE, ...cached] : [WELCOME_MESSAGE];
  });
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const headingId = `${panelId}-heading`;
  const hasRestoredRef = useRef(false);

  const hasUserMessage = messages.some((m) => m.role === "user");

  // ── Restore Supabase history on first open ─────────────────────────────
  useEffect(() => {
    if (!isOpen || hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    setIsRestoring(true);
    fetchHistory()
      .then(({ messages: dbMessages }) => {
        if (dbMessages.length > 0) {
          // Supabase history available — replace sessionStorage cache
          setMessages([WELCOME_MESSAGE, ...dbMessages]);
          saveCachedHistory(dbMessages);
        }
        // If no DB history, keep the sessionStorage-seeded state
      })
      .catch(() => {
        // Silently fall back to sessionStorage cache
      })
      .finally(() => {
        setIsRestoring(false);
      });
  }, [isOpen]);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, isRestoring]);

  // Escape key closes panel
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Clear error banner automatically
  useEffect(() => {
    if (!errorBanner) return;
    const t = setTimeout(() => setErrorBanner(null), 6000);
    return () => clearTimeout(t);
  }, [errorBanner]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      setErrorBanner(null);

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
        status: "complete",
      };

      setMessages((prev) => {
        const next = [...prev, userMsg];
        saveCachedHistory(next);
        return next;
      });
      setIsSending(true);

      try {
        // Build client history snapshot for the API.
        // The server prefers DB history; this is a fallback if DB is unavailable.
        const historyForAPI = messages
          .filter((m) => m.id !== "welcome" && m.status === "complete")
          .map((m) => ({ role: m.role, content: m.content }));

        const { answer } = await callChatAPI({
          message: trimmed,
          history: historyForAPI,
        });

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: answer,
          timestamp: Date.now(),
          status: "complete",
        };

        setMessages((prev) => {
          const next = [...prev, assistantMsg];
          saveCachedHistory(next);
          return next;
        });
      } catch (err) {
        const msg =
          err instanceof RateLimitError
            ? err.message
            : err instanceof Error && err.name === "TimeoutError"
            ? "The response took too long. Please try again."
            : "I'm having trouble right now. Please try again in a moment.";

        setErrorBanner(msg);

        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: msg,
          timestamp: Date.now(),
          status: "error",
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsSending(false);
      }
    },
    [isSending, messages]
  );

  const handleNewChat = useCallback(() => {
    clearCachedHistory();
    hasRestoredRef.current = false; // allow re-restore if the panel is reopened
    setMessages([WELCOME_MESSAGE]);
    setInputValue("");
    setErrorBanner(null);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop (mobile only) */}
          <motion.div
            key="backdrop"
            className="ask-arun-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="panel"
            className="ask-arun-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Header */}
            <div className="ask-arun-header">
              <div className="ask-arun-header-identity">
                <SparkIcon size={18} />
                <div>
                  <h2 id={headingId} className="ask-arun-title">
                    Ask Arun
                  </h2>
                  <p className="ask-arun-subtitle">AI portfolio assistant</p>
                </div>
              </div>
              <div className="ask-arun-header-actions">
                <button
                  className="ask-arun-icon-btn"
                  onClick={handleNewChat}
                  title="New chat"
                  aria-label="Start a new chat"
                  type="button"
                >
                  <NewChatIcon />
                </button>
                <button
                  className="ask-arun-icon-btn"
                  onClick={onClose}
                  aria-label="Close Ask Arun AI assistant"
                  type="button"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              className="ask-arun-messages"
              role="log"
              aria-live="polite"
              aria-label="Conversation"
            >
              {messages.map((msg) => (
                <ChatMessageComponent key={msg.id} message={msg} />
              ))}

              {/* Quick prompts — before first user message */}
              {!hasUserMessage && !isRestoring && (
                <QuickPrompts onSelect={(p) => sendMessage(p)} />
              )}

              {/* Restoring indicator */}
              {isRestoring && (
                <div className="ask-arun-msg-row ask-arun-msg-row--assistant">
                  <div className="ask-arun-avatar" aria-hidden="true">
                    <SparkIcon size={14} />
                  </div>
                  <div className="ask-arun-bubble ask-arun-bubble--assistant">
                    <TypingIndicator />
                  </div>
                </div>
              )}

              {/* Typing indicator */}
              {isSending && (
                <div className="ask-arun-msg-row ask-arun-msg-row--assistant">
                  <div className="ask-arun-avatar" aria-hidden="true">
                    <SparkIcon size={14} />
                  </div>
                  <div className="ask-arun-bubble ask-arun-bubble--assistant">
                    <TypingIndicator />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <ChatInput
              value={inputValue}
              onChange={setInputValue}
              onSend={sendMessage}
              disabled={isSending || isRestoring}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Icons ──────────────────────────────────────────────────────────────── */

function SparkIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M8 1L9.5 6.5L15 8L9.5 9.5L8 15L6.5 9.5L1 8L6.5 6.5L8 1Z"
        fill="var(--accent-primary)"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 3L13 13M13 3L3 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NewChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 3V13M3 8H13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
