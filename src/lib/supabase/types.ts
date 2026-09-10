/**
 * src/lib/supabase/types.ts
 *
 * Minimal hand-written Supabase database types for the Ask Arun schema.
 * Replace with auto-generated types via:
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      visitor_sessions: {
        Row: {
          id: string;
          created_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          last_seen_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          visitor_session_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          visitor_session_id: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          visitor_session_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: string;
            columns: string[];
            referencedRelation: string;
            referencedColumns: string[];
          }
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: "user" | "assistant";
          content?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: string;
            columns: string[];
            referencedRelation: string;
            referencedColumns: string[];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
