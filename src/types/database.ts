export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      budget_categories: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          name: string;
          planned_amount: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          name: string;
          planned_amount?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          name?: string;
          planned_amount?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budget_categories_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_about_facts: {
        Row: {
          event_id: string;
          id: string;
          label: string;
          position: number;
          value: string;
        };
        ComputedFields: never;
        Insert: {
          event_id: string;
          id?: string;
          label: string;
          position: number;
          value: string;
        };
        Update: {
          event_id?: string;
          id?: string;
          label?: string;
          position?: number;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_about_facts_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_contacts: {
        Row: {
          email: string | null;
          event_id: string;
          id: string;
          label: string | null;
          name: string | null;
          phone: string | null;
          position: number;
        };
        ComputedFields: never;
        Insert: {
          email?: string | null;
          event_id: string;
          id?: string;
          label?: string | null;
          name?: string | null;
          phone?: string | null;
          position: number;
        };
        Update: {
          email?: string | null;
          event_id?: string;
          id?: string;
          label?: string | null;
          name?: string | null;
          phone?: string | null;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "event_contacts_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_locations: {
        Row: {
          address: string;
          event_id: string;
          id: string;
          label: string | null;
          name: string;
          position: number;
          show_map: boolean;
        };
        ComputedFields: never;
        Insert: {
          address: string;
          event_id: string;
          id?: string;
          label?: string | null;
          name: string;
          position: number;
          show_map?: boolean;
        };
        Update: {
          address?: string;
          event_id?: string;
          id?: string;
          label?: string | null;
          name?: string;
          position?: number;
          show_map?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "event_locations_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_members: {
        Row: {
          event_id: string;
          joined_at: string;
          role: Database["public"]["Enums"]["event_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          event_id: string;
          joined_at?: string;
          role?: Database["public"]["Enums"]["event_role"];
          user_id: string;
        };
        Update: {
          event_id?: string;
          joined_at?: string;
          role?: Database["public"]["Enums"]["event_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      event_page_photos: {
        Row: {
          alt_text: string | null;
          created_at: string;
          event_id: string;
          id: string;
          position: number;
          section: Database["public"]["Enums"]["event_section"];
          storage_path: string;
        };
        ComputedFields: never;
        Insert: {
          alt_text?: string | null;
          created_at?: string;
          event_id: string;
          id?: string;
          position?: number;
          section: Database["public"]["Enums"]["event_section"];
          storage_path: string;
        };
        Update: {
          alt_text?: string | null;
          created_at?: string;
          event_id?: string;
          id?: string;
          position?: number;
          section?: Database["public"]["Enums"]["event_section"];
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_page_photos_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_schedule_items: {
        Row: {
          description: string | null;
          event_id: string;
          id: string;
          position: number;
          time_label: string | null;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          description?: string | null;
          event_id: string;
          id?: string;
          position: number;
          time_label?: string | null;
          title: string;
        };
        Update: {
          description?: string | null;
          event_id?: string;
          id?: string;
          position?: number;
          time_label?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_schedule_items_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_sections: {
        Row: {
          content_body: string | null;
          content_title: string | null;
          description: string | null;
          event_id: string;
          eyebrow: string | null;
          is_visible: boolean;
          nav_label: string | null;
          section: Database["public"]["Enums"]["event_section"];
          title: string | null;
        };
        ComputedFields: never;
        Insert: {
          content_body?: string | null;
          content_title?: string | null;
          description?: string | null;
          event_id: string;
          eyebrow?: string | null;
          is_visible?: boolean;
          nav_label?: string | null;
          section: Database["public"]["Enums"]["event_section"];
          title?: string | null;
        };
        Update: {
          content_body?: string | null;
          content_title?: string | null;
          description?: string | null;
          event_id?: string;
          eyebrow?: string | null;
          is_visible?: boolean;
          nav_label?: string | null;
          section?: Database["public"]["Enums"]["event_section"];
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_sections_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          access_code_hash: string;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          starts_at: string | null;
          theme: string;
        };
        ComputedFields: never;
        Insert: {
          access_code_hash: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          starts_at?: string | null;
          theme?: string;
        };
        Update: {
          access_code_hash?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          starts_at?: string | null;
          theme?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_payments: {
        Row: {
          amount: number;
          created_at: string;
          event_id: string;
          expense_id: string;
          id: string;
          method: string | null;
          notes: string | null;
          paid_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          event_id: string;
          expense_id: string;
          id?: string;
          method?: string | null;
          notes?: string | null;
          paid_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          event_id?: string;
          expense_id?: string;
          id?: string;
          method?: string | null;
          notes?: string | null;
          paid_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_payments_expense_fkey";
            columns: ["event_id", "expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["event_id", "id"];
          },
        ];
      };
      expenses: {
        Row: {
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          deposit_amount: number | null;
          due_date: string | null;
          event_id: string;
          id: string;
          notes: string | null;
          status: Database["public"]["Enums"]["expense_status"];
          title: string;
          total_amount: number;
          updated_at: string;
          vendor_contact: string | null;
          vendor_name: string | null;
        };
        ComputedFields: never;
        Insert: {
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deposit_amount?: number | null;
          due_date?: string | null;
          event_id: string;
          id?: string;
          notes?: string | null;
          status?: Database["public"]["Enums"]["expense_status"];
          title: string;
          total_amount: number;
          updated_at?: string;
          vendor_contact?: string | null;
          vendor_name?: string | null;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deposit_amount?: number | null;
          due_date?: string | null;
          event_id?: string;
          id?: string;
          notes?: string | null;
          status?: Database["public"]["Enums"]["expense_status"];
          title?: string;
          total_amount?: number;
          updated_at?: string;
          vendor_contact?: string | null;
          vendor_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_category_fkey";
            columns: ["event_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "budget_categories";
            referencedColumns: ["event_id", "id"];
          },
          {
            foreignKeyName: "expenses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      guest_groups: {
        Row: {
          address: string | null;
          created_at: string;
          default_invited_jointly: boolean;
          default_inviter_id: string | null;
          event_id: string;
          id: string;
          invitation_sent_at: string | null;
          name: string;
          notes: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          created_at?: string;
          default_invited_jointly?: boolean;
          default_inviter_id?: string | null;
          event_id: string;
          id?: string;
          invitation_sent_at?: string | null;
          name: string;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          default_invited_jointly?: boolean;
          default_inviter_id?: string | null;
          event_id?: string;
          id?: string;
          invitation_sent_at?: string | null;
          name?: string;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guest_groups_default_inviter_fkey";
            columns: ["event_id", "default_inviter_id"];
            isOneToOne: false;
            referencedRelation: "guests";
            referencedColumns: ["event_id", "id"];
          },
          {
            foreignKeyName: "guest_groups_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      guests: {
        Row: {
          address: string | null;
          age_group: Database["public"]["Enums"]["guest_age_group"];
          attendance: Database["public"]["Enums"]["attendance_likelihood"];
          created_at: string;
          diet: string | null;
          email: string | null;
          event_id: string;
          first_name: string | null;
          group_id: string | null;
          id: string;
          invited_by_guest_id: string | null;
          invited_jointly: boolean;
          is_inviter: boolean;
          is_plus_one: boolean;
          last_name: string | null;
          needs_accommodation: boolean;
          needs_transport: boolean;
          notes: string | null;
          phone: string | null;
          seat_number: number | null;
          table_id: string | null;
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          age_group?: Database["public"]["Enums"]["guest_age_group"];
          attendance?: Database["public"]["Enums"]["attendance_likelihood"];
          created_at?: string;
          diet?: string | null;
          email?: string | null;
          event_id: string;
          first_name?: string | null;
          group_id?: string | null;
          id?: string;
          invited_by_guest_id?: string | null;
          invited_jointly?: boolean;
          is_inviter?: boolean;
          is_plus_one?: boolean;
          last_name?: string | null;
          needs_accommodation?: boolean;
          needs_transport?: boolean;
          notes?: string | null;
          phone?: string | null;
          seat_number?: number | null;
          table_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          address?: string | null;
          age_group?: Database["public"]["Enums"]["guest_age_group"];
          attendance?: Database["public"]["Enums"]["attendance_likelihood"];
          created_at?: string;
          diet?: string | null;
          email?: string | null;
          event_id?: string;
          first_name?: string | null;
          group_id?: string | null;
          id?: string;
          invited_by_guest_id?: string | null;
          invited_jointly?: boolean;
          is_inviter?: boolean;
          is_plus_one?: boolean;
          last_name?: string | null;
          needs_accommodation?: boolean;
          needs_transport?: boolean;
          notes?: string | null;
          phone?: string | null;
          seat_number?: number | null;
          table_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "guests_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guests_group_fkey";
            columns: ["event_id", "group_id"];
            isOneToOne: false;
            referencedRelation: "guest_groups";
            referencedColumns: ["event_id", "id"];
          },
          {
            foreignKeyName: "guests_invited_by_fkey";
            columns: ["event_id", "invited_by_guest_id"];
            isOneToOne: false;
            referencedRelation: "guests";
            referencedColumns: ["event_id", "id"];
          },
          {
            foreignKeyName: "guests_table_fkey";
            columns: ["event_id", "table_id"];
            isOneToOne: false;
            referencedRelation: "seating_tables";
            referencedColumns: ["event_id", "id"];
          },
          {
            foreignKeyName: "guests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      join_attempts: {
        Row: {
          attempted_at: string;
          id: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          attempted_at?: string;
          id?: never;
          user_id: string;
        };
        Update: {
          attempted_at?: string;
          id?: never;
          user_id?: string;
        };
        Relationships: [];
      };
      photos: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          mime_type: string;
          original_filename: string;
          size_bytes: number;
          storage_path: string;
          thumbnail_storage_path: string | null;
          uploaded_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          mime_type: string;
          original_filename: string;
          size_bytes: number;
          storage_path: string;
          thumbnail_storage_path?: string | null;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          mime_type?: string;
          original_filename?: string;
          size_bytes?: number;
          storage_path?: string;
          thumbnail_storage_path?: string | null;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "photos_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "photos_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          is_anonymous: boolean;
          is_platform_admin: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          is_anonymous?: boolean;
          is_platform_admin?: boolean;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          is_anonymous?: boolean;
          is_platform_admin?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      seating_landmarks: {
        Row: {
          created_at: string;
          event_id: string;
          height: number;
          id: string;
          label: string;
          rotation: number;
          width: number;
          x: number;
          y: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_id: string;
          height: number;
          id?: string;
          label: string;
          rotation?: number;
          width: number;
          x: number;
          y: number;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          height?: number;
          id?: string;
          label?: string;
          rotation?: number;
          width?: number;
          x?: number;
          y?: number;
        };
        Relationships: [
          {
            foreignKeyName: "seating_landmarks_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      seating_rooms: {
        Row: {
          created_at: string;
          event_id: string;
          height: number;
          is_published: boolean;
          updated_at: string;
          width: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_id: string;
          height?: number;
          is_published?: boolean;
          updated_at?: string;
          width?: number;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          height?: number;
          is_published?: boolean;
          updated_at?: string;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: "seating_rooms_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: true;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      seating_tables: {
        Row: {
          capacity: number;
          created_at: string;
          event_id: string;
          id: string;
          name: string;
          notes: string | null;
          rotation: number;
          seat_config: NonNullable<Json>;
          shape: Database["public"]["Enums"]["seating_table_shape"];
          updated_at: string;
          x: number;
          y: number;
        };
        ComputedFields: never;
        Insert: {
          capacity?: number;
          created_at?: string;
          event_id: string;
          id?: string;
          name: string;
          notes?: string | null;
          rotation?: number;
          seat_config?: NonNullable<Json>;
          shape?: Database["public"]["Enums"]["seating_table_shape"];
          updated_at?: string;
          x?: number;
          y?: number;
        };
        Update: {
          capacity?: number;
          created_at?: string;
          event_id?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          rotation?: number;
          seat_config?: NonNullable<Json>;
          shape?: Database["public"]["Enums"]["seating_table_shape"];
          updated_at?: string;
          x?: number;
          y?: number;
        };
        Relationships: [
          {
            foreignKeyName: "seating_tables_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_event_page_photo: {
        Args: {
          p_alt_text?: string;
          p_event_id: string;
          p_section: Database["public"]["Enums"]["event_section"];
          p_storage_path: string;
        };
        Returns: string;
      };
      assert_not_last_admin: {
        Args: { p_event_id: string; p_user_id: string };
        Returns: undefined;
      };
      assign_seat: {
        Args: { p_guest_id: string; p_seat_number?: number; p_table_id?: string };
        Returns: undefined;
      };
      check_event_code: {
        Args: { p_access_code: string };
        Returns: {
          event_id: string;
          event_name: string;
          starts_at: string;
        }[];
      };
      clean_display_name: { Args: { p_value: string }; Returns: string };
      clean_text: { Args: { p_value: string }; Returns: string };
      cleanup_abandoned_anonymous_users: { Args: Record<PropertyKey, never>; Returns: number };
      create_event: {
        Args: { p_access_code: string; p_name: string; p_starts_at?: string };
        Returns: string;
      };
      delete_event: { Args: { p_event_id: string }; Returns: undefined };
      delete_event_page_photo: { Args: { p_photo_id: string }; Returns: string };
      delete_guest_group: {
        Args: { p_delete_guests?: boolean; p_group_id: string };
        Returns: number;
      };
      find_event_by_access_code: {
        Args: { p_access_code: string; p_uid: string };
        Returns: string;
      };
      get_event_page: { Args: { p_event_id: string }; Returns: Json };
      get_seating_plan: { Args: { p_event_id: string }; Returns: Json };
      has_event_role: {
        Args: { p_event_id: string; p_roles: Database["public"]["Enums"]["event_role"][] };
        Returns: boolean;
      };
      insert_default_event_sections: { Args: { p_event_id: string }; Returns: undefined };
      is_event_member: { Args: { p_event_id: string }; Returns: boolean };
      is_platform_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      join_event: {
        Args: { p_access_code: string; p_display_name?: string };
        Returns: {
          event_id: string;
          event_name: string;
          role: Database["public"]["Enums"]["event_role"];
          starts_at: string;
        }[];
      };
      list_event_members_admin: {
        Args: { p_event_id: string };
        Returns: {
          display_name: string;
          email: string;
          is_anonymous: boolean;
          joined_at: string;
          role: Database["public"]["Enums"]["event_role"];
          user_id: string;
        }[];
      };
      list_events_admin: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          guest_count: number;
          id: string;
          member_count: number;
          name: string;
          photo_count: number;
          starts_at: string;
        }[];
      };
      my_event_role: {
        Args: { p_event_id: string };
        Returns: Database["public"]["Enums"]["event_role"];
      };
      normalize_access_code: { Args: { p_code: string }; Returns: string };
      remove_member: { Args: { p_event_id: string; p_user_id: string }; Returns: undefined };
      require_display_name: { Args: { p_display_name: string }; Returns: string };
      require_event_name: { Args: { p_name: string }; Returns: string };
      require_free_access_code: {
        Args: { p_access_code: string; p_except_event_id: string };
        Returns: string;
      };
      require_item_list: {
        Args: { p_items: Json; p_label: string; p_max: number };
        Returns: undefined;
      };
      require_platform_admin: { Args: Record<PropertyKey, never>; Returns: undefined };
      save_event_page_photos: {
        Args: {
          p_event_id: string;
          p_items: Json;
          p_section: Database["public"]["Enums"]["event_section"];
        };
        Returns: undefined;
      };
      save_event_section: {
        Args: {
          p_content: Json;
          p_event_id: string;
          p_items?: Json;
          p_section: Database["public"]["Enums"]["event_section"];
        };
        Returns: undefined;
      };
      save_seating_layout: {
        Args: {
          p_dry_run?: boolean;
          p_event_id: string;
          p_landmarks: Json;
          p_room: Json;
          p_tables: Json;
        };
        Returns: Json;
      };
      set_display_name: { Args: { p_display_name: string }; Returns: undefined };
      set_event_access_code: {
        Args: { p_access_code: string; p_event_id: string };
        Returns: undefined;
      };
      set_event_section_visibility: {
        Args: {
          p_event_id: string;
          p_section: Database["public"]["Enums"]["event_section"];
          p_visible: boolean;
        };
        Returns: undefined;
      };
      set_event_theme: { Args: { p_event_id: string; p_theme: string }; Returns: undefined };
      set_member_role: {
        Args: {
          p_event_id: string;
          p_role: Database["public"]["Enums"]["event_role"];
          p_user_id: string;
        };
        Returns: undefined;
      };
      set_seating_published: {
        Args: { p_event_id: string; p_published: boolean };
        Returns: undefined;
      };
      shares_event_with: { Args: { p_user_id: string }; Returns: boolean };
      storage_path_event_id: { Args: { p_name: string }; Returns: string };
      storage_path_owner: { Args: { p_name: string }; Returns: string };
      update_event: {
        Args: { p_event_id: string; p_name: string; p_starts_at: string };
        Returns: undefined;
      };
      update_guest_group: {
        Args: {
          p_address?: string;
          p_apply_to_members?: boolean;
          p_default_invited_jointly: boolean;
          p_default_inviter_id?: string;
          p_group_id: string;
          p_name: string;
        };
        Returns: {
          address: string | null;
          created_at: string;
          default_invited_jointly: boolean;
          default_inviter_id: string | null;
          event_id: string;
          id: string;
          invitation_sent_at: string | null;
          name: string;
          notes: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "guest_groups";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      upsert_own_profile: { Args: { p_display_name: string; p_uid: string }; Returns: undefined };
    };
    Enums: {
      attendance_likelihood: "UNKNOWN" | "CONFIRMED" | "LIKELY" | "UNLIKELY" | "DECLINED";
      event_role: "ADMIN" | "EDITOR" | "GUEST";
      event_section:
        | "gallery"
        | "couple"
        | "schedule"
        | "seating"
        | "location"
        | "contact"
        | "footer";
      expense_status: "UNPAID" | "DEPOSIT_PAID" | "PAID";
      guest_age_group: "ADULT" | "CHILD" | "INFANT";
      seating_table_shape: "RECT" | "L" | "U";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      attendance_likelihood: ["UNKNOWN", "CONFIRMED", "LIKELY", "UNLIKELY", "DECLINED"],
      event_role: ["ADMIN", "EDITOR", "GUEST"],
      event_section: ["gallery", "couple", "schedule", "seating", "location", "contact", "footer"],
      expense_status: ["UNPAID", "DEPOSIT_PAID", "PAID"],
      guest_age_group: ["ADULT", "CHILD", "INFANT"],
      seating_table_shape: ["RECT", "L", "U"],
    },
  },
} as const;
