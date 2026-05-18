export type ForwardingType = 'no_answer' | 'all' | 'busy' | 'unreachable';

export type ForwardingCode = {
  type: ForwardingType;
  activationCode: string | null;
  suffix?: string;
  cancelCode: string | null;
};

export const FORWARDING_TYPE_META: Record<
  ForwardingType,
  { label: string; description: string; recommended?: boolean }
> = {
  no_answer: {
    label: 'Forward no-answer calls',
    description: "When you don't pick up within ~20 seconds",
    recommended: true,
  },
  all: {
    label: 'Forward all calls',
    description: 'Every call goes to RingBooker',
  },
  busy: {
    label: 'Forward busy calls',
    description: "When you're already on another call",
  },
  unreachable: {
    label: 'Forward unreachable calls',
    description: 'When your phone is off or out of service',
  },
};

export type Carrier = {
  id: string;
  name: string;
  logoPath: string | null;
  color: string;
  defaultType: ForwardingType;
  forwardingCodes: ForwardingCode[];
  appSteps?: string[];
};

export type CountryCarriers = {
  countryCode: string;
  countryName: string;
  flag: string;
  carriers: Carrier[];
};

export function buildDialCode(code: ForwardingCode, number: string): string | null {
  if (!code.activationCode) return null;
  return code.activationCode + number + (code.suffix || '');
}

const GSM: ForwardingCode[] = [
  { type: 'all', activationCode: '**21*', suffix: '#', cancelCode: '##21#' },
  { type: 'no_answer', activationCode: '**61*', suffix: '#', cancelCode: '##61#' },
  { type: 'busy', activationCode: '**67*', suffix: '#', cancelCode: '##67#' },
  { type: 'unreachable', activationCode: '**62*', suffix: '#', cancelCode: '##62#' },
];

const rogersCodes: ForwardingCode[] = [
  { type: 'all', activationCode: '*21*', suffix: '#', cancelCode: '##21#' },
  { type: 'no_answer', activationCode: '*61*', suffix: '#', cancelCode: '##61#' },
  { type: 'busy', activationCode: '*67*', suffix: '#', cancelCode: '##67#' },
  { type: 'unreachable', activationCode: '*62*', suffix: '#', cancelCode: '##62#' },
];

const bellCodes: ForwardingCode[] = [
  { type: 'all', activationCode: '*72', cancelCode: '*73' },
  { type: 'no_answer', activationCode: '*92', cancelCode: '*93' },
  { type: 'busy', activationCode: '*90', cancelCode: '*91' },
  { type: 'unreachable', activationCode: '*94', cancelCode: '*95' },
];

const telusCodes: ForwardingCode[] = [
  { type: 'all', activationCode: '*21*', suffix: '#', cancelCode: '#21#' },
  { type: 'no_answer', activationCode: '*61*', suffix: '#', cancelCode: '#61#' },
  { type: 'busy', activationCode: '*67*', suffix: '#', cancelCode: '#67#' },
  { type: 'unreachable', activationCode: '*62*', suffix: '#', cancelCode: '#62#' },
];

export const CARRIER_DATA: CountryCarriers[] = [
  {
    countryCode: 'us',
    countryName: 'United States',
    flag: '🇺🇸',
    carriers: [
      { id: 'verizon', name: 'Verizon', logoPath: '/provider-logos/verizon.svg', color: '#cd040b', defaultType: 'no_answer', forwardingCodes: [
        { type: 'all', activationCode: '*72', cancelCode: '*73' },
        { type: 'no_answer', activationCode: '*71', cancelCode: '*73' },
        { type: 'busy', activationCode: '*90', cancelCode: '*91' },
        { type: 'unreachable', activationCode: '*92', cancelCode: '*93' },
      ] },
      { id: 'att', name: 'AT&T', logoPath: '/provider-logos/att.svg', color: '#00a8e0', defaultType: 'no_answer', forwardingCodes: [
        { type: 'all', activationCode: '*21*', suffix: '#', cancelCode: '##21#' },
        { type: 'no_answer', activationCode: '**61*', suffix: '#', cancelCode: '##61#' },
        { type: 'busy', activationCode: '**67*', suffix: '#', cancelCode: '##67#' },
        { type: 'unreachable', activationCode: '**62*', suffix: '#', cancelCode: '##62#' },
      ] },
      { id: 'tmobile', name: 'T-Mobile', logoPath: '/provider-logos/t-mobile.svg', color: '#e20074', defaultType: 'no_answer', forwardingCodes: [
        { type: 'all', activationCode: '**21*', suffix: '#', cancelCode: '##21#' },
        { type: 'no_answer', activationCode: '**61*', suffix: '#', cancelCode: '##61#' },
        { type: 'busy', activationCode: '**67*', suffix: '#', cancelCode: '##67#' },
        { type: 'unreachable', activationCode: '**62*', suffix: '#', cancelCode: '##62#' },
      ] },
      { id: 'nextiva', name: 'Nextiva', logoPath: '/provider-logos/nextiva-us.ico', color: '#0057b8', defaultType: 'no_answer', forwardingCodes: [
        { type: 'no_answer', activationCode: '*92', cancelCode: '*93' },
        { type: 'busy', activationCode: '*90', cancelCode: '*91' },
        { type: 'unreachable', activationCode: '*94', cancelCode: '*95' },
      ] },
      { id: 'comcast', name: 'Comcast Business', logoPath: '/provider-logos/comcast-business.ico', color: '#d22626', defaultType: 'no_answer', forwardingCodes: [
        { type: 'all', activationCode: '*72', cancelCode: '*73' },
        { type: 'no_answer', activationCode: '*92', cancelCode: '*93' },
        { type: 'busy', activationCode: '*90', cancelCode: '*91' },
        { type: 'unreachable', activationCode: '*59', cancelCode: '*59' },
      ] },
      { id: 'ooma', name: 'Ooma', logoPath: '/provider-logos/ooma-us.ico', color: '#e05a1b', defaultType: 'all', forwardingCodes: [
        { type: 'all', activationCode: '*72', suffix: '#', cancelCode: '*74' },
      ] },
      { id: 'googlevoice', name: 'Google Voice', logoPath: '/provider-logos/google-voice-us.ico', color: '#4285f4', defaultType: 'all', forwardingCodes: [], appSteps: [
        'Open voice.google.com or the Google Voice app',
        'Go to Settings → Calls → Call forwarding',
        'Enter your RingBooker number as destination',
      ] },
      { id: 'ringcentral', name: 'RingCentral', logoPath: '/provider-logos/ringcentral-us.ico', color: '#f89a1c', defaultType: 'all', forwardingCodes: [], appSteps: [
        'Log in to your RingCentral admin portal',
        'Go to Phone System → Call Handling',
        'Set forwarding to your RingBooker number',
      ] },
      { id: 'openphone', name: 'OpenPhone', logoPath: '/provider-logos/openphone-us.ico', color: '#7c3aed', defaultType: 'all', forwardingCodes: [], appSteps: [
        'Open your OpenPhone app or web portal',
        'Go to Settings → your number → Call Routing',
        'Add your RingBooker number as forwarding destination',
      ] },
      { id: 'twilio', name: 'Twilio', logoPath: '/provider-logos/twilio-logo.png', color: '#f22f46', defaultType: 'all', forwardingCodes: [], appSteps: [
        'Open the Twilio Console and go to Phone Numbers → Manage → Active numbers',
        'Select the Twilio number customers call',
        'Under Voice & Fax, set “A call comes in” to a Studio Flow or webhook that forwards to your RingBooker number',
        'Publish or save the change, then call the Twilio number to confirm forwarding works',
      ] },
      { id: 'other', name: 'Other', logoPath: null, color: '#6b7280', defaultType: 'no_answer', forwardingCodes: [], appSteps: [
        'Contact your carrier to enable call forwarding',
        'Ask them to forward unanswered calls to your RingBooker number',
        'Confirm the setup is active before going live',
      ] },
    ],
  },
  {
    countryCode: 'ca',
    countryName: 'Canada',
    flag: '🇨🇦',
    carriers: [
      { id: 'rogers', name: 'Rogers', logoPath: '/provider-logos/rogers.ico', color: '#e21a2c', defaultType: 'no_answer', forwardingCodes: rogersCodes },
      { id: 'bell', name: 'Bell', logoPath: '/provider-logos/bell.ico', color: '#0057b8', defaultType: 'no_answer', forwardingCodes: bellCodes },
      { id: 'telus', name: 'TELUS', logoPath: '/provider-logos/telus.ico', color: '#4b286d', defaultType: 'no_answer', forwardingCodes: telusCodes },
      { id: 'fido', name: 'Fido', logoPath: '/provider-logos/fido.ico', color: '#e21a2c', defaultType: 'no_answer', forwardingCodes: rogersCodes },
      { id: 'virginplus', name: 'Virgin Plus', logoPath: '/provider-logos/virgin-plus.ico', color: '#e21a2c', defaultType: 'no_answer', forwardingCodes: bellCodes },
      { id: 'freedom', name: 'Freedom Mobile', logoPath: '/provider-logos/freedom-mobile.ico', color: '#00a651', defaultType: 'no_answer', forwardingCodes: telusCodes },
      { id: 'other', name: 'Other', logoPath: null, color: '#6b7280', defaultType: 'no_answer', forwardingCodes: [], appSteps: [
        'Contact your carrier to enable call forwarding',
        'Forward unanswered calls to your RingBooker number',
        'Confirm setup is active',
      ] },
    ],
  },
  { countryCode: 'gb', countryName: 'United Kingdom', flag: '🇬🇧', carriers: [
    { id: 'ee', name: 'EE', logoPath: '/provider-logos/ee.ico', color: '#00b288', defaultType: 'no_answer', forwardingCodes: GSM },
    { id: 'o2', name: 'O2', logoPath: '/provider-logos/o2.ico', color: '#0050a0', defaultType: 'no_answer', forwardingCodes: GSM },
    { id: 'vodafone', name: 'Vodafone', logoPath: '/provider-logos/vodafone-uk.ico', color: '#e60000', defaultType: 'no_answer', forwardingCodes: GSM },
    { id: 'three', name: 'Three', logoPath: '/provider-logos/three-uk.ico', color: '#0055a5', defaultType: 'no_answer', forwardingCodes: GSM },
    { id: 'skymobile', name: 'Sky Mobile', logoPath: '/provider-logos/sky-mobile.ico', color: '#0e2d6d', defaultType: 'no_answer', forwardingCodes: GSM },
    { id: 'other', name: 'Other', logoPath: null, color: '#6b7280', defaultType: 'no_answer', forwardingCodes: GSM },
  ] },
  { countryCode: 'au', countryName: 'Australia', flag: '🇦🇺', carriers: [
    { id: 'telstra', name: 'Telstra', logoPath: '/provider-logos/telstra.ico', color: '#1a75cf', defaultType: 'no_answer', forwardingCodes: GSM },
    { id: 'optus', name: 'Optus', logoPath: '/provider-logos/optus.ico', color: '#f7941d', defaultType: 'no_answer', forwardingCodes: GSM },
    { id: 'vodafone', name: 'Vodafone AU', logoPath: '/provider-logos/vodafone-australia.ico', color: '#e60000', defaultType: 'no_answer', forwardingCodes: GSM },
    { id: 'other', name: 'Other', logoPath: null, color: '#6b7280', defaultType: 'no_answer', forwardingCodes: GSM },
  ] },
  { countryCode: 'nz', countryName: 'New Zealand', flag: '🇳🇿', carriers: [
    { id: 'spark', name: 'Spark', logoPath: '/provider-logos/spark.ico', color: '#e31837', defaultType: 'no_answer', forwardingCodes: GSM },
    { id: 'onenz', name: 'One NZ', logoPath: '/provider-logos/one-nz.ico', color: '#003087', defaultType: 'no_answer', forwardingCodes: GSM },
    { id: 'twodegrees', name: '2degrees', logoPath: '/provider-logos/2degrees.ico', color: '#e4003b', defaultType: 'no_answer', forwardingCodes: GSM },
    { id: 'other', name: 'Other', logoPath: null, color: '#6b7280', defaultType: 'no_answer', forwardingCodes: GSM },
  ] },
  { countryCode: 'ie', countryName: 'Ireland', flag: '🇮🇪', carriers: [
    { id: 'eir', name: 'eir', logoPath: '/provider-logos/eir.ico', color: '#6dc8be', defaultType: 'no_answer', forwardingCodes: GSM },
    { id: 'vodafone', name: 'Vodafone', logoPath: '/provider-logos/vodafone-ireland.ico', color: '#e60000', defaultType: 'no_answer', forwardingCodes: GSM },
    { id: 'three', name: 'Three', logoPath: '/provider-logos/three-ireland.ico', color: '#0055a5', defaultType: 'no_answer', forwardingCodes: GSM },
    { id: 'other', name: 'Other', logoPath: null, color: '#6b7280', defaultType: 'no_answer', forwardingCodes: GSM },
  ] },
];

export function findCountry(countryCode: string | undefined): CountryCarriers {
  return CARRIER_DATA.find((country) => country.countryCode === countryCode) ?? CARRIER_DATA[0];
}

export function findCarrier(countryCode: string | undefined, carrierId: string | undefined): Carrier | null {
  const country = findCountry(countryCode);
  return country.carriers.find((carrier) => carrier.id === carrierId) ?? null;
}

export function getForwardingCode(carrier: Carrier | null, type: ForwardingType): ForwardingCode | null {
  return carrier?.forwardingCodes.find((code) => code.type === type) ?? null;
}
