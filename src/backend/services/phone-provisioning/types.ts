export type AvailablePhoneNumber = {
  phoneNumber: string;
  locality?: string;
  administrativeArea?: string;
  countryCode?: string;
  monthlyCost?: string;
};

export interface PhoneProvisioningService {
  searchAvailableNumbers(params: {
    countryCode: string;
    locality?: string;
    administrativeArea?: string;
    limit?: number;
  }): Promise<AvailablePhoneNumber[]>;

  provisionNumber(params: {
    phoneNumber: string;
    requestId: string;
  }): Promise<{
    phoneNumber: string;
    providerNumberId?: string;
    orderId?: string;
  }>;
}
