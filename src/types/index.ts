export type AppRole = 'admin' | 'moderator' | 'user';
export type RentalStatus = 'pending' | 'approved' | 'active' | 'completed' | 'cancelled' | 'rejected';
export type ItemCategory = 'electronics' | 'vehicles' | 'tools' | 'sports' | 'party' | 'other';
export type TransactionStatus = 'pending' | 'completed' | 'refunded' | 'failed';
export type NotificationType = 'rental_request' | 'rental_approved' | 'rental_rejected' | 'payment_received' | 'review_received' | 'message_received';
export type WalletTransactionType = 'deposit' | 'withdrawal' | 'rental_payment' | 'rental_earning' | 'refund';

export interface Profile {
  id: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  is_verified: boolean;
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
  status: RentalStatus;
  payment_status: string;
  payment_method?: string;
  toyyibpay_bill_code?: string;
  owner_confirmed_completion?: boolean;
  renter_confirmed_completion?: boolean;
  created_at: string;
  updated_at: string;
  item?: Item;
  renter?: Profile;
  owner?: Profile;
}

export interface Transaction {
  id: string;
  rental_id: string;
  amount: number;
  status: TransactionStatus;
  toyyibpay_bill_code?: string;
  toyyibpay_transaction_id?: string;
  payment_date?: string;
  created_at: string;
  updated_at: string;
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

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: WalletTransactionType;
  amount: number;
  description: string;
  reference_id?: string;
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

export interface UserPromoUsage {
  id: string;
  user_id: string;
  promo_code_id: string;
  used_at: string;
}
