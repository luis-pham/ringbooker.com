import { InMemoryVoiceCallLegsRepository } from '@/src/backend/adapters/memory/voice-call-legs-repository';
import { InMemoryHandoffSessionsRepository } from '@/src/backend/adapters/memory/handoff-sessions-repository';
import { SupabaseVoiceCallLegsRepository } from '@/src/backend/adapters/supabase/voice-call-legs-repository';
import { SupabaseHandoffSessionsRepository } from '@/src/backend/adapters/supabase/handoff-sessions-repository';
import { R2CallRecordingStorage } from '@/src/backend/adapters/cloudflare/r2-call-recording-storage';
import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCustomersRepository } from '@/src/backend/adapters/memory/customers-repository';
import { InMemoryBillingCustomersRepository } from '@/src/backend/adapters/memory/billing-customers-repository';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryShopOverageChargesRepository } from '@/src/backend/adapters/memory/shop-overage-charges-repository';
import { InMemoryShopUsageAlertsRepository } from '@/src/backend/adapters/memory/shop-usage-alerts-repository';
import { InMemoryBillingNotificationsRepository } from '@/src/backend/adapters/memory/billing-notifications-repository';
import { InMemoryBusinessKnowledgeSuggestionsRepository } from '@/src/backend/adapters/memory/business-knowledge-suggestions-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryOutboundMessagesRepository } from '@/src/backend/adapters/memory/outbound-messages-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryVagaroWebhookEventsRepository } from '@/src/backend/adapters/memory/vagaro-webhook-events-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryMissedCallsRepository } from '@/src/backend/adapters/memory/missed-calls-repository';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryBlogPostsRepository } from '@/src/backend/adapters/memory/blog-posts-repository';
import { InMemoryContactRequestsRepository } from '@/src/backend/adapters/memory/contact-requests-repository';
import { InMemoryDemoSessionsRepository } from '@/src/backend/adapters/memory/demo-sessions-repository';
import { InMemoryWebDemoSessionsRepository } from '@/src/backend/adapters/memory/web-demo-sessions-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryCommercialGoLiveApprovalEventsRepository } from '@/src/backend/adapters/memory/commercial-go-live-approval-events-repository';
import { InMemoryShopLocationsRepository } from '@/src/backend/adapters/memory/shop-locations-repository';
import { InMemoryShopRoutingRulesRepository } from '@/src/backend/adapters/memory/shop-routing-rules-repository';
import { InMemoryCommercialAccountsRepository } from '@/src/backend/adapters/memory/commercial-accounts-repository';
import { InMemoryShopActiveCallSessionsRepository } from '@/src/backend/adapters/memory/shop-active-call-sessions-repository';
import { InMemoryForwardingTestSessionsRepository } from '@/src/backend/adapters/memory/forwarding-test-sessions-repository';
import { InMemoryTestCallAttemptsRepository } from '@/src/backend/adapters/memory/test-call-attempts-repository';
import {
  InMemoryShopStaffRepository,
  InMemoryShopStaffServicesRepository,
} from '@/src/backend/adapters/memory/shop-staff-repository';
import { NoopEmailService } from '@/src/backend/adapters/noop/email-service';
import { NoopPhoneProvisioningService } from '@/src/backend/adapters/noop/phone-provisioning-service';
import { NoopSmsService } from '@/src/backend/adapters/noop/sms-service';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import { ResendEmailService } from '@/src/backend/adapters/resend/email-service';
import { SupabaseJobsRepository } from '@/src/backend/adapters/supabase/jobs-repository';
import { SupabaseBookingsRepository } from '@/src/backend/adapters/supabase/bookings-repository';
import { SupabaseCustomersRepository } from '@/src/backend/adapters/supabase/customers-repository';
import { SupabaseBillingCustomersRepository } from '@/src/backend/adapters/supabase/billing-customers-repository';
import { SupabaseBillingSubscriptionsRepository } from '@/src/backend/adapters/supabase/billing-subscriptions-repository';
import { SupabaseShopOverageChargesRepository } from '@/src/backend/adapters/supabase/shop-overage-charges-repository';
import { SupabaseShopUsageAlertsRepository } from '@/src/backend/adapters/supabase/shop-usage-alerts-repository';
import { SupabaseBillingNotificationsRepository } from '@/src/backend/adapters/supabase/billing-notifications-repository';
import { SupabaseBusinessKnowledgeSuggestionsRepository } from '@/src/backend/adapters/supabase/business-knowledge-suggestions-repository';
import { SupabaseCallbacksRepository } from '@/src/backend/adapters/supabase/callbacks-repository';
import { SupabaseOutboundMessagesRepository } from '@/src/backend/adapters/supabase/outbound-messages-repository';
import { SupabaseProviderEventsRepository } from '@/src/backend/adapters/supabase/provider-events-repository';
import { SupabaseVagaroWebhookEventsRepository } from '@/src/backend/adapters/supabase/vagaro-webhook-events-repository';
import { SupabaseShopsRepository } from '@/src/backend/adapters/supabase/shops-repository';
import { SupabaseCallLogsRepository } from '@/src/backend/adapters/supabase/call-logs-repository';
import { SupabaseMissedCallsRepository } from '@/src/backend/adapters/supabase/missed-calls-repository';
import { SupabaseAuthUsersRepository } from '@/src/backend/adapters/supabase/auth-users-repository';
import { SupabaseBlogPostsRepository } from '@/src/backend/adapters/supabase/blog-posts-repository';
import { SupabaseContactRequestsRepository } from '@/src/backend/adapters/supabase/contact-requests-repository';
import { SupabaseDemoSessionsRepository } from '@/src/backend/adapters/supabase/demo-sessions-repository';
import { SupabaseWebDemoSessionsRepository } from '@/src/backend/adapters/supabase/web-demo-sessions-repository';
import { SupabaseShopAccessStatesRepository } from '@/src/backend/adapters/supabase/shop-access-states-repository';
import { SupabaseCommercialGoLiveApprovalEventsRepository } from '@/src/backend/adapters/supabase/commercial-go-live-approval-events-repository';
import { SupabaseShopLocationsRepository } from '@/src/backend/adapters/supabase/shop-locations-repository';
import { SupabaseShopRoutingRulesRepository } from '@/src/backend/adapters/supabase/shop-routing-rules-repository';
import { SupabaseCommercialAccountsRepository } from '@/src/backend/adapters/supabase/commercial-accounts-repository';
import { SupabaseShopActiveCallSessionsRepository } from '@/src/backend/adapters/supabase/shop-active-call-sessions-repository';
import { SupabaseForwardingTestSessionsRepository } from '@/src/backend/adapters/supabase/forwarding-test-sessions-repository';
import { SupabaseTestCallAttemptsRepository } from '@/src/backend/adapters/supabase/test-call-attempts-repository';
import {
  SupabaseShopStaffRepository,
  SupabaseShopStaffServicesRepository,
} from '@/src/backend/adapters/supabase/shop-staff-repository';
import { TelnyxPhoneProvisioningService } from '@/src/backend/adapters/telnyx/phone-provisioning-service';
import { TelnyxSmsService } from '@/src/backend/adapters/telnyx/sms-service';
import { TelnyxTelephonyService } from '@/src/backend/adapters/telnyx/telephony-service';
import { PaddleBillingProvider } from '@/src/backend/adapters/paddle/billing-provider';
import { LiveKitRealtimeRuntime } from '@/src/agent/realtime/livekit-gemini-runtime';
import { LiveKitNativeGeminiRuntime } from '@/src/agent/realtime/livekit-native-gemini-runtime';
import { LiveKitNativeOpenAIRuntime } from '@/src/agent/realtime/livekit-native-openai-runtime';
import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';
import { getEnv } from '@/src/backend/config/env';
import { createSupabaseServiceClient } from '@/src/backend/db/supabase-client';
import { logEmailRuntimeStartup, resolveEmailProviderMode } from '@/src/backend/services/email/startup';

type BackendRuntime = ReturnType<typeof createBackendRuntime>;
type BackendRepositoryMode = 'memory' | 'supabase';
type BackendCommProvider = 'noop' | 'telnyx';
type BillingProviderMode = 'paddle' | 'manual';
type AgentRuntimeMode = 'mock' | 'livekit_realtime';
type AgentTransportMode = 'mock' | 'livekit';
type AgentVoiceProviderMode = 'none' | 'gemini_live' | 'openai_realtime';
function getRepositoryMode(): BackendRepositoryMode {
  return process.env.BACKEND_REPOSITORY_MODE === 'supabase' ? 'supabase' : 'memory';
}

function getCommProvider(): BackendCommProvider {
  return process.env.BACKEND_COMM_PROVIDER === 'telnyx' ? 'telnyx' : 'noop';
}

function getBillingProviderMode(): BillingProviderMode {
  return process.env.BILLING_PROVIDER === 'manual' ? 'manual' : 'paddle';
}

function getAgentTransportMode(): AgentTransportMode {
  if (process.env.AGENT_TRANSPORT === 'livekit') return 'livekit';
  return process.env.AGENT_RUNTIME_MODE === 'livekit_gemini' ||
    process.env.AGENT_RUNTIME_MODE === 'livekit_native_gemini' ||
    process.env.AGENT_RUNTIME_MODE === 'livekit_openai' ||
    process.env.AGENT_RUNTIME_MODE === 'livekit_native_openai'
    ? 'livekit'
    : 'mock';
}

function getAgentVoiceProviderMode(): AgentVoiceProviderMode {
  const configured = process.env.AGENT_VOICE_PROVIDER;
  if (configured === 'gemini_live' || configured === 'openai_realtime' || configured === 'none') {
    return configured;
  }
  if (process.env.AGENT_RUNTIME_MODE === 'livekit_openai' || process.env.AGENT_RUNTIME_MODE === 'livekit_native_openai') {
    return 'openai_realtime';
  }
  return process.env.AGENT_RUNTIME_MODE === 'livekit_gemini' || process.env.AGENT_RUNTIME_MODE === 'livekit_native_gemini'
    ? 'gemini_live'
    : 'none';
}

function getAgentRuntimeMode(): AgentRuntimeMode {
  const transport = getAgentTransportMode();
  const voiceProvider = getAgentVoiceProviderMode();
  return transport === 'livekit' && voiceProvider !== 'none' ? 'livekit_realtime' : 'mock';
}

function enforceProductionRuntimeProfile(params: {
  mode: BackendRepositoryMode;
  commProvider: BackendCommProvider;
  agentRuntimeMode: AgentRuntimeMode;
}) {
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.ENFORCE_PRODUCTION_RUNTIME_PROFILE !== 'true') return;
  if (process.env.ALLOW_INSECURE_PROD_RUNTIME === 'true') return;

  const violations: string[] = [];
  if (params.mode !== 'supabase') violations.push(`BACKEND_REPOSITORY_MODE must be supabase (found ${params.mode})`);
  if (params.commProvider !== 'telnyx') violations.push(`BACKEND_COMM_PROVIDER must be telnyx (found ${params.commProvider})`);
  if (params.agentRuntimeMode !== 'livekit_realtime') {
    violations.push(`agent runtime must be livekit_realtime (found ${params.agentRuntimeMode})`);
  }

  if (violations.length > 0) {
    throw new Error(`invalid_production_runtime_profile:${violations.join('; ')}`);
  }
}

export function createBackendRuntime() {
  const mode = getRepositoryMode();
  const commProvider = getCommProvider();
  const billingProviderMode = getBillingProviderMode();
  const agentTransportMode = getAgentTransportMode();
  const agentVoiceProviderMode = getAgentVoiceProviderMode();
  const agentRuntimeMode = getAgentRuntimeMode();
  const emailProvider = resolveEmailProviderMode();
  logEmailRuntimeStartup(emailProvider);
  enforceProductionRuntimeProfile({
    mode,
    commProvider,
    agentRuntimeMode,
  });
  const repositories =
    mode === 'supabase'
      ? (() => {
          const supabase = createSupabaseServiceClient();
          return {
            providerEventsRepository: new SupabaseProviderEventsRepository(supabase),
            vagaroWebhookEventsRepository: new SupabaseVagaroWebhookEventsRepository(supabase),
            shopsRepository: new SupabaseShopsRepository(supabase),
            customersRepository: new SupabaseCustomersRepository(supabase),
            billingCustomersRepository: new SupabaseBillingCustomersRepository(supabase),
            billingSubscriptionsRepository: new SupabaseBillingSubscriptionsRepository(supabase),
            shopOverageChargesRepository: new SupabaseShopOverageChargesRepository(supabase),
            shopUsageAlertsRepository: new SupabaseShopUsageAlertsRepository(supabase),
            billingNotificationsRepository: new SupabaseBillingNotificationsRepository(supabase),
            businessKnowledgeSuggestionsRepository: new SupabaseBusinessKnowledgeSuggestionsRepository(supabase),
            shopAccessStatesRepository: new SupabaseShopAccessStatesRepository(supabase),
            commercialGoLiveApprovalEventsRepository: new SupabaseCommercialGoLiveApprovalEventsRepository(supabase),
            shopLocationsRepository: new SupabaseShopLocationsRepository(supabase),
            shopRoutingRulesRepository: new SupabaseShopRoutingRulesRepository(supabase),
            commercialAccountsRepository: new SupabaseCommercialAccountsRepository(supabase),
            shopActiveCallSessionsRepository: new SupabaseShopActiveCallSessionsRepository(supabase),
            testCallAttemptsRepository: new SupabaseTestCallAttemptsRepository(supabase),
            forwardingTestSessionsRepository: new SupabaseForwardingTestSessionsRepository(supabase),
            shopStaffRepository: new SupabaseShopStaffRepository(supabase),
            shopStaffServicesRepository: new SupabaseShopStaffServicesRepository(supabase),
            jobsRepository: new SupabaseJobsRepository(supabase),
            bookingsRepository: new SupabaseBookingsRepository(supabase),
            callbacksRepository: new SupabaseCallbacksRepository(supabase),
            outboundMessagesRepository: new SupabaseOutboundMessagesRepository(supabase),
            callLogsRepository: new SupabaseCallLogsRepository(supabase),
            missedCallsRepository: new SupabaseMissedCallsRepository(supabase),
            authUsersRepository: new SupabaseAuthUsersRepository(supabase),
            blogPostsRepository: new SupabaseBlogPostsRepository(supabase),
            contactRequestsRepository: new SupabaseContactRequestsRepository(supabase),
            demoSessionsRepository: new SupabaseDemoSessionsRepository(supabase),
            webDemoSessionsRepository: new SupabaseWebDemoSessionsRepository(supabase),
            handoffSessionsRepository: new SupabaseHandoffSessionsRepository(supabase),
            voiceCallLegsRepository: new SupabaseVoiceCallLegsRepository(supabase),
          };
        })()
      : {
          providerEventsRepository: new InMemoryProviderEventsRepository(),
          vagaroWebhookEventsRepository: new InMemoryVagaroWebhookEventsRepository(),
          shopsRepository: new InMemoryShopsRepository(),
          customersRepository: new InMemoryCustomersRepository(),
          billingCustomersRepository: new InMemoryBillingCustomersRepository(),
          billingSubscriptionsRepository: new InMemoryBillingSubscriptionsRepository(),
          shopOverageChargesRepository: new InMemoryShopOverageChargesRepository(),
          shopUsageAlertsRepository: new InMemoryShopUsageAlertsRepository(),
          billingNotificationsRepository: new InMemoryBillingNotificationsRepository(),
          businessKnowledgeSuggestionsRepository: new InMemoryBusinessKnowledgeSuggestionsRepository(),
          shopAccessStatesRepository: new InMemoryShopAccessStatesRepository(),
          commercialGoLiveApprovalEventsRepository: new InMemoryCommercialGoLiveApprovalEventsRepository(),
          shopLocationsRepository: new InMemoryShopLocationsRepository(),
          shopRoutingRulesRepository: new InMemoryShopRoutingRulesRepository(),
          commercialAccountsRepository: new InMemoryCommercialAccountsRepository(),
          shopActiveCallSessionsRepository: new InMemoryShopActiveCallSessionsRepository(),
          testCallAttemptsRepository: new InMemoryTestCallAttemptsRepository(),
          forwardingTestSessionsRepository: new InMemoryForwardingTestSessionsRepository(),
          shopStaffRepository: new InMemoryShopStaffRepository(),
          shopStaffServicesRepository: new InMemoryShopStaffServicesRepository(),
          jobsRepository: new InMemoryJobsRepository(),
          bookingsRepository: new InMemoryBookingsRepository(),
          callbacksRepository: new InMemoryCallbacksRepository(),
          outboundMessagesRepository: new InMemoryOutboundMessagesRepository(),
          callLogsRepository: new InMemoryCallLogsRepository(),
          missedCallsRepository: new InMemoryMissedCallsRepository(),
          authUsersRepository: new InMemoryAuthUsersRepository(),
          blogPostsRepository: new InMemoryBlogPostsRepository(),
          contactRequestsRepository: new InMemoryContactRequestsRepository(),
          demoSessionsRepository: new InMemoryDemoSessionsRepository(),
          webDemoSessionsRepository: new InMemoryWebDemoSessionsRepository(),
          handoffSessionsRepository: new InMemoryHandoffSessionsRepository(),
          voiceCallLegsRepository: new InMemoryVoiceCallLegsRepository(),
        };
  const services =
    commProvider === 'telnyx'
      ? {
          smsService: new TelnyxSmsService(getEnv().TELNYX_API_KEY),
          telephonyService: new TelnyxTelephonyService(getEnv().TELNYX_API_KEY, getEnv().TELNYX_APP_ID, {
            livekitUrl: getEnv().LIVEKIT_URL,
            livekitApiKey: getEnv().LIVEKIT_API_KEY,
            livekitApiSecret: getEnv().LIVEKIT_API_SECRET,
            sipOutboundTrunkId: getEnv().LIVEKIT_SIP_OUTBOUND_TRUNK_ID,
            handoffSessionsRepository: repositories.handoffSessionsRepository,
            jobsRepository: repositories.jobsRepository,
          }),
          phoneProvisioningService: new TelnyxPhoneProvisioningService(
            getEnv().TELNYX_API_KEY,
            getEnv().TELNYX_APP_ID,
            getEnv().TELNYX_MESSAGING_PROFILE,
          ),
        }
      : {
          smsService: new NoopSmsService(),
          telephonyService: new NoopTelephonyService(),
          phoneProvisioningService: new NoopPhoneProvisioningService(),
        };
  const emailService =
    emailProvider === 'resend'
      ? (() => {
          const resendApiKey = getEnv().RESEND_API_KEY;
          if (!resendApiKey) {
            throw new Error('resend_api_key_missing');
          }
          return new ResendEmailService(resendApiKey, getEnv().EMAIL_FROM_ADDRESS);
        })()
      : new NoopEmailService();
  const recordingStorage = (() => {
    const env = getEnv();
    if (
      !env.R2_CALL_RECORDINGS_ACCOUNT_ID ||
      !env.R2_CALL_RECORDINGS_ACCESS_KEY_ID ||
      !env.R2_CALL_RECORDINGS_SECRET_ACCESS_KEY ||
      !env.R2_CALL_RECORDINGS_BUCKET
    ) {
      return undefined;
    }
    return new R2CallRecordingStorage(env.R2_CALL_RECORDINGS_BUCKET, {
      accountId: env.R2_CALL_RECORDINGS_ACCOUNT_ID,
      accessKeyId: env.R2_CALL_RECORDINGS_ACCESS_KEY_ID,
      secretAccessKey: env.R2_CALL_RECORDINGS_SECRET_ACCESS_KEY,
    });
  })();
  const realtimeAgentRuntime =
    agentRuntimeMode === 'livekit_realtime'
      ? (() => {
          const sharedConfig = {
            livekitUrl: getEnv().LIVEKIT_URL,
            livekitApiKey: getEnv().LIVEKIT_API_KEY,
            livekitApiSecret: getEnv().LIVEKIT_API_SECRET,
            voiceProvider: agentVoiceProviderMode === 'none' ? 'gemini_live' : agentVoiceProviderMode,
            voiceApiKeyConfigured:
              agentVoiceProviderMode === 'gemini_live'
                ? Boolean(getEnv().GOOGLE_AI_API_KEY)
                : agentVoiceProviderMode === 'openai_realtime'
                  ? Boolean(process.env.OPENAI_API_KEY)
                  : false,
            voiceModel: process.env.AGENT_VOICE_MODEL?.trim() || getEnv().AGENT_GEMINI_MODEL,
          } as const;

          if (process.env.AGENT_RUNTIME_MODE === 'livekit_native_gemini') {
            return new LiveKitNativeGeminiRuntime(sharedConfig);
          }
          if (process.env.AGENT_RUNTIME_MODE === 'livekit_native_openai') {
            return new LiveKitNativeOpenAIRuntime(sharedConfig);
          }
          return new LiveKitRealtimeRuntime(sharedConfig);
        })()
      : new MockRealtimeAgentRuntime();
  const billingProvider =
    billingProviderMode === 'paddle'
      ? new PaddleBillingProvider({
          billingCustomersRepository: repositories.billingCustomersRepository,
          billingSubscriptionsRepository: repositories.billingSubscriptionsRepository,
          shopOverageChargesRepository: repositories.shopOverageChargesRepository,
          shopUsageAlertsRepository: repositories.shopUsageAlertsRepository,
          callLogsRepository: repositories.callLogsRepository,
          shopAccessStatesRepository: repositories.shopAccessStatesRepository,
          shopsRepository: repositories.shopsRepository,
          authUsersRepository: repositories.authUsersRepository,
          emailService,
        })
      : undefined;

  const app = createBackendApp({
    providerEventsRepository: repositories.providerEventsRepository,
    vagaroWebhookEventsRepository: repositories.vagaroWebhookEventsRepository,
    jobsRepository: repositories.jobsRepository,
    bookingsRepository: repositories.bookingsRepository,
    billingCustomersRepository: repositories.billingCustomersRepository,
    billingSubscriptionsRepository: repositories.billingSubscriptionsRepository,
    shopOverageChargesRepository: repositories.shopOverageChargesRepository,
    shopUsageAlertsRepository: repositories.shopUsageAlertsRepository,
    billingNotificationsRepository: repositories.billingNotificationsRepository,
    shopAccessStatesRepository: repositories.shopAccessStatesRepository,
    commercialGoLiveApprovalEventsRepository: repositories.commercialGoLiveApprovalEventsRepository,
    shopLocationsRepository: repositories.shopLocationsRepository,
    shopRoutingRulesRepository: repositories.shopRoutingRulesRepository,
    commercialAccountsRepository: repositories.commercialAccountsRepository,
    testCallAttemptsRepository: repositories.testCallAttemptsRepository,
    forwardingTestSessionsRepository: repositories.forwardingTestSessionsRepository,
    callbacksRepository: repositories.callbacksRepository,
    shopsRepository: repositories.shopsRepository,
    shopStaffRepository: repositories.shopStaffRepository,
    shopStaffServicesRepository: repositories.shopStaffServicesRepository,
    telephonyService: services.telephonyService,
    phoneProvisioningService: services.phoneProvisioningService,
    emailService,
    realtimeAgentRuntime,
    callLogsRepository: repositories.callLogsRepository,
    recordingStorage,
    missedCallsRepository: repositories.missedCallsRepository,
    handoffSessionsRepository: repositories.handoffSessionsRepository,
    voiceCallLegsRepository: repositories.voiceCallLegsRepository,
    authUsersRepository: repositories.authUsersRepository,
    blogPostsRepository: repositories.blogPostsRepository,
    contactRequestsRepository: repositories.contactRequestsRepository,
    demoSessionsRepository: repositories.demoSessionsRepository,
    webDemoSessionsRepository: repositories.webDemoSessionsRepository,
    billingProvider,
    basePath: '/api/backend',
    runtimeInfo: {
      mode,
      commProvider,
      agentRuntimeMode,
      agentTransportMode,
      agentVoiceProviderMode,
    },
  });

  return {
    app,
    mode,
    commProvider,
    agentRuntimeMode,
    agentTransportMode,
    agentVoiceProviderMode,
    providerEventsRepository: repositories.providerEventsRepository,
    vagaroWebhookEventsRepository: repositories.vagaroWebhookEventsRepository,
    shopsRepository: repositories.shopsRepository,
    customersRepository: repositories.customersRepository,
    billingCustomersRepository: repositories.billingCustomersRepository,
    billingSubscriptionsRepository: repositories.billingSubscriptionsRepository,
    shopOverageChargesRepository: repositories.shopOverageChargesRepository,
    shopUsageAlertsRepository: repositories.shopUsageAlertsRepository,
    billingNotificationsRepository: repositories.billingNotificationsRepository,
    shopAccessStatesRepository: repositories.shopAccessStatesRepository,
    shopLocationsRepository: repositories.shopLocationsRepository,
    shopRoutingRulesRepository: repositories.shopRoutingRulesRepository,
    commercialAccountsRepository: repositories.commercialAccountsRepository,
    shopActiveCallSessionsRepository: repositories.shopActiveCallSessionsRepository,
    testCallAttemptsRepository: repositories.testCallAttemptsRepository,
    forwardingTestSessionsRepository: repositories.forwardingTestSessionsRepository,
    jobsRepository: repositories.jobsRepository,
    bookingsRepository: repositories.bookingsRepository,
    callbacksRepository: repositories.callbacksRepository,
    outboundMessagesRepository: repositories.outboundMessagesRepository,
    callLogsRepository: repositories.callLogsRepository,
    recordingStorage,
    missedCallsRepository: repositories.missedCallsRepository,
    handoffSessionsRepository: repositories.handoffSessionsRepository,
    voiceCallLegsRepository: repositories.voiceCallLegsRepository,
    authUsersRepository: repositories.authUsersRepository,
    blogPostsRepository: repositories.blogPostsRepository,
    contactRequestsRepository: repositories.contactRequestsRepository,
    demoSessionsRepository: repositories.demoSessionsRepository,
    webDemoSessionsRepository: repositories.webDemoSessionsRepository,
    smsService: services.smsService,
    telephonyService: services.telephonyService,
    phoneProvisioningService: services.phoneProvisioningService,
    emailService,
    billingProvider,
    realtimeAgentRuntime,
  };
}

let runtimeSingleton: BackendRuntime | null = null;

export function getBackendRuntime(): BackendRuntime {
  if (!runtimeSingleton) {
    runtimeSingleton = createBackendRuntime();
  }
  return runtimeSingleton;
}
