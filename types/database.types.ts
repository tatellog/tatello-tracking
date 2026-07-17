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
      ai_insights: {
        Row: {
          context_hash: string
          created_at: string
          expires_at: string | null
          feature: string
          id: string
          period_end: string
          period_start: string
          period_type: string
          prompt_version: string
          response: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          context_hash: string
          created_at?: string
          expires_at?: string | null
          feature: string
          id?: string
          period_end: string
          period_start: string
          period_type: string
          prompt_version: string
          response: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          context_hash?: string
          created_at?: string
          expires_at?: string | null
          feature?: string
          id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          prompt_version?: string
          response?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      beta_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
      body_checkins: {
        Row: {
          abdomen_cm: number | null
          arm_left_cm: number | null
          arm_right_cm: number | null
          bmi: number | null
          bmr_kcal: number | null
          body_fat_pct: number | null
          bone_mass_kg: number | null
          calf_left_cm: number | null
          calf_right_cm: number | null
          chest_cm: number | null
          created_at: string
          fat_arm_left_pct: number | null
          fat_arm_right_pct: number | null
          fat_leg_left_pct: number | null
          fat_leg_right_pct: number | null
          fat_trunk_pct: number | null
          hips_cm: number | null
          id: string
          measured_on: string
          metabolic_age: number | null
          muscle_arm_left_kg: number | null
          muscle_arm_right_kg: number | null
          muscle_kg: number | null
          muscle_leg_left_kg: number | null
          muscle_leg_right_kg: number | null
          muscle_trunk_kg: number | null
          neck_cm: number | null
          notes: string | null
          source: string
          thigh_left_cm: number | null
          thigh_right_cm: number | null
          updated_at: string
          user_id: string
          visceral_fat_index: number | null
          waist_cm: number | null
          water_pct: number | null
          weight_kg: number | null
        }
        Insert: {
          abdomen_cm?: number | null
          arm_left_cm?: number | null
          arm_right_cm?: number | null
          bmi?: number | null
          bmr_kcal?: number | null
          body_fat_pct?: number | null
          bone_mass_kg?: number | null
          calf_left_cm?: number | null
          calf_right_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          fat_arm_left_pct?: number | null
          fat_arm_right_pct?: number | null
          fat_leg_left_pct?: number | null
          fat_leg_right_pct?: number | null
          fat_trunk_pct?: number | null
          hips_cm?: number | null
          id?: string
          measured_on: string
          metabolic_age?: number | null
          muscle_arm_left_kg?: number | null
          muscle_arm_right_kg?: number | null
          muscle_kg?: number | null
          muscle_leg_left_kg?: number | null
          muscle_leg_right_kg?: number | null
          muscle_trunk_kg?: number | null
          neck_cm?: number | null
          notes?: string | null
          source?: string
          thigh_left_cm?: number | null
          thigh_right_cm?: number | null
          updated_at?: string
          user_id: string
          visceral_fat_index?: number | null
          waist_cm?: number | null
          water_pct?: number | null
          weight_kg?: number | null
        }
        Update: {
          abdomen_cm?: number | null
          arm_left_cm?: number | null
          arm_right_cm?: number | null
          bmi?: number | null
          bmr_kcal?: number | null
          body_fat_pct?: number | null
          bone_mass_kg?: number | null
          calf_left_cm?: number | null
          calf_right_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          fat_arm_left_pct?: number | null
          fat_arm_right_pct?: number | null
          fat_leg_left_pct?: number | null
          fat_leg_right_pct?: number | null
          fat_trunk_pct?: number | null
          hips_cm?: number | null
          id?: string
          measured_on?: string
          metabolic_age?: number | null
          muscle_arm_left_kg?: number | null
          muscle_arm_right_kg?: number | null
          muscle_kg?: number | null
          muscle_leg_left_kg?: number | null
          muscle_leg_right_kg?: number | null
          muscle_trunk_kg?: number | null
          neck_cm?: number | null
          notes?: string | null
          source?: string
          thigh_left_cm?: number | null
          thigh_right_cm?: number | null
          updated_at?: string
          user_id?: string
          visceral_fat_index?: number | null
          waist_cm?: number | null
          water_pct?: number | null
          weight_kg?: number | null
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
      daily_notes: {
        Row: {
          created_at: string
          note: string
          note_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          note: string
          note_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          note?: string
          note_date?: string
          updated_at?: string
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
      experiments: {
        Row: {
          closed_at: string | null
          created_at: string
          dimension: string
          ends_on: string
          hypothesis_id: string
          id: string
          plan: Json
          result: Json | null
          started_on: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          dimension: string
          ends_on: string
          hypothesis_id: string
          id?: string
          plan?: Json
          result?: Json | null
          started_on: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          dimension?: string
          ends_on?: string
          hypothesis_id?: string
          id?: string
          plan?: Json
          result?: Json | null
          started_on?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'experiments_hypothesis_same_user_fkey'
            columns: ['hypothesis_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'hypotheses'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      facts: {
        Row: {
          created_at: string
          evidence_count: number
          id: string
          kind: string
          period_end: string
          period_start: string
          period_type: string
          unit: string | null
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          evidence_count?: number
          id?: string
          kind: string
          period_end: string
          period_start: string
          period_type: string
          unit?: string | null
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          evidence_count?: number
          id?: string
          kind?: string
          period_end?: string
          period_start?: string
          period_type?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      findings: {
        Row: {
          category: string
          confidence: number
          created_at: string
          finding_id: string
          id: string
          is_obstacle: boolean
          payload: Json
          period_end: string
          period_start: string
          period_type: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          confidence: number
          created_at?: string
          finding_id: string
          id?: string
          is_obstacle?: boolean
          payload: Json
          period_end: string
          period_start: string
          period_type: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          confidence?: number
          created_at?: string
          finding_id?: string
          id?: string
          is_obstacle?: boolean
          payload?: Json
          period_end?: string
          period_start?: string
          period_type?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hypotheses: {
        Row: {
          confidence: number
          created_at: string
          hypothesis_id: string
          id: string
          period_end: string
          period_start: string
          period_type: string
          source_finding_id: string | null
          source_story_id: string | null
          status: string
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence: number
          created_at?: string
          hypothesis_id: string
          id?: string
          period_end: string
          period_start: string
          period_type: string
          source_finding_id?: string | null
          source_story_id?: string | null
          status?: string
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          hypothesis_id?: string
          id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          source_finding_id?: string | null
          source_story_id?: string | null
          status?: string
          text?: string
          updated_at?: string
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
      meal_hydration: {
        Row: {
          created_at: string
          detected_items: Json
          glasses: number
          id: string
          intake_date: string
          meal_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detected_items?: Json
          glasses?: number
          id?: string
          intake_date: string
          meal_id: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          detected_items?: Json
          glasses?: number
          id?: string
          intake_date?: string
          meal_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'meal_hydration_meal_id_fkey'
            columns: ['meal_id']
            isOneToOne: true
            referencedRelation: 'meals'
            referencedColumns: ['id']
          },
        ]
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
      month_reflections: {
        Row: {
          answer: string
          created_at: string
          id: string
          month: string
          question_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          month: string
          question_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          month?: string
          question_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_reports: {
        Row: {
          created_at: string
          findings_hash: string
          id: string
          month: string
          payload: Json
          period_end: string
          period_start: string
          period_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          findings_hash: string
          id?: string
          month: string
          payload: Json
          period_end: string
          period_start: string
          period_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          findings_hash?: string
          id?: string
          month?: string
          payload?: Json
          period_end?: string
          period_start?: string
          period_type?: string
          updated_at?: string
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
          count_liquids_from_meals: boolean
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
          count_liquids_from_meals?: boolean
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
          count_liquids_from_meals?: boolean
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
      revelations: {
        Row: {
          dismissed_at: string | null
          id: string
          kind: string
          metadata: Json
          shown_at: string
          tier: string
          title: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string | null
          id?: string
          kind: string
          metadata?: Json
          shown_at?: string
          tier: string
          title: string
          user_id: string
        }
        Update: {
          dismissed_at?: string | null
          id?: string
          kind?: string
          metadata?: Json
          shown_at?: string
          tier?: string
          title?: string
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
      soul_node_reveals: {
        Row: {
          config_version: number
          id: string
          node_id: string
          revealed_at: string
          sign: string
          source: string
          user_id: string
        }
        Insert: {
          config_version?: number
          id?: string
          node_id: string
          revealed_at?: string
          sign: string
          source: string
          user_id: string
        }
        Update: {
          config_version?: number
          id?: string
          node_id?: string
          revealed_at?: string
          sign?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          chain: string[]
          created_at: string
          finding_ids: string[]
          id: string
          period_end: string
          period_start: string
          period_type: string
          score: number
          story_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chain: string[]
          created_at?: string
          finding_ids: string[]
          id?: string
          period_end: string
          period_start: string
          period_type: string
          score: number
          story_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chain?: string[]
          created_at?: string
          finding_ids?: string[]
          id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          score?: number
          story_id?: string
          updated_at?: string
          user_id?: string
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
      wearable_body_composition: {
        Row: {
          bmi: number | null
          body_fat_pct: number | null
          created_at: string
          day_date: string
          id: string
          lean_body_mass_kg: number | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bmi?: number | null
          body_fat_pct?: number | null
          created_at?: string
          day_date: string
          id?: string
          lean_body_mass_kg?: number | null
          source: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bmi?: number | null
          body_fat_pct?: number | null
          created_at?: string
          day_date?: string
          id?: string
          lean_body_mass_kg?: number | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wearable_sleep: {
        Row: {
          asleep_minutes: number
          bedtime_at: string | null
          created_at: string
          external_id: string
          id: string
          sleep_date: string
          source: string
          updated_at: string
          user_id: string
          wake_at: string | null
        }
        Insert: {
          asleep_minutes: number
          bedtime_at?: string | null
          created_at?: string
          external_id: string
          id?: string
          sleep_date: string
          source: string
          updated_at?: string
          user_id: string
          wake_at?: string | null
        }
        Update: {
          asleep_minutes?: number
          bedtime_at?: string | null
          created_at?: string
          external_id?: string
          id?: string
          sleep_date?: string
          source?: string
          updated_at?: string
          user_id?: string
          wake_at?: string | null
        }
        Relationships: []
      }
      wearable_steps: {
        Row: {
          created_at: string
          day_date: string
          id: string
          source: string
          steps: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_date: string
          id?: string
          source: string
          steps: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_date?: string
          id?: string
          source?: string
          steps?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wearable_workouts: {
        Row: {
          created_at: string
          duration_min: number | null
          ended_at: string
          energy_kcal: number | null
          external_id: string
          id: string
          source: string
          started_at: string
          updated_at: string
          user_id: string
          workout_type: string | null
        }
        Insert: {
          created_at?: string
          duration_min?: number | null
          ended_at: string
          energy_kcal?: number | null
          external_id: string
          id?: string
          source: string
          started_at: string
          updated_at?: string
          user_id: string
          workout_type?: string | null
        }
        Update: {
          created_at?: string
          duration_min?: number | null
          ended_at?: string
          energy_kcal?: number | null
          external_id?: string
          id?: string
          source?: string
          started_at?: string
          updated_at?: string
          user_id?: string
          workout_type?: string | null
        }
        Relationships: []
      }
      weekly_readings: {
        Row: {
          created_at: string
          grade: string
          id: string
          opened_at: string | null
          payload: Json
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          grade: string
          id?: string
          opened_at?: string | null
          payload: Json
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          grade?: string
          id?: string
          opened_at?: string | null
          payload?: Json
          user_id?: string
          week_start?: string
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
          workout_kcal: number | null
          workout_source: string | null
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
      fn_transform_points: {
        Args: { p_water_goal_glasses?: number }
        Returns: number
      }
      fn_transform_points_as_of: {
        Args: { p_as_of: string; p_water_goal_glasses?: number }
        Returns: number
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
