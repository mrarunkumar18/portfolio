"use client";

import React from "react";
import { type ChatMessage as ChatMessageType } from "./types";

interface ChatMessageProps {
  message: ChatMessageType;
}

/**
 * Renders a single chat message with comprehensive output security.
 *
 * Security guarantees:
 * - NO dangerouslySetInnerHTML anywhere.
 * - Raw HTML tags (<script>, <iframe>, <form>, etc.) are stripped or rendered harmlessly.
 * - Markdown links are strictly URL-scheme validated (https, http, mailto only).
 * - javascript:, data:, vbscript:, and file: schemes are completely neutralised.
 * - External links enforce target="_blank" and rel="noopener noreferrer".
 */
export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="ask-arun-msg-row ask-arun-msg-row--user">
        <div className="ask-arun-bubble ask-arun-bubble--user">
          <p className="ask-arun-msg-text">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ask-arun-msg-row ask-arun-msg-row--assistant">
      <div className="ask-arun-avatar" aria-hidden="true">
        <SparkIcon />
      </div>
      <div className="ask-arun-bubble ask-arun-bubble--assistant">
        <SafeMarkdown content={message.content} />
        {message.status === "error" && (
          <p className="ask-arun-msg-error">
            Something went wrong. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Safe Markdown Renderer ─────────────────────────────────────────────── */

/**
 * Strips dangerous raw HTML tags completely before rendering.
 */
function sanitizeRawHtml(text: string): string {
  return text
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, "")
    .replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, "")
    .replace(/<\s*(form|input|button|object|embed|applet|meta|link)[^>]*>/gi, "");
}

/**
 * Validates and sanitizes link targets.
 * Strict whitelist: https:, http:, mailto: only.
 * Explicitly rejects javascript:, data:, vbscript:, file:, etc.
 */
function sanitizeUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  // Quick pre-check for dangerous protocols
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (["https:", "http:", "mailto:"].includes(parsed.protocol.toLowerCase())) {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Renders AI text with minimal, strictly-safe formatting.
 * Supports:
 * - Fenced code blocks
 * - Bullet lists (* or -)
 * - Numbered lists (1., 2.)
 * - Bold text (**text**)
 * - Inline code (`text`)
 * - Safe markdown links ([title](https://...))
 */
function SafeMarkdown({ content }: { content: string }) {
  const cleaned = sanitizeRawHtml(content);
  const lines = cleaned.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={`code-${i}`} className="ask-arun-code-block">
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      i++;
      continue;
    }

    // Unordered list item
    if (line.match(/^[-*•] /)) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*•] /)) {
        listItems.push(lines[i].replace(/^[-*•] /, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="ask-arun-list">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list item (1. item)
    if (line.match(/^\d+\.\s+/)) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        listItems.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="ask-arun-list ask-arun-list--ordered">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line (paragraph break)
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${i}`} className="ask-arun-msg-text">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <>{elements}</>;
}

/**
 * Renders inline markdown securely.
 */
function renderInline(text: string): React.ReactNode[] {
  // Split on bold (**text**), inline code (`text`), and markdown links [text](url)
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);

  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={idx} className="ask-arun-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    // Markdown link [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const linkText = linkMatch[1];
      const href = sanitizeUrl(linkMatch[2]);
      if (href) {
        return (
          <a
            key={idx}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="ask-arun-link"
          >
            {linkText}
          </a>
        );
      }
      // Dangerous or invalid URL -> render unlinked text node only
      return <span key={idx}>{linkText}</span>;
    }

    return <span key={idx}>{part}</span>;
  });
}

function SparkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 1L9.5 6.5L15 8L9.5 9.5L8 15L6.5 9.5L1 8L6.5 6.5L8 1Z"
        fill="var(--accent-primary)"
      />
    </svg>
  );
}
