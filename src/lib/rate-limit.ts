/**
 * Rate limiting architecture for the Ask Arun AI assistant (/api/chat).
 *
 * Production security requirements:
 * 1. Distributed rate limiting via Upstash Redis (@upstash/ratelimit).
 * 2. Shared state across all serverless function instances.
 * 3. Fail-closed in production: If Upstash is missing or unavailable in production,
 *    requests are REJECTED with a safe server error rather than silently degrading
 *    to an in-memory Map (which would permit cost exploitation across serverless instances).
 * 4. In development (NODE_ENV !== "production"): Graceful in-memory fallback is
 *    permitted so developers can work offline or without Upstash keys.
 * 5. Targets:
 *    - IP limit: 10 requests / 60 seconds
 *    - Session limit: 30 requests / 3600 seconds (1 hour)
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/* ── Configuration ───────────────────────────────────────────────────────── */

const IP_LIMIT = parseInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS ?? "10", 10);
const IP_WINDOW_SECONDS = parseInt(
  process.env.AI_RATE_LIMIT_WINDOW_SECONDS ?? "60",
  10
);

const SESSION_LIMIT = parseInt(
  process.env.AI_SESSION_RATE_LIMIT_MAX ?? "30",
  10
);
const SESSION_WINDOW_SECONDS = parseInt(
  process.env.AI_SESSION_RATE_LIMIT_WINDOW_SECONDS ?? "3600",
  10
);

const isProduction = process.env.NODE_ENV === "production";

/* ── Distributed Upstash Limiter ─────────────────────────────────────────── */

let ipRatelimit: Ratelimit | null = null;
let sessionRatelimit: Ratelimit | null = null;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const isUpstashConfigured = Boolean(redisUrl && redisToken);

if (isUpstashConfigured) {
  try {
    const redis = new Redis({
      url: redisUrl!,
      token: redisToken!,
    });

    ipRatelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(IP_LIMIT, `${IP_WINDOW_SECONDS} s`),
      prefix: "ask_arun_ip",
      analytics: false,
    });

    sessionRatelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(SESSION_LIMIT, `${SESSION_WINDOW_SECONDS} s`),
      prefix: "ask_arun_session",
      analytics: false,
    });
  } catch (err) {
    console.error("[RateLimit] Failed to initialize Upstash Redis:", err);
  }
}

/* ── In-Memory Fallback (Development Only) ────────────────────────────────── */

interface MemoryEntry {
  count: number;
  windowStart: number;
}

const memoryIpStore = new Map<string, MemoryEntry>();
const memorySessionStore = new Map<string, MemoryEntry>();

function checkMemoryLimit(
  store: Map<string, MemoryEntry>,
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: limit - 1,
      resetInMs: windowMs,
    };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs: windowMs - (now - entry.windowStart),
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetInMs: windowMs - (now - entry.windowStart),
  };
}

export function pruneMemoryEntries(): void {
  const now = Date.now();
  const ipWindowMs = IP_WINDOW_SECONDS * 1000;
  for (const [key, entry] of memoryIpStore.entries()) {
    if (now - entry.windowStart >= ipWindowMs) {
      memoryIpStore.delete(key);
    }
  }

  const sessionWindowMs = SESSION_WINDOW_SECONDS * 1000;
  for (const [key, entry] of memorySessionStore.entries()) {
    if (now - entry.windowStart >= sessionWindowMs) {
      memorySessionStore.delete(key);
    }
  }
}

/* ── Public API ──────────────────────────────────────────────────────────── */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
  /** Set if rate limiting failed closed due to unavailable security service */
  failClosedError?: boolean;
}

/**
 * Checks rate limits for a request against both IP and (if provided) Session ID.
 *
 * Production behaviour:
 * - If Upstash is not configured or fails: FAILS CLOSED (allowed: false, failClosedError: true).
 *
 * Development behaviour:
 * - Falls back to in-memory limiter with logged warning.
 */
export async function checkRateLimit(
  ip: string,
  sessionId?: string | null
): Promise<RateLimitResult> {
  // ── 1. Production check: Must have distributed limiter ────────────────────
  if (isProduction && (!isUpstashConfigured || !ipRatelimit)) {
    console.error(
      "[RateLimit] SECURITY ERROR: Distributed rate limiter is not configured in production. Failing closed."
    );
    return {
      allowed: false,
      remaining: 0,
      resetInMs: 60000,
      failClosedError: true,
    };
  }

  // ── 2. Distributed rate limit execution ──────────────────────────────────
  if (ipRatelimit) {
    try {
      // Check IP limit
      const ipResult = await ipRatelimit.limit(ip);
      if (!ipResult.success) {
        return {
          allowed: false,
          remaining: ipResult.remaining,
          resetInMs: Math.max(0, ipResult.reset - Date.now()),
        };
      }

      // Check Session limit if provided
      if (sessionId && sessionRatelimit) {
        // Sanitize sessionId key (alphanumeric only, max 64 chars)
        const cleanSession = sessionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
        if (cleanSession.length > 0) {
          const sessionResult = await sessionRatelimit.limit(cleanSession);
          if (!sessionResult.success) {
            return {
              allowed: false,
              remaining: sessionResult.remaining,
              resetInMs: Math.max(0, sessionResult.reset - Date.now()),
            };
          }
        }
      }

      return {
        allowed: true,
        remaining: ipResult.remaining,
        resetInMs: Math.max(0, ipResult.reset - Date.now()),
      };
    } catch (err) {
      console.error("[RateLimit] Upstash rate limit error:", err);
      if (isProduction) {
        // Fail closed in production on Redis communication failure
        return {
          allowed: false,
          remaining: 0,
          resetInMs: 60000,
          failClosedError: true,
        };
      }
      // In dev, fall through to memory fallback
    }
  }

  // ── 3. In-memory fallback (Development only) ─────────────────────────────
  const ipResult = checkMemoryLimit(
    memoryIpStore,
    ip,
    IP_LIMIT,
    IP_WINDOW_SECONDS * 1000
  );

  if (!ipResult.allowed) {
    return ipResult;
  }

  if (sessionId) {
    const cleanSession = sessionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    if (cleanSession.length > 0) {
      const sessionResult = checkMemoryLimit(
        memorySessionStore,
        cleanSession,
        SESSION_LIMIT,
        SESSION_WINDOW_SECONDS * 1000
      );
      if (!sessionResult.allowed) {
        return sessionResult;
      }
    }
  }

  return ipResult;
}
