/**
 * Google Gemini AI Provider — Real Implementation (Phase 3C & Phase 5 Hardening)
 *
 * Uses the official @google/genai SDK.
 * API: ai.models.generateContent() with systemInstruction.
 *
 * Security & Cost Controls:
 *   - GEMINI_API_KEY read strictly server-side
 *   - AI_MODEL configurable via env (default: gemini-3.5-flash-lite)
 *   - Configurable timeout protection via AI_REQUEST_TIMEOUT_MS (default: 15000ms)
 *   - Hard output token cap (HARD_MAX_TOKENS = 2048)
 *   - Sanitized error types without leaking internal credentials
 */

import { GoogleGenAI } from "@google/genai";
import { type AIProvider, type AIMessage, type AIOptions, type AIResponse } from "./provider";

/* ── Constants ────────────────────────────────────────────────────────────── */

/** Fallback model if AI_MODEL env var is not set. */
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/** Absolute output token cap — defence against runaway generation. */
const HARD_MAX_TOKENS = 2048;

/** Default server-side timeout in ms for AI calls. */
const DEFAULT_TIMEOUT_MS = 15000;

/* ── Provider ─────────────────────────────────────────────────────────────── */

export class GeminiProvider implements AIProvider {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "[AskArun] GEMINI_API_KEY environment variable is not set. " +
        "Set AI_PROVIDER=mock for local development without a key."
      );
    }

    this.ai = new GoogleGenAI({ apiKey });
    this.model = process.env.AI_MODEL ?? DEFAULT_MODEL;
  }

  async chat(
    systemPrompt: string,
    messages: AIMessage[],
    options?: AIOptions
  ): Promise<AIResponse> {
    const maxTokens = Math.min(
      options?.maxOutputTokens ?? 600,
      HARD_MAX_TOKENS
    );

    const timeoutMs =
      options?.timeoutMs ??
      parseInt(process.env.AI_REQUEST_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10);

    // Convert message format to @google/genai Content format.
    // Roles: user -> "user", assistant -> "model".
    const contents = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const err = new Error(`Gemini request timed out after ${timeoutMs}ms.`);
        err.name = "TimeoutError";
        reject(err);
      }, timeoutMs);
    });

    try {
      const response = await Promise.race([
        this.ai.models.generateContent({
          model: this.model,
          contents,
          config: {
            systemInstruction: systemPrompt,
            maxOutputTokens: maxTokens,
            temperature: 0.4,
            topP: 0.9,
          },
        }),
        timeoutPromise,
      ]);

      const text = response.text;

      if (!text) {
        throw new Error("[AskArun] Gemini returned an empty response.");
      }

      return { answer: text };
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
