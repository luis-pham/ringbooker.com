export interface CountryConfig {
  iso2: string;
  name: string;
  phonePrefix: string;
  phoneFormat: string;
  telnyx: {
    countryIso: string;
    numberType: 'local' | 'toll_free' | 'mobile';
  };
  sms: {
    senderType: 'toll_free' | 'local' | 'sender_id';
    senderId?: string;
    requiresVerification: boolean;
    a2pRegistration: boolean;
    quietHours: { start: number; end: number };
  };
  defaultTimezone: string;
  compliance: {
    requiresSmsConsent: boolean;
    consentType: 'express' | 'soft_optin';
    unsubscribeKeyword: string;
  };
  features: {
    callForwarding: boolean;
    smsNotifications: boolean;
    customerSms: boolean;
  };
}

export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  US: {
    iso2: 'US',
    name: 'United States',
    phonePrefix: '+1',
    phoneFormat: '+1 (555) 000-0000',
    telnyx: { countryIso: 'US', numberType: 'local' },
    sms: {
      senderType: 'toll_free',
      requiresVerification: true,
      a2pRegistration: true,
      quietHours: { start: 8, end: 21 },
    },
    defaultTimezone: 'America/Los_Angeles',
    compliance: {
      requiresSmsConsent: true,
      consentType: 'express',
      unsubscribeKeyword: 'STOP',
    },
    features: {
      callForwarding: true,
      smsNotifications: true,
      customerSms: true,
    },
  },
  CA: {
    iso2: 'CA',
    name: 'Canada',
    phonePrefix: '+1',
    phoneFormat: '+1 (555) 000-0000',
    telnyx: { countryIso: 'CA', numberType: 'local' },
    sms: {
      senderType: 'toll_free',
      requiresVerification: true,
      a2pRegistration: false,
      quietHours: { start: 8, end: 21 },
    },
    defaultTimezone: 'America/Toronto',
    compliance: {
      requiresSmsConsent: true,
      consentType: 'express',
      unsubscribeKeyword: 'STOP',
    },
    features: {
      callForwarding: true,
      smsNotifications: true,
      customerSms: false,
    },
  },
  AU: {
    iso2: 'AU',
    name: 'Australia',
    phonePrefix: '+61',
    phoneFormat: '+61 4XX XXX XXX',
    telnyx: { countryIso: 'AU', numberType: 'local' },
    sms: {
      senderType: 'sender_id',
      senderId: 'RingBooker',
      requiresVerification: true,
      a2pRegistration: false,
      quietHours: { start: 8, end: 20 },
    },
    defaultTimezone: 'Australia/Sydney',
    compliance: {
      requiresSmsConsent: true,
      consentType: 'express',
      unsubscribeKeyword: 'STOP',
    },
    features: {
      callForwarding: true,
      smsNotifications: true,
      customerSms: false,
    },
  },
  GB: {
    iso2: 'GB',
    name: 'United Kingdom',
    phonePrefix: '+44',
    phoneFormat: '+44 7XXX XXXXXX',
    telnyx: { countryIso: 'GB', numberType: 'local' },
    sms: {
      senderType: 'sender_id',
      senderId: 'RingBooker',
      requiresVerification: false,
      a2pRegistration: false,
      quietHours: { start: 8, end: 20 },
    },
    defaultTimezone: 'Europe/London',
    compliance: {
      requiresSmsConsent: true,
      consentType: 'express',
      unsubscribeKeyword: 'STOP',
    },
    features: {
      callForwarding: true,
      smsNotifications: true,
      customerSms: false,
    },
  },
};

export function getCountryConfig(iso2?: string | null): CountryConfig {
  return COUNTRY_CONFIGS[iso2?.toUpperCase() ?? ''] ?? COUNTRY_CONFIGS['US'];
}

export function getSupportedCountries(): CountryConfig[] {
  return Object.values(COUNTRY_CONFIGS);
}

export function isCountrySupported(iso2: string): boolean {
  return iso2.toUpperCase() in COUNTRY_CONFIGS;
}
