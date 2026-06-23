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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          call_count: number
          created_at: string
          date: string
          id: string
          session_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          call_count?: number
          created_at?: string
          date?: string
          id?: string
          session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          call_count?: number
          created_at?: string
          date?: string
          id?: string
          session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          home_country: string | null
          id: string
          notification_preferences: Json | null
          preferred_currency: string | null
          preferred_language: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          home_country?: string | null
          id?: string
          notification_preferences?: Json | null
          preferred_currency?: string | null
          preferred_language?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          home_country?: string | null
          id?: string
          notification_preferences?: Json | null
          preferred_currency?: string | null
          preferred_language?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scan_entries: {
        Row: {
          ai_analysis: Json | null
          category: string
          created_at: string
          description: string | null
          extracted_text: string | null
          id: string
          image_url: string | null
          is_favorite: boolean | null
          latitude: number | null
          location_name: string | null
          longitude: number | null
          name: string | null
          notes: string | null
          prices: Json | null
          tips: string[] | null
          trip_id: string | null
          user_id: string
          warnings: string[] | null
        }
        Insert: {
          ai_analysis?: Json | null
          category: string
          created_at?: string
          description?: string | null
          extracted_text?: string | null
          id?: string
          image_url?: string | null
          is_favorite?: boolean | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          name?: string | null
          notes?: string | null
          prices?: Json | null
          tips?: string[] | null
          trip_id?: string | null
          user_id: string
          warnings?: string[] | null
        }
        Update: {
          ai_analysis?: Json | null
          category?: string
          created_at?: string
          description?: string | null
          extracted_text?: string | null
          id?: string
          image_url?: string | null
          is_favorite?: boolean | null
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          name?: string | null
          notes?: string | null
          prices?: Json | null
          tips?: string[] | null
          trip_id?: string | null
          user_id?: string
          warnings?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_entries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      spending_records: {
        Row: {
          amount: number
          category: string
          created_at: string
          currency: string
          date: string
          id: string
          location_name: string | null
          merchant: string | null
          notes: string | null
          scan_entry_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          currency?: string
          date?: string
          id?: string
          location_name?: string | null
          merchant?: string | null
          notes?: string | null
          scan_entry_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          date?: string
          id?: string
          location_name?: string | null
          merchant?: string | null
          notes?: string | null
          scan_entry_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spending_records_scan_entry_id_fkey"
            columns: ["scan_entry_id"]
            isOneToOne: false
            referencedRelation: "scan_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          ai_best_time_to_visit: string | null
          ai_budget_estimate: Json | null
          ai_itinerary: Json | null
          ai_must_try: Json | null
          ai_overview: string | null
          ai_packing_tips: string[] | null
          ai_summary: string | null
          cover_image_url: string | null
          created_at: string
          destination: string | null
          end_date: string | null
          id: string
          is_public: boolean | null
          name: string
          share_code: string | null
          shareable_story: string | null
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_best_time_to_visit?: string | null
          ai_budget_estimate?: Json | null
          ai_itinerary?: Json | null
          ai_must_try?: Json | null
          ai_overview?: string | null
          ai_packing_tips?: string[] | null
          ai_summary?: string | null
          cover_image_url?: string | null
          created_at?: string
          destination?: string | null
          end_date?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          share_code?: string | null
          shareable_story?: string | null
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_best_time_to_visit?: string | null
          ai_budget_estimate?: Json | null
          ai_itinerary?: Json | null
          ai_must_try?: Json | null
          ai_overview?: string | null
          ai_packing_tips?: string[] | null
          ai_summary?: string | null
          cover_image_url?: string | null
          created_at?: string
          destination?: string | null
          end_date?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          share_code?: string | null
          shareable_story?: string | null
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
