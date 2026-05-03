import type { HandoffSessionRecord, HandoffSessionStatus } from '@/src/backend/domain/handoff';
import type { VoiceCallLegPurpose, VoiceCallLegRecord } from '@/src/backend/domain/voice-call-leg';
import type {
  BlogPost,
  BlogPostStatus,
  BillingCustomer,
  BillingProvider,
  BillingSubscription,
  BillingSubscriptionStatus,
  ContactRequest,
  ContactRequestStatus,
  JobStatus,
  JobType,
  Shop,
} from '@/src/backend/domain/types';

export interface ProviderEventRecord {
  provider: 'telnyx' | 'paddle' | string;
  providerEventId: string;
  eventType: string;
  payload: unknown;
}

export interface ProviderEventsRepository {
  hasProcessed(provider: string, providerEventId: string): Promise<boolean>;
  markProcessed(event: ProviderEventRecord): Promise<void>;
  markProcessingError(provider: string, providerEventId: string, reason: string): Promise<void>;
  clearProcessingError(provider: string, providerEventId: string): Promise<void>;
}

export type DemoMode = 'quick' | 'advanced' | 'free-form';
export type DemoSessionStatus = 'created' | 'queued' | 'dialing' | 'live' | 'completed' | 'missed' | 'failed' | 'expired';
export type DemoCallStatus = 'queued' | 'dialing' | 'live' | 'completed' | 'missed' | 'failed';

export interface DemoCallRunRecord {
  requestId: string;
  publicSessionId: string;
  verticalSlug: string;
  mode: DemoMode;
  callbackPhone: string;
  provider: string;
  providerCallId?: string | null;
  roomName?: string | null;
  status: DemoCallStatus;
  startedAt?: string | null;
  connectedAt?: string | null;
  endedAt?: string | null;
  outcome?: string | null;
  expiresAt?: string | null;
}

/** One marketing demo call run with session context for admin list UIs. */
export type SipDemoSessionEnrichment = {
  shopName: string;
  verticalSlug: string;
  notes?: string | null;
  demoConfig?: {
    city?: string | null;
    primaryHours?: string | null;
    secondaryHours?: string | null;
    staffNames: string[];
    services: Array<{
      category: string;
      name: string;
      price?: number | null;
      duration?: string | null;
      enabled?: boolean;
    }>;
  };
};

export type DemoAdminCallListRow = {
  requestId: string;
  demoSessionId: string;
  publicSessionId: string;
  verticalSlug: string;
  demoMode: DemoMode;
  source: string;
  sessionStatus: DemoSessionStatus;
  runStatus: DemoCallStatus;
  outcome: string | null;
  callbackPhone: string;
  businessName: string | null;
  clientIp: string | null;
  clientCountry: string | null;
  provider: string;
  providerCallId: string | null;
  roomName: string | null;
  startedAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
  runCreatedAt: string;
};

export interface DemoSessionsRepository {
  createSession(params: {
    publicSessionId: string;
    verticalSlug: string;
    mode: DemoMode;
    source: string;
    callbackPhone: string;
    businessName: string;
    city?: string | null;
    businessHours?: unknown;
    staff?: unknown;
    notes?: string | null;
    systemPrompt?: string | null;
    services?: Array<{
      category: string;
      name: string;
      price?: number | null;
      duration?: string | null;
      enabled?: boolean;
    }>;
    expiresAt?: Date;
    clientIp?: string | null;
    clientCountry?: string | null;
  }): Promise<{ id: string; expiresAt: Date }>;
  createCallRun(params: {
    demoSessionId: string;
    requestId: string;
    provider: string;
    providerCallId?: string | null;
    roomName?: string | null;
    status: DemoCallStatus;
    startedAt?: Date;
  }): Promise<void>;
  markCallRunStatusByRequestId(params: {
    requestId: string;
    status: DemoCallStatus;
    providerCallId?: string | null;
    connectedAt?: Date | null;
    endedAt?: Date | null;
    outcome?: string | null;
  }): Promise<void>;
  createSmsRun(params: {
    requestId: string;
    toPhone: string;
    templateKey: string;
    previewBody: string;
    sentAt?: Date | null;
    providerMessageId?: string | null;
  }): Promise<void>;
  addStatusEvent(params: {
    requestId?: string | null;
    demoSessionId?: string | null;
    eventType: string;
    payload?: unknown;
    occurredAt?: Date;
  }): Promise<void>;
  findCallRunByRequestId(requestId: string): Promise<DemoCallRunRecord | null>;
  /**
   * Latest non-expired demo session for this caller phone (any vertical).
   * Used for one shared pilot DID: vertical + shop context come from the newest matching session.
   */
  findLatestSipDemoContext(params: {
    callerPhone: string;
    now?: Date;
  }): Promise<SipDemoSessionEnrichment | null>;
  expireOlderThan(now: Date): Promise<number>;
  listAdminDemoCallRuns(params: {
    createdAfter: Date;
    createdBefore: Date;
    limit?: number;
    offset?: number;
  }): Promise<DemoAdminCallListRow[]>;
  countAdminDemoCallRuns(params: { createdAfter: Date; createdBefore: Date }): Promise<number>;
}


export type CallSummaryUrgency = 'low' | 'medium' | 'high';
export type CallSummaryNextAction =
  | 'booking_created'
  | 'booking_link_sent'
  | 'callback_scheduled'
  | 'cancellation_requested'
  | 'reschedule_requested'
  | 'info_provided'
  | 'escalated'
  | 'no_action_needed';

export type CallStructuredSummaryFields = {
  summaryServiceRequest?: string | null;
  summaryUrgency?: CallSummaryUrgency | null;
  summaryNextAction?: CallSummaryNextAction | null;
  summaryCallerQuestion?: string | null;
  summaryCallerName?: string | null;
  summaryPreferredTech?: string | null;
  summaryPreferredDatetime?: string | null;
  summaryFollowUpRequired?: boolean;
};


export type CallLogsQueryParams = {
  limit?: number;
  offset?: number;
  startedAfter?: Date;
  startedBefore?: Date;
  outcome?: string;
  transcriptStatus?: string;
  summaryFollowUpRequired?: boolean;
  summaryUrgency?: CallSummaryUrgency;
  summaryNextActions?: CallSummaryNextAction[];
};

export interface CallLogsRepository {
  createOrUpdateInboundCall(params: {
    provider: string;
    providerCallId: string;
    shopId: string;
    callerPhone?: string;
    destinationPhone?: string;
    requestId?: string;
    roomName?: string;
    startedAt?: Date;
  }): Promise<void>;
  markAgentJoined(params: {
    shopId: string;
    requestId: string;
    roomName?: string;
  }): Promise<void>;
  appendTranscriptByRequestId(params: {
    shopId: string;
    requestId: string;
    speaker: 'caller' | 'assistant' | 'system';
    text: string;
    occurredAt?: Date;
  }): Promise<void>;
  updateDemoLiveStateByRequestId(params: {
    shopId: string;
    requestId: string;
    state:
      | 'preparing'
      | 'caller_speaking'
      | 'ai_agent_speaking'
      | 'thinking'
      | 'looking_up_info'
      | 'completed'
      | 'failed'
      | null;
  }): Promise<void>;
  updateTranscriptStatusByRequestId(params: {
    shopId: string;
    requestId: string;
    status: 'pending' | 'completed' | 'failed';
  }): Promise<void>;
  markEndedByProviderCallId(params: {
    provider: string;
    providerCallId: string;
    endedAt: Date;
    outcome?: string;
    humanAnswered?: boolean;
  }): Promise<void>;
  /** Mid-call outcome update (e.g. transferred_to_owner) without ending the call. */
  setOutcomeByProviderCallId(params: { provider: string; providerCallId: string; outcome: string }): Promise<void>;
  listByShop(
    shopId: string,
    params?: CallLogsQueryParams,
  ): Promise<
    Array<{
      provider: string;
      providerCallId: string;
      shopId: string;
      callerPhone?: string;
      destinationPhone?: string;
      requestId?: string;
      roomName?: string;
      startedAt?: string;
      endedAt?: string;
      agentJoined: boolean;
      humanAnswered: boolean;
      transcriptStatus?: string;
      transcriptText?: string;
      demoLiveState?: string;
      outcome?: string;
      summaryServiceRequest?: string | null;
      summaryUrgency?: CallSummaryUrgency | null;
      summaryNextAction?: CallSummaryNextAction | null;
      summaryCallerQuestion?: string | null;
      summaryCallerName?: string | null;
      summaryPreferredTech?: string | null;
      summaryPreferredDatetime?: string | null;
      summaryFollowUpRequired?: boolean;
    }>
  >;
  countByShop(
    shopId: string,
    params?: CallLogsQueryParams,
  ): Promise<number>;
  countRecent(params?: CallLogsQueryParams): Promise<number>;
  listRecent(params?: CallLogsQueryParams): Promise<
    Array<{
      provider: string;
      providerCallId: string;
      shopId: string;
      callerPhone?: string;
      destinationPhone?: string;
      requestId?: string;
      roomName?: string;
      startedAt?: string;
      endedAt?: string;
      agentJoined: boolean;
      humanAnswered: boolean;
      transcriptStatus?: string;
      transcriptText?: string;
      demoLiveState?: string;
      outcome?: string;
      summaryServiceRequest?: string | null;
      summaryUrgency?: CallSummaryUrgency | null;
      summaryNextAction?: CallSummaryNextAction | null;
      summaryCallerQuestion?: string | null;
      summaryCallerName?: string | null;
      summaryPreferredTech?: string | null;
      summaryPreferredDatetime?: string | null;
      summaryFollowUpRequired?: boolean;
    }>
  >;
  updateStructuredSummary(
    shopId: string,
    requestId: string,
    fields: CallStructuredSummaryFields,
  ): Promise<void>;
  findTranscriptByShopAndRequestId(params: {
    shopId: string;
    requestId: string;
  }): Promise<{
    transcriptText?: string;
    transcriptStatus?: string;
    startedAt?: string;
    endedAt?: string;
  } | null>;
  listTranscriptMetaByShopAndRequestIds(params: {
    shopId: string;
    requestIds: string[];
  }): Promise<Map<string, { transcriptStatus?: string; hasTranscriptText: boolean }>>;
}

export interface MissedCallsRepository {
  createOncePerHour(params: {
    shopId: string;
    callerPhone: string;
    callLogProviderCallId?: string;
    createdAt?: Date;
  }): Promise<{ created: boolean }>;
}

export interface ShopsRepository {
  findByDestinationPhone(destinationPhone: string): Promise<Shop | null>;
  /** Telnyx DID / PSTN number provisioned for this shop (E.164). Active shops only. */
  findByTelnyxNumber(e164: string): Promise<Shop | null>;
  findById(shopId: string): Promise<Shop | null>;
  /** ISO timestamps of shop creation, for admin charts (UTC). */
  listCreatedAtInRange(params: { createdAfter: Date; createdBefore: Date }): Promise<string[]>;
  list(params?: { limit?: number }): Promise<Shop[]>;
  create(params: {
    name: string;
    brand_slug?: string | null;
    phone_number: string;
    user_phone: string;
    user_name?: string | null;
    timezone: string;
    plan?: Shop['plan'];
    active?: boolean;
  }): Promise<Shop>;
  updateUserSettings(
    shopId: string,
    patch: Partial<
      Pick<
        Shop,
        | 'name'
        | 'phone_number'
        | 'vertical'
        | 'user_name'
        | 'user_phone'
        | 'backup_phone'
        | 'address'
        | 'timezone'
        | 'services'
        | 'hours'
        | 'cancel_policy'
        | 'promotions'
        | 'booking_url'
        | 'website_url'
        | 'languages'
        | 'current_onboarding_step'
        | 'setup_method'
        | 'forwarding_type'
        | 'forwarding_carrier'
        | 'forwarding_country'
        | 'telnyx_number'
      >
    >,
  ): Promise<Shop | null>;
  updateDynamicConfig(
    shopId: string,
    patch: Partial<
      Pick<
        Shop,
        | 'ai_voice'
        | 'ai_welcome_message'
        | 'ai_custom_instructions'
        | 'allow_transfers'
        | 'allow_callbacks'
        | 'send_reminder_sms'
        | 'send_review_request_sms'
        | 'send_missed_call_followup_sms'
      >
    >,
  ): Promise<Shop | null>;
  updatePlanAndActivation(
    shopId: string,
    patch: {
      plan?: Shop['plan'];
      active?: boolean;
    },
  ): Promise<Shop | null>;
  updateCalendarConnection(
    shopId: string,
    patch: Pick<Shop, 'google_cal_id' | 'google_cal_credentials_encrypted'>,
  ): Promise<Shop | null>;
}

export interface BillingCustomersRepository {
  findByShopId(shopId: string, provider?: BillingProvider): Promise<BillingCustomer | null>;
  findByProviderCustomerId(provider: BillingProvider, providerCustomerId: string): Promise<BillingCustomer | null>;
  upsert(params: {
    shopId: string;
    provider: BillingProvider;
    providerCustomerId: string;
    email?: string | null;
  }): Promise<BillingCustomer>;
}

export interface BillingSubscriptionsRepository {
  findCurrentByShopId(shopId: string, provider?: BillingProvider): Promise<BillingSubscription | null>;
  findByProviderSubscriptionId(
    provider: BillingProvider,
    providerSubscriptionId: string,
  ): Promise<BillingSubscription | null>;
  list(params?: { limit?: number; shopId?: string }): Promise<BillingSubscription[]>;
  upsert(params: {
    shopId: string;
    provider: BillingProvider;
    providerSubscriptionId: string;
    providerCustomerId?: string | null;
    plan: Shop['plan'];
    status: BillingSubscriptionStatus;
    interval: 'month' | 'year';
    currency: string;
    amount: number;
    cancelAtPeriodEnd?: boolean;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    trialEndsAt?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<BillingSubscription>;
}

export interface JobsRepository {
  enqueue(params: {
    shopId: string;
    type: JobType;
    payload: Record<string, unknown>;
    runAt: Date;
    idempotencyKey: string;
  }): Promise<void>;
  leaseNext(params: {
    now: Date;
    leaseSeconds: number;
    workerId: string;
  }): Promise<{
    id: string;
    shopId: string;
    type: JobType;
    payload: Record<string, unknown>;
    attemptCount: number;
  } | null>;
  complete(jobId: string): Promise<void>;
  fail(jobId: string, params: { retryable: boolean; reason: string; nextRunAt?: Date }): Promise<void>;
  updateStatus(jobId: string, status: JobStatus): Promise<void>;
  getStatusCounts(): Promise<Partial<Record<JobStatus, number>>>;
}

export interface BookingRecord {
  id: string;
  shopId: string;
  customerPhone: string;
  customerName?: string | null;
  service: string;
  datetimeUtc: string;
  timezone: string;
  status: string;
  reminder24hSent: boolean;
  reminder2hSent: boolean;
  reviewRequestSent: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BookingsRepository {
  findById(bookingId: string): Promise<BookingRecord | null>;
  countByShop(shopId: string): Promise<number>;
  listByShop(
    shopId: string,
    params?: { limit?: number; createdAfter?: Date; createdBefore?: Date },
  ): Promise<BookingRecord[]>;
  create(params: {
    id?: string;
    shopId: string;
    customerPhone: string;
    customerName?: string | null;
    service: string;
    datetimeUtc: string;
    timezone: string;
    status: string;
    calendarEventId?: string;
  }): Promise<BookingRecord>;
  updateDatetime(bookingId: string, newDatetimeUtc: Date): Promise<void>;
  markReminderSent(bookingId: string, kind: '24h' | '2h'): Promise<void>;
  markReviewRequestSent(bookingId: string): Promise<void>;
}

export interface CallbackRecord {
  id: string;
  shopId: string;
  customerPhone: string;
  customerName?: string | null;
  reason: string;
  status: string;
  attemptCount: number;
}

export interface CallbacksRepository {
  create(params: {
    shopId: string;
    customerPhone: string;
    customerName?: string | null;
    reason: string;
    requestId?: string;
  }): Promise<CallbackRecord>;
  findById(callbackId: string): Promise<CallbackRecord | null>;
  markAttempt(callbackId: string, params: { nextAttemptAt?: Date }): Promise<void>;
  markQueued(callbackId: string, params: { nextAttemptAt: Date }): Promise<void>;
  markCompleted(callbackId: string): Promise<void>;
  markFailed(callbackId: string): Promise<void>;
}

export interface OutboundMessagesRepository {
  create(params: {
    shopId: string;
    bookingId?: string;
    customerPhone: string;
    category: string;
    body: string;
    idempotencyKey: string;
    status: 'queued' | 'sent' | 'failed';
    providerMessageId?: string;
  }): Promise<void>;
}

export type AuthRole = 'user' | 'admin';

export interface AuthUserRecord {
  id: string;
  email: string;
  role: AuthRole;
  shopId?: string | null;
  passwordHash: string;
  active: boolean;
  mfaEnabled: boolean;
}

/** Safe row for admin user directory (no password hash). */
export type AuthUserAdminListItem = {
  id: string;
  email: string;
  role: AuthRole;
  shopId?: string | null;
  active: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export interface AuthUsersRepository {
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findById(id: string): Promise<AuthUserRecord | null>;
  create(params: {
    email: string;
    role: AuthRole;
    shopId?: string | null;
    passwordHash: string;
    active?: boolean;
    mfaEnabled?: boolean;
  }): Promise<AuthUserRecord>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
  listForAdmin(params?: { limit?: number }): Promise<AuthUserAdminListItem[]>;
  updateUserAdmin(
    userId: string,
    patch: { role?: AuthRole; active?: boolean },
  ): Promise<AuthUserAdminListItem | null>;
  createPasswordResetToken(params: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  consumePasswordResetToken(tokenHash: string): Promise<{ userId: string } | null>;
}

export interface BlogPostsRepository {
  listPublished(params?: { limit?: number; query?: string }): Promise<BlogPost[]>;
  listForAdmin(params?: { limit?: number; status?: BlogPostStatus | 'all'; query?: string }): Promise<BlogPost[]>;
  findBySlug(slug: string, params?: { includeDraft?: boolean }): Promise<BlogPost | null>;
  findById(id: string): Promise<BlogPost | null>;
  create(params: {
    slug: string;
    title: string;
    excerpt: string;
    content: string;
    status: BlogPostStatus;
    seoTitle?: string | null;
    seoDescription?: string | null;
    coverImageUrl?: string | null;
    tags?: string[];
    authorName?: string | null;
    publishedAt?: string | null;
  }): Promise<BlogPost>;
  update(
    id: string,
    patch: Partial<{
      slug: string;
      title: string;
      excerpt: string;
      content: string;
      status: BlogPostStatus;
      seoTitle: string | null;
      seoDescription: string | null;
      coverImageUrl: string | null;
      tags: string[];
      authorName: string | null;
      publishedAt: string | null;
    }>,
  ): Promise<BlogPost | null>;
  delete(id: string): Promise<boolean>;
}

export interface ContactRequestsRepository {
  create(params: {
    requestId: string;
    fullName: string;
    businessName: string;
    email: string;
    phoneNumber: string;
    businessType: string;
    currentSetup: string;
    helpNeed: string;
    bestTime: string;
    source?: string;
    ip?: string | null;
  }): Promise<ContactRequest>;
  listForAdmin(params?: {
    limit?: number;
    status?: ContactRequestStatus | 'all';
    query?: string;
    createdAfter?: Date;
    createdBefore?: Date;
  }): Promise<ContactRequest[]>;
  updateStatus(
    id: string,
    params: {
      status: ContactRequestStatus;
      notes?: string | null;
      handledBy?: string | null;
    },
  ): Promise<ContactRequest | null>;
}

export interface HandoffSessionsRepository {
  create(params: {
    shopId: string;
    rbCallId: string;
    idempotencyKey: string;
    parentCallControlId: string;
    parentCallSessionId?: string | null;
    ownerPhone: string;
    callerPhone?: string | null;
    callerName?: string | null;
    reason: string;
    urgency: string;
    summary: string;
    serviceRequested?: string | null;
    preferredTime?: string | null;
    status: HandoffSessionStatus;
  }): Promise<HandoffSessionRecord>;
  findById(id: string): Promise<HandoffSessionRecord | null>;
  findActiveByRbCallId(shopId: string, rbCallId: string): Promise<HandoffSessionRecord | null>;
  findByOwnerCallControlId(callControlId: string): Promise<HandoffSessionRecord | null>;
  findByParentCallControlId(parentCallControlId: string): Promise<HandoffSessionRecord | null>;
  /** Latest non-terminal session whose parent Telnyx leg matches (caller leg). */
  findActiveByParentCallControlId(parentCallControlId: string): Promise<HandoffSessionRecord | null>;
  update(
    id: string,
    patch: Partial<{
      status: HandoffSessionStatus;
      ownerCallControlId: string | null;
      openaiCallId: string | null;
      parentCallSessionId: string | null;
      failedReason: string | null;
      errorMessage: string | null;
      dtmfRetryCount: number;
      fallbackSmsSent: boolean;
      completedAt: Date | null;
    }>,
  ): Promise<void>;
}

export interface VoiceCallLegsRepository {
  createOrUpdateCallLeg(params: {
    shopId: string;
    rbCallId: string;
    purpose: VoiceCallLegPurpose;
    callControlId?: string | null;
    callSessionId?: string | null;
    callLegId?: string | null;
    parentCallControlId?: string | null;
    parentCallSessionId?: string | null;
    status: string;
    clientState?: unknown | null;
    metadata?: unknown | null;
  }): Promise<VoiceCallLegRecord>;

  findCallLegByCallControlId(callControlId: string): Promise<VoiceCallLegRecord | null>;

  findOpenAiLegByRbCallId(shopId: string, rbCallId: string): Promise<VoiceCallLegRecord | null>;

  findOpenAiLegByParentCallControlId(parentCallControlId: string): Promise<VoiceCallLegRecord | null>;

  /** Active OpenAI SIP leg `call_control_id` for hangup (not ended). */
  findActiveOpenAiLegCallControlIdByRbCallId(shopId: string, rbCallId: string): Promise<string | null>;

  findActiveOpenAiLegCallControlIdByParent(parentCallControlId: string): Promise<string | null>;

  markCallLegStatus(params: {
    shopId: string;
    rbCallId: string;
    purpose: VoiceCallLegPurpose;
    status: string;
    callControlId?: string | null;
    callSessionId?: string | null;
  }): Promise<void>;

  markCallLegEnded(callControlId: string, purpose?: VoiceCallLegPurpose): Promise<void>;
}
