export type ShopPlan = 'starter' | 'professional' | 'enterprise';
export type BillingProvider = 'paddle' | 'stripe' | 'manual';
export type BillingInterval = 'month' | 'year';
export type BlogPostStatus = 'draft' | 'published' | 'archived';
export type BillingSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'paused'
  | 'unknown';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export type CallOutcome =
  | 'booked'
  | 'info_only'
  | 'missed'
  | 'transferred'
  | 'callback_scheduled'
  | 'callback_completed'
  | 'voicemail'
  | 'error';

export type CallbackStatus = 'queued' | 'dialing' | 'connected' | 'completed' | 'failed' | 'cancelled';
export type ContactRequestStatus = 'new' | 'contacted' | 'qualified' | 'closed' | 'spam';

export type JobStatus = 'queued' | 'running' | 'leased' | 'completed' | 'failed' | 'dead_letter' | 'cancelled';

export type JobType =
  | 'realtime_session_dispatch'
  | 'appointment_reminder_24h'
  | 'appointment_reminder_2h'
  | 'missed_call_followup_sms'
  | 'booking_link_sms'
  | 'callback_outbound_call'
  | 'review_request_sms'
  | 'post_call_summary';

export type TranscriptStatus = 'pending' | 'completed' | 'failed';

export type BusinessHours = Record<
  string,
  | {
      closed: true;
    }
  | {
      open: string;
      close: string;
    }
>;

export interface ServiceItem {
  name: string;
  duration_min: number;
  price: number;
}

export interface Shop {
  id: string;
  name: string;
  brand_slug?: string | null;
  phone_number: string;
  user_phone: string;
  backup_phone?: string | null;
  user_name?: string | null;
  address?: string | null;
  timezone: string;
  services: ServiceItem[];
  hours: BusinessHours;
  cancel_policy: string;
  promotions?: string | null;
  booking_url?: string | null;
  ai_voice?: string | null;
  ai_welcome_message?: string | null;
  ai_custom_instructions?: string | null;
  allow_transfers: boolean;
  allow_callbacks: boolean;
  send_reminder_sms: boolean;
  send_review_request_sms: boolean;
  send_missed_call_followup_sms: boolean;
  plan: ShopPlan;
  active: boolean;
  google_cal_id?: string | null;
  google_cal_credentials_encrypted?: string | null;
}

export interface Customer {
  phone: string;
  shop_id: string;
  full_name?: string | null;
  last_service?: string | null;
  preferred_tech?: string | null;
  visit_count: number;
  notes?: string | null;
  sms_opt_out: boolean;
  last_visit_at?: string | null;
}

export interface TimeSlot {
  date: string;
  time: string;
  techName?: string;
}

export interface BookingInput {
  shopId: string;
  customerPhone: string;
  customerName?: string;
  service: string;
  techName?: string;
  datetimeIso: string;
  timezone: string;
  durationMin: number;
  source: 'inbound_call' | 'outbound_call' | 'sms' | 'manual';
  notes?: string;
  callLogId?: string;
  idempotencyKey: string;
}

export interface BookingResult {
  bookingId: string;
  calendarEventId?: string;
  confirmed: boolean;
}

export interface TransferResult {
  initiated: boolean;
  target: 'user' | 'frontdesk' | 'voicemail';
  providerCallId?: string;
}

export type ToolErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CALENDAR_TIMEOUT'
  | 'CALENDAR_CONFLICT'
  | 'SMS_FAILED'
  | 'TRANSFER_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface ToolError {
  error: string;
  retryable?: boolean;
  code?: ToolErrorCode;
}

export interface BookingView {
  service: string;
  localDateLabel: string;
  localTimeLabel: string;
  tech_name?: string | null;
  customerPhone?: string;
}

export interface CallbackJob {
  id: string;
  shopId: string;
  customerPhone: string;
  reason: string;
}

export interface BillingCustomer {
  id: string;
  shopId: string;
  provider: BillingProvider;
  providerCustomerId: string;
  email?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BillingSubscription {
  id: string;
  shopId: string;
  provider: BillingProvider;
  providerSubscriptionId: string;
  providerCustomerId?: string | null;
  plan: ShopPlan;
  status: BillingSubscriptionStatus;
  interval: BillingInterval;
  currency: string;
  amount: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BillingCheckoutSession {
  provider: BillingProvider;
  checkoutUrl: string;
  providerTransactionId?: string | null;
  providerCustomerId?: string | null;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  status: BlogPostStatus;
  seoTitle?: string | null;
  seoDescription?: string | null;
  coverImageUrl?: string | null;
  tags: string[];
  authorName?: string | null;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContactRequest {
  id: string;
  requestId: string;
  fullName: string;
  businessName: string;
  email: string;
  phoneNumber: string;
  businessType: string;
  currentSetup: string;
  helpNeed: string;
  bestTime: string;
  status: ContactRequestStatus;
  source: string;
  ip?: string | null;
  notes?: string | null;
  handledBy?: string | null;
  handledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
