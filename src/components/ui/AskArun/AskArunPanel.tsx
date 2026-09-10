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
const MAX_SESSION_MESSAGES = 20;

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm Arun's portfolio assistant.\n\nAsk me about Arun's projects, cybersecurity journey, technical skills, resume, GitHub, or experience.",
  timestamp: Date.now(),
  status: "complete",
};

/* ── Session storage helpers ─────────────────────────────────────────────── */

function loadHistory(): ChatMessage[] {
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

function saveHistory(messages: ChatMessage[]) {
  try {
    // Only persist complete user/assistant messages (no errors, no welcome)
    const toSave = messages
      .filter((m) => m.id !== "welcome" && m.status === "complete")
      .slice(-MAX_SESSION_MESSAGES);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(toSave));
  } catch {
    // sessionStorage may be unavailable (private mode, quota exceeded) — ignore
  }
}

function clearHistory() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

/* ── API call ────────────────────────────────────────────────────────────── */

interface APIPayload {
  message: string;
  /** Only user/assistant messages — no secrets, no system prompts. */
  history: Array<{ role: "user" | "assistant"; content: string }>;
}

const SESSION_ID_KEY = "ask-arun-session-id";

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

async function callChatAPI(payload: APIPayload): Promise<string> {
  const sessionId = getOrCreateSessionId();
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-id": sessionId,
    },
    body: JSON.stringify(payload),
    // Prevent fetch from retrying automatically
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 429) {
    throw new RateLimitError("You're sending messages too quickly. Please wait a moment.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Request failed.");
  }

  const data = await res.json() as { answer: string };
  return data.answer;
}

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

/* ── Component ─────────────────────────────────────────────────────────── */

interface AskArunPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AskArunPanel({ isOpen, onClose }: AskArunPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // On first mount: restore session history if available
    const history = loadHistory();
    return history.length > 0
      ? [WELCOME_MESSAGE, ...history]
      : [WELCOME_MESSAGE];
  });
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const headingId = `${panelId}-heading`;

  const hasUserMessage = messages.some((m) => m.role === "user");

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

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
        saveHistory(next);
        return next;
      });
      setIsSending(true);

      try {
        // Build sanitised history for the API — only user/assistant, no welcome msg
        const historyForAPI = messages
          .filter((m) => m.id !== "welcome" && m.status === "complete")
          .map((m) => ({ role: m.role, content: m.content }));

        const answer = await callChatAPI({
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
          saveHistory(next);
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

        // Add error message to chat
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
    clearHistory();
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
              {!hasUserMessage && (
                <QuickPrompts onSelect={(p) => sendMessage(p)} />
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
              disabled={isSending}
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
