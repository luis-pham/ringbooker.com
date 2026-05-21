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
    /** US area code (NPA), e.g. "415". Passed as filter[npa] to Telnyx. */
    npa?: string;
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

  releaseNumber?(params: {
    phoneNumber: string;
    providerNumberId?: string;
    orderId?: string;
    reason: string;
  }): Promise<void>;
}
