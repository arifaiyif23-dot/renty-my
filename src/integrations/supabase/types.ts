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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: []
      }
      item_images: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string
          is_primary: boolean | null
          item_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          is_primary?: boolean | null
          item_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          is_primary?: boolean | null
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_images_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_views: {
        Row: {
          id: string
          item_id: string
          user_id: string | null
          viewed_at: string | null
        }
        Insert: {
          id?: string
          item_id: string
          user_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          id?: string
          item_id?: string
          user_id?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_views_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          auto_approve_bookings: boolean | null
          booking_count: number | null
          cancellation_policy: string | null
          category: Database["public"]["Enums"]["item_category"]
          created_at: string | null
          deposit_amount: number | null
          description: string
          featured: boolean | null
          id: string
          instant_book_enabled: boolean | null
          is_available: boolean | null
          item_condition: string | null
          last_edited_at: string | null
          latitude: number | null
          listing_status: string | null
          location: string
          longitude: number | null
          maximum_rental_days: number | null
          minimum_rental_days: number | null
          owner_id: string
          price_per_day: number
          tags: string[] | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          auto_approve_bookings?: boolean | null
          booking_count?: number | null
          cancellation_policy?: string | null
          category: Database["public"]["Enums"]["item_category"]
          created_at?: string | null
          deposit_amount?: number | null
          description: string
          featured?: boolean | null
          id?: string
          instant_book_enabled?: boolean | null
          is_available?: boolean | null
          item_condition?: string | null
          last_edited_at?: string | null
          latitude?: number | null
          listing_status?: string | null
          location: string
          longitude?: number | null
          maximum_rental_days?: number | null
          minimum_rental_days?: number | null
          owner_id: string
          price_per_day: number
          tags?: string[] | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          auto_approve_bookings?: boolean | null
          booking_count?: number | null
          cancellation_policy?: string | null
          category?: Database["public"]["Enums"]["item_category"]
          created_at?: string | null
          deposit_amount?: number | null
          description?: string
          featured?: boolean | null
          id?: string
          instant_book_enabled?: boolean | null
          is_available?: boolean | null
          item_condition?: string | null
          last_edited_at?: string | null
          latitude?: number | null
          listing_status?: string | null
          location?: string
          longitude?: number | null
          maximum_rental_days?: number | null
          minimum_rental_days?: number | null
          owner_id?: string
          price_per_day?: number
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_analytics: {
        Row: {
          booking_requests: number | null
          bookings_confirmed: number | null
          clicks: number | null
          created_at: string | null
          date: string
          id: string
          item_id: string
          revenue: number | null
          views: number | null
        }
        Insert: {
          booking_requests?: number | null
          bookings_confirmed?: number | null
          clicks?: number | null
          created_at?: string | null
          date: string
          id?: string
          item_id: string
          revenue?: number | null
          views?: number | null
        }
        Update: {
          booking_requests?: number | null
          bookings_confirmed?: number | null
          clicks?: number | null
          created_at?: string | null
          date?: string
          id?: string
          item_id?: string
          revenue?: number | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_analytics_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_edit_history: {
        Row: {
          created_at: string | null
          edit_type: string | null
          edited_by: string
          field_name: string
          id: string
          item_id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          created_at?: string | null
          edit_type?: string | null
          edited_by: string
          field_name: string
          id?: string
          item_id: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          created_at?: string | null
          edit_type?: string | null
          edited_by?: string
          field_name?: string
          id?: string
          item_id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_edit_history_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_edit_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          content: string
          created_at: string | null
          delivered_at: string | null
          id: string
          is_read: boolean | null
          read_at: string | null
          recipient_id: string
          rental_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          recipient_id: string
          rental_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          recipient_id?: string
          rental_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_audit_log: {
        Row: {
          action: string
          amount: number | null
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown
          rental_id: string
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          amount?: number | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          rental_id: string
          status: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          amount?: number | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          rental_id?: string
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_audit_log_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_holds: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          held_at: string
          held_by: string | null
          hold_reason: string
          id: string
          owner_payout: number
          platform_fee: number
          rental_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          held_at?: string
          held_by?: string | null
          hold_reason: string
          id?: string
          owner_payout: number
          platform_fee?: number
          rental_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          held_at?: string
          held_by?: string | null
          hold_reason?: string
          id?: string
          owner_payout?: number
          platform_fee?: number
          rental_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_holds_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_locks: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          locked_at: string
          locked_by: string
          rental_id: string
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          locked_at?: string
          locked_by: string
          rental_id: string
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          locked_at?: string
          locked_by?: string
          rental_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_locks_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: true
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reviews: {
        Row: {
          created_at: string
          id: string
          payment_hold_id: string
          review_notes: string | null
          review_status: string
          reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_hold_id: string
          review_notes?: string | null
          review_status: string
          reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_hold_id?: string
          review_notes?: string | null
          review_status?: string
          reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reviews_payment_hold_id_fkey"
            columns: ["payment_hold_id"]
            isOneToOne: false
            referencedRelation: "payment_holds"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string
          id: string
          is_verified: boolean | null
          latitude: number | null
          location: string | null
          longitude: number | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name: string
          id: string
          is_verified?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          is_verified?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string | null
          current_uses: number | null
          discount_amount: number
          discount_type: string
          id: string
          is_active: boolean | null
          max_uses: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          current_uses?: number | null
          discount_amount: number
          discount_type: string
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          current_uses?: number | null
          discount_amount?: number
          discount_type?: string
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string
          first_rental_completed: boolean | null
          id: string
          referee_id: string | null
          referee_reward: number | null
          referral_code: string
          referrer_id: string
          referrer_reward: number | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          first_rental_completed?: boolean | null
          id?: string
          referee_id?: string | null
          referee_reward?: number | null
          referral_code: string
          referrer_id: string
          referrer_reward?: number | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          first_rental_completed?: boolean | null
          id?: string
          referee_id?: string | null
          referee_reward?: number | null
          referral_code?: string
          referrer_id?: string
          referrer_reward?: number | null
          status?: string
        }
        Relationships: []
      }
      rental_delivery: {
        Row: {
          created_at: string
          delivery_fee: number
          delivery_instructions: string | null
          delivery_method: string
          delivery_provider: string | null
          id: string
          pickup_address: string | null
          pickup_completed_at: string | null
          pickup_scheduled_at: string | null
          rental_id: string
          return_address: string | null
          return_completed_at: string | null
          return_scheduled_at: string | null
          status: string
          tracking_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_fee?: number
          delivery_instructions?: string | null
          delivery_method: string
          delivery_provider?: string | null
          id?: string
          pickup_address?: string | null
          pickup_completed_at?: string | null
          pickup_scheduled_at?: string | null
          rental_id: string
          return_address?: string | null
          return_completed_at?: string | null
          return_scheduled_at?: string | null
          status?: string
          tracking_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_fee?: number
          delivery_instructions?: string | null
          delivery_method?: string
          delivery_provider?: string | null
          id?: string
          pickup_address?: string | null
          pickup_completed_at?: string | null
          pickup_scheduled_at?: string | null
          rental_id?: string
          return_address?: string | null
          return_completed_at?: string | null
          return_scheduled_at?: string | null
          status?: string
          tracking_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_delivery_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_insurance: {
        Row: {
          coverage_amount: number
          created_at: string
          id: string
          plan_type: string
          premium_cost: number
          rental_id: string
        }
        Insert: {
          coverage_amount: number
          created_at?: string
          id?: string
          plan_type: string
          premium_cost?: number
          rental_id: string
        }
        Update: {
          coverage_amount?: number
          created_at?: string
          id?: string
          plan_type?: string
          premium_cost?: number
          rental_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_insurance_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_modifications: {
        Row: {
          created_at: string
          id: string
          new_end_date: string
          original_end_date: string
          price_adjustment: number
          reason: string | null
          rental_id: string
          requested_at: string
          requested_by: string
          responded_at: string | null
          responded_by: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_end_date: string
          original_end_date: string
          price_adjustment: number
          reason?: string | null
          rental_id: string
          requested_at?: string
          requested_by: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          new_end_date?: string
          original_end_date?: string
          price_adjustment?: number
          reason?: string | null
          rental_id?: string
          requested_at?: string
          requested_by?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_modifications_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rentals: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          item_id: string
          owner_confirmed_completion: boolean | null
          owner_id: string
          payment_method: string | null
          payment_status: string | null
          renter_confirmed_completion: boolean | null
          renter_id: string
          start_date: string
          status: Database["public"]["Enums"]["rental_status"] | null
          total_price: number
          toyyibpay_bill_code: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          item_id: string
          owner_confirmed_completion?: boolean | null
          owner_id: string
          payment_method?: string | null
          payment_status?: string | null
          renter_confirmed_completion?: boolean | null
          renter_id: string
          start_date: string
          status?: Database["public"]["Enums"]["rental_status"] | null
          total_price: number
          toyyibpay_bill_code?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          item_id?: string
          owner_confirmed_completion?: boolean | null
          owner_id?: string
          payment_method?: string | null
          payment_status?: string | null
          renter_confirmed_completion?: boolean | null
          renter_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["rental_status"] | null
          total_price?: number
          toyyibpay_bill_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rentals_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          review_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          review_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_images_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_votes: {
        Row: {
          created_at: string
          id: string
          is_helpful: boolean
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_helpful: boolean
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_helpful?: boolean
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_votes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          helpful_count: number | null
          id: string
          owner_response: string | null
          owner_response_at: string | null
          rating: number
          rental_id: string
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          owner_response?: string | null
          owner_response_at?: string | null
          rating: number
          rental_id: string
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          owner_response?: string | null
          owner_response_at?: string | null
          rating?: number
          rental_id?: string
          reviewee_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_items: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          category: string | null
          created_at: string
          id: string
          instant_book_only: boolean | null
          location: string | null
          max_price: number | null
          min_price: number | null
          name: string
          notify_on_new: boolean | null
          user_id: string
          verified_only: boolean | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          instant_book_only?: boolean | null
          location?: string | null
          max_price?: number | null
          min_price?: number | null
          name: string
          notify_on_new?: boolean | null
          user_id: string
          verified_only?: boolean | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          instant_book_only?: boolean | null
          location?: string | null
          max_price?: number | null
          min_price?: number | null
          name?: string
          notify_on_new?: boolean | null
          user_id?: string
          verified_only?: boolean | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          payment_date: string | null
          rental_id: string
          status: Database["public"]["Enums"]["transaction_status"] | null
          toyyibpay_bill_code: string | null
          toyyibpay_transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          payment_date?: string | null
          rental_id: string
          status?: Database["public"]["Enums"]["transaction_status"] | null
          toyyibpay_bill_code?: string | null
          toyyibpay_transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          payment_date?: string | null
          rental_id?: string
          status?: Database["public"]["Enums"]["transaction_status"] | null
          toyyibpay_bill_code?: string | null
          toyyibpay_transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_promo_usage: {
        Row: {
          id: string
          promo_code_id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          promo_code_id: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          promo_code_id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_promo_usage_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_views: {
        Row: {
          id: string
          item_id: string
          user_id: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          item_id: string
          user_id?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          user_id?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_views_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          performed_by: string | null
          verification_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
          verification_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
          verification_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_audit_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_audit_log_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_requests: {
        Row: {
          admin_notes: string | null
          ai_analysis_result: Json | null
          created_at: string | null
          date_of_birth: string | null
          document_back_url: string | null
          document_front_url: string
          document_quality_score: number | null
          document_type: Database["public"]["Enums"]["document_type"]
          face_match_score: number | null
          full_name_on_document: string
          ic_number: string | null
          id: string
          liveness_score: number | null
          overall_confidence_score: number | null
          rejection_reason: string | null
          selfie_url: string
          status: Database["public"]["Enums"]["verification_status"]
          updated_at: string | null
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          admin_notes?: string | null
          ai_analysis_result?: Json | null
          created_at?: string | null
          date_of_birth?: string | null
          document_back_url?: string | null
          document_front_url: string
          document_quality_score?: number | null
          document_type: Database["public"]["Enums"]["document_type"]
          face_match_score?: number | null
          full_name_on_document: string
          ic_number?: string | null
          id?: string
          liveness_score?: number | null
          overall_confidence_score?: number | null
          rejection_reason?: string | null
          selfie_url: string
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string | null
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          admin_notes?: string | null
          ai_analysis_result?: Json | null
          created_at?: string | null
          date_of_birth?: string | null
          document_back_url?: string | null
          document_front_url?: string
          document_quality_score?: number | null
          document_type?: Database["public"]["Enums"]["document_type"]
          face_match_score?: number | null
          full_name_on_document?: string
          ic_number?: string | null
          id?: string
          liveness_score?: number | null
          overall_confidence_score?: number | null
          rejection_reason?: string | null
          selfie_url?: string
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string | null
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string | null
          description: string
          expires_at: string | null
          id: string
          idempotency_key: string | null
          reference_id: string | null
          status: string | null
          toyyibpay_transaction_id: string | null
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string | null
          description: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          reference_id?: string | null
          status?: string | null
          toyyibpay_transaction_id?: string | null
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          description?: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          reference_id?: string | null
          status?: string | null
          toyyibpay_transaction_id?: string | null
          type?: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          account_holder_name: string | null
          account_number: string | null
          amount: number
          bank_name: string | null
          created_at: string
          id: string
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_holder_name?: string | null
          account_number?: string | null
          amount: number
          bank_name?: string | null
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_holder_name?: string | null
          account_number?: string | null
          amount?: number
          bank_name?: string | null
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_payment_lock: {
        Args: { p_rental_id: string; p_user_id: string }
        Returns: boolean
      }
      calculate_verification_confidence: {
        Args: { doc_quality: number; face_match: number; liveness: number }
        Returns: number
      }
      cleanup_expired_payment_locks: { Args: never; Returns: undefined }
      generate_referral_code: { Args: never; Returns: string }
      get_listing_conversion_rate: {
        Args: { item_id_param: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_item_views: {
        Args: { item_id_param: string }
        Returns: undefined
      }
      increment_wallet_balance: {
        Args: { p_amount: number; p_user_id: string }
        Returns: number
      }
      release_payment_lock: {
        Args: { p_rental_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      document_type: "mykad" | "passport" | "driving_license"
      item_category:
        | "electronics"
        | "vehicles"
        | "tools"
        | "sports"
        | "party"
        | "other"
      notification_type:
        | "rental_request"
        | "rental_approved"
        | "rental_rejected"
        | "payment_received"
        | "review_received"
        | "message_received"
      rental_status:
        | "pending"
        | "approved"
        | "active"
        | "completed"
        | "cancelled"
        | "rejected"
      transaction_status: "pending" | "completed" | "refunded" | "failed"
      verification_status:
        | "pending"
        | "processing"
        | "approved"
        | "rejected"
        | "resubmit_required"
      wallet_transaction_type:
        | "deposit"
        | "withdrawal"
        | "rental_payment"
        | "rental_earning"
        | "refund"
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
      app_role: ["admin", "moderator", "user"],
      document_type: ["mykad", "passport", "driving_license"],
      item_category: [
        "electronics",
        "vehicles",
        "tools",
        "sports",
        "party",
        "other",
      ],
      notification_type: [
        "rental_request",
        "rental_approved",
        "rental_rejected",
        "payment_received",
        "review_received",
        "message_received",
      ],
      rental_status: [
        "pending",
        "approved",
        "active",
        "completed",
        "cancelled",
        "rejected",
      ],
      transaction_status: ["pending", "completed", "refunded", "failed"],
      verification_status: [
        "pending",
        "processing",
        "approved",
        "rejected",
        "resubmit_required",
      ],
      wallet_transaction_type: [
        "deposit",
        "withdrawal",
        "rental_payment",
        "rental_earning",
        "refund",
      ],
    },
  },
} as const
