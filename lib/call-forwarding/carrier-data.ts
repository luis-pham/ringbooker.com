export type ForwardingType = 'no_answer' | 'all' | 'busy' | 'unreachable';

export type ForwardingCode = {
  type: ForwardingType;
  label: string;
  description: string;
  activationCode: string | null;
  suffix?: string;
  cancelCode: string | null;
};

export type Carrier = {
  id: string;
  name: string;
  logoPath: string | null;
  color: string;
  defaultType: ForwardingType;
  forwardingCodes: ForwardingCode[];
  getSteps: (type: ForwardingType, number: string) => string[];
};

export type CountryCarriers = {
  countryCode: string;
  countryName: string;
  flag: string;
  carriers: Carrier[];
};

const FORWARDING_COPY: Record<ForwardingType, { label: string; description: string }> = {
  all: {
    label: 'Forward all calls',
    description: "Every call goes to RingBooker - you won't receive calls directly",
  },
  no_answer: {
    label: 'Forward no-answer calls',
    description: "RingBooker answers when you don't pick up (recommended)",
  },
  busy: {
    label: 'Forward busy calls',
    description: "RingBooker answers when you're already on another call",
  },
  unreachable: {
    label: 'Forward unreachable calls',
    description: 'RingBooker answers when your phone is off or out of service',
  },
};

function code(type: ForwardingType, activationCode: string | null, cancelCode: string | null, suffix?: string): ForwardingCode {
  return {
    type,
    label: FORWARDING_COPY[type].label,
    description: FORWARDING_COPY[type].description,
    activationCode,
    suffix,
    cancelCode,
  };
}

function buildDialCodeValue(forwardingCode: ForwardingCode, number: string): string | null {
  if (!forwardingCode.activationCode) return null;
  return `${forwardingCode.activationCode}${number}${forwardingCode.suffix ?? ''}`;
}

function dialCodeSteps(type: ForwardingType, number: string, forwardingCodes: ForwardingCode[]): string[] {
  const forwardingCode = forwardingCodes.find((item) => item.type === type) ?? forwardingCodes[0];
  const dialCode = forwardingCode ? buildDialCodeValue(forwardingCode, number) : null;
  return [
    'Open your phone dialer',
    dialCode ? `Dial ${dialCode} and press call` : 'Open your provider call forwarding settings',
    "You'll hear a confirmation tone - forwarding is active",
  ];
}

function appSteps(steps: string[]) {
  return () => steps;
}

function carrier(input: {
  id: string;
  name: string;
  logoPath: string | null;
  color: string;
  defaultType: ForwardingType;
  forwardingCodes?: ForwardingCode[];
  steps?: string[];
}): Carrier {
  const forwardingCodes = input.forwardingCodes ?? [];
  return {
    id: input.id,
    name: input.name,
    logoPath: input.logoPath,
    color: input.color,
    defaultType: input.defaultType,
    forwardingCodes,
    getSteps: input.steps ? appSteps(input.steps) : (type, number) => dialCodeSteps(type, number, forwardingCodes),
  };
}

const attCodes = [
  code('all', '*21*', '##21#', '#'),
  code('no_answer', '**61*', '##61#', '#'),
  code('busy', '**67*', '##67#', '#'),
  code('unreachable', '**62*', '##62#', '#'),
];

const tMobileCodes = [
  code('all', '**21*', '##21#', '#'),
  code('no_answer', '**61*', '##61#', '#'),
  code('busy', '**67*', '##67#', '#'),
  code('unreachable', '**62*', '##62#', '#'),
];

const rogersCodes = [
  code('all', '*21*', '##21#', '#'),
  code('no_answer', '*61*', '##61#', '#'),
  code('busy', '*67*', '##67#', '#'),
  code('unreachable', '*62*', '##62#', '#'),
];

const bellCodes = [
  code('all', '*72', '*73'),
  code('no_answer', '*92', '*93'),
  code('busy', '*90', '*91'),
  code('unreachable', '*94', '*95'),
];

const telusCodes = [
  code('all', '*21*', '#21#', '#'),
  code('no_answer', '*61*', '#61#', '#'),
  code('busy', '*67*', '#67#', '#'),
  code('unreachable', '*62*', '#62#', '#'),
];

export const CARRIER_DATA: CountryCarriers[] = [
  {
    countryCode: 'US',
    countryName: 'United States',
    flag: 'US',
    carriers: [
      carrier({
        id: 'verizon',
        name: 'Verizon',
        logoPath: '/provider-logos/verizon.svg',
        color: '#cd040b',
        defaultType: 'no_answer',
        forwardingCodes: [
          code('all', '*72', '*73'),
          code('no_answer', '*71', '*73'),
        ],
      }),
      carrier({ id: 'att', name: 'AT&T', logoPath: '/provider-logos/att.svg', color: '#00a8e0', defaultType: 'no_answer', forwardingCodes: attCodes }),
      carrier({ id: 't-mobile', name: 'T-Mobile', logoPath: '/provider-logos/t-mobile.svg', color: '#e20074', defaultType: 'no_answer', forwardingCodes: tMobileCodes }),
      carrier({
        id: 'nextiva-us',
        name: 'Nextiva',
        logoPath: '/provider-logos/nextiva-us.ico',
        color: '#0057b8',
        defaultType: 'no_answer',
        forwardingCodes: [
          code('no_answer', '*92', '*92'),
          code('busy', '*90', '*90'),
          code('unreachable', '*94', '*94'),
        ],
      }),
      carrier({ id: 'ooma-us', name: 'Ooma Office', logoPath: '/provider-logos/ooma-us.ico', color: '#e05a1b', defaultType: 'all', forwardingCodes: [code('all', '*72', '*74', '#')] }),
      carrier({
        id: 'comcast-business',
        name: 'Comcast Business',
        logoPath: '/provider-logos/comcast-business.ico',
        color: '#d22626',
        defaultType: 'no_answer',
        forwardingCodes: [
          code('all', '*72', '*73'),
          code('no_answer', '*92', '*93'),
          code('busy', '*90', '*91'),
          code('unreachable', '*59', '*59'),
        ],
      }),
      carrier({
        id: 'google-voice-us',
        name: 'Google Voice',
        logoPath: '/provider-logos/google-voice.svg',
        color: '#4285f4',
        defaultType: 'all',
        steps: ['Open voice.google.com or the Google Voice app', 'Go to Settings > Calls > Call forwarding', 'Enter your RingBooker number as destination'],
      }),
      carrier({
        id: 'ringcentral-us',
        name: 'RingCentral',
        logoPath: '/provider-logos/ringcentral.svg',
        color: '#f89a1c',
        defaultType: 'all',
        steps: ['Log in to your RingCentral admin portal', 'Go to Phone System > Call Handling & Forwarding', 'Set forwarding destination to your RingBooker number'],
      }),
      carrier({
        id: 'openphone-us',
        name: 'OpenPhone / Quo',
        logoPath: '/provider-logos/openphone-us.ico',
        color: '#7c3aed',
        defaultType: 'all',
        steps: ['Open your OpenPhone app or web portal', 'Go to Settings > your number > Call Routing', 'Add your RingBooker number as forwarding destination'],
      }),
      carrier({
        id: 'vonage-us',
        name: 'Vonage',
        logoPath: '/provider-logos/vonage-us.ico',
        color: '#111827',
        defaultType: 'all',
        steps: ['Sign in to Vonage admin', 'Open call forwarding settings and set RingBooker number', 'Save the forwarding rule and place a test call'],
      }),
    ],
  },
  {
    countryCode: 'CA',
    countryName: 'Canada',
    flag: 'CA',
    carriers: [
      carrier({ id: 'rogers', name: 'Rogers', logoPath: '/provider-logos/rogers.ico', color: '#e21a2c', defaultType: 'no_answer', forwardingCodes: rogersCodes }),
      carrier({ id: 'bell', name: 'Bell', logoPath: '/provider-logos/bell.ico', color: '#0057b8', defaultType: 'no_answer', forwardingCodes: bellCodes }),
      carrier({ id: 'telus', name: 'TELUS', logoPath: '/provider-logos/telus.ico', color: '#4b286d', defaultType: 'no_answer', forwardingCodes: telusCodes }),
      carrier({ id: 'fido', name: 'Fido', logoPath: '/provider-logos/fido.ico', color: '#e21a2c', defaultType: 'no_answer', forwardingCodes: rogersCodes }),
      carrier({ id: 'virgin-plus', name: 'Virgin Plus', logoPath: '/provider-logos/virgin-plus.ico', color: '#e21a2c', defaultType: 'no_answer', forwardingCodes: bellCodes }),
      carrier({ id: 'freedom-mobile', name: 'Freedom Mobile', logoPath: '/provider-logos/freedom-mobile.ico', color: '#00a651', defaultType: 'no_answer', forwardingCodes: telusCodes }),
      carrier({
        id: 'dialpad',
        name: 'Dialpad',
        logoPath: '/provider-logos/dialpad.ico',
        color: '#7c3aed',
        defaultType: 'all',
        steps: ['Sign in at Dialpad', 'Open Your settings > Your devices > Forwarding number', 'Enter RingBooker forwarding number and save'],
      }),
    ],
  },
  {
    countryCode: 'AU',
    countryName: 'Australia',
    flag: 'AU',
    carriers: [
      carrier({ id: 'telstra', name: 'Telstra', logoPath: '/provider-logos/telstra.ico', color: '#0064d2', defaultType: 'no_answer', steps: ['Open Telstra call forwarding settings', 'Choose the forwarding condition you want', 'Enter your RingBooker number and test the setup'] }),
      carrier({ id: 'optus', name: 'Optus', logoPath: '/provider-logos/optus.ico', color: '#f6c400', defaultType: 'no_answer', steps: ['Open Optus call forwarding settings', 'Choose the forwarding condition you want', 'Enter your RingBooker number and test the setup'] }),
      carrier({ id: 'vodafone-australia', name: 'Vodafone Australia', logoPath: '/provider-logos/vodafone-australia.ico', color: '#e60000', defaultType: 'no_answer', steps: ['Open Vodafone call forwarding settings', 'Choose the forwarding condition you want', 'Enter your RingBooker number and test the setup'] }),
      carrier({ id: 'aussie-broadband', name: 'Aussie Broadband', logoPath: '/provider-logos/aussie-broadband.ico', color: '#111827', defaultType: 'no_answer', steps: ['Open your Aussie Broadband phone settings', 'Choose forwarding or diversion settings', 'Enter your RingBooker number and save'] }),
      carrier({ id: 'tpg', name: 'TPG', logoPath: '/provider-logos/tpg.ico', color: '#111827', defaultType: 'no_answer', steps: ['Open your TPG phone settings', 'Choose forwarding or diversion settings', 'Enter your RingBooker number and save'] }),
      carrier({ id: 'iinet', name: 'iiNet', logoPath: '/provider-logos/iinet.ico', color: '#111827', defaultType: 'no_answer', steps: ['Open your iiNet phone settings', 'Choose forwarding or diversion settings', 'Enter your RingBooker number and save'] }),
    ],
  },
  {
    countryCode: 'UK',
    countryName: 'United Kingdom',
    flag: 'UK',
    carriers: [
      carrier({ id: 'ee', name: 'EE', logoPath: '/provider-logos/ee.ico', color: '#009c9c', defaultType: 'no_answer', steps: ['Open EE call divert settings', 'Choose the forwarding condition you want', 'Enter your RingBooker number and test the setup'] }),
      carrier({ id: 'o2', name: 'O2', logoPath: '/provider-logos/o2.ico', color: '#0050aa', defaultType: 'no_answer', steps: ['Open O2 call divert settings', 'Choose the forwarding condition you want', 'Enter your RingBooker number and test the setup'] }),
      carrier({ id: 'vodafone-uk', name: 'Vodafone UK', logoPath: '/provider-logos/vodafone-uk.ico', color: '#e60000', defaultType: 'no_answer', steps: ['Open Vodafone call divert settings', 'Choose the forwarding condition you want', 'Enter your RingBooker number and test the setup'] }),
      carrier({ id: 'three-uk', name: 'Three UK', logoPath: '/provider-logos/three-uk.ico', color: '#111827', defaultType: 'no_answer', steps: ['Open Three call divert settings', 'Choose the forwarding condition you want', 'Enter your RingBooker number and test the setup'] }),
      carrier({ id: 'sky-mobile', name: 'Sky Mobile', logoPath: '/provider-logos/sky-mobile.ico', color: '#111827', defaultType: 'no_answer', steps: ['Open Sky Mobile call divert settings', 'Choose the forwarding condition you want', 'Enter your RingBooker number and test the setup'] }),
      carrier({ id: 'bt', name: 'BT', logoPath: '/provider-logos/bt.ico', color: '#5514b4', defaultType: 'all', steps: ['Log in to your BT business phone portal', 'Open call forwarding or divert settings', 'Set RingBooker as the forwarding destination'] }),
    ],
  },
  {
    countryCode: 'NZ',
    countryName: 'New Zealand',
    flag: 'NZ',
    carriers: [
      carrier({ id: 'spark', name: 'Spark', logoPath: '/provider-logos/spark.ico', color: '#ff5a00', defaultType: 'no_answer', steps: ['Open Spark call forwarding settings', 'Choose the forwarding condition you want', 'Enter your RingBooker number and test the setup'] }),
      carrier({ id: 'one-nz', name: 'One NZ', logoPath: '/provider-logos/one-nz.ico', color: '#e60000', defaultType: 'no_answer', steps: ['Open One NZ call forwarding settings', 'Choose the forwarding condition you want', 'Enter your RingBooker number and test the setup'] }),
      carrier({ id: '2degrees', name: '2degrees', logoPath: '/provider-logos/2degrees.ico', color: '#00a3e0', defaultType: 'no_answer', steps: ['Open 2degrees call forwarding settings', 'Choose the forwarding condition you want', 'Enter your RingBooker number and test the setup'] }),
    ],
  },
  {
    countryCode: 'IE',
    countryName: 'Ireland',
    flag: 'IE',
    carriers: [
      carrier({ id: 'eir', name: 'eir', logoPath: '/provider-logos/eir.ico', color: '#7c3aed', defaultType: 'no_answer', steps: ['Open eir call forwarding settings', 'Choose the forwarding condition you want', 'Enter your RingBooker number and test the setup'] }),
      carrier({ id: 'vodafone-ireland', name: 'Vodafone Ireland', logoPath: '/provider-logos/vodafone-ireland.ico', color: '#e60000', defaultType: 'no_answer', steps: ['Open Vodafone Ireland call forwarding settings', 'Choose the forwarding condition you want', 'Enter your RingBooker number and test the setup'] }),
      carrier({ id: 'three-ireland', name: 'Three Ireland', logoPath: '/provider-logos/three-ireland.ico', color: '#111827', defaultType: 'no_answer', steps: ['Open Three Ireland call forwarding settings', 'Choose the forwarding condition you want', 'Enter your RingBooker number and test the setup'] }),
      carrier({ id: 'virgin-media-ireland', name: 'Virgin Media Ireland', logoPath: '/provider-logos/virgin-media-ireland.ico', color: '#e21a2c', defaultType: 'all', steps: ['Log in to your Virgin Media account', 'Open call forwarding or divert settings', 'Set RingBooker as the forwarding destination'] }),
    ],
  },
];

export function getForwardingTypeCopy(type: ForwardingType) {
  return FORWARDING_COPY[type];
}

export function buildDialCode(codeItem: ForwardingCode, number: string): string | null {
  return buildDialCodeValue(codeItem, number);
}
