import type { Customer } from '@/src/backend/domain/types';
import type { CustomersRepository } from '@/src/backend/ports/repositories';

export class InMemoryCustomersRepository implements CustomersRepository {
  private readonly records = new Map<string, Customer>();
  private readonly platformOptOuts = new Set<string>();

  private key(shopId: string, phone: string): string {
    return `${shopId}::${phone}`;
  }

  async isSmsOptedOut(shopId: string, phone: string): Promise<boolean> {
    return this.records.get(this.key(shopId, phone))?.sms_opt_out === true || this.platformOptOuts.has(phone);
  }

  async setSmsOptOut(shopId: string, phone: string, optOut: boolean): Promise<void> {
    const k = this.key(shopId, phone);
    const existing = this.records.get(k);
    if (existing) {
      this.records.set(k, { ...existing, sms_opt_out: optOut });
    } else {
      this.records.set(k, { phone, shop_id: shopId, visit_count: 0, sms_opt_out: optOut, sms_consent: false });
    }
  }

  async setPlatformSmsOptOut(phone: string): Promise<void> {
    this.platformOptOuts.add(phone);
  }

  async isSmsConsented(shopId: string, phone: string): Promise<boolean> {
    return this.records.get(this.key(shopId, phone))?.sms_consent === true;
  }

  async setSmsConsent(shopId: string, phone: string): Promise<void> {
    const k = this.key(shopId, phone);
    const existing = this.records.get(k);
    const now = new Date().toISOString();
    if (existing) {
      this.records.set(k, { ...existing, sms_consent: true, sms_consent_at: now });
    } else {
      this.records.set(k, { phone, shop_id: shopId, visit_count: 0, sms_opt_out: false, sms_consent: true, sms_consent_at: now });
    }
  }

  async upsert(customer: Omit<Customer, 'sms_opt_out' | 'sms_consent' | 'sms_consent_at'>): Promise<Customer> {
    const k = this.key(customer.shop_id, customer.phone);
    const existing = this.records.get(k);
    const record: Customer = {
      ...customer,
      sms_opt_out: existing?.sms_opt_out ?? false,
      sms_consent: existing?.sms_consent ?? false,
      sms_consent_at: existing?.sms_consent_at ?? null,
    };
    this.records.set(k, record);
    return record;
  }
}
