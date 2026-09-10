"use client";

const QUICK_PROMPTS = [
  "What cybersecurity projects has Arun built?",
  "What are Arun's strongest technical skills?",
  "Why would Arun be a good cybersecurity intern?",
  "Show me Arun's most relevant projects.",
];

interface QuickPromptsProps {
  onSelect: (prompt: string) => void;
}

/**
 * Clickable quick-prompt chips shown before the first message is sent.
 * Each chip submits the prompt text directly into the chat.
 */
export function QuickPrompts({ onSelect }: QuickPromptsProps) {
  return (
    <div className="ask-arun-quick-prompts" role="list" aria-label="Quick question suggestions">
      {QUICK_PROMPTS.map((prompt) => (
        <button
          key={prompt}
          role="listitem"
          className="ask-arun-quick-prompt-btn"
          onClick={() => onSelect(prompt)}
          type="button"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
