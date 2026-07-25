export type AppRole = 'super_admin' | 'admin' | 'moderator' | 'user';
export type RentalStatus = 'pending_approval' | 'approved' | 'rejected' | 'paid' | 'pending' | 'active' | 'completed' | 'cancelled' | 'disputed';
export type ItemCategory = 'electronics' | 'vehicles' | 'tools' | 'sports' | 'party' | 'fashion' | 'other';
export type ListingStatus = 'active' | 'paused' | 'draft' | 'archived';
export type NotificationType = 'rental_request' | 'rental_approved' | 'rental_rejected' | 'payment_received' | 'review_received' | 'message_received' | 'dispute_opened';

export type ReportTargetType = 'item' | 'user' | 'message';
export type ReportStatus = 'pending' | 'investigating' | 'resolved' | 'dismissed';

export interface Report {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  description?: string;
  status: ReportStatus;
  resolved_by?: string;
  resolution_note?: string;
  created_at: string;
  updated_at: string;
  reporter?: {
    full_name: string;
    avatar_url?: string | null;
  };
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  rental_requests: boolean;
  rental_updates: boolean;
  messages: boolean;
  reviews: boolean;
  payment_updates: boolean;
  verification_updates: boolean;
  marketing: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavedSearch {
  id: string;
  user_id: string;
  query_text?: string;
  category?: string;
  location?: string;
  min_price?: number;
  max_price?: number;
  sort_by?: string;
  label?: string;
  notify_on_new: boolean;
  last_notified_at?: string;
  created_at: string;
}

export type VerificationLevel = 'unverified' | 'email' | 'basic' | 'kyc' | 'premium';

export interface Profile {
  id: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  is_verified: boolean;
  verification_level?: VerificationLevel;
  identity_number_hash?: string;
  trust_score?: number;
  ekyc_provider?: string;
  ekyc_session_id?: string;
  ekyc_verified_at?: string;
  total_rentals_completed?: number;
  total_reviews_received?: number;
  response_rate?: number;
  avg_response_time_minutes?: number;
  is_suspended?: boolean;
  suspension_reason?: string;
  suspended_at?: string;
  preferred_role?: string;
  terms_accepted_at?: string;
  terms_version?: number;
  bio?: string;
  is_deleted?: boolean;
  deleted_at?: string;
  last_active_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Item {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: ItemCategory;
  price_per_day: number;
  location: string;
  latitude?: number;
  longitude?: number;
  is_available: boolean;
  listing_status?: ListingStatus;
  view_count?: number;
  cancellation_policy?: string;
  deposit_amount?: number;
  item_condition?: string;
  minimum_rental_days?: number;
  maximum_rental_days?: number;
  instant_book_enabled?: boolean;
  auto_approve_bookings?: boolean;
  specifications?: Record<string, string>;
  created_at: string;
  updated_at: string;
  owner?: Profile;
  images?: ItemImage[];
}

export interface ItemImage {
  id: string;
  item_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  created_at: string;
}

export interface Rental {
  id: string;
  item_id: string;
  renter_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  original_total_price?: number;
  discount_amount?: number;
  promo_code_id?: string;
  status: RentalStatus;
  created_at: string;
  updated_at: string;
  pickup_code?: string;
  handover_photos?: string[];
  return_photos?: string[];
  actual_start_at?: string;
  dispute_reason?: string;
  dispute_status?: 'open' | 'resolved_refund' | 'resolved_payout';
  is_disputed?: boolean;
  item?: Item;
  renter?: Profile;
  owner?: Profile;
}

export interface Review {
  id: string;
  rental_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  reviewer?: Profile;
}

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  rental_id?: string;
  content: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
  delivered_at?: string;
  attachment_url?: string;
  attachment_type?: string;
  pending?: boolean;
  sender?: Profile;
  recipient?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface PromoCode {
  id: string;
  code: string;
  discount_amount: number;
  discount_type: 'percentage' | 'fixed';
  max_uses?: number;
  current_uses: number;
  valid_from: string;
  valid_until?: string;
  is_active: boolean;
  created_at: string;
}

export interface ListingEditFormData {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  price_per_day?: number;
  location?: string;
  deposit_amount?: number;
  minimum_rental_days?: number;
  maximum_rental_days?: number | null;
  instant_book_enabled?: boolean;
  auto_approve_bookings?: boolean;
  item_condition?: string;
  cancellation_policy?: string;
  tags?: string[];
  item_images?: Array<{ id: string; image_url: string; is_primary: boolean }>;
}

export interface UserPromoUsage {
  id: string;
  user_id: string;
  promo_code_id: string;
  used_at: string;
}
