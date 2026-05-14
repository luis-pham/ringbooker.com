import type { Customer } from '@/src/backend/domain/types';
import type { CustomersRepository } from '@/src/backend/ports/repositories';

export class InMemoryCustomersRepository implements CustomersRepository {
  private readonly records = new Map<string, Customer>();

  private key(shopId: string, phone: string): string {
    return `${shopId}::${phone}`;
  }

  async isSmsOptedOut(shopId: string, phone: string): Promise<boolean> {
    return this.records.get(this.key(shopId, phone))?.sms_opt_out === true;
  }

  async setSmsOptOut(shopId: string, phone: string, optOut: boolean): Promise<void> {
    const k = this.key(shopId, phone);
    const existing = this.records.get(k);
    if (existing) {
      this.records.set(k, { ...existing, sms_opt_out: optOut });
    } else {
      this.records.set(k, { phone, shop_id: shopId, visit_count: 0, sms_opt_out: optOut });
    }
  }

  async upsert(customer: Omit<Customer, 'sms_opt_out'>): Promise<Customer> {
    const k = this.key(customer.shop_id, customer.phone);
    const existing = this.records.get(k);
    const record: Customer = { ...customer, sms_opt_out: existing?.sms_opt_out ?? false };
    this.records.set(k, record);
    return record;
  }
}
