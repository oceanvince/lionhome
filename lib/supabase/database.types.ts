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
      agent_profile: {
        Row: {
          agent_id: string
          bio: string | null
          created_at: string
          specializations: Json
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          agent_id: string
          bio?: string | null
          created_at?: string
          specializations?: Json
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          agent_id?: string
          bio?: string | null
          created_at?: string
          specializations?: Json
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_profile_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          auth_user_id: string | null
          cea_number: string
          cea_verified_at: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["agent_status"]
          tier: Database["public"]["Enums"]["agent_tier"]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          auth_user_id?: string | null
          cea_number: string
          cea_verified_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          tier?: Database["public"]["Enums"]["agent_tier"]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          auth_user_id?: string | null
          cea_number?: string
          cea_verified_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          tier?: Database["public"]["Enums"]["agent_tier"]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      calculator_runs: {
        Row: {
          created_at: string
          id: string
          inputs: Json
          outputs: Json
          session_id: string
          tax_rates_version: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          inputs: Json
          outputs: Json
          session_id?: string
          tax_rates_version: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          inputs?: Json
          outputs?: Json
          session_id?: string
          tax_rates_version?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calculator_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      config: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          key: string
          notes: string | null
          value: Json
          version: string
        }
        Insert: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          key: string
          notes?: string | null
          value: Json
          version: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          key?: string
          notes?: string | null
          value?: Json
          version?: string
        }
        Relationships: []
      }
      consent_log: {
        Row: {
          consent_text_hash: string
          consent_type: Database["public"]["Enums"]["consent_type"]
          consent_version: string
          granted: boolean
          granted_at: string
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
          withdrawn_at: string | null
        }
        Insert: {
          consent_text_hash: string
          consent_type: Database["public"]["Enums"]["consent_type"]
          consent_version: string
          granted: boolean
          granted_at?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          consent_text_hash?: string
          consent_type?: Database["public"]["Enums"]["consent_type"]
          consent_version?: string
          granted?: boolean
          granted_at?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content: {
        Row: {
          author_user_id: string | null
          body_md: string | null
          created_at: string
          excerpt: string | null
          hero_image_url: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["content_status"]
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          body_md?: string | null
          created_at?: string
          excerpt?: string | null
          hero_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          body_md?: string | null
          created_at?: string
          excerpt?: string | null
          hero_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          agent_confirmed_at: string | null
          agent_id: string
          buyer_confirmed_at: string | null
          commission_total: number | null
          completion_date: string | null
          created_at: string
          id: string
          lead_id: string
          notes: string | null
          ota_signed_at: string | null
          platform_share_amount: number | null
          platform_share_pct: number
          project_id: string | null
          settlement_status: Database["public"]["Enums"]["settlement_status"]
          stage: Database["public"]["Enums"]["deal_stage"]
          transaction_price: number | null
          updated_at: string
        }
        Insert: {
          agent_confirmed_at?: string | null
          agent_id: string
          buyer_confirmed_at?: string | null
          commission_total?: number | null
          completion_date?: string | null
          created_at?: string
          id?: string
          lead_id: string
          notes?: string | null
          ota_signed_at?: string | null
          platform_share_amount?: number | null
          platform_share_pct?: number
          project_id?: string | null
          settlement_status?: Database["public"]["Enums"]["settlement_status"]
          stage?: Database["public"]["Enums"]["deal_stage"]
          transaction_price?: number | null
          updated_at?: string
        }
        Update: {
          agent_confirmed_at?: string | null
          agent_id?: string
          buyer_confirmed_at?: string | null
          commission_total?: number | null
          completion_date?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          ota_signed_at?: string | null
          platform_share_amount?: number | null
          platform_share_pct?: number
          project_id?: string | null
          settlement_status?: Database["public"]["Enums"]["settlement_status"]
          stage?: Database["public"]["Enums"]["deal_stage"]
          transaction_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignments: {
        Row: {
          accepted_at: string | null
          agent_id: string
          assigned_at: string
          created_at: string
          declined_at: string | null
          expires_at: string | null
          id: string
          lead_id: string
          notes: string | null
          outcome: string | null
        }
        Insert: {
          accepted_at?: string | null
          agent_id: string
          assigned_at?: string
          created_at?: string
          declined_at?: string | null
          expires_at?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          outcome?: string | null
        }
        Update: {
          accepted_at?: string | null
          agent_id?: string
          assigned_at?: string
          created_at?: string
          declined_at?: string | null
          expires_at?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          outcome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_journey_events: {
        Row: {
          event_data: Json
          event_type: Database["public"]["Enums"]["lead_event_type"]
          id: string
          lead_id: string | null
          occurred_at: string
          user_id: string | null
        }
        Insert: {
          event_data?: Json
          event_type: Database["public"]["Enums"]["lead_event_type"]
          id?: string
          lead_id?: string | null
          occurred_at?: string
          user_id?: string | null
        }
        Update: {
          event_data?: Json
          event_type?: Database["public"]["Enums"]["lead_event_type"]
          id?: string
          lead_id?: string | null
          occurred_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_journey_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_journey_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_scores: {
        Row: {
          components: Json
          computed_by: string
          created_at: string
          id: string
          lead_id: string
          score: number
        }
        Insert: {
          components: Json
          computed_by?: string
          created_at?: string
          id?: string
          lead_id: string
          score: number
        }
        Update: {
          components?: Json
          computed_by?: string
          created_at?: string
          id?: string
          lead_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_scores_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          buyer_archetype: Database["public"]["Enums"]["buyer_archetype"] | null
          created_at: string
          current_assignment_id: string | null
          id: string
          readiness_band: Database["public"]["Enums"]["readiness_band"] | null
          score: number
          score_components: Json | null
          source_campaign: string | null
          source_channel: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          buyer_archetype?:
            | Database["public"]["Enums"]["buyer_archetype"]
            | null
          created_at?: string
          current_assignment_id?: string | null
          id?: string
          readiness_band?: Database["public"]["Enums"]["readiness_band"] | null
          score?: number
          score_components?: Json | null
          source_campaign?: string | null
          source_channel?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          buyer_archetype?:
            | Database["public"]["Enums"]["buyer_archetype"]
            | null
          created_at?: string
          current_assignment_id?: string | null
          id?: string
          readiness_band?: Database["public"]["Enums"]["readiness_band"] | null
          score?: number
          score_components?: Json | null
          source_campaign?: string | null
          source_channel?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_current_assignment_fk"
            columns: ["current_assignment_id"]
            isOneToOne: false
            referencedRelation: "lead_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          developer: string | null
          district: string | null
          external_ref: string | null
          id: string
          metadata: Json
          name: string
          tenure: string | null
          top_year: number | null
          total_units: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          developer?: string | null
          district?: string | null
          external_ref?: string | null
          id?: string
          metadata?: Json
          name: string
          tenure?: string | null
          top_year?: number | null
          total_units?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          developer?: string | null
          district?: string | null
          external_ref?: string | null
          id?: string
          metadata?: Json
          name?: string
          tenure?: string | null
          top_year?: number | null
          total_units?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      quiz_runs: {
        Row: {
          answers: Json
          archetype: Database["public"]["Enums"]["buyer_archetype"] | null
          created_at: string
          id: string
          score: number | null
          score_components: Json | null
          session_id: string
          user_id: string | null
        }
        Insert: {
          answers: Json
          archetype?: Database["public"]["Enums"]["buyer_archetype"] | null
          created_at?: string
          id?: string
          score?: number | null
          score_components?: Json | null
          session_id?: string
          user_id?: string | null
        }
        Update: {
          answers?: Json
          archetype?: Database["public"]["Enums"]["buyer_archetype"] | null
          created_at?: string
          id?: string
          score?: number | null
          score_components?: Json | null
          session_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          agent_id: string
          amount_owed: number
          created_at: string
          deal_id: string
          id: string
          notes: string | null
          paid_at: string | null
          reference: string | null
          status: Database["public"]["Enums"]["settlement_status"]
          updated_at: string
        }
        Insert: {
          agent_id: string
          amount_owed: number
          created_at?: string
          deal_id: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["settlement_status"]
          updated_at?: string
        }
        Update: {
          agent_id?: string
          amount_owed?: number
          created_at?: string
          deal_id?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["settlement_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          absd_matrix: Json
          bsd_slabs: Json
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          ltv_rules: Json
          msr: Json
          notes: string | null
          tdsr: Json
          version: string
        }
        Insert: {
          absd_matrix: Json
          bsd_slabs: Json
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          ltv_rules: Json
          msr: Json
          notes?: string | null
          tdsr: Json
          version: string
        }
        Update: {
          absd_matrix?: Json
          bsd_slabs?: Json
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          ltv_rules?: Json
          msr?: Json
          notes?: string | null
          tdsr?: Json
          version?: string
        }
        Relationships: []
      }
      user_profile: {
        Row: {
          age: number | null
          created_at: string
          employment_type: string | null
          household_size: number | null
          marital_status: Database["public"]["Enums"]["marital_status"] | null
          notes: string | null
          preferred_districts: string[] | null
          preferred_unit_types: string[] | null
          self_use_weight: number | null
          spouse_residency:
            | Database["public"]["Enums"]["residency_status"]
            | null
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: number | null
          created_at?: string
          employment_type?: string | null
          household_size?: number | null
          marital_status?: Database["public"]["Enums"]["marital_status"] | null
          notes?: string | null
          preferred_districts?: string[] | null
          preferred_unit_types?: string[] | null
          self_use_weight?: number | null
          spouse_residency?:
            | Database["public"]["Enums"]["residency_status"]
            | null
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number | null
          created_at?: string
          employment_type?: string | null
          household_size?: number | null
          marital_status?: Database["public"]["Enums"]["marital_status"] | null
          notes?: string | null
          preferred_districts?: string[] | null
          preferred_unit_types?: string[] | null
          self_use_weight?: number | null
          spouse_residency?:
            | Database["public"]["Enums"]["residency_status"]
            | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          email: string | null
          id: string
          last_seen_at: string | null
          phone: string | null
          preferred_language: Database["public"]["Enums"]["preferred_language"]
          residency: Database["public"]["Enums"]["residency_status"] | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          last_seen_at?: string | null
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["preferred_language"]
          residency?: Database["public"]["Enums"]["residency_status"] | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          last_seen_at?: string | null
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["preferred_language"]
          residency?: Database["public"]["Enums"]["residency_status"] | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_id: { Args: never; Returns: string }
    }
    Enums: {
      agent_status: "active" | "paused" | "removed"
      agent_tier: "top" | "mid" | "probation" | "removed"
      buyer_archetype: "upgrader" | "school" | "commuter" | "value" | "diaspora"
      consent_type:
        | "privacy_policy"
        | "data_sharing_with_advisor"
        | "marketing_email"
        | "marketing_whatsapp"
        | "cookies"
      content_status: "draft" | "scheduled" | "published" | "archived"
      deal_stage:
        | "lead"
        | "contacted"
        | "viewing"
        | "negotiation"
        | "otp_issued"
        | "completed"
        | "lost"
      lead_event_type:
        | "page_view"
        | "cta_click"
        | "form_start"
        | "form_submit"
        | "chat_message"
        | "note"
        | "system"
      lead_status:
        | "new"
        | "layer1"
        | "layer2"
        | "qualified"
        | "routed"
        | "contacted"
        | "viewing"
        | "negotiation"
        | "closed"
        | "lost"
        | "dormant"
      marital_status: "single" | "married" | "married_foreign_spouse"
      preferred_language: "zh-CN" | "zh-TW" | "en"
      readiness_band: "hot" | "warm" | "cool" | "cold"
      report_request_status:
        | "pending"
        | "in_progress"
        | "ready"
        | "expired"
        | "cancelled"
      residency_status: "citizen" | "pr" | "foreigner" | "company"
      settlement_status: "pending" | "verified" | "paid" | "disputed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      agent_status: ["active", "paused", "removed"],
      agent_tier: ["top", "mid", "probation", "removed"],
      buyer_archetype: ["upgrader", "school", "commuter", "value", "diaspora"],
      consent_type: [
        "privacy_policy",
        "data_sharing_with_advisor",
        "marketing_email",
        "marketing_whatsapp",
        "cookies",
      ],
      content_status: ["draft", "scheduled", "published", "archived"],
      deal_stage: [
        "lead",
        "contacted",
        "viewing",
        "negotiation",
        "otp_issued",
        "completed",
        "lost",
      ],
      lead_event_type: [
        "page_view",
        "cta_click",
        "form_start",
        "form_submit",
        "chat_message",
        "note",
        "system",
      ],
      lead_status: [
        "new",
        "layer1",
        "layer2",
        "qualified",
        "routed",
        "contacted",
        "viewing",
        "negotiation",
        "closed",
        "lost",
        "dormant",
      ],
      marital_status: ["single", "married", "married_foreign_spouse"],
      preferred_language: ["zh-CN", "zh-TW", "en"],
      readiness_band: ["hot", "warm", "cool", "cold"],
      report_request_status: [
        "pending",
        "in_progress",
        "ready",
        "expired",
        "cancelled",
      ],
      residency_status: ["citizen", "pr", "foreigner", "company"],
      settlement_status: ["pending", "verified", "paid", "disputed"],
    },
  },
} as const
