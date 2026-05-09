export type PhoneSetupState =
  | 'onboarding_incomplete'
  | 'setup_ready_for_test'
  | 'payment_verification_pending'
  | 'payment_method_required'
  | 'forwarding_number_needed'
  | 'forwarding_number_ready'
  | 'forwarding_verification_needed'
  | 'ready_to_enable_live'
  | 'live_answering_active'
  | 'billing_issue'
  | 'live_paused';

export type PhoneSetupStatusInput = {
  onboardingRequired?: boolean;
  subscriptionStatus?: string | null;
  paymentMethodStatus?: string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  hasPaymentMethod?: boolean;
  hasForwardingNumber?: boolean;
  forwardingSetupVerified?: boolean;
  liveCallsEnabled?: boolean;
  primaryCta?: string | null;
  blockReason?: string | null;
  commercialApprovalRequired?: boolean;
};

export type PhoneSetupCopy = {
  title: string;
  explanation: string;
  primaryLabel: string;
  primaryTarget: string;
  secondaryLabel?: string;
  secondaryTarget?: string;
  blockingReason?: string;
};

const BILLING_ISSUE_STATUSES = new Set(['canceled', 'paused', 'past_due', 'unpaid', 'trial_expired']);

export function resolvePhoneSetupState(input: PhoneSetupStatusInput): PhoneSetupState {
  if (input.onboardingRequired) return 'onboarding_incomplete';
  if (input.commercialApprovalRequired) return 'live_paused';
  if (BILLING_ISSUE_STATUSES.has(input.subscriptionStatus ?? '') || input.blockReason === 'trial_expired') {
    return 'billing_issue';
  }
  if (input.liveCallsEnabled && input.blockReason !== 'subscription_inactive') return 'live_answering_active';
  if (input.primaryCta === 'enable_live_answering' || input.forwardingSetupVerified) return 'ready_to_enable_live';
  if (input.hasForwardingNumber && !input.forwardingSetupVerified) return 'forwarding_verification_needed';
  if (input.primaryCta === 'set_up_call_forwarding' || (input.hasPaymentMethod && !input.hasForwardingNumber)) {
    return 'forwarding_number_needed';
  }
  if (
    ['unknown', 'pending'].includes(input.paymentMethodStatus ?? '') &&
    ['active', 'trialing'].includes(input.subscriptionStatus ?? '') &&
    (Boolean(input.providerCustomerId?.trim()) || Boolean(input.providerSubscriptionId?.trim()))
  ) {
    return 'payment_verification_pending';
  }
  if ((input.paymentMethodStatus ?? 'none') !== 'valid' || !input.hasPaymentMethod) return 'payment_method_required';
  if (input.hasForwardingNumber) return 'forwarding_number_ready';
  return 'setup_ready_for_test';
}

export function getPhoneSetupCopy(state: PhoneSetupState): PhoneSetupCopy {
  const copies: Record<PhoneSetupState, PhoneSetupCopy> = {
    onboarding_incomplete: {
      title: 'Finish your basic setup',
      explanation: 'Add your business details first. After that, RingBooker will walk you through connecting your phone.',
      primaryLabel: 'Continue setup',
      primaryTarget: '/user/onboarding',
      blockingReason: 'Setup is not complete yet.',
    },
    setup_ready_for_test: {
      title: 'Test RingBooker before going live',
      explanation: 'You can run setup tests without a card. Add a payment method only when you are ready to connect your business phone.',
      primaryLabel: 'Run a test call',
      primaryTarget: 'test_call',
      secondaryLabel: 'Add payment method',
      secondaryTarget: '/user/billing',
    },
    payment_verification_pending: {
      title: 'Payment method is being verified',
      explanation: 'Paddle has returned you to RingBooker, but billing has not been verified by webhook yet. Live answering stays off until verification is complete.',
      primaryLabel: 'Refresh status',
      primaryTarget: 'refresh',
      secondaryLabel: 'Open Billing',
      secondaryTarget: '/user/billing',
      blockingReason: 'This usually updates shortly after Paddle sends confirmation.',
    },
    payment_method_required: {
      title: 'Add a payment method to connect your phone',
      explanation: 'Add a payment method to generate your RingBooker forwarding number and go live. Setup and test calls still work without a card.',
      primaryLabel: 'Add payment method',
      primaryTarget: 'checkout',
      secondaryLabel: 'Open Billing',
      secondaryTarget: '/user/billing',
      blockingReason: 'Payment method is required before live answering.',
    },
    forwarding_number_needed: {
      title: 'Create your RingBooker forwarding number',
      explanation: 'RingBooker will create a managed forwarding number. Your clients keep calling your current business phone number.',
      primaryLabel: 'Create forwarding number',
      primaryTarget: 'provision_forwarding_number',
      secondaryLabel: 'Open Billing',
      secondaryTarget: '/user/billing',
    },
    forwarding_number_ready: {
      title: 'Your forwarding number is ready',
      explanation: 'Forward missed, after-hours, or overflow calls from your current business number to your RingBooker forwarding number.',
      primaryLabel: 'Show forwarding instructions',
      primaryTarget: '#forwarding-instructions',
    },
    forwarding_verification_needed: {
      title: 'Verify call forwarding',
      explanation: 'After setting up forwarding with your carrier, call your current business number from another phone so RingBooker can confirm the call reaches the right place.',
      primaryLabel: 'Start verification',
      primaryTarget: 'start_forwarding_test',
      secondaryLabel: 'I have verified it manually',
      secondaryTarget: 'confirm_forwarding',
      blockingReason: 'Forwarding must be verified before live answering.',
    },
    ready_to_enable_live: {
      title: 'Ready to enable live answering',
      explanation: 'Billing, forwarding number, and verification are ready. Turn on live answering when you want RingBooker to answer real callers.',
      primaryLabel: 'Enable live answering',
      primaryTarget: 'enable_live',
    },
    live_answering_active: {
      title: 'Live answering is active',
      explanation: 'RingBooker can answer forwarded calls from your current business number.',
      primaryLabel: 'View call logs',
      primaryTarget: '/user/calls',
      secondaryLabel: 'Run a test call',
      secondaryTarget: 'test_call',
    },
    billing_issue: {
      title: 'Billing issue blocks live answering',
      explanation: 'Live answering is blocked until your subscription and payment method are active again.',
      primaryLabel: 'Resolve billing issue',
      primaryTarget: '/user/billing',
      blockingReason: 'Billing is not valid for live answering.',
    },
    live_paused: {
      title: 'Live answering is paused',
      explanation: 'Your Custom setup is being reviewed by RingBooker. We will confirm routing and go-live details before live answering is enabled.',
      primaryLabel: 'Contact support',
      primaryTarget: '/contact?topic=implementation',
      blockingReason: 'RingBooker approval is required before go-live.',
    },
  };
  return copies[state];
}
