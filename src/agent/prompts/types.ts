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
  variants?: Array<{
    label: string;
    price?: number | null;
    priceType?: 'fixed' | 'from' | 'varies' | 'consultation' | null;
    duration?: string | number | null;
    notes?: string | null;
  }>;
};

export type RuntimeBusinessConfig = {
  businessName: string;
  businessType?: string | null;
  additionalServices?: string | null;
  location?: string | null;
  timezone?: string | null;
  currentLocalTime?: string | null;
  currentlyOpen?: boolean | null;
  todayHours?: string | null;
  hours?: string | null;
  services?: RuntimeService[];
  notOfferedServices?: string[];
  providers?: string[];
  promotions?: string | null;
  cancellationPolicy?: string | null;
  bookingMethod?: string | null;
  selectedIntegration?: string | null;
  vagaroMode?: string | null;
  vagaroConnectionStatus?: string | null;
  bookingUrl?: string | null;
  bookingRequestInstruction?: string | null;
  welcomeMessage?: string | null;
  customInstructions?: string | null;
  languageOptions?: string[];
  /** Production-only; Starter plan uses English-only policy + setup metadata */
  productionLanguageDirective?: string | null;
  handoffPolicy?: string | null;
  /**
   * Runtime caller ID status. Undefined means this prompt path does not know;
   * null/empty means caller ID is unavailable and phone may need collection.
   */
  callerPhone?: string | null;
  callerContext?: string | null;
  demoContext?: string | null;
};

export type VoicePromptInput = {
  vertical: VoicePromptVertical;
  callType: VoicePromptCallType;
  mode: VoicePromptMode;
  business: RuntimeBusinessConfig;
  runtimeEssentials?: string;
  runtimeOptional?: string;
  /** Production shop plan: core + vertical language strips for Starter / paid English-only */
  shopPlan?: ShopPlan;
  shopLanguages?: string[];
};

export type PromptPack = {
  id: string;
  title: string;
  content: string;
};
