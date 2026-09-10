/**
 * AI Provider abstraction layer.
 *
 * All concrete providers (mock, Gemini, OpenAI) implement the AIProvider
 * interface. The rest of the application only imports from this file and
 * never touches a provider SDK directly.
 *
 * To add a new provider:
 *   1. Create src/lib/ai/<name>-provider.ts
 *   2. Implement AIProvider
 *   3. Add a case to getAIProvider()
 *   4. Set AI_PROVIDER=<name> in the environment
 */

/* ── Core types ───────────────────────────────────────────────────────────── */

/** Only user/assistant roles are allowed in the message history. */
export type AIMessageRole = "user" | "assistant";

export interface AIMessage {
  role: AIMessageRole;
  content: string;
}

export interface AIOptions {
  /** Maximum tokens to generate. Falls back to AI_MAX_OUTPUT_TOKENS env var. */
  maxOutputTokens?: number;
  /** Request timeout in milliseconds. Falls back to AI_REQUEST_TIMEOUT_MS env var. */
  timeoutMs?: number;
}

export interface AIResponse {
  /** The generated text answer. Never contains raw HTML. */
  answer: string;
}

/* ── Provider interface ───────────────────────────────────────────────────── */

export interface AIProvider {
  /**
   * Send a conversation (system + history + latest user message) to the AI.
   *
   * @param systemPrompt  The authoritative server-created system prompt.
   *                      Clients cannot override this.
   * @param messages      Recent conversation history (user/assistant only).
   * @param options       Optional tunables.
   */
  chat(
    systemPrompt: string,
    messages: AIMessage[],
    options?: AIOptions
  ): Promise<AIResponse>;
}

/* ── Factory ──────────────────────────────────────────────────────────────── */

/**
 * Returns the configured AIProvider.
 * Selection is driven entirely by the AI_PROVIDER environment variable.
 * Defaults to "mock" so the application never breaks without credentials.
 *
 * IMPORTANT: This function is server-only. Never call it from client code.
 */
export async function getAIProvider(): Promise<AIProvider> {
  const provider = process.env.AI_PROVIDER ?? "mock";

  switch (provider) {
    case "mock": {
      const { MockProvider } = await import("./mock-provider");
      return new MockProvider();
    }
    case "gemini": {
      // Imported lazily so the Gemini SDK is never bundled when not in use.
      const { GeminiProvider } = await import("./gemini-provider");
      return new GeminiProvider();
    }
    default: {
      console.warn(
        `[AskArun] Unknown AI_PROVIDER="${provider}". Falling back to mock.`
      );
      const { MockProvider } = await import("./mock-provider");
      return new MockProvider();
    }
  }
}
