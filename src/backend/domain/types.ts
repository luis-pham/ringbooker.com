export type ShopPlan = 'starter' | 'professional' | 'enterprise';
export type ShopVertical = 'nail_salon' | 'hair_salon' | 'day_spa' | 'med_spa' | 'beauty_clinic';
export type BillingProvider = 'internal' | 'paddle' | 'stripe' | 'manual';
export type BillingInterval = 'month' | 'year';
export type BlogPostStatus = 'draft' | 'published' | 'archived';
export type BillingSubscriptionStatus =
  | 'incomplete'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'canceled'
  | 'trial_expired'
  | 'unpaid'
  | 'unknown';
export type BillingPaymentMethodStatus = 'none' | 'pending' | 'valid' | 'failed' | 'unknown';
export type VagaroMode = 'link_only' | 'live_sync';
export type VagaroConnectionStatus = 'disconnected' | 'pending' | 'connected' | 'error';
export type AcuityConnectionStatus = 'disconnected' | 'connected' | 'error';

export type AcuityTokenResponse = {
  access_token: string;
  token_type: 'Bearer';
};

export type BookingStatus =
  | 'pending'
  | 'captured'
  | 'link_sent'
  | 'contacted'
  | 'confirmed'
  | 'reminder_sent'
  | 'cancel_link_sent'
  | 'declined'
  | 'cancelled'
  | 'rescheduled'
  | 'completed'
  | 'no_show';

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
export type ContactRequestIntent = 'demo' | 'enterprise' | 'sales' | 'support' | 'general';
export type ContactRequestPlanInterest = 'starter' | 'professional' | 'enterprise' | 'unknown';

export type JobStatus = 'queued' | 'running' | 'leased' | 'completed' | 'failed' | 'dead_letter' | 'cancelled';

export type JobType =
  | 'realtime_session_dispatch'
  | 'booking_confirmation_sms'
  | 'appointment_reminder_24h'
  | 'appointment_reminder_2h'
  | 'missed_call_followup_sms'
  | 'booking_link_sms'
  | 'cancellation_request_alert'
  | 'callback_outbound_call'
  | 'review_request_sms'
  | 'post_call_summary'
  | 'handoff_failed_owner_sms'
  | 'new_booking_request_owner_alert'
  | 'callback_request_owner_alert'
  | 'lifecycle_email'
  | 'trial_reminder_email'
  | 'trial_expiry_check'
  | 'technical_failure_callback'
  | 'ai_failure_owner_alert'
  | 'max_duration_alert';

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

export type ShopServicePriceType = 'fixed' | 'from' | 'varies' | 'consultation';

export interface ShopServiceVariant {
  id: string;
  label: string;
  durationMinutes?: number | null;
  durationText?: string | null;
  priceAmount?: number | null;
  priceCurrency: string;
  priceType: ShopServicePriceType;
  sortOrder: number;
  notes?: string | null;
}

export interface ServiceCategory {
  id: string;
  shopId: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShopService {
  id: string;
  shopId: string;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  durationText?: string | null;
  durationMinutes?: number | null;
  priceAmount?: number | null;
  priceCurrency: string;
  priceType: ShopServicePriceType;
  bookable: boolean;
  active: boolean;
  sortOrder: number;
  aliases: string[];
  bookingNotes?: string | null;
  variants?: ShopServiceVariant[];
  externalProvider?: string | null;
  externalServiceId?: string | null;
  externalLocationId?: string | null;
  externalStaffRequired?: boolean;
  externalMetadata?: Record<string, unknown>;
  aiKnowledgeStatus?: 'imported_unreviewed' | 'owner_reviewed' | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceMatchResult {
  matchedServiceId?: string;
  matchedCategoryId?: string;
  confidence: number;
  matchedName?: string;
  reason?: string;
  requiresClarification?: boolean;
  bookable?: boolean;
}

export interface ShopServiceCatalog {
  categories: ServiceCategory[];
  services: ShopService[];
}

export interface StaffMember {
  name: string;
  role?: string | null;
  specialties?: string[];
  notes?: string | null;
  active?: boolean;
}

export type ShopStaffExternalProvider = 'square' | 'vagaro' | 'mindbody' | 'acuity';

export interface ShopStaff {
  id: string;
  shopId: string;
  name: string;
  role?: string | null;
  specialties: string[];
  notes?: string | null;
  active: boolean;
  externalProvider?: ShopStaffExternalProvider | null;
  externalStaffId?: string | null;
  externalMetadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShopStaffService {
  id: string;
  shopId: string;
  staffId: string;
  serviceId: string;
  createdAt?: string;
}

export interface BusinessFaqItem {
  question: string;
  answer: string;
}


export interface ShopLocation {
  id: string;
  shopId: string;
  name: string;
  address?: string | null;
  timezone: string;
  phoneNumber?: string | null;
  telnyxNumber?: string | null;
  businessHours: BusinessHours;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShopRoutingRule {
  id: string;
  shopId: string;
  locationId?: string | null;
  ruleType: string;
  conditionJson: Record<string, unknown>;
  actionJson: Record<string, unknown>;
  priority: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommercialAccount {
  shopId: string;
  contractStatus: 'draft' | 'sent' | 'signed' | 'active' | 'paused' | 'terminated';
  monthlyMinimumCents?: number | null;
  setupFeeCents?: number | null;
  includedLocations?: number | null;
  includedMinutes?: number | null;
  includedCapturedCallers?: number | null;
  maxConcurrentLiveCalls?: number | null;
  maxCallDurationSeconds?: number | null;
  overageRateCents?: number | null;
  billingMethod: 'manual_invoice' | 'paddle_custom' | 'wire' | 'ach' | 'other';
  contractSignedAt?: string | null;
  approvedAt?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommercialGoLiveApprovalEvent {
  id: string;
  shopId: string;
  eventType: 'approved';
  actorEmail: string;
  note?: string | null;
  createdAt: string;
}

export interface ShopActiveCallSession {
  id: string;
  shopId: string;
  callSessionId: string;
  provider: string;
  startedAt: string;
  expiresAt: string;
  releasedAt?: string | null;
  status: 'active' | 'released' | 'expired';
  createdAt?: string;
  updatedAt?: string;
}

export interface Shop {
  id: string;
  name: string;
  vertical?: ShopVertical | null;
  /** Onboarding hint for beauty_clinic sub-vertical (lash studio, wax, etc.). */
  vertical_detail?: string | null;
  brand_slug?: string | null;
  phone_number: string;
  user_phone: string;
  handoff_phone?: string | null;
  handoff_availability?: 'business_hours' | 'always' | 'custom';
  handoff_custom_hours?: BusinessHours | null;
  user_name?: string | null;
  address?: string | null;
  email?: string | null;
  timezone: string;
  services: ServiceItem[];
  service_catalog?: ShopServiceCatalog;
  /** User-confirmed services the business does not offer. Never infer this from vertical alone. */
  not_offered_services?: string[];
  staff?: StaffMember[];
  /** Normalized staff records loaded from shop_staff when a workflow needs platform sync metadata. */
  shopStaff?: ShopStaff[];
  faqs?: BusinessFaqItem[];
  hours: BusinessHours;
  cancel_policy: string;
  promotions?: string | null;
  booking_url?: string | null;
  booking_method?: 'app' | 'direct' | 'later' | null;
  selected_integration?: string | null;
  vagaro_mode?: VagaroMode;
  vagaro_booking_url?: string | null;
  vagaro_webhook_token?: string | null;
  vagaro_client_id?: string | null;
  vagaro_client_secret_encrypted?: string | null;
  vagaro_region?: string | null;
  vagaro_connection_status?: VagaroConnectionStatus;
  vagaro_fallback_url?: string | null;
  vagaro_business_id?: string | null;
  vagaro_business_name?: string | null;
  vagaro_location_id?: string | null;
  vagaro_locations?: unknown | null;
  website_url?: string | null;
  languages?: string[];
  current_onboarding_step?: number | null;
  setup_method?: 'forward' | 'new_number' | null;
  forwarding_type?: 'no_answer' | 'all' | 'busy' | 'unreachable' | null;
  forwarding_carrier?: string | null;
  forwarding_country?: string | null;
  telnyx_number?: string | null;
  forwarding_number_status?: 'none' | 'provisioning' | 'provisioned' | 'failed' | null;
  forwarding_number_provisioning_started_at?: string | null;
  forwarding_number_provisioned_at?: string | null;
  forwarding_number_released_at?: string | null;
  forwarding_number_release_reason?: string | null;
  forwarding_number_provider_order_id?: string | null;
  forwarding_number_last_error?: string | null;
  detected_carrier?: string | null;
  detected_line_type?: string | null;
  carrier_detected_at?: string | null;
  test_call_count?: number;
  test_call_limit?: number;
  ai_voice?: string | null;
  ai_welcome_message?: string | null;
  ai_custom_instructions?: string | null;
  allow_transfers: boolean;
  call_recording_enabled?: boolean;
  allow_callbacks: boolean;
  /** Explicit owner/staff consent for operational SMS alerts. */
  sms_owner_opted_in?: boolean;
  send_reminder_sms: boolean;
  send_review_request_sms: boolean;
  send_missed_call_followup_sms: boolean;
  send_call_summary_sms?: boolean;
  owner_call_summary_sms_timing?: 'business_hours' | 'always';
  send_callback_request_sms?: boolean;
  owner_callback_request_sms_timing?: 'business_hours' | 'always';
  send_daily_digest_sms?: boolean;
  owner_daily_digest_time?: string | null;
  sms_quiet_hours_start?: string | null;
  sms_quiet_hours_end?: string | null;
  plan: ShopPlan;
  active: boolean;
  google_cal_id?: string | null;
  google_cal_credentials_encrypted?: string | null;
  /** Provider-neutral credentials for booking/calendar integrations such as Mindbody. */
  integration_credentials_encrypted?: string | null;
  acuity_access_token_encrypted?: string | null;
  acuity_user_id?: string | null;
  acuity_connection_status?: AcuityConnectionStatus;
  /** ISO 3166-1 alpha-2 country code for the business location (e.g. 'US', 'AU', 'GB'). Defaults to 'US'. */
  country_code?: string | null;
}

export type AcuityOAuthCredentialsUpdate = Pick<
  Shop,
  'acuity_access_token_encrypted' | 'acuity_user_id' | 'acuity_connection_status'
>;

export type VagaroSettings = Pick<
  Shop,
  | 'vagaro_mode'
  | 'vagaro_booking_url'
  | 'vagaro_webhook_token'
  | 'vagaro_client_id'
  | 'vagaro_client_secret_encrypted'
  | 'vagaro_region'
  | 'vagaro_connection_status'
  | 'vagaro_fallback_url'
  | 'vagaro_business_id'
  | 'vagaro_business_name'
  | 'vagaro_location_id'
  | 'vagaro_locations'
>;

export type VagaroWebhookEvent = {
  id: string;
  shop_id: string;
  event_type: string;
  action?: string | null;
  payload: unknown;
  raw_headers?: Record<string, string> | null;
  received_at: string;
  processed_at?: string | null;
  processing_error?: string | null;
};

export type BusinessKnowledgeSuggestionType = 'staff' | 'policy' | 'faq' | 'promotion' | 'booking_hint';
export type BusinessKnowledgeSuggestionSource = 'website' | 'llm' | 'jsonld' | 'deterministic';
export type BusinessKnowledgeSuggestionStatus = 'pending' | 'applied' | 'dismissed';

export interface BusinessKnowledgeSuggestion {
  id: string;
  shopId: string;
  sourceUrl: string;
  suggestionType: BusinessKnowledgeSuggestionType;
  payload: Record<string, unknown>;
  payloadHash: string;
  confidence: number;
  source: BusinessKnowledgeSuggestionSource;
  evidenceSnippet?: string | null;
  status: BusinessKnowledgeSuggestionStatus;
  createdAt: string;
  updatedAt: string;
  appliedAt?: string | null;
  dismissedAt?: string | null;
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
  sms_consent: boolean;
  sms_consent_at?: string | null;
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
  customerEmail?: string;
  service: string;
  techName?: string;
  teamMemberId?: string;
  datetimeIso: string;
  timezone: string;
  durationMin: number;
  source: 'inbound_call' | 'outbound_call' | 'sms' | 'manual';
  notes?: string;
  callLogId?: string;
  matchedServiceId?: string | null;
  matchedServiceConfidence?: number | null;
  idempotencyKey: string;
}

export type BookingProviderStatus =
  | 'request_only'
  | 'provider_confirmed'
  | 'provider_failed'
  | 'provider_unavailable'
  | 'provider_disabled'
  | 'missing_mapping';

export interface BookingResult {
  bookingId: string;
  calendarEventId?: string;
  confirmed: boolean;
  providerStatus?: BookingProviderStatus;
  providerErrorReason?: string;
}

export interface TransferResult {
  initiated: boolean;
  target: 'user' | 'frontdesk' | 'voicemail';
  providerCallId?: string;
}

export type ToolErrorCode =
  | 'VALIDATION_ERROR'
  | 'APPOINTMENT_TIME_NOT_VALIDATED'
  | 'NOT_FOUND'
  | 'CALENDAR_TIMEOUT'
  | 'CALENDAR_CONFLICT'
  | 'BOOKING_LINK_PROVIDER'
  | 'OUTSIDE_BUSINESS_HOURS'
  | 'UNKNOWN_SERVICE'
  | 'SERVICE_NEEDS_CLARIFICATION'
  | 'SERVICE_NOT_BOOKABLE'
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
  providerCustomerId?: string | null;
  email?: string | null;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BillingSubscription {
  id: string;
  shopId: string;
  provider: BillingProvider;
  providerSubscriptionId?: string | null;
  providerCustomerId?: string | null;
  providerPriceId?: string | null;
  providerProductId?: string | null;
  plan: ShopPlan;
  status: BillingSubscriptionStatus;
  interval: BillingInterval;
  currency: string;
  /** Legacy dollar amount kept for existing UI/tests; prefer amountCents for new code. */
  amount: number;
  amountCents?: number | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  trialExpiredAt?: string | null;
  canceledAt?: string | null;
  pausedAt?: string | null;
  paymentMethodStatus?: BillingPaymentMethodStatus;
  paymentMethodAddedAt?: string | null;
  activatedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export type ShopOverageChargeStatus = 'pending' | 'charged' | 'failed' | 'skipped';
export type ShopUsageAlertType = '80pct_warning' | '100pct_overage' | 'overage_charged';

export interface ShopOverageCharge {
  id: string;
  shopId: string;
  billingSubscriptionId?: string | null;
  periodStart: string;
  periodEnd: string;
  includedCallers: number;
  capturedCallers: number;
  overageCallers: number;
  rateCents: number;
  amountCents: number;
  paddleSubscriptionId?: string | null;
  paddleTransactionId?: string | null;
  status: ShopOverageChargeStatus;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopUsageAlert {
  id: string;
  shopId: string;
  alertType: ShopUsageAlertType;
  periodStart: string;
  sentAt: string;
  idempotencyKey: string;
}

export type ForwardingSetupVerifiedVia =
  | 'inbound_test_call'
  | 'manual_confirmation'
  | 'forwarding_test'
  | 'user_confirmed'
  /** DB backfill for shops already live before P1.3 forwarding verification columns existed (see scripts/backfill-forwarding-verification-legacy-live.sql). */
  | 'legacy_live';

export type ForwardingTestSessionStatus = 'pending' | 'passed' | 'expired' | 'failed';

export interface ForwardingTestSession {
  id: string;
  shopId: string;
  status: ForwardingTestSessionStatus;
  forwardingNumber: string;
  expectedBusinessPhone: string | null;
  startedAt: string;
  expiresAt: string;
  passedAt: string | null;
  inboundCallSessionId: string | null;
  inboundCallControlId: string | null;
  callerPhone: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ShopAccessState {
  id: string;
  shopId: string;
  liveCallsEnabled: boolean;
  goLiveAt?: string | null;
  liveCallsPausedReason?: string | null;
  liveCallsPausedAt?: string | null;
  lastAccessCheckAt?: string | null;
  forwardingClaimedAt?: string | null;
  forwardingVerifiedAt?: string | null;
  forwardingVerifiedSource?: 'inbound_test' | 'admin_override' | null;
  /** @deprecated Use forwardingVerifiedAt. Kept as a compatibility alias during rollout. */
  forwardingSetupVerifiedAt?: string | null;
  /** @deprecated Use forwardingVerifiedSource. Kept as a compatibility alias during rollout. */
  forwardingSetupVerifiedVia?: ForwardingSetupVerifiedVia | null;
  commercialGoLiveApprovedAt?: string | null;
  commercialGoLiveApprovedBy?: string | null;
  commercialGoLiveApprovalNote?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type TestCallAttemptType = 'outbound_call_me' | 'inbound_test_number' | 'demo_vertical';
export type TestCallAttemptStatus = 'requested' | 'started' | 'completed' | 'failed' | 'canceled';

export interface TestCallAttempt {
  id: string;
  shopId: string;
  userId?: string | null;
  type: TestCallAttemptType;
  status: TestCallAttemptStatus;
  destinationPhone?: string | null;
  sourceNumber?: string | null;
  testNumberId?: string | null;
  transcriptId?: string | null;
  callSummaryId?: string | null;
  durationSeconds?: number | null;
  errorReason?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export type BillingNotificationType =
  | 'trial_started'
  | 'trial_ends_7_days'
  | 'trial_ends_3_days'
  | 'trial_ends_1_day'
  | 'trial_ended'
  | 'finish_onboarding_reminder_1'
  | 'finish_onboarding_reminder_2'
  | 'add_payment_method_go_live'
  | 'payment_method_added'
  | 'forwarding_number_ready'
  | 'forwarding_number_failed_user'
  | 'forwarding_number_failed_internal'
  | 'forwarding_not_verified_24h'
  | 'forwarding_not_verified_72h'
  | 'forwarding_number_abandoned_24h'
  | 'forwarding_number_abandoned_48h'
  | 'forwarding_number_released_72h'
  | 'forwarding_verified'
  | 'subscription_active'
  | 'payment_failed'
  | 'live_answering_enabled'
  | 'live_answering_billing_paused'
  | 'live_answering_billing_paused_canceled'
  | 'live_answering_billing_paused_paused'
  | 'live_answering_billing_paused_past_due'
  | 'live_answering_billing_paused_payment_failed'
  | 'live_answering_billing_restored'
  | 'internal_paddle_alert'
  | 'internal_telnyx_alert'
  | 'internal_live_billing_blocked_alert';
export type BillingNotificationChannel = 'email' | 'sms' | 'app';

export interface BillingNotification {
  id: string;
  shopId: string;
  subscriptionId?: string | null;
  type: BillingNotificationType;
  channel: BillingNotificationChannel;
  sentAt: string;
  metadata?: Record<string, unknown> | null;
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
  intent: ContactRequestIntent;
  sourceDetail?: string | null;
  planInterest: ContactRequestPlanInterest;
  locationCount?: number | null;
  estimatedCallVolume?: string | null;
  bookingSoftware?: string | null;
  routingNeeds?: string | null;
  goLiveTimeline?: string | null;
  numberOfLocations?: number | null;
  locationsText?: string | null;
  mainContact?: string | null;
  currentPhoneProvider?: string | null;
  currentBookingSoftware?: string | null;
  currentCrm?: string | null;
  estimatedMonthlyCallVolume?: string | null;
  languagesNeeded?: string | null;
  routingRules?: string | null;
  escalationRules?: string | null;
  integrationRequirements?: string | null;
  preferredGoLiveTimeline?: string | null;
  status: ContactRequestStatus;
  source: string;
  ip?: string | null;
  notes?: string | null;
  handledBy?: string | null;
  handledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
