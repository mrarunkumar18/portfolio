"use client";

import { useRef, useCallback } from "react";

const MAX_LENGTH = 1500;

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Textarea + send button for composing messages.
 *
 * - Enter key sends the message
 * - Shift+Enter inserts a newline
 * - Empty or whitespace-only messages are rejected
 * - Messages over MAX_LENGTH are blocked
 */
export function ChatInput({ onSend, disabled = false, value, onChange }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    if (trimmed.length > MAX_LENGTH) return;
    onSend(trimmed);
    onChange("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      // Auto-grow textarea
      const ta = e.target;
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    },
    [onChange]
  );

  const overLimit = value.length > MAX_LENGTH;
  const canSend = value.trim().length > 0 && !disabled && !overLimit;

  return (
    <div className="ask-arun-input-area">
      <div className={`ask-arun-input-wrapper${overLimit ? " ask-arun-input-wrapper--error" : ""}`}>
        <textarea
          ref={textareaRef}
          className="ask-arun-textarea"
          placeholder="Ask something about Arun..."
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          maxLength={MAX_LENGTH + 50} // allow slight overrun so user sees counter
          aria-label="Type your message"
          aria-describedby="ask-arun-char-count"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          className="ask-arun-send-btn"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          type="button"
        >
          <SendIcon />
        </button>
      </div>
      {/* Character counter — only visible near limit */}
      {value.length > MAX_LENGTH * 0.8 && (
        <p
          id="ask-arun-char-count"
          className={`ask-arun-char-count${overLimit ? " ask-arun-char-count--error" : ""}`}
          aria-live="polite"
        >
          {value.length}/{MAX_LENGTH}
        </p>
      )}
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M14.5 8L2 2L5 8L2 14L14.5 8Z"
        fill="currentColor"
        strokeLinejoin="round"
      />
    </svg>
  );
}
