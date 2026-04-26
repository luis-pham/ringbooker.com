export type ProviderCountryCode = 'US' | 'CA' | 'AU' | 'UK' | 'NZ' | 'IE';
export type ProviderCountry = 'United States' | 'Canada' | 'Australia' | 'United Kingdom' | 'New Zealand' | 'Ireland' | 'Multi-country';
export type ProviderMarketGroup = 'default_country' | 'business_voip' | 'secondary_country';
export type ProviderCategory = 'mobile_carrier' | 'landline' | 'business_phone' | 'voip' | 'virtual_number' | 'cable_phone';
export type ProviderTypeLabel = 'Mobile' | 'Landline' | 'Business phone' | 'VoIP' | 'Virtual number' | 'Cable phone';
export type SourcePriority = 'skipcalls_discovery' | 'official_docs' | 'manual_research';
export type VerificationStatus = 'verified_official' | 'partial' | 'needs_official_verification';
export type SetupKey = 'no-answer' | 'busy' | 'after-hours' | 'all-calls';
export type SetupInstructionVerification = 'skipcalls_sourced' | 'official_verified' | 'needs_official_verification';
export type SetupInstructionOptionType = 'all_calls' | 'no_answer' | 'busy' | 'unreachable' | 'after_hours' | 'dashboard_rule';
export type SetupInstructionActivationMethod = 'dial_code' | 'app_setting' | 'web_dashboard' | 'admin_portal' | 'phone_setting' | 'unknown';

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
  country: ProviderCountry;
  countryCode: ProviderCountryCode | null;
  marketGroup: ProviderMarketGroup;
  category: ProviderCategory;
  providerTypeLabel: ProviderTypeLabel;
  sourcePriority: SourcePriority;
  sourceUrls: string[];
  verificationStatus: VerificationStatus;
  bestFor: string;
  ringbookerRecommendation: string;
  setupOptions: {
    allCalls: boolean | 'unknown';
    noAnswer: boolean | 'unknown';
    busy: boolean | 'unknown';
    unreachable: boolean | 'unknown';
    afterHours: boolean | 'unknown';
  };
  setupGuidance: {
    missedNoAnswer: {
      whenToUse: string;
      steps: string[];
      sourceUrls: string[];
      verificationStatus: VerificationStatus;
    };
    busy: {
      whenToUse: string;
      steps: string[];
      sourceUrls: string[];
      verificationStatus: VerificationStatus;
    };
    afterHours: {
      whenToUse: string;
      steps: string[];
      sourceUrls: string[];
      verificationStatus: VerificationStatus;
    };
    allCalls: {
      whenToUse: string;
      steps: string[];
      sourceUrls: string[];
      verificationStatus: VerificationStatus;
    };
  };
  beforeYouStart: string[];
  testingSteps: string[];
  turnOffSteps: string[];
  troubleshooting: string[];
  disclaimer: string;
  logo: {
    src: string | null;
    alt: string;
    sourceUrl: string | null;
    sourceType: 'official_brand_kit' | 'official_website' | 'official_support_site' | 'official_favicon' | 'text_fallback' | 'needs_review';
    usageStatus: 'approved_official' | 'likely_ok' | 'needs_manual_review' | 'not_found';
  };
  setupInstructions: {
    verificationStatus: SetupInstructionVerification;
    sourceUrls: string[];
    options: Array<{
      type: SetupInstructionOptionType;
      label: string;
      activationMethod: SetupInstructionActivationMethod;
      activationCode: string | null;
      activationSteps: string[];
      deactivationCode: string | null;
      deactivationSteps: string[];
      notes: string[];
    }>;
    testingSteps: string[];
    troubleshooting: string[];
  };
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
  'Access to your provider account, phone, or admin portal',
  'Permission to change forwarding or call handling settings',
  'A second phone for test calls',
];

const BASE_TESTING_STEPS = [
  'Call your public business number from another phone.',
  'Trigger the forwarding condition you selected, such as no-answer, busy, or after-hours.',
  'Confirm RingBooker receives the call.',
  'Check the call summary or transcript.',
  'Turn forwarding off and test again if needed.',
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
  'The provider plan does not include the forwarding type you need',
  'The forwarding code or setting differs by plan, region, or device',
];

function record(input: {
  id: string;
  name: string;
  aliases?: string[];
  countryCode: ProviderCountryCode | null;
  marketGroup: ProviderMarketGroup;
  category: ProviderCategory;
  providerTypeLabel: ProviderTypeLabel;
  sourceUrls: string[];
  verificationStatus: VerificationStatus;
  bestFor: string;
}): ProviderRecord {
  const verificationDisclaimer =
    'Carrier features, forwarding codes, and admin settings may vary by plan, region, device, and account type. Always test call forwarding with a second phone before sending real client calls to RingBooker.';
  const countryMap: Record<ProviderCountryCode, ProviderCountry> = {
    US: 'United States',
    CA: 'Canada',
    AU: 'Australia',
    UK: 'United Kingdom',
    NZ: 'New Zealand',
    IE: 'Ireland',
  };
  const sourcePriority: SourcePriority =
    input.verificationStatus === 'verified_official' ? 'official_docs' : input.verificationStatus === 'partial' ? 'manual_research' : 'skipcalls_discovery';

  return {
    id: input.id,
    name: input.name,
    aliases: input.aliases ?? [],
    country: input.countryCode ? countryMap[input.countryCode] : 'Multi-country',
    countryCode: input.countryCode,
    marketGroup: input.marketGroup,
    category: input.category,
    providerTypeLabel: input.providerTypeLabel,
    sourcePriority,
    sourceUrls: input.sourceUrls,
    verificationStatus: input.verificationStatus,
    bestFor: input.bestFor,
    ringbookerRecommendation:
      'Most salons and spas should start with no-answer, busy-line, overflow, or after-hours forwarding. This lets your team answer normal calls while RingBooker covers calls that would otherwise be missed. Use all-call forwarding only if you want RingBooker to answer every incoming call.',
    setupOptions: {
      allCalls: true,
      noAnswer: true,
      busy: true,
      unreachable: 'unknown',
      afterHours: true,
    },
    setupGuidance: {
      missedNoAnswer: {
        whenToUse: BASE_SETUP_OPTIONS[0].whenToUse,
        steps: BASE_SETUP_OPTIONS[0].steps,
        sourceUrls: input.sourceUrls,
        verificationStatus: input.verificationStatus,
      },
      busy: {
        whenToUse: BASE_SETUP_OPTIONS[1].whenToUse,
        steps: BASE_SETUP_OPTIONS[1].steps,
        sourceUrls: input.sourceUrls,
        verificationStatus: input.verificationStatus,
      },
      afterHours: {
        whenToUse: BASE_SETUP_OPTIONS[2].whenToUse,
        steps: BASE_SETUP_OPTIONS[2].steps,
        sourceUrls: input.sourceUrls,
        verificationStatus: input.verificationStatus,
      },
      allCalls: {
        whenToUse: BASE_SETUP_OPTIONS[3].whenToUse,
        steps: BASE_SETUP_OPTIONS[3].steps,
        sourceUrls: input.sourceUrls,
        verificationStatus: input.verificationStatus,
      },
    },
    beforeYouStart: BASE_BEFORE_YOU_START,
    testingSteps: BASE_TESTING_STEPS,
    turnOffSteps: BASE_TURNOFF_STEPS,
    troubleshooting: BASE_TROUBLESHOOTING,
    disclaimer: verificationDisclaimer,
    logo: {
      src: null,
      alt: `${input.name} logo`,
      sourceUrl: null,
      sourceType: 'text_fallback',
      usageStatus: 'not_found',
    },
    setupInstructions: buildSetupInstructions(input.id, input.sourceUrls),
  };
}

function genericSetupInstructions(sourceUrls: string[]) {
  return {
    verificationStatus: 'needs_official_verification' as const,
    sourceUrls,
    options: [
      {
        type: 'no_answer' as const,
        label: 'Forward missed / no-answer calls',
        activationMethod: 'unknown' as const,
        activationCode: null,
        activationSteps: ['Open your provider call forwarding settings.', 'Choose no-answer forwarding.', 'Set your RingBooker forwarding number and save.'],
        deactivationCode: null,
        deactivationSteps: ['Disable no-answer forwarding in the same settings screen.'],
        notes: ['Exact menus and codes vary by plan, region, and device.'],
      },
      {
        type: 'busy' as const,
        label: 'Forward busy calls',
        activationMethod: 'unknown' as const,
        activationCode: null,
        activationSteps: ['Open conditional forwarding or busy-line settings.', 'Route busy calls to your RingBooker forwarding number.'],
        deactivationCode: null,
        deactivationSteps: ['Turn off busy forwarding in your provider settings.'],
        notes: ['Sometimes labeled as call waiting forward or overflow forwarding.'],
      },
      {
        type: 'after_hours' as const,
        label: 'Forward after-hours calls',
        activationMethod: 'unknown' as const,
        activationCode: null,
        activationSteps: ['Open schedule or business-hours routing.', 'Set after-hours destination to your RingBooker forwarding number.'],
        deactivationCode: null,
        deactivationSteps: ['Remove or disable after-hours route rule.'],
        notes: ['Available mostly in business phone or VoIP dashboards.'],
      },
    ],
    testingSteps: BASE_TESTING_STEPS,
    troubleshooting: BASE_TROUBLESHOOTING,
  };
}

function buildSetupInstructions(id: string, sourceUrls: string[]) {
  const skipSource = ['https://skipcalls.com/call-forwarding', ...sourceUrls.filter((u) => u.includes('skipcalls.com'))];
  type ProviderSetupInstructions = ProviderRecord['setupInstructions'];
  const byId: Record<string, ProviderSetupInstructions> = {
    verizon: {
      verificationStatus: 'official_verified',
      sourceUrls: ['https://skipcalls.com/call-forwarding/verizon', 'https://www.verizon.com/support/call-forwarding/', ...skipSource],
      options: [
        { type: 'all_calls', label: 'Forward all calls', activationMethod: 'dial_code', activationCode: '*72 + destination number', activationSteps: ['Dial `*72` followed by your RingBooker forwarding number, then press Call.', 'Wait for confirmation tone or message.'], deactivationCode: '*73', deactivationSteps: ['Dial `*73` to turn off forwarding.'], notes: [] },
        { type: 'no_answer', label: 'Forward no-answer calls', activationMethod: 'dial_code', activationCode: '*71 + destination number', activationSteps: ['Dial `*71` followed by your RingBooker forwarding number.', 'Press Call and wait for confirmation.'], deactivationCode: '*73', deactivationSteps: ['Dial `*73` to clear no-answer forwarding.'], notes: [] },
      ],
      testingSteps: BASE_TESTING_STEPS,
      troubleshooting: ['If dial codes fail, check My Verizon app call forwarding settings.', ...BASE_TROUBLESHOOTING],
    },
    att: {
      verificationStatus: 'official_verified',
      sourceUrls: ['https://skipcalls.com/call-forwarding/att', 'https://www.att.com/support/article/wireless/KM1011513/', ...skipSource],
      options: [
        { type: 'all_calls', label: 'Forward all calls', activationMethod: 'dial_code', activationCode: '*21*[destination]#', activationSteps: ['Dial `*21*<RingBooker number>#` and press Call.'], deactivationCode: '##21#', deactivationSteps: ['Dial `##21#` to disable all-call forwarding.'], notes: [] },
        { type: 'busy', label: 'Forward busy calls', activationMethod: 'dial_code', activationCode: '**67*[destination]#', activationSteps: ['Dial `**67*<RingBooker number>#`.'], deactivationCode: '##67#', deactivationSteps: ['Dial `##67#`.'], notes: [] },
        { type: 'no_answer', label: 'Forward no-answer calls', activationMethod: 'dial_code', activationCode: '**61*[destination]#', activationSteps: ['Dial `**61*<RingBooker number>#`.'], deactivationCode: '##61#', deactivationSteps: ['Dial `##61#`.'], notes: [] },
        { type: 'unreachable', label: 'Forward unreachable calls', activationMethod: 'dial_code', activationCode: '**62*[destination]#', activationSteps: ['Dial `**62*<RingBooker number>#`.'], deactivationCode: '##62#', deactivationSteps: ['Dial `##62#`.'], notes: [] },
      ],
      testingSteps: BASE_TESTING_STEPS,
      troubleshooting: ['If codes do not apply, call AT&T support and request manual forwarding enablement.', ...BASE_TROUBLESHOOTING],
    },
    't-mobile': {
      verificationStatus: 'skipcalls_sourced',
      sourceUrls: ['https://skipcalls.com/call-forwarding/tmobile', ...skipSource],
      options: [
        { type: 'all_calls', label: 'Forward all calls', activationMethod: 'dial_code', activationCode: '**21*[destination]#', activationSteps: ['Dial `**21*<RingBooker number>#`.'], deactivationCode: '##21#', deactivationSteps: ['Dial `##21#`.'], notes: [] },
        { type: 'busy', label: 'Forward busy calls', activationMethod: 'dial_code', activationCode: '**67*[destination]#', activationSteps: ['Dial `**67*<RingBooker number>#`.'], deactivationCode: '##67#', deactivationSteps: ['Dial `##67#`.'], notes: [] },
        { type: 'no_answer', label: 'Forward no-answer calls', activationMethod: 'dial_code', activationCode: '**61*[destination]#', activationSteps: ['Dial `**61*<RingBooker number>#`.'], deactivationCode: '##61#', deactivationSteps: ['Dial `##61#`.'], notes: [] },
        { type: 'unreachable', label: 'Forward unreachable calls', activationMethod: 'dial_code', activationCode: '**62*[destination]#', activationSteps: ['Dial `**62*<RingBooker number>#`.'], deactivationCode: '##62#', deactivationSteps: ['Dial `##62#`.'], notes: ['Some accounts may require support activation for conditional forwarding.'] },
      ],
      testingSteps: BASE_TESTING_STEPS,
      troubleshooting: ['If blocked, call T-Mobile support to enable conditional forwarding to external number.', ...BASE_TROUBLESHOOTING],
    },
    'google-voice-us': {
      verificationStatus: 'official_verified',
      sourceUrls: ['https://skipcalls.com/call-forwarding/google-voice', 'https://support.google.com/voice/answer/165656', 'https://support.google.com/voice/answer/11420769?hl=en', ...skipSource],
      options: [
        { type: 'dashboard_rule', label: 'Link and verify forwarding number', activationMethod: 'app_setting', activationCode: null, activationSteps: ['Open Google Voice on mobile.', 'Go to Settings > Linked numbers > Add linked number.', 'Use phone-call verification (not SMS).', 'Verify your RingBooker forwarding number and enable forwarding toggle.'], deactivationCode: null, deactivationSteps: ['Turn off forwarding toggle or remove linked RingBooker number.'], notes: ['Use mobile app for smoother verification flow.'] },
      ],
      testingSteps: BASE_TESTING_STEPS,
      troubleshooting: ['Check Do Not Disturb and custom rules if forwarding does not trigger.', ...BASE_TROUBLESHOOTING],
    },
    'ringcentral-us': {
      verificationStatus: 'needs_official_verification',
      sourceUrls: ['https://skipcalls.com/call-forwarding/ringcentral', 'https://support.ringcentral.com/', ...skipSource],
      options: [
        { type: 'dashboard_rule', label: 'Configure call handling in RingCentral', activationMethod: 'admin_portal', activationCode: null, activationSteps: ['Sign in to RingCentral.', 'Open Phone / Call handling for your user or extension.', 'Add external forwarding number (RingBooker).', 'Enable forward-all or schedule-based rules and save.'], deactivationCode: null, deactivationSteps: ['Disable forwarding rule or remove external forwarding number.'], notes: ['Place forwarding rule before voicemail if you want RingBooker to answer first.'] },
      ],
      testingSteps: BASE_TESTING_STEPS,
      troubleshooting: ['Confirm you edited the active extension or schedule.', ...BASE_TROUBLESHOOTING],
    },
    'openphone-us': {
      verificationStatus: 'needs_official_verification',
      sourceUrls: ['https://skipcalls.com/call-forwarding/openphone', 'https://support.openphone.com/core-concepts/administration/call-flows/call-forwarding', ...skipSource],
      options: [
        { type: 'dashboard_rule', label: 'Configure call flow in OpenPhone / Quo', activationMethod: 'web_dashboard', activationCode: null, activationSteps: ['Sign in to OpenPhone.', 'Open your number Call flow builder.', 'Either enable Forward all calls to RingBooker, or add Forward call step after business-hours/ring-users rule.', 'Save and publish flow.'], deactivationCode: null, deactivationSteps: ['Disable Forward call step or revert to previous flow.'], notes: ['Applies per-number; if multiple numbers exist, configure each one.'] },
      ],
      testingSteps: BASE_TESTING_STEPS,
      troubleshooting: ['Check for conflicting simultaneous ringing or routing steps.', ...BASE_TROUBLESHOOTING],
    },
    'nextiva-us': {
      verificationStatus: 'needs_official_verification',
      sourceUrls: ['https://skipcalls.com/call-forwarding/nextiva', 'https://www.nextiva.com/support/', ...skipSource],
      options: [
        { type: 'no_answer', label: 'Forward no-answer calls', activationMethod: 'dial_code', activationCode: '*92 + destination number', activationSteps: ['Dial `*92` followed by RingBooker number.'], deactivationCode: '*92', deactivationSteps: ['Dial `*92` to clear no-answer forwarding.'], notes: [] },
        { type: 'busy', label: 'Forward busy calls', activationMethod: 'dial_code', activationCode: '*90 + destination number', activationSteps: ['Dial `*90` followed by RingBooker number.'], deactivationCode: '*90', deactivationSteps: ['Dial `*90` again to disable busy forwarding.'], notes: [] },
        { type: 'unreachable', label: 'Forward unreachable calls', activationMethod: 'dial_code', activationCode: '*94 + destination number', activationSteps: ['Dial `*94` followed by RingBooker number.'], deactivationCode: '*94', deactivationSteps: ['Dial `*94` again to disable unreachable forwarding.'], notes: [] },
      ],
      testingSteps: BASE_TESTING_STEPS,
      troubleshooting: BASE_TROUBLESHOOTING,
    },
    'vonage-us': {
      verificationStatus: 'needs_official_verification',
      sourceUrls: ['https://skipcalls.com/call-forwarding/vonage', 'https://support.vonage.com/', ...skipSource],
      options: [
        { type: 'dashboard_rule', label: 'Forward calls in Vonage admin', activationMethod: 'web_dashboard', activationCode: null, activationSteps: ['Sign in to Vonage admin.', 'Open call forwarding settings and set RingBooker number.', 'Set ring delay if desired (5-7 seconds often used).', 'If needed, update hunt/call sequence so forwarding path is active.'], deactivationCode: null, deactivationSteps: ['Disable call forwarding in Vonage settings or restore prior sequence.'], notes: [] },
      ],
      testingSteps: BASE_TESTING_STEPS,
      troubleshooting: BASE_TROUBLESHOOTING,
    },
    'ooma-us': {
      verificationStatus: 'needs_official_verification',
      sourceUrls: ['https://skipcalls.com/call-forwarding/ooma', 'https://support.ooma.com/office/', ...skipSource],
      options: [
        { type: 'all_calls', label: 'Forward all calls', activationMethod: 'dial_code', activationCode: '*72 + destination number#', activationSteps: ['Dial `*72` then RingBooker number and `#`.'], deactivationCode: '*74', deactivationSteps: ['Dial `*74` to disable all-call forwarding.'], notes: [] },
      ],
      testingSteps: BASE_TESTING_STEPS,
      troubleshooting: BASE_TROUBLESHOOTING,
    },
    'comcast-business': {
      verificationStatus: 'official_verified',
      sourceUrls: ['https://skipcalls.com/call-forwarding/comcast-business', 'https://business.comcast.com/help-and-support/voice/call-forwarding', ...skipSource],
      options: [
        { type: 'all_calls', label: 'Forward all calls', activationMethod: 'dial_code', activationCode: '*72', activationSteps: ['Dial `*72` and follow prompt to enter your RingBooker number.'], deactivationCode: '*73', deactivationSteps: ['Dial `*73`.'], notes: [] },
        { type: 'busy', label: 'Forward busy calls', activationMethod: 'dial_code', activationCode: '*90', activationSteps: ['Dial `*90` and add forwarding destination when prompted.'], deactivationCode: '*91', deactivationSteps: ['Dial `*91`.'], notes: [] },
        { type: 'no_answer', label: 'Forward no-answer calls', activationMethod: 'dial_code', activationCode: '*92', activationSteps: ['Dial `*92` and enter forwarding destination.'], deactivationCode: '*93', deactivationSteps: ['Dial `*93`.'], notes: [] },
        { type: 'unreachable', label: 'Forward unreachable calls', activationMethod: 'dial_code', activationCode: '*59', activationSteps: ['Dial `*59` and follow prompts for unreachable forwarding.'], deactivationCode: '*59', deactivationSteps: ['Dial `*59` again to disable unreachable forwarding.'], notes: [] },
      ],
      testingSteps: BASE_TESTING_STEPS,
      troubleshooting: BASE_TROUBLESHOOTING,
    },
    rogers: {
      verificationStatus: 'skipcalls_sourced',
      sourceUrls: ['https://skipcalls.com/call-forwarding/rogers', ...skipSource],
      options: [
        { type: 'all_calls', label: 'Forward all calls', activationMethod: 'dial_code', activationCode: '*21*[destination]#', activationSteps: ['Dial `*21*<RingBooker number>#`.'], deactivationCode: '##21#', deactivationSteps: ['Dial `##21#`.'], notes: [] },
        { type: 'busy', label: 'Forward busy calls', activationMethod: 'dial_code', activationCode: '*67*[destination]#', activationSteps: ['Dial `*67*<RingBooker number>#`.'], deactivationCode: '##67#', deactivationSteps: ['Dial `##67#`.'], notes: [] },
        { type: 'no_answer', label: 'Forward no-answer calls', activationMethod: 'dial_code', activationCode: '*61*[destination]#', activationSteps: ['Dial `*61*<RingBooker number>#`.'], deactivationCode: '##61#', deactivationSteps: ['Dial `##61#`.'], notes: [] },
        { type: 'unreachable', label: 'Forward unreachable calls', activationMethod: 'dial_code', activationCode: '*62*[destination]#', activationSteps: ['Dial `*62*<RingBooker number>#`.'], deactivationCode: '##62#', deactivationSteps: ['Dial `##62#`.'], notes: [] },
      ],
      testingSteps: BASE_TESTING_STEPS,
      troubleshooting: BASE_TROUBLESHOOTING,
    },
    bell: {
      verificationStatus: 'skipcalls_sourced',
      sourceUrls: ['https://skipcalls.com/call-forwarding/bell', ...skipSource],
      options: [
        { type: 'all_calls', label: 'Forward all calls', activationMethod: 'dial_code', activationCode: '*72 + destination number', activationSteps: ['Dial `*72` followed by RingBooker number.'], deactivationCode: '*73', deactivationSteps: ['Dial `*73`.'], notes: [] },
        { type: 'busy', label: 'Forward busy calls', activationMethod: 'dial_code', activationCode: '*90 + destination number', activationSteps: ['Dial `*90` followed by RingBooker number.'], deactivationCode: '*91', deactivationSteps: ['Dial `*91`.'], notes: [] },
        { type: 'no_answer', label: 'Forward no-answer calls', activationMethod: 'dial_code', activationCode: '*92 + destination number', activationSteps: ['Dial `*92` followed by RingBooker number.'], deactivationCode: '*93', deactivationSteps: ['Dial `*93`.'], notes: [] },
        { type: 'unreachable', label: 'Forward unreachable calls', activationMethod: 'dial_code', activationCode: '*94 + destination number', activationSteps: ['Dial `*94` followed by RingBooker number.'], deactivationCode: '*95', deactivationSteps: ['Dial `*95`.'], notes: ['Disable Bell voicemail first if it intercepts calls before forwarding.'] },
      ],
      testingSteps: BASE_TESTING_STEPS,
      troubleshooting: ['Business lines may need Bell support to enable forwarding feature.', ...BASE_TROUBLESHOOTING],
    },
    telus: {
      verificationStatus: 'skipcalls_sourced',
      sourceUrls: ['https://skipcalls.com/call-forwarding/telus', ...skipSource],
      options: [
        { type: 'all_calls', label: 'Forward all calls', activationMethod: 'dial_code', activationCode: '*21*[destination]#', activationSteps: ['Dial `*21*<RingBooker number>#`.'], deactivationCode: '#21#', deactivationSteps: ['Dial `#21#`.'], notes: [] },
        { type: 'busy', label: 'Forward busy calls', activationMethod: 'dial_code', activationCode: '*67*[destination]#', activationSteps: ['Dial `*67*<RingBooker number>#`.'], deactivationCode: '#67#', deactivationSteps: ['Dial `#67#`.'], notes: [] },
        { type: 'no_answer', label: 'Forward no-answer calls', activationMethod: 'dial_code', activationCode: '*61*[destination]#', activationSteps: ['Dial `*61*<RingBooker number>#`.'], deactivationCode: '#61#', deactivationSteps: ['Dial `#61#`.'], notes: [] },
        { type: 'unreachable', label: 'Forward unreachable calls', activationMethod: 'dial_code', activationCode: '*62*[destination]#', activationSteps: ['Dial `*62*<RingBooker number>#`.'], deactivationCode: '#62#', deactivationSteps: ['Dial `#62#`.'], notes: ['SkipCalls mentions `*004*<destination>*20#` for declined/unanswered scenarios.'] },
      ],
      testingSteps: BASE_TESTING_STEPS,
      troubleshooting: BASE_TROUBLESHOOTING,
    },
    fido: {
      verificationStatus: 'skipcalls_sourced',
      sourceUrls: ['https://skipcalls.com/call-forwarding/fido', ...skipSource],
      options: [
        { type: 'all_calls', label: 'Forward all calls', activationMethod: 'dial_code', activationCode: '*21*[destination]#', activationSteps: ['Dial `*21*<RingBooker number>#`.'], deactivationCode: '##21#', deactivationSteps: ['Dial `##21#`.'], notes: [] },
        { type: 'busy', label: 'Forward busy calls', activationMethod: 'dial_code', activationCode: '*67*[destination]#', activationSteps: ['Dial `*67*<RingBooker number>#`.'], deactivationCode: '##67#', deactivationSteps: ['Dial `##67#`.'], notes: [] },
        { type: 'no_answer', label: 'Forward no-answer calls', activationMethod: 'dial_code', activationCode: '*61*[destination]#', activationSteps: ['Dial `*61*<RingBooker number>#`.'], deactivationCode: '##61#', deactivationSteps: ['Dial `##61#`.'], notes: [] },
        { type: 'unreachable', label: 'Forward unreachable calls', activationMethod: 'dial_code', activationCode: '*62*[destination]#', activationSteps: ['Dial `*62*<RingBooker number>#`.'], deactivationCode: '##62#', deactivationSteps: ['Dial `##62#`.'], notes: [] },
      ],
      testingSteps: BASE_TESTING_STEPS,
      troubleshooting: BASE_TROUBLESHOOTING,
    },
    'virgin-plus': {
      verificationStatus: 'skipcalls_sourced',
      sourceUrls: ['https://skipcalls.com/call-forwarding/virgin-plus', ...skipSource],
      options: [
        { type: 'all_calls', label: 'Forward all calls', activationMethod: 'dial_code', activationCode: '*72 + destination number', activationSteps: ['Dial `*72` followed by RingBooker number.'], deactivationCode: '*73', deactivationSteps: ['Dial `*73`.'], notes: [] },
        { type: 'busy', label: 'Forward busy calls', activationMethod: 'dial_code', activationCode: '*90 + destination number', activationSteps: ['Dial `*90` followed by RingBooker number.'], deactivationCode: '*91', deactivationSteps: ['Dial `*91`.'], notes: [] },
        { type: 'no_answer', label: 'Forward no-answer calls', activationMethod: 'dial_code', activationCode: '*92 + destination number', activationSteps: ['Dial `*92` followed by RingBooker number.'], deactivationCode: '*93', deactivationSteps: ['Dial `*93`.'], notes: [] },
        { type: 'unreachable', label: 'Forward unreachable calls', activationMethod: 'dial_code', activationCode: '*94 + destination number', activationSteps: ['Dial `*94` followed by RingBooker number.'], deactivationCode: '*95', deactivationSteps: ['Dial `*95`.'], notes: [] },
      ],
      testingSteps: BASE_TESTING_STEPS,
      troubleshooting: BASE_TROUBLESHOOTING,
    },
    'freedom-mobile': {
      verificationStatus: 'skipcalls_sourced',
      sourceUrls: ['https://skipcalls.com/call-forwarding/freedom', ...skipSource],
      options: [
        { type: 'all_calls', label: 'Forward all calls', activationMethod: 'dial_code', activationCode: '*21*[destination]#', activationSteps: ['Dial `*21*<RingBooker number>#`.'], deactivationCode: '#21#', deactivationSteps: ['Dial `#21#`.'], notes: [] },
        { type: 'busy', label: 'Forward busy calls', activationMethod: 'dial_code', activationCode: '*67*[destination]#', activationSteps: ['Dial `*67*<RingBooker number>#`.'], deactivationCode: '#67#', deactivationSteps: ['Dial `#67#`.'], notes: [] },
        { type: 'no_answer', label: 'Forward no-answer calls', activationMethod: 'dial_code', activationCode: '*61*[destination]#', activationSteps: ['Dial `*61*<RingBooker number>#`.'], deactivationCode: '#61#', deactivationSteps: ['Dial `#61#`.'], notes: [] },
        { type: 'unreachable', label: 'Forward unreachable calls', activationMethod: 'dial_code', activationCode: '*62*[destination]#', activationSteps: ['Dial `*62*<RingBooker number>#`.'], deactivationCode: '#62#', deactivationSteps: ['Dial `#62#`.'], notes: [] },
      ],
      testingSteps: BASE_TESTING_STEPS,
      troubleshooting: BASE_TROUBLESHOOTING,
    },
    dialpad: {
      verificationStatus: 'skipcalls_sourced',
      sourceUrls: ['https://skipcalls.com/call-forwarding/dialpad', ...skipSource],
      options: [
        { type: 'dashboard_rule', label: 'Set forwarding number in Dialpad', activationMethod: 'web_dashboard', activationCode: null, activationSteps: ['Sign in at Dialpad.', 'Open Your settings > Your devices > Forwarding number.', 'Enter RingBooker forwarding number and save.'], deactivationCode: null, deactivationSteps: ['Remove forwarding number or disable forwarding toggle in Dialpad settings.'], notes: [] },
      ],
      testingSteps: BASE_TESTING_STEPS,
      troubleshooting: BASE_TROUBLESHOOTING,
    },
  };
  return byId[id] ?? genericSetupInstructions(sourceUrls);
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
    countryCode: 'US',
    marketGroup: 'default_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.verizon.com/support/call-forwarding/'],
    verificationStatus: 'verified_official',
    bestFor: 'Best for no-answer and busy forwarding on mobile business lines.',
  }),
  record({
    id: 'att',
    name: 'AT&T',
    aliases: ['at&t wireless'],
    countryCode: 'US',
    marketGroup: 'default_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.att.com/support/article/wireless/KM1011513/'],
    verificationStatus: 'verified_official',
    bestFor: 'Best for overflow routing from a primary mobile business number.',
  }),
  record({
    id: 't-mobile',
    name: 'T-Mobile',
    aliases: ['tmobile'],
    countryCode: 'US',
    marketGroup: 'default_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.t-mobile.com/support/plans-features/self-service-short-codes'],
    verificationStatus: 'partial',
    bestFor: 'Best for missed-call forwarding in owner-operated teams.',
  }),
  record({
    id: 'google-voice-us',
    name: 'Google Voice',
    aliases: ['gvoice'],
    countryCode: 'US',
    marketGroup: 'default_country',
    category: 'virtual_number',
    providerTypeLabel: 'Virtual number',
    sourceUrls: ['https://support.google.com/voice/answer/165656'],
    verificationStatus: 'verified_official',
    bestFor: 'Best for cloud-managed no-answer forwarding workflows.',
  }),
  record({
    id: 'ringcentral-us',
    name: 'RingCentral',
    countryCode: 'US',
    marketGroup: 'default_country',
    category: 'business_phone',
    providerTypeLabel: 'Business phone',
    sourceUrls: ['https://support.ringcentral.com/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for queue overflow and after-hours call handling policies.',
  }),
  record({
    id: 'openphone-us',
    name: 'OpenPhone / Quo',
    aliases: ['open phone'],
    countryCode: 'US',
    marketGroup: 'default_country',
    category: 'voip',
    providerTypeLabel: 'VoIP',
    sourceUrls: ['https://support.openphone.com/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for shared inbox teams using one public number.',
  }),
  record({
    id: 'nextiva-us',
    name: 'Nextiva',
    countryCode: 'US',
    marketGroup: 'default_country',
    category: 'business_phone',
    providerTypeLabel: 'Business phone',
    sourceUrls: ['https://www.nextiva.com/support/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for extension-level routing and overflow handling.',
  }),
  record({
    id: 'vonage-us',
    name: 'Vonage',
    countryCode: 'US',
    marketGroup: 'default_country',
    category: 'voip',
    providerTypeLabel: 'VoIP',
    sourceUrls: ['https://support.vonage.com/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for conditional forwarding by user or extension.',
  }),
  record({
    id: 'ooma-us',
    name: 'Ooma Office',
    countryCode: 'US',
    marketGroup: 'default_country',
    category: 'business_phone',
    providerTypeLabel: 'Business phone',
    sourceUrls: ['https://support.ooma.com/office/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for practical missed-call backup on desk phones.',
  }),
  record({
    id: 'comcast-business',
    name: 'Comcast Business',
    aliases: ['comcast'],
    countryCode: 'US',
    marketGroup: 'default_country',
    category: 'business_phone',
    providerTypeLabel: 'Landline',
    sourceUrls: ['https://business.comcast.com/help-and-support/voice/call-forwarding'],
    verificationStatus: 'partial',
    bestFor: 'Best for fixed-line no-answer forwarding in office setups.',
  }),

  // Canada
  record({
    id: 'rogers',
    name: 'Rogers',
    countryCode: 'CA',
    marketGroup: 'default_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.rogers.com/support/mobility/call-forwarding'],
    verificationStatus: 'partial',
    bestFor: 'Best for missed-call conditional forwarding on wireless business plans.',
  }),
  record({
    id: 'bell',
    name: 'Bell',
    countryCode: 'CA',
    marketGroup: 'default_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://support.bell.ca/mobility/calling_features/how_to_use_call_forwarding_on_my_mobile_phone'],
    verificationStatus: 'partial',
    bestFor: 'Best for no-answer timeout routing on Bell mobility lines.',
  }),
  record({
    id: 'telus',
    name: 'TELUS',
    countryCode: 'CA',
    marketGroup: 'default_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.telus.com/en/support/article/call-forwarding'],
    verificationStatus: 'partial',
    bestFor: 'Best for busy-line overflow during in-service call spikes.',
  }),
  record({
    id: 'fido',
    name: 'Fido',
    countryCode: 'CA',
    marketGroup: 'default_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.fido.ca/support/mobility/call-forwarding'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for solo operators needing no-answer backup.',
  }),
  record({
    id: 'virgin-plus',
    name: 'Virgin Plus',
    countryCode: 'CA',
    marketGroup: 'default_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.virginplus.ca/en/support/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for practical overflow coverage on mobile business numbers.',
  }),
  record({
    id: 'freedom-mobile',
    name: 'Freedom Mobile',
    aliases: ['freedom'],
    countryCode: 'CA',
    marketGroup: 'default_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.freedommobile.ca/en-CA/support'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for budget-friendly missed-call forwarding.',
  }),

  // Australia
  record({
    id: 'telstra',
    name: 'Telstra',
    countryCode: 'AU',
    marketGroup: 'default_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.telstra.com.au/support/mobiles-devices/call-forwarding'],
    verificationStatus: 'partial',
    bestFor: 'Best for missed and busy forwarding on AU mobile lines.',
  }),
  record({
    id: 'optus',
    name: 'Optus',
    countryCode: 'AU',
    marketGroup: 'default_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.optus.com.au/support/mobiles-tablets-watches/calling-and-voicemail/call-forwarding'],
    verificationStatus: 'partial',
    bestFor: 'Best for overflow capture during treatment-hour peaks.',
  }),
  record({
    id: 'vodafone-australia',
    name: 'Vodafone Australia',
    aliases: ['vodafone au'],
    countryCode: 'AU',
    marketGroup: 'default_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.vodafone.com.au/support/device/call-forwarding'],
    verificationStatus: 'partial',
    bestFor: 'Best for scenario-based conditional forwarding.',
  }),
  record({
    id: 'aussie-broadband',
    name: 'Aussie Broadband',
    countryCode: 'AU',
    marketGroup: 'default_country',
    category: 'business_phone',
    providerTypeLabel: 'Business phone',
    sourceUrls: ['https://www.aussiebroadband.com.au/help-centre/phone/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for NBN voice no-answer routing.',
  }),
  record({
    id: 'tpg',
    name: 'TPG',
    countryCode: 'AU',
    marketGroup: 'default_country',
    category: 'business_phone',
    providerTypeLabel: 'Business phone',
    sourceUrls: ['https://support.tpg.com.au/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for after-hours routing in bundled voice accounts.',
  }),
  record({
    id: 'iinet',
    name: 'iiNet',
    countryCode: 'AU',
    marketGroup: 'default_country',
    category: 'business_phone',
    providerTypeLabel: 'Landline',
    sourceUrls: ['https://help.iinet.net.au/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for fixed-line missed-call fallback.',
  }),

  // Business phone & VoIP
  record({
    id: 'google-voice-voip',
    name: 'Google Voice',
    aliases: ['gvoice'],
    countryCode: null,
    marketGroup: 'business_voip',
    category: 'virtual_number',
    providerTypeLabel: 'Virtual number',
    sourceUrls: ['https://support.google.com/voice/answer/165656'],
    verificationStatus: 'verified_official',
    bestFor: 'Best for web/mobile no-answer forwarding flows.',
  }),
  record({
    id: 'ringcentral-voip',
    name: 'RingCentral',
    countryCode: null,
    marketGroup: 'business_voip',
    category: 'business_phone',
    providerTypeLabel: 'Business phone',
    sourceUrls: ['https://support.ringcentral.com/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for queue overflow and schedule-based routing.',
  }),
  record({
    id: 'openphone-quo',
    name: 'OpenPhone / Quo',
    aliases: ['openphone', 'quo'],
    countryCode: null,
    marketGroup: 'business_voip',
    category: 'voip',
    providerTypeLabel: 'VoIP',
    sourceUrls: ['https://support.openphone.com/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for shared inbox call workflows.',
  }),
  record({
    id: 'dialpad',
    name: 'Dialpad',
    countryCode: null,
    marketGroup: 'business_voip',
    category: 'voip',
    providerTypeLabel: 'VoIP',
    sourceUrls: ['https://help.dialpad.com/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for office-hours and routing policy control.',
  }),
  record({
    id: 'nextiva-voip',
    name: 'Nextiva',
    countryCode: null,
    marketGroup: 'business_voip',
    category: 'business_phone',
    providerTypeLabel: 'Business phone',
    sourceUrls: ['https://www.nextiva.com/support/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for extension-based call routing.',
  }),
  record({
    id: 'vonage-voip',
    name: 'Vonage',
    countryCode: null,
    marketGroup: 'business_voip',
    category: 'voip',
    providerTypeLabel: 'VoIP',
    sourceUrls: ['https://support.vonage.com/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for conditional forwarding by user or extension.',
  }),
  record({
    id: 'ooma-voip',
    name: 'Ooma Office',
    countryCode: null,
    marketGroup: 'business_voip',
    category: 'business_phone',
    providerTypeLabel: 'Business phone',
    sourceUrls: ['https://support.ooma.com/office/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for simple missed-call fallback routing.',
  }),
  record({
    id: 'zoom-phone',
    name: 'Zoom Phone',
    aliases: ['zoom'],
    countryCode: null,
    marketGroup: 'business_voip',
    category: 'voip',
    providerTypeLabel: 'VoIP',
    sourceUrls: ['https://support.zoom.com/hc/en/zoom-phone'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for queue + business-hours forwarding rules.',
  }),
  record({
    id: 'grasshopper',
    name: 'Grasshopper',
    countryCode: null,
    marketGroup: 'business_voip',
    category: 'virtual_number',
    providerTypeLabel: 'Virtual number',
    sourceUrls: ['https://grasshopper.com/support/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for solo operators with one public number.',
  }),
  record({
    id: 'goto-connect',
    name: 'GoTo Connect',
    aliases: ['goto'],
    countryCode: null,
    marketGroup: 'business_voip',
    category: 'voip',
    providerTypeLabel: 'VoIP',
    sourceUrls: ['https://support.goto.com/connect/help'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for dial-plan fallback routing.',
  }),

  // Other countries
  record({
    id: 'ee',
    name: 'EE',
    countryCode: 'UK',
    marketGroup: 'secondary_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://ee.co.uk/help/mobile/calling/call-divert'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for no-answer routing on UK mobile lines.',
  }),
  record({
    id: 'o2',
    name: 'O2',
    countryCode: 'UK',
    marketGroup: 'secondary_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.o2.co.uk/help/phones-sims-and-devices/call-divert'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for missed and busy forwarding on mobile business numbers.',
  }),
  record({
    id: 'vodafone-uk',
    name: 'Vodafone UK',
    countryCode: 'UK',
    marketGroup: 'secondary_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://support.vodafone.co.uk/Phones-devices/Calls-and-voicemail/1464043672/How-do-I-set-up-call-diverting.htm'],
    verificationStatus: 'partial',
    bestFor: 'Best for overflow and off-hours routing.',
  }),
  record({
    id: 'three-uk',
    name: 'Three UK',
    aliases: ['three'],
    countryCode: 'UK',
    marketGroup: 'secondary_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.three.co.uk/support/calls-and-voicemail/call-divert'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for missed-call fallback on one primary line.',
  }),
  record({
    id: 'bt',
    name: 'BT',
    countryCode: 'UK',
    marketGroup: 'secondary_country',
    category: 'business_phone',
    providerTypeLabel: 'Landline',
    sourceUrls: ['https://business.bt.com/help/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for fixed-line no-answer routing.',
  }),
  record({
    id: 'virgin-media-uk',
    name: 'Virgin Media UK',
    aliases: ['virgin media uk'],
    countryCode: 'UK',
    marketGroup: 'secondary_country',
    category: 'business_phone',
    providerTypeLabel: 'Landline',
    sourceUrls: ['https://www.virginmediabusiness.co.uk/help-and-advice/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for after-hours landline call coverage.',
  }),
  record({
    id: 'talktalk',
    name: 'TalkTalk',
    countryCode: 'UK',
    marketGroup: 'secondary_country',
    category: 'business_phone',
    providerTypeLabel: 'Landline',
    sourceUrls: ['https://community.talktalk.co.uk/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for practical missed-call forwarding.',
  }),
  record({
    id: 'sky-mobile',
    name: 'Sky Mobile',
    aliases: ['sky'],
    countryCode: 'UK',
    marketGroup: 'secondary_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.sky.com/help/home/sky-mobile'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for mobile overflow backup.',
  }),
  record({
    id: 'spark',
    name: 'Spark',
    countryCode: 'NZ',
    marketGroup: 'secondary_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.spark.co.nz/help/mobile/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for no-answer and busy forwarding on NZ mobile lines.',
  }),
  record({
    id: 'one-nz',
    name: 'One NZ',
    aliases: ['vodafone nz'],
    countryCode: 'NZ',
    marketGroup: 'secondary_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://one.nz/help/mobile/calling/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for overflow capture during treatment windows.',
  }),
  record({
    id: '2degrees',
    name: '2degrees',
    aliases: ['two degrees'],
    countryCode: 'NZ',
    marketGroup: 'secondary_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.2degrees.nz/help/mobile-help/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for simple conditional forwarding.',
  }),
  record({
    id: 'eir',
    name: 'eir',
    countryCode: 'IE',
    marketGroup: 'secondary_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.eir.ie/helpandsupport/mobile/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for missed-call fallback on Irish mobile lines.',
  }),
  record({
    id: 'vodafone-ireland',
    name: 'Vodafone Ireland',
    aliases: ['vodafone ie'],
    countryCode: 'IE',
    marketGroup: 'secondary_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://n.vodafone.ie/support/mobile.html'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for peak-hour overflow routing.',
  }),
  record({
    id: 'three-ireland',
    name: 'Three Ireland',
    aliases: ['three ie'],
    countryCode: 'IE',
    marketGroup: 'secondary_country',
    category: 'mobile_carrier',
    providerTypeLabel: 'Mobile',
    sourceUrls: ['https://www.three.ie/support/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for no-answer conditional forwarding.',
  }),
  record({
    id: 'virgin-media-ireland',
    name: 'Virgin Media Ireland',
    aliases: ['virgin media ie'],
    countryCode: 'IE',
    marketGroup: 'secondary_country',
    category: 'business_phone',
    providerTypeLabel: 'Landline',
    sourceUrls: ['https://www.virginmedia.ie/customer-support/'],
    verificationStatus: 'needs_official_verification',
    bestFor: 'Best for fixed-line after-hours call capture.',
  }),
];

export const callForwardingProviders = CALL_FORWARDING_PROVIDERS;
