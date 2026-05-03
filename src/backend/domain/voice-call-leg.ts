export type VoiceCallLegPurpose = 'parent_caller_leg' | 'openai_sip_leg' | 'owner_handoff_leg';

export type VoiceCallLegRecord = {
  id: string;
  rbCallId: string;
  shopId: string;
  purpose: VoiceCallLegPurpose;
  callControlId: string | null;
  callSessionId: string | null;
  callLegId: string | null;
  parentCallControlId: string | null;
  parentCallSessionId: string | null;
  status: string;
  provider: string;
  clientState: unknown | null;
  metadata: unknown | null;
  createdAt: Date;
  updatedAt: Date;
};
