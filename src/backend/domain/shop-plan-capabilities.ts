import type { ShopPlan } from '@/src/backend/domain/types';

export type ShopSettingCapability =
  | 'edit_business_profile'
  | 'edit_booking_url'
  | 'edit_cancel_policy'
  | 'edit_promotions'
  | 'edit_services'
  | 'edit_hours'
  | 'edit_transfer_settings'
  | 'edit_callback_settings'
  | 'edit_missed_call_followup_sms'
  | 'edit_ai_voice'
  | 'edit_ai_greeting'
  | 'edit_reminder_sms'
  | 'edit_review_request_sms'
  | 'edit_ai_custom_instructions';

export type ShopPlanCapabilities = Record<ShopSettingCapability, boolean>;

const PLAN_ORDER: Record<ShopPlan, number> = {
  starter: 0,
  professional: 1,
  enterprise: 2,
};

export const CAPABILITY_MIN_PLAN: Record<ShopSettingCapability, ShopPlan> = {
  edit_business_profile: 'starter',
  edit_booking_url: 'starter',
  edit_cancel_policy: 'starter',
  edit_promotions: 'starter',
  edit_services: 'starter',
  edit_hours: 'starter',
  edit_transfer_settings: 'professional',
  edit_callback_settings: 'starter',
  edit_missed_call_followup_sms: 'starter',
  edit_ai_voice: 'professional',
  edit_ai_greeting: 'professional',
  edit_reminder_sms: 'professional',
  edit_review_request_sms: 'professional',
  edit_ai_custom_instructions: 'enterprise',
};

export const CAPABILITY_LABELS: Record<ShopSettingCapability, string> = {
  edit_business_profile: 'Business profile',
  edit_booking_url: 'Booking link',
  edit_cancel_policy: 'Cancellation policy',
  edit_promotions: 'Promotions',
  edit_services: 'Services',
  edit_hours: 'Business hours',
  edit_transfer_settings: 'Transfer rules',
  edit_callback_settings: 'Callback rules',
  edit_missed_call_followup_sms: 'Missed-call follow-up SMS',
  edit_ai_voice: 'AI voice style',
  edit_ai_greeting: 'AI greeting',
  edit_reminder_sms: 'Reminder SMS',
  edit_review_request_sms: 'Review request SMS',
  edit_ai_custom_instructions: 'Advanced AI instructions',
};

export function getShopPlanCapabilities(plan: ShopPlan): ShopPlanCapabilities {
  return {
    edit_business_profile: true,
    edit_booking_url: true,
    edit_cancel_policy: true,
    edit_promotions: true,
    edit_services: true,
    edit_hours: true,
    edit_transfer_settings: PLAN_ORDER[plan] >= PLAN_ORDER.professional,
    edit_callback_settings: true,
    edit_missed_call_followup_sms: true,
    edit_ai_voice: PLAN_ORDER[plan] >= PLAN_ORDER.professional,
    edit_ai_greeting: PLAN_ORDER[plan] >= PLAN_ORDER.professional,
    edit_reminder_sms: PLAN_ORDER[plan] >= PLAN_ORDER.professional,
    edit_review_request_sms: PLAN_ORDER[plan] >= PLAN_ORDER.professional,
    edit_ai_custom_instructions: PLAN_ORDER[plan] >= PLAN_ORDER.enterprise,
  };
}

export function isCapabilityAllowed(plan: ShopPlan, capability: ShopSettingCapability): boolean {
  return PLAN_ORDER[plan] >= PLAN_ORDER[CAPABILITY_MIN_PLAN[capability]];
}

export function canUseReminderSms(plan: ShopPlan): boolean {
  return isCapabilityAllowed(plan, 'edit_reminder_sms');
}

export function canUseReviewRequestSms(plan: ShopPlan): boolean {
  return isCapabilityAllowed(plan, 'edit_review_request_sms');
}

export function canUseReturningCallerContext(plan: ShopPlan): boolean {
  return PLAN_ORDER[plan] >= PLAN_ORDER.professional;
}

export function canUseBilingualWorkflow(plan: ShopPlan): boolean {
  return PLAN_ORDER[plan] >= PLAN_ORDER.professional;
}

export function canUseOwnerTransfer(plan: ShopPlan): boolean {
  return isCapabilityAllowed(plan, 'edit_transfer_settings');
}
