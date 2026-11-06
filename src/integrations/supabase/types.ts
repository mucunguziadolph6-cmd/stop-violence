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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      districts: {
        Row: {
          id: string
          name: string
          province_id: string
        }
        Insert: {
          id?: string
          name: string
          province_id: string
        }
        Update: {
          id?: string
          name?: string
          province_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "districts_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          display_name: string
          id: string
        }
        Insert: {
          display_name?: string
          id: string
        }
        Update: {
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      provinces: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      report_feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          report_id: string
          sender_id: string
          staff_title: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          report_id: string
          sender_id?: string
          staff_title?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          report_id?: string
          sender_id?: string
          staff_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_feedback_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          location: string
          owner_id: string
          photo_path: string | null
          school_id: string | null
          summary: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          id?: string
          location?: string
          owner_id?: string
          photo_path?: string | null
          school_id?: string | null
          summary?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          location?: string
          owner_id?: string
          photo_path?: string | null
          school_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_memberships: {
        Row: {
          created_at: string
          member_role: string
          school_id: string
          staff_title: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          member_role: string
          school_id: string
          staff_title?: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          member_role?: string
          school_id?: string
          staff_title?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_notifications: {
        Row: {
          created_at: string
          id: string
          kind: string
          read_at: string | null
          recipient_id: string
          report_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          recipient_id: string
          report_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          recipient_id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sector_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sector_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sector_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schools_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          district_id: string
          id: string
          name: string
        }
        Insert: {
          district_id: string
          id?: string
          name: string
        }
        Update: {
          district_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectors_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      site_owners: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: []
      }
      student_codes: {
        Row: {
          created_at: string
          full_name: string
          id: string
          school_id: string
          student_code: string
          used: boolean
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          school_id: string
          student_code: string
          used?: boolean
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          school_id?: string
          student_code?: string
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "student_codes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
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
      create_school: { Args: { _name: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_school_staff: { Args: { _school_id: string }; Returns: boolean }
      is_site_owner: { Args: never; Returns: boolean }
      list_pending_staff: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          school_name: string
          staff_title: string
          user_id: string
        }[]
      }
      list_reports_since_signup: {
        Args: { page_number?: number }
        Returns: {
          category: string
          created_at: string
          description: string
          id: string
          location: string
          summary: string
        }[]
      }
      list_shared_reports: {
        Args: { page_number?: number }
        Returns: {
          category: string
          created_at: string
          description: string
          id: string
          location: string
          summary: string
        }[]
      }
      request_school_membership: {
        Args: { _role: string; _school_id: string; _title?: string }
        Returns: undefined
      }
      review_school_membership: {
        Args: { _approve: boolean; _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "staff" | "user"
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
    Enums: {
      app_role: ["staff", "user"],
    },
  },
} as const
