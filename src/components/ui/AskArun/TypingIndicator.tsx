"use client";

/**
 * TypingIndicator — three animated dots shown while AI is generating a response.
 * Respects prefers-reduced-motion: dots are static when motion is reduced.
 */
export function TypingIndicator() {
  return (
    <div
      className="ask-arun-typing"
      role="status"
      aria-label="AI is thinking"
      aria-live="polite"
    >
      <span className="ask-arun-typing-dot" style={{ animationDelay: "0ms" }} />
      <span className="ask-arun-typing-dot" style={{ animationDelay: "160ms" }} />
      <span className="ask-arun-typing-dot" style={{ animationDelay: "320ms" }} />
    </div>
  );
}
