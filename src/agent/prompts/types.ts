import type { ShopPlan } from '@/src/backend/domain/types';

export type VoicePromptVertical = 'nail-salon' | 'hair-salon' | 'day-spa' | 'med-spa' | 'beauty-clinic';

export type VoicePromptCallType =
  | 'inbound_booking'
  | 'reschedule'
  | 'cancellation'
  | 'complaint_escalation'
  | 'demo_outbound'
  | 'callback'
  | 'outbound_reminder'
  | 'outbound_no_show_followup'
  | 'outbound_slot_recovery'
  | 'outbound_reactivation';

export type VoicePromptMode = 'production' | 'demo';

export type RuntimeService = {
  name: string;
  price?: number | null;
  priceType?: 'fixed' | 'from' | 'varies' | 'consultation' | null;
  duration?: string | number | null;
  category?: string | null;
  notes?: string | null;
  bookable?: boolean | null;
};

export type RuntimeBusinessConfig = {
  businessName: string;
  businessType?: string | null;
  location?: string | null;
  timezone?: string | null;
  hours?: string | null;
  services?: RuntimeService[];
  providers?: string[];
  promotions?: string | null;
  cancellationPolicy?: string | null;
  bookingUrl?: string | null;
  welcomeMessage?: string | null;
  customInstructions?: string | null;
  languageOptions?: string[];
  /** Production-only; Starter plan uses English-only policy + setup metadata */
  productionLanguageDirective?: string | null;
  callerContext?: string | null;
  demoContext?: string | null;
};

export type VoicePromptInput = {
  vertical: VoicePromptVertical;
  callType: VoicePromptCallType;
  mode: VoicePromptMode;
  business: RuntimeBusinessConfig;
  /** Production shop plan: core + vertical language strips for Starter / paid English-only */
  shopPlan?: ShopPlan;
  shopLanguages?: string[];
};

export type PromptPack = {
  id: string;
  title: string;
  content: string;
};
