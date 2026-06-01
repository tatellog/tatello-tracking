export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      beta_feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          screen: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          screen?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          screen?: string | null
          user_id?: string
        }
        Relationships: []
      }
      body_measurements: {
        Row: {
          arm_cm: number | null
          bmi: number | null
          bmr: number | null
          body_fat_pct: number | null
          bone_mass_kg: number | null
          chest_cm: number | null
          created_at: string
          hip_cm: number | null
          id: string
          measured_at: string
          metabolic_age: number | null
          muscle_mass_kg: number | null
          thigh_cm: number | null
          user_id: string
          visceral_fat: number | null
          waist_cm: number | null
          water_pct: number | null
          weight_kg: number | null
        }
        Insert: {
          arm_cm?: number | null
          bmi?: number | null
          bmr?: number | null
          body_fat_pct?: number | null
          bone_mass_kg?: number | null
          chest_cm?: number | null
          created_at?: string
          hip_cm?: number | null
          id?: string
          measured_at?: string
          metabolic_age?: number | null
          muscle_mass_kg?: number | null
          thigh_cm?: number | null
          user_id: string
          visceral_fat?: number | null
          waist_cm?: number | null
          water_pct?: number | null
          weight_kg?: number | null
        }
        Update: {
          arm_cm?: number | null
          bmi?: number | null
          bmr?: number | null
          body_fat_pct?: number | null
          bone_mass_kg?: number | null
          chest_cm?: number | null
          created_at?: string
          hip_cm?: number | null
          id?: string
          measured_at?: string
          metabolic_age?: number | null
          muscle_mass_kg?: number | null
          thigh_cm?: number | null
          user_id?: string
          visceral_fat?: number | null
          waist_cm?: number | null
          water_pct?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      briefs: {
        Row: {
          brief_date: string
          content: Json
          generated_at: string
          id: string
          user_id: string
        }
        Insert: {
          brief_date: string
          content: Json
          generated_at?: string
          id?: string
          user_id: string
        }
        Update: {
          brief_date?: string
          content?: Json
          generated_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      cycle_events: {
        Row: {
          created_at: string
          event_date: string
          event_type: string
          flow: string | null
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_date: string
          event_type: string
          flow?: string | null
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_date?: string
          event_type?: string
          flow?: string | null
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      detected_patterns: {
        Row: {
          detected_at: string
          id: string
          metadata: Json
          pattern_type: string
          shown_to_user: boolean
          user_id: string
        }
        Insert: {
          detected_at?: string
          id?: string
          metadata?: Json
          pattern_type: string
          shown_to_user?: boolean
          user_id: string
        }
        Update: {
          detected_at?: string
          id?: string
          metadata?: Json
          pattern_type?: string
          shown_to_user?: boolean
          user_id?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          created_at: string
          error_message: string
          id: string
          screen: string | null
          stack: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message: string
          id?: string
          screen?: string | null
          stack?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string
          id?: string
          screen?: string | null
          stack?: string | null
          user_id?: string
        }
        Relationships: []
      }
      macro_targets: {
        Row: {
          calories: number
          protein_g: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calories: number
          protein_g: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calories?: number
          protein_g?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          ai_raw_response: Json | null
          calories: number
          consumed_at: string
          created_at: string
          id: string
          meal_date: string | null
          meal_type: string
          name: string
          notes: string | null
          photo_storage_path: string | null
          protein_g: number
          source: string
          user_id: string
        }
        Insert: {
          ai_raw_response?: Json | null
          calories: number
          consumed_at?: string
          created_at?: string
          id?: string
          meal_date?: string | null
          meal_type: string
          name: string
          notes?: string | null
          photo_storage_path?: string | null
          protein_g: number
          source?: string
          user_id: string
        }
        Update: {
          ai_raw_response?: Json | null
          calories?: number
          consumed_at?: string
          created_at?: string
          id?: string
          meal_date?: string | null
          meal_type?: string
          name?: string
          notes?: string | null
          photo_storage_path?: string | null
          protein_g?: number
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      mood_checkins: {
        Row: {
          checked_at: string
          checkin_date: string | null
          created_at: string
          id: string
          user_id: string
          value: string
        }
        Insert: {
          checked_at?: string
          checkin_date?: string | null
          created_at?: string
          id?: string
          user_id: string
          value: string
        }
        Update: {
          checked_at?: string
          checkin_date?: string | null
          created_at?: string
          id?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          angle: string
          byte_size: number | null
          created_at: string
          height: number | null
          id: string
          storage_path: string
          taken_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          angle: string
          byte_size?: number | null
          created_at?: string
          height?: number | null
          id?: string
          storage_path: string
          taken_at?: string
          user_id: string
          width?: number | null
        }
        Update: {
          angle?: string
          byte_size?: number | null
          created_at?: string
          height?: number | null
          id?: string
          storage_path?: string
          taken_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          acquisition_source: string | null
          avatar_path: string | null
          biological_sex: string | null
          created_at: string
          cycle_length_days: number | null
          cycle_situation: string | null
          date_of_birth: string | null
          display_name: string | null
          first_workout_at: string | null
          frictions: Json
          goal: string | null
          height_cm: number | null
          id: string
          is_beta: boolean
          is_dev: boolean
          monthly_focus: string | null
          monthly_focus_secondary: string[] | null
          notification_window: string | null
          onboarding_completed_at: string | null
          timezone: string
          training_frequency: string | null
          typical_sleep_hours: number | null
          updated_at: string
        }
        Insert: {
          acquisition_source?: string | null
          avatar_path?: string | null
          biological_sex?: string | null
          created_at?: string
          cycle_length_days?: number | null
          cycle_situation?: string | null
          date_of_birth?: string | null
          display_name?: string | null
          first_workout_at?: string | null
          frictions?: Json
          goal?: string | null
          height_cm?: number | null
          id: string
          is_beta?: boolean
          is_dev?: boolean
          monthly_focus?: string | null
          monthly_focus_secondary?: string[] | null
          notification_window?: string | null
          onboarding_completed_at?: string | null
          timezone?: string
          training_frequency?: string | null
          typical_sleep_hours?: number | null
          updated_at?: string
        }
        Update: {
          acquisition_source?: string | null
          avatar_path?: string | null
          biological_sex?: string | null
          created_at?: string
          cycle_length_days?: number | null
          cycle_situation?: string | null
          date_of_birth?: string | null
          display_name?: string | null
          first_workout_at?: string | null
          frictions?: Json
          goal?: string | null
          height_cm?: number | null
          id?: string
          is_beta?: boolean
          is_dev?: boolean
          monthly_focus?: string | null
          monthly_focus_secondary?: string[] | null
          notification_window?: string | null
          onboarding_completed_at?: string | null
          timezone?: string
          training_frequency?: string | null
          typical_sleep_hours?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      rest_days: {
        Row: {
          created_at: string
          rest_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          rest_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          rest_date?: string
          user_id?: string
        }
        Relationships: []
      }
      sleep_logs: {
        Row: {
          bedtime: string
          created_at: string
          duration_minutes: number | null
          id: string
          notes: string | null
          quality: number | null
          sleep_date: string
          user_id: string
          wake_time: string
        }
        Insert: {
          bedtime: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          quality?: number | null
          sleep_date: string
          user_id: string
          wake_time: string
        }
        Update: {
          bedtime?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          quality?: number | null
          sleep_date?: string
          user_id?: string
          wake_time?: string
        }
        Relationships: []
      }
      water_intake: {
        Row: {
          glasses: number
          intake_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          glasses?: number
          intake_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          glasses?: number
          intake_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wellbeing_checkins: {
        Row: {
          checked_at: string
          checkin_date: string
          created_at: string
          energy: number | null
          id: string
          motivation: number | null
          notes: string | null
          stress: number | null
          user_id: string
        }
        Insert: {
          checked_at?: string
          checkin_date: string
          created_at?: string
          energy?: number | null
          id?: string
          motivation?: number | null
          notes?: string | null
          stress?: number | null
          user_id: string
        }
        Update: {
          checked_at?: string
          checkin_date?: string
          created_at?: string
          energy?: number | null
          id?: string
          motivation?: number | null
          notes?: string | null
          stress?: number | null
          user_id?: string
        }
        Relationships: []
      }
      workouts: {
        Row: {
          completed_at: string
          created_at: string
          id: string
          notes: string | null
          type: string | null
          user_id: string
          workout_date: string | null
        }
        Insert: {
          completed_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          type?: string | null
          user_id: string
          workout_date?: string | null
        }
        Update: {
          completed_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          type?: string | null
          user_id?: string
          workout_date?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      daily_signals: {
        Row: {
          calories: number | null
          day: string | null
          energy: number | null
          meal_count: number | null
          mood: string | null
          motivation: number | null
          on_period: boolean | null
          protein_g: number | null
          rested: boolean | null
          sleep_minutes: number | null
          sleep_quality: number | null
          stress: number | null
          trained: boolean | null
          user_id: string | null
          water_glasses: number | null
          weight_kg: number | null
          wellbeing_checkins: number | null
          workout_type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_rls_status: {
        Args: never
        Returns: {
          policy_count: number
          rls_enabled: boolean
          table_name: string
        }[]
      }
      get_brief_context: {
        Args: { p_date?: string; p_user_id?: string }
        Returns: Json
      }
      get_current_streak: {
        Args: { p_timezone?: string; p_user_id?: string }
        Returns: number
      }
      get_meal_suggestions: {
        Args: { p_limit?: number; p_meal_type: string }
        Returns: {
          calories: number
          id: string
          name: string
          protein_g: number
          source: string
        }[]
      }
      user_timezone: { Args: never; Returns: string }
      user_tz: { Args: { p_user_id?: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
