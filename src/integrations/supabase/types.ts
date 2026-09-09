export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      guesses: {
        Row: {
          correct: boolean
          created_at: string
          id: string
          player_id: string
          player_name: string
          round_id: string
          text: string
        }
        Insert: {
          correct?: boolean
          created_at?: string
          id?: string
          player_id: string
          player_name: string
          round_id: string
          text: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          id?: string
          player_id?: string
          player_name?: string
          round_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "guesses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guesses_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          id: string
          is_host: boolean
          last_seen: string
          name: string
          room_id: string
          score: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_host?: boolean
          last_seen?: string
          name: string
          room_id: string
          score?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_host?: boolean
          last_seen?: string
          name?: string
          room_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          id: string
          mode: string
          status: string
          target_score: number
          winner_name: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          mode?: string
          status?: string
          target_score?: number
          winner_name?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          mode?: string
          status?: string
          target_score?: number
          winner_name?: string | null
        }
        Relationships: []
      }
      rounds: {
        Row: {
          artist_name: string
          artwork_url: string | null
          ended: boolean
          ends_at: string
          id: string
          kind: string
          preview_url: string
          room_id: string
          round_no: number
          started_at: string
          track_name: string
          winner_player_id: string | null
        }
        Insert: {
          artist_name: string
          artwork_url?: string | null
          ended?: boolean
          ends_at: string
          id?: string
          kind?: string
          preview_url: string
          room_id: string
          round_no?: number
          started_at?: string
          track_name: string
          winner_player_id?: string | null
        }
        Update: {
          artist_name?: string
          artwork_url?: string | null
          ended?: boolean
          ends_at?: string
          id?: string
          kind?: string
          preview_url?: string
          room_id?: string
          round_no?: number
          started_at?: string
          track_name?: string
          winner_player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      titles: {
        Row: {
          artwork_url: string | null
          created_at: string
          id: string
          itunes_id: string
          media_type: string
          preview_url: string
          subtitle: string
          title: string
        }
        Insert: {
          artwork_url?: string | null
          created_at?: string
          id?: string
          itunes_id: string
          media_type: string
          preview_url: string
          subtitle?: string
          title: string
        }
        Update: {
          artwork_url?: string | null
          created_at?: string
          id?: string
          itunes_id?: string
          media_type?: string
          preview_url?: string
          subtitle?: string
          title?: string
        }
        Relationships: []
      }
      tracks: {
        Row: {
          artist_name: string
          artwork_url: string | null
          created_at: string
          id: string
          itunes_id: string
          preview_url: string
          track_name: string
        }
        Insert: {
          artist_name: string
          artwork_url?: string | null
          created_at?: string
          id?: string
          itunes_id: string
          preview_url: string
          track_name: string
        }
        Update: {
          artist_name?: string
          artwork_url?: string | null
          created_at?: string
          id?: string
          itunes_id?: string
          preview_url?: string
          track_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
