/**
 * POST /api/chat
 *
 * The Ask Arun AI portfolio assistant API endpoint.
 *
 * Security architecture (Phase 5 Hardened):
 *   Browser → /api/chat → Server → AI Provider
 *   1. The browser NEVER calls the AI provider directly.
 *   2. API keys are server-side only (never exposed to client).
 *   3. Origin validation: Validates Origin header (production: arunx.xyz; dev: localhost/127.0.0.1).
 *   4. Distributed rate limiting via Upstash Redis with fail-closed production protection.
 *   5. Session ID used strictly as an auxiliary rate-limit key (never for auth/privilege).
 *   6. Strict input validation (types, limits, roles whitelist).
 *   7. Authoritative server-side system prompt generation.
 *   8. Gemini request timeout protection with clean error handling.
 *   9. Zero secret or sensitive data leakage in logs.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAIProvider, type AIMessage } from "@/lib/ai/provider";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { checkRateLimit, pruneMemoryEntries } from "@/lib/rate-limit";

/* ── Config ──────────────────────────────────────────────────────────────── */

const MAX_MESSAGE_LENGTH = parseInt(
  process.env.AI_MAX_MESSAGE_LENGTH ?? "1500",
  10
);
const MAX_HISTORY_MESSAGES = parseInt(
  process.env.AI_MAX_HISTORY_MESSAGES ?? "20",
  10
);
const MAX_OUTPUT_TOKENS = parseInt(
  process.env.AI_MAX_OUTPUT_TOKENS ?? "600",
  10
);
const REQUEST_TIMEOUT_MS = parseInt(
  process.env.AI_REQUEST_TIMEOUT_MS ?? "15000",
  10
);

/* ── Allowed roles whitelist ─────────────────────────────────────────────── */

/** Only user/assistant messages from the client are accepted in history.
 *  "system", "developer", "tool", "admin" are rejected. */
const ALLOWED_ROLES = new Set(["user", "assistant"]);

/* ── Route handler ───────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // ── 1. Origin Validation ───────────────────────────────────────────────
  const origin = req.headers.get("origin");
  if (!isValidOrigin(origin)) {
    return errorResponse(403, "Forbidden: Cross-origin request rejected.");
  }

  // Prune stale in-memory entries occasionally (dev fallback)
  if (Math.random() < 0.05) {
    pruneMemoryEntries();
  }

  // ── 2. Client IP & Session handling ────────────────────────────────────
  const ip = getClientIP(req);
  const rawSessionId = req.headers.get("x-session-id");

  // ── 3. Distributed Rate Limit (Fail-Closed in Production) ───────────────
  const rateLimit = await checkRateLimit(ip, rawSessionId);

  if (rateLimit.failClosedError) {
    console.error(
      `[AskArun] Rate limit service unavailable in production. Request rejected for [${maskIP(ip)}].`
    );
    return errorResponse(
      503,
      "Security service temporarily unavailable. Please try again in a moment."
    );
  }

  if (!rateLimit.allowed) {
    return errorResponse(
      429,
      "You're sending messages too quickly. Please wait a moment.",
      {
        "Retry-After": String(Math.ceil(rateLimit.resetInMs / 1000)),
        "X-RateLimit-Remaining": "0",
      }
    );
  }

  // ── 4. Parse body ──────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "Invalid JSON in request body.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse(400, "Request body must be a JSON object.");
  }

  const raw = body as Record<string, unknown>;

  // ── 5. Validate message ────────────────────────────────────────────────
  if (!("message" in raw)) {
    return errorResponse(400, "Missing required field: message.");
  }
  if (typeof raw.message !== "string") {
    return errorResponse(400, "Field 'message' must be a string.");
  }

  const message = raw.message.trim();

  if (message.length === 0) {
    return errorResponse(400, "Message cannot be empty.");
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return errorResponse(
      400,
      `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`
    );
  }

  // ── 6. Validate history ────────────────────────────────────────────────
  const history: AIMessage[] = [];

  if ("history" in raw) {
    if (!Array.isArray(raw.history)) {
      return errorResponse(400, "Field 'history' must be an array.");
    }

    const rawHistory = raw.history as unknown[];
    const capped = rawHistory.slice(-MAX_HISTORY_MESSAGES);

    for (const entry of capped) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return errorResponse(400, "Each history entry must be an object.");
      }
      const h = entry as Record<string, unknown>;

      if (typeof h.role !== "string" || typeof h.content !== "string") {
        return errorResponse(
          400,
          "Each history entry must have string 'role' and 'content' fields."
        );
      }

      // Reject disallowed roles — clients cannot inject system/tool instructions
      if (!ALLOWED_ROLES.has(h.role)) {
        return errorResponse(
          400,
          `History entries may only use roles: ${[...ALLOWED_ROLES].join(", ")}.`
        );
      }

      const content = String(h.content).trim().slice(0, MAX_MESSAGE_LENGTH);
      history.push({ role: h.role as AIMessage["role"], content });
    }
  }

  // Append current user message
  const messages: AIMessage[] = [...history, { role: "user", content: message }];

  // ── 7. Build authoritative system prompt (server-created) ──────────────
  let systemPrompt: string;
  try {
    systemPrompt = buildSystemPrompt();
  } catch (err) {
    console.error("[AskArun] Failed to build system prompt:", err instanceof Error ? err.message : "unknown");
    return errorResponse(500, "I'm having trouble right now. Please try again in a moment.");
  }

  // ── 8. Call AI provider with timeout protection ────────────────────────
  let answer: string;
  try {
    const provider = await getAIProvider();
    const result = await provider.chat(systemPrompt, messages, {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    answer = result.answer;
  } catch (err: unknown) {
    const duration = Date.now() - startTime;
    const errorName = (err as Error)?.name ?? "UnknownError";
    const isTimeout =
      errorName === "TimeoutError" ||
      (err as Error)?.message?.includes("timed out");

    if (isTimeout) {
      console.warn(
        `[AskArun] Timeout after ${duration}ms for [${maskIP(ip)}]`
      );
      return errorResponse(
        504,
        "The assistant took too long to respond. Please try again in a moment."
      );
    }

    console.error(
      `[AskArun] Provider error category: ${errorName} (duration: ${duration}ms)`
    );
    return errorResponse(
      500,
      "I'm having trouble reaching the AI right now. Please try again in a moment."
    );
  }

  // ── 9. Return sanitised response ───────────────────────────────────────
  return NextResponse.json(
    { answer },
    {
      status: 200,
      headers: {
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "Cache-Control": "no-store",
      },
    }
  );
}

/* ── Non-POST methods ────────────────────────────────────────────────────── */

export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/**
 * Validates Origin header.
 * - If absent, allowed (same-origin browser fetches, dev curl).
 * - Production: strictly https://arunx.xyz and https://www.arunx.xyz.
 * - Development: http://localhost:<port> and http://127.0.0.1:<port>.
 */
function isValidOrigin(origin: string | null): boolean {
  if (!origin) return true;

  try {
    const url = new URL(origin);
    const isProd = process.env.NODE_ENV === "production";

    // Production origins
    const prodHosts = new Set(["arunx.xyz", "www.arunx.xyz"]);
    if (url.protocol === "https:" && prodHosts.has(url.hostname)) {
      return true;
    }

    // Development origins: validate protocol, hostname and port
    if (!isProd) {
      if (
        url.protocol === "http:" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1")
      ) {
        const port = url.port ? parseInt(url.port, 10) : 80;
        if (port >= 80 && port <= 65535) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Extracts client IP using platform-trusted proxy headers.
 * Vercel edge sets x-vercel-forwarded-for which cannot be spoofed by clients.
 */
function getClientIP(req: NextRequest): string {
  const vercelIP = req.headers.get("x-vercel-forwarded-for");
  if (vercelIP) {
    return vercelIP.split(",")[0].trim();
  }

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }

  return "127.0.0.1";
}

/**
 * Masks IP for safe logging without storing sensitive PII.
 */
function maskIP(ip: string): string {
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
  }
  return "masked-ip";
}

/**
 * Returns a JSON error response.
 * Never leaks stack traces or internal secrets.
 */
function errorResponse(
  status: number,
  userMessage: string,
  extraHeaders?: Record<string, string>
): NextResponse {
  return NextResponse.json(
    { error: userMessage },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...extraHeaders,
      },
    }
  );
}
