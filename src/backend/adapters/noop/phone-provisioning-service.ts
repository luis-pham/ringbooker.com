import type { PhoneProvisioningService } from '@/src/backend/services/phone-provisioning/types';

export class NoopPhoneProvisioningService implements PhoneProvisioningService {
  async searchAvailableNumbers(params: {
    countryCode: string;
    locality?: string;
    administrativeArea?: string;
    limit?: number;
  }) {
    void params;
    return [
      {
        phoneNumber: '+17145550124',
        locality: 'Garden Grove',
        administrativeArea: 'CA',
        countryCode: 'US',
      },
      {
        phoneNumber: '+17145550125',
        locality: 'Santa Ana',
        administrativeArea: 'CA',
        countryCode: 'US',
      },
      {
        phoneNumber: '+17145550126',
        locality: 'Anaheim',
        administrativeArea: 'CA',
        countryCode: 'US',
      },
    ];
  }

  async provisionNumber(params: { phoneNumber: string; requestId: string }) {
    void params.requestId;
    return {
      phoneNumber: params.phoneNumber,
      providerNumberId: `noop-${params.phoneNumber.replace(/\D/g, '')}`,
      orderId: `noop-order-${Date.now()}`,
    };
  }
}
