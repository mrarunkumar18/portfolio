/**
 * Shared types for the Ask Arun AI assistant UI.
 * Kept in one file so all components share a single source of truth.
 */

export type MessageRole = "user" | "assistant";
export type MessageStatus = "sending" | "complete" | "error";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  status: MessageStatus;
}

export type ChatState = "closed" | "open" | "idle" | "sending" | "error";
