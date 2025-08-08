export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      battles: {
        Row: {
          allies: Json | null
          created_at: string | null
          id: string
          log: Json | null
          map_ref: string | null
          monsters: Json | null
          session_id: string | null
          name: string | null;
          slug: string | null;
          background_image: string | null;
          initiative: Json | null; 
        }
        Insert: {
          allies?: Json | null
          created_at?: string | null
          id?: string
          log?: Json | null
          map_ref?: string | null
          monsters?: Json | null
          session_id?: string | null
          name?: string | null;
          slug?: string | null;
          background_image?: string | null;
          initiative?: Json | null; 
        }
        Update: {
          allies?: Json | null
          created_at?: string | null
          id?: string
          log?: Json | null
          map_ref?: string | null
          monsters?: Json | null
          session_id?: string | null
          name?: string | null;
          slug?: string | null;
          background_image?: string | null;
          initiative?: Json | null; 
        }
        Relationships: [
          {
            foreignKeyName: "battles_map_ref_fkey"
            columns: ["map_ref"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "battles_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string | null
          id: string
          name: string
          owner_id: string | null
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          owner_id?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      loot_assignments: {
        Row: {
          assigned_at: string | null
          assigned_to_user_id: string | null
          id: string
          item_data: Json | null
          item_id: string
          session_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to_user_id?: string | null
          id?: string
          item_data?: Json | null
          item_id: string
          session_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to_user_id?: string | null
          id?: string
          item_data?: Json | null
          item_id?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loot_assignments_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loot_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      maps: {
        Row: {
          created_at: string | null
          grid_size: number
          session_id: string
          terrain_data: Json | null
          tokens: Json | null
          updated_at: string | null
          background_image: string | null;
        }
        Insert: {
          created_at?: string | null
          grid_size?: number
          session_id: string
          terrain_data?: Json | null
          tokens?: Json | null
          updated_at?: string | null
          background_image?: string | null;
        }
        Update: {
          created_at?: string | null
          grid_size?: number
          session_id?: string
          terrain_data?: Json | null
          tokens?: Json | null
          updated_at?: string | null
          background_image?: string | null;
        }
        Relationships: [
          {
            foreignKeyName: "maps_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      // NEW: messages table types (chat)
      messages: {
        Row: {
          id: string;
          session_id: string;
          campaign_id: string | null;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          campaign_id?: string | null;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string | null;
          campaign_id?: string | null;
          user_id?: string;
          content?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          active: boolean | null
          campaign_id: string | null
          created_at: string | null
          id: string
          participants: Json | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          campaign_id?: string | null
          created_at?: string | null
          id: string
          participants?: Json | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          participants?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          active: boolean | null
          campaign_id: string | null
          created_at: string | null
          id: string
          inventory: Json | null
          keeper: Json | null
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          inventory?: Json | null
          keeper?: Json | null
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          inventory?: Json | null
          keeper?: Json | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shops_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          clerk_id: string
          created_at: string | null
          id: string
          name: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          clerk_id: string
          created_at?: string | null
          id: string
          name: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          clerk_id?: string
          created_at?: string | null
          id?: string
          name?: string
          role?: string | null
          updated_at?: string | null
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
