/**
 * src/lib/ai/memory-context.ts
 *
 * File-based Arun AI memory loader (Phase 7).
 *
 * Architecture:
 *   src/memory/arun-memory.md  (edited by Arun/developer)
 *           ↓
 *   loadMemoryContext()        (server-side only, read-only)
 *           ↓
 *   buildSystemPrompt()        (injected after portfolio data)
 *           ↓
 *   Gemini API
 *
 * Security invariants:
 *   - File is read-only from the application's perspective.
 *   - No public HTTP endpoint exposes this file directly.
 *   - Visitor messages CANNOT modify this file.
 *   - Content is bounded by AI_MEMORY_MAX_CONTEXT_CHARS (default 12000).
 *   - Never imported in Client Components (server-only via fs).
 */

import fs from "fs";
import path from "path";

/* ── Config ──────────────────────────────────────────────────────────────── */

const MEMORY_FILE_PATH = path.join(process.cwd(), "src", "memory", "arun-memory.md");

const MAX_CONTEXT_CHARS = parseInt(
  process.env.AI_MEMORY_MAX_CONTEXT_CHARS ?? "12000",
  10
);

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface MemoryContextResult {
  /** Sanitized memory content ready to inject into system prompt. */
  content: string;
  /** True if the memory file was found and loaded successfully. */
  loaded: boolean;
  /** True if content was truncated to stay within the context budget. */
  truncated: boolean;
  /** Character count of the final content. */
  charCount: number;
}

/* ── Loader ──────────────────────────────────────────────────────────────── */

/**
 * Reads and normalizes src/memory/arun-memory.md server-side.
 *
 * - Strips HTML comments (<!-- ... -->) so developer notes are never sent to Gemini.
 * - Collapses excessive blank lines.
 * - Truncates to AI_MEMORY_MAX_CONTEXT_CHARS if needed.
 * - Returns a safe result object — never throws.
 */
export function loadMemoryContext(): MemoryContextResult {
  let raw: string;

  try {
    raw = fs.readFileSync(MEMORY_FILE_PATH, "utf-8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      // File not found — silently skip (memory is optional)
      return { content: "", loaded: false, truncated: false, charCount: 0 };
    }
    // Unexpected FS error — log sanitized message, skip memory gracefully
    console.error("[MemoryContext] Failed to read arun-memory.md:", code ?? "unknown error");
    return { content: "", loaded: false, truncated: false, charCount: 0 };
  }

  // ── Strip HTML comments (developer notes, instructions) ──────────────────
  // These are stripped so they never reach Gemini.
  const stripped = raw.replace(/<!--[\s\S]*?-->/g, "");

  // ── Normalize whitespace ─────────────────────────────────────────────────
  // Collapse 3+ consecutive blank lines to max 2, trim leading/trailing.
  const normalized = stripped
    .replace(/\r\n/g, "\n")          // normalize line endings
    .replace(/\n{3,}/g, "\n\n")      // collapse excessive blank lines
    .trim();

  if (!normalized) {
    return { content: "", loaded: true, truncated: false, charCount: 0 };
  }

  // ── Enforce context budget ───────────────────────────────────────────────
  let truncated = false;
  let content = normalized;

  if (content.length > MAX_CONTEXT_CHARS) {
    content = content.slice(0, MAX_CONTEXT_CHARS);

    // Truncate cleanly at last newline to avoid mid-sentence cuts
    const lastNewline = content.lastIndexOf("\n");
    if (lastNewline > MAX_CONTEXT_CHARS * 0.8) {
      content = content.slice(0, lastNewline);
    }

    truncated = true;
    console.warn(
      `[MemoryContext] arun-memory.md exceeds ${MAX_CONTEXT_CHARS} chars — truncated to ${content.length} chars.`
    );
  }

  return {
    content,
    loaded: true,
    truncated,
    charCount: content.length,
  };
}
