export type ProviderCountry = 'US' | 'CA' | 'AU' | 'UK' | 'NZ' | 'IE';
export type ProviderMarketGroup = 'default-country' | 'business-voip' | 'other-country';
export type ProviderCategory = 'carrier' | 'business-phone' | 'voip' | 'virtual-number';
export type ProviderType = 'Mobile' | 'Landline' | 'Business phone' | 'VoIP' | 'Virtual number';
export type VerificationStatus = 'verified_official_docs' | 'partial' | 'needs_official_verification';
export type SetupKey = 'no-answer' | 'busy' | 'after-hours' | 'all-calls';

export type SetupOption = {
  id: SetupKey;
  title: string;
  whenToUse: string;
  steps: string[];
  note: string;
};

export type ProviderRecord = {
  id: string;
  name: string;
  aliases: string[];
  country: ProviderCountry | null;
  marketGroup: ProviderMarketGroup;
  category: ProviderCategory;
  providerType: ProviderType;
  sourceUrls: string[];
  verificationStatus: VerificationStatus;
  bestFor: string;
  ringbookerRecommendation: string;
  setupOptions: SetupOption[];
  beforeYouStart: string[];
  generalSetupSteps: string[];
  testingSteps: string[];
  turnOffSteps: string[];
  troubleshooting: string[];
  disclaimer: string;
};

const BASE_SETUP_OPTIONS: SetupOption[] = [
  {
    id: 'no-answer',
    title: 'Forward missed / no-answer calls',
    whenToUse: 'Best when your team usually answers but misses calls during service windows.',
    steps: [
      'Open call forwarding settings for the business number.',
      'Find no-answer/unanswered forwarding.',
      'Set RingBooker number as forwarding destination.',
      'Choose ring timeout and save settings.',
    ],
    note: 'Exact labels and ring timeout options vary by device, plan, and region.',
  },
  {
    id: 'busy',
    title: 'Forward busy calls',
    whenToUse: 'Best for peak-hour overflow when line or queue is occupied.',
    steps: [
      'Open busy-line or overflow forwarding settings.',
      'Route busy condition to RingBooker.',
      'Keep normal answered-call flow unchanged.',
      'Test by calling while line is in use.',
    ],
    note: 'Some systems label this as “busy line”, “call waiting forward”, or “queue overflow”.',
  },
  {
    id: 'after-hours',
    title: 'Forward after-hours calls',
    whenToUse: 'Best when your team handles in-hours calls and RingBooker handles off-hours.',
    steps: [
      'Open business hours or schedule-based routing settings.',
      'Set after-hours destination to RingBooker.',
      'Confirm in-hours route stays with your staff.',
      'Run at least one off-hours test call.',
    ],
    note: 'After-hours controls are often in auto-attendant, call handling, or routing policy screens.',
  },
  {
    id: 'all-calls',
    title: 'Forward all calls',
    whenToUse: 'Use for controlled pilots or temporary full call coverage.',
    steps: [
      'Enable unconditional/all-call forwarding.',
      'Set RingBooker as destination number.',
      'Run a live inbound test immediately.',
      'Document rollback path before going live.',
    ],
    note: 'All calls bypass your normal first-ring handling while active.',
  },
];

const BASE_BEFORE_YOU_START = [
  'Your current business phone number',
  'Your RingBooker forwarding number',
  'Admin access to carrier or phone system account',
  'A second phone for test calls',
];

const BASE_GENERAL_STEPS = [
  'Sign in to provider account, app, or dial-code menu.',
  'Locate call forwarding/call handling settings for your business number.',
  'Apply forwarding condition (no-answer, busy, after-hours, or all calls).',
  'Set RingBooker as destination and save.',
];

const BASE_TESTING_STEPS = [
  'Call your public business number from a different phone.',
  'Trigger selected forwarding condition.',
  'Confirm RingBooker receives the call and call summary is generated.',
  'Validate your team receives follow-up details.',
];

const BASE_TURNOFF_STEPS = [
  'Disable forwarding in provider settings (or deactivation code flow if available).',
  'Run one verification call to confirm forwarding is off.',
];

const BASE_TROUBLESHOOTING = [
  'Calls still go to voicemail',
  'Calls forward immediately when they should not',
  'RingBooker does not receive test calls',
  'Caller ID presentation is unexpected',
  'Admin permission or plan restrictions block changes',
];

function record(input: {
  id: string;
  name: string;
  aliases?: string[];
  country: ProviderCountry | null;
  marketGroup: ProviderMarketGroup;
  category: ProviderCategory;
  providerType: ProviderType;
  sourceUrls: string[];
  verificationStatus: VerificationStatus;
  bestFor: string;
}): ProviderRecord {
  const verificationDisclaimer =
    input.verificationStatus === 'verified_official_docs'
      ? 'This provider has official documentation references in source links. Always validate in your own account before go-live.'
      : input.verificationStatus === 'partial'
        ? 'Some forwarding behavior is verified from official docs, but steps can vary by plan/device. Confirm in your account before go-live.'
        : 'Exact forwarding codes/menus are not fully verified from official docs yet. Use general setup flow and confirm with provider support.';

  return {
    id: input.id,
    name: input.name,
    aliases: input.aliases ?? [],
    country: input.country,
    marketGroup: input.marketGroup,
    category: input.category,
    providerType: input.providerType,
    sourceUrls: input.sourceUrls,
    verificationStatus: input.verificationStatus,
    bestFor: input.bestFor,
    ringbookerRecommendation:
      'Most salons and spas should start with no-answer, busy-line, or after-hours forwarding. This keeps normal answered calls with your team while RingBooker covers missed-call windows.',
    setupOptions: BASE_SETUP_OPTIONS,
    beforeYouStart: BASE_BEFORE_YOU_START,
    generalSetupSteps: BASE_GENERAL_STEPS,
    testingSteps: BASE_TESTING_STEPS,
    turnOffSteps: BASE_TURNOFF_STEPS,
    troubleshooting: BASE_TROUBLESHOOTING,
    disclaimer: verificationDisclaimer,
  };
}

export const CALL_FORWARDING_COUNTRY_GROUPS: Array<{ code: 'US' | 'CA' | 'AU'; label: string; description: string }> = [
  { code: 'US', label: 'United States', description: 'Popular US carrier and business phone options for appointment-based teams.' },
  { code: 'CA', label: 'Canada', description: 'Common Canadian providers for no-answer, busy, and after-hours forwarding.' },
  { code: 'AU', label: 'Australia', description: 'Australian provider options for practical missed-call coverage.' },
];

export const CALL_FORWARDING_OTHER_COUNTRIES: Array<{ code: 'UK' | 'NZ' | 'IE'; label: string }> = [
  { code: 'UK', label: 'United Kingdom' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'IE', label: 'Ireland' },
];

export const CALL_FORWARDING_PROVIDERS: ProviderRecord[] = [
  // United States
  record({
    id: 'verizon',
    name: 'Verizon',
    aliases: ['verizon wireless'],
    country: 'US',
    marketGroup: 'default-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.verizon.com/support/call-forwarding/'],
    verificationStatus: 'verified_official_docs',
    bestFor: 'Best for no-answer and busy forwarding on mobile business lines.',
  }),
  record({
    id: 'att',
    name: 'AT&T',
    aliases: ['at&t wireless'],
    country: 'US',
    marketGroup: 'default-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.att.com/support/article/wireless/KM1011513/'],
    verificationStatus: 'verified_official_docs',
    bestFor: 'Best for overflow routing from a primary mobile business number.',
  }),
  record({
    id: 't-mobile',
    name: 'T-Mobile',
    aliases: ['tmobile'],
    country: 'US',
    marketGroup: 'default-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.t-mobile.com/support/plans-features/self-service-short-codes'],
    verificationStatus: 'partial',
    bestFor: 'Best for missed-call forwarding in owner-operated teams.',
  }),
  record({
    id: 'google-voice-us',
    name: 'Google Voice',
    aliases: ['gvoice'],
    country: 'US',
    marketGroup: 'default-country',
    category: 'virtual-number',
    providerType: 'Virtual number',
    sourceUrls: ['https://support.google.com/voice/answer/165656'],
    verificationStatus: 'verified_official_docs',
    bestFor: 'Best for cloud-managed no-answer forwarding workflows.',
  }),
  record({
    id: 'ringcentral-us',
    name: 'RingCentral',
    country: 'US',
    marketGroup: 'default-country',
    category: 'business-phone',
    providerType: 'Business phone',
    sourceUrls: ['https://support.ringcentral.com/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for queue overflow and after-hours call handling policies.',
  }),
  record({
    id: 'openphone-us',
    name: 'OpenPhone',
    aliases: ['open phone'],
    country: 'US',
    marketGroup: 'default-country',
    category: 'voip',
    providerType: 'VoIP',
    sourceUrls: ['https://support.openphone.com/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for shared inbox teams using one public number.',
  }),
  record({
    id: 'nextiva-us',
    name: 'Nextiva',
    country: 'US',
    marketGroup: 'default-country',
    category: 'business-phone',
    providerType: 'Business phone',
    sourceUrls: ['https://www.nextiva.com/support/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for extension-level routing and overflow handling.',
  }),
  record({
    id: 'vonage-us',
    name: 'Vonage',
    country: 'US',
    marketGroup: 'default-country',
    category: 'voip',
    providerType: 'VoIP',
    sourceUrls: ['https://support.vonage.com/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for conditional forwarding by user or extension.',
  }),
  record({
    id: 'ooma-us',
    name: 'Ooma',
    country: 'US',
    marketGroup: 'default-country',
    category: 'business-phone',
    providerType: 'Business phone',
    sourceUrls: ['https://support.ooma.com/office/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for practical missed-call backup on desk phones.',
  }),
  record({
    id: 'comcast-business',
    name: 'Comcast Business',
    aliases: ['comcast'],
    country: 'US',
    marketGroup: 'default-country',
    category: 'business-phone',
    providerType: 'Landline',
    sourceUrls: ['https://business.comcast.com/help-and-support/voice/call-forwarding'],
    verificationStatus: 'partial',
    bestFor: 'Best for fixed-line no-answer forwarding in office setups.',
  }),

  // Canada
  record({
    id: 'rogers',
    name: 'Rogers',
    country: 'CA',
    marketGroup: 'default-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.rogers.com/support/mobility/call-forwarding'],
    verificationStatus: 'partial',
    bestFor: 'Best for missed-call conditional forwarding on wireless business plans.',
  }),
  record({
    id: 'bell',
    name: 'Bell',
    country: 'CA',
    marketGroup: 'default-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://support.bell.ca/mobility/calling_features/how_to_use_call_forwarding_on_my_mobile_phone'],
    verificationStatus: 'partial',
    bestFor: 'Best for no-answer timeout routing on Bell mobility lines.',
  }),
  record({
    id: 'telus',
    name: 'TELUS',
    country: 'CA',
    marketGroup: 'default-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.telus.com/en/support/article/call-forwarding'],
    verificationStatus: 'partial',
    bestFor: 'Best for busy-line overflow during in-service call spikes.',
  }),
  record({
    id: 'fido',
    name: 'Fido',
    country: 'CA',
    marketGroup: 'default-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.fido.ca/support/mobility/call-forwarding'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for solo operators needing no-answer backup.',
  }),
  record({
    id: 'virgin-plus',
    name: 'Virgin Plus',
    country: 'CA',
    marketGroup: 'default-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.virginplus.ca/en/support/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for practical overflow coverage on mobile business numbers.',
  }),
  record({
    id: 'freedom-mobile',
    name: 'Freedom Mobile',
    aliases: ['freedom'],
    country: 'CA',
    marketGroup: 'default-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.freedommobile.ca/en-CA/support'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for budget-friendly missed-call forwarding.',
  }),

  // Australia
  record({
    id: 'telstra',
    name: 'Telstra',
    country: 'AU',
    marketGroup: 'default-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.telstra.com.au/support/mobiles-devices/call-forwarding'],
    verificationStatus: 'partial',
    bestFor: 'Best for missed and busy forwarding on AU mobile lines.',
  }),
  record({
    id: 'optus',
    name: 'Optus',
    country: 'AU',
    marketGroup: 'default-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.optus.com.au/support/mobiles-tablets-watches/calling-and-voicemail/call-forwarding'],
    verificationStatus: 'partial',
    bestFor: 'Best for overflow capture during treatment-hour peaks.',
  }),
  record({
    id: 'vodafone-australia',
    name: 'Vodafone Australia',
    aliases: ['vodafone au'],
    country: 'AU',
    marketGroup: 'default-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.vodafone.com.au/support/device/call-forwarding'],
    verificationStatus: 'partial',
    bestFor: 'Best for scenario-based conditional forwarding.',
  }),
  record({
    id: 'aussie-broadband',
    name: 'Aussie Broadband',
    country: 'AU',
    marketGroup: 'default-country',
    category: 'business-phone',
    providerType: 'Business phone',
    sourceUrls: ['https://www.aussiebroadband.com.au/help-centre/phone/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for NBN voice no-answer routing.',
  }),
  record({
    id: 'tpg',
    name: 'TPG',
    country: 'AU',
    marketGroup: 'default-country',
    category: 'business-phone',
    providerType: 'Business phone',
    sourceUrls: ['https://support.tpg.com.au/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for after-hours routing in bundled voice accounts.',
  }),
  record({
    id: 'iinet',
    name: 'iiNet',
    country: 'AU',
    marketGroup: 'default-country',
    category: 'business-phone',
    providerType: 'Landline',
    sourceUrls: ['https://help.iinet.net.au/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for fixed-line missed-call fallback.',
  }),

  // Business phone & VoIP
  record({
    id: 'google-voice-voip',
    name: 'Google Voice',
    aliases: ['gvoice'],
    country: null,
    marketGroup: 'business-voip',
    category: 'virtual-number',
    providerType: 'Virtual number',
    sourceUrls: ['https://support.google.com/voice/answer/165656'],
    verificationStatus: 'verified_official_docs',
    bestFor: 'Best for web/mobile no-answer forwarding flows.',
  }),
  record({
    id: 'ringcentral-voip',
    name: 'RingCentral',
    country: null,
    marketGroup: 'business-voip',
    category: 'business-phone',
    providerType: 'Business phone',
    sourceUrls: ['https://support.ringcentral.com/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for queue overflow and schedule-based routing.',
  }),
  record({
    id: 'openphone-quo',
    name: 'OpenPhone / Quo',
    aliases: ['openphone', 'quo'],
    country: null,
    marketGroup: 'business-voip',
    category: 'voip',
    providerType: 'VoIP',
    sourceUrls: ['https://support.openphone.com/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for shared inbox call workflows.',
  }),
  record({
    id: 'dialpad',
    name: 'Dialpad',
    country: null,
    marketGroup: 'business-voip',
    category: 'voip',
    providerType: 'VoIP',
    sourceUrls: ['https://help.dialpad.com/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for office-hours and routing policy control.',
  }),
  record({
    id: 'nextiva-voip',
    name: 'Nextiva',
    country: null,
    marketGroup: 'business-voip',
    category: 'business-phone',
    providerType: 'Business phone',
    sourceUrls: ['https://www.nextiva.com/support/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for extension-based call routing.',
  }),
  record({
    id: 'vonage-voip',
    name: 'Vonage',
    country: null,
    marketGroup: 'business-voip',
    category: 'voip',
    providerType: 'VoIP',
    sourceUrls: ['https://support.vonage.com/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for conditional forwarding by user or extension.',
  }),
  record({
    id: 'ooma-voip',
    name: 'Ooma',
    country: null,
    marketGroup: 'business-voip',
    category: 'business-phone',
    providerType: 'Business phone',
    sourceUrls: ['https://support.ooma.com/office/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for simple missed-call fallback routing.',
  }),
  record({
    id: 'zoom-phone',
    name: 'Zoom Phone',
    aliases: ['zoom'],
    country: null,
    marketGroup: 'business-voip',
    category: 'voip',
    providerType: 'VoIP',
    sourceUrls: ['https://support.zoom.com/hc/en/zoom-phone'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for queue + business-hours forwarding rules.',
  }),
  record({
    id: 'grasshopper',
    name: 'Grasshopper',
    country: null,
    marketGroup: 'business-voip',
    category: 'virtual-number',
    providerType: 'Virtual number',
    sourceUrls: ['https://grasshopper.com/support/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for solo operators with one public number.',
  }),
  record({
    id: 'goto-connect',
    name: 'GoTo Connect',
    aliases: ['goto'],
    country: null,
    marketGroup: 'business-voip',
    category: 'voip',
    providerType: 'VoIP',
    sourceUrls: ['https://support.goto.com/connect/help'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for dial-plan fallback routing.',
  }),

  // Other countries
  record({
    id: 'ee',
    name: 'EE',
    country: 'UK',
    marketGroup: 'other-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://ee.co.uk/help/mobile/calling/call-divert'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for no-answer routing on UK mobile lines.',
  }),
  record({
    id: 'o2',
    name: 'O2',
    country: 'UK',
    marketGroup: 'other-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.o2.co.uk/help/phones-sims-and-devices/call-divert'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for missed and busy forwarding on mobile business numbers.',
  }),
  record({
    id: 'vodafone-uk',
    name: 'Vodafone UK',
    country: 'UK',
    marketGroup: 'other-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://support.vodafone.co.uk/Phones-devices/Calls-and-voicemail/1464043672/How-do-I-set-up-call-diverting.htm'],
    verificationStatus: 'partial',
    bestFor: 'Best for overflow and off-hours routing.',
  }),
  record({
    id: 'three-uk',
    name: 'Three UK',
    aliases: ['three'],
    country: 'UK',
    marketGroup: 'other-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.three.co.uk/support/calls-and-voicemail/call-divert'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for missed-call fallback on one primary line.',
  }),
  record({
    id: 'bt',
    name: 'BT',
    country: 'UK',
    marketGroup: 'other-country',
    category: 'business-phone',
    providerType: 'Landline',
    sourceUrls: ['https://business.bt.com/help/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for fixed-line no-answer routing.',
  }),
  record({
    id: 'virgin-media-uk',
    name: 'Virgin Media UK',
    aliases: ['virgin media uk'],
    country: 'UK',
    marketGroup: 'other-country',
    category: 'business-phone',
    providerType: 'Landline',
    sourceUrls: ['https://www.virginmediabusiness.co.uk/help-and-advice/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for after-hours landline call coverage.',
  }),
  record({
    id: 'talktalk',
    name: 'TalkTalk',
    country: 'UK',
    marketGroup: 'other-country',
    category: 'business-phone',
    providerType: 'Landline',
    sourceUrls: ['https://community.talktalk.co.uk/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for practical missed-call forwarding.',
  }),
  record({
    id: 'sky-mobile',
    name: 'Sky Mobile',
    aliases: ['sky'],
    country: 'UK',
    marketGroup: 'other-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.sky.com/help/home/sky-mobile'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for mobile overflow backup.',
  }),
  record({
    id: 'spark',
    name: 'Spark',
    country: 'NZ',
    marketGroup: 'other-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.spark.co.nz/help/mobile/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for no-answer and busy forwarding on NZ mobile lines.',
  }),
  record({
    id: 'one-nz',
    name: 'One NZ',
    aliases: ['vodafone nz'],
    country: 'NZ',
    marketGroup: 'other-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://one.nz/help/mobile/calling/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for overflow capture during treatment windows.',
  }),
  record({
    id: '2degrees',
    name: '2degrees',
    aliases: ['two degrees'],
    country: 'NZ',
    marketGroup: 'other-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.2degrees.nz/help/mobile-help/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for simple conditional forwarding.',
  }),
  record({
    id: 'eir',
    name: 'eir',
    country: 'IE',
    marketGroup: 'other-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.eir.ie/helpandsupport/mobile/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for missed-call fallback on Irish mobile lines.',
  }),
  record({
    id: 'vodafone-ireland',
    name: 'Vodafone Ireland',
    aliases: ['vodafone ie'],
    country: 'IE',
    marketGroup: 'other-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://n.vodafone.ie/support/mobile.html'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for peak-hour overflow routing.',
  }),
  record({
    id: 'three-ireland',
    name: 'Three Ireland',
    aliases: ['three ie'],
    country: 'IE',
    marketGroup: 'other-country',
    category: 'carrier',
    providerType: 'Mobile',
    sourceUrls: ['https://www.three.ie/support/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for no-answer conditional forwarding.',
  }),
  record({
    id: 'virgin-media-ireland',
    name: 'Virgin Media Ireland',
    aliases: ['virgin media ie'],
    country: 'IE',
    marketGroup: 'other-country',
    category: 'business-phone',
    providerType: 'Landline',
    sourceUrls: ['https://www.virginmedia.ie/customer-support/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for fixed-line after-hours call capture.',
  }),
];
