import { MarketingLegalPage } from '@/components/marketing/marketing-legal';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'Refund Policy',
  description:
    'When and how RingBooker issues refunds for subscription plans and add-ons purchased through the platform.',
  path: '/refund',
});

export default function RefundPage() {
  return (
    <MarketingLegalPage
      badge="Refund Policy"
      title="Refund Policy"
      subtitle="This policy explains when and how RingBooker issues refunds for paid subscription plans and add-ons purchased through our platform."
      updatedAt="April 11, 2026"
      sections={[
        {
          title: 'Subscription Plans',
          content: (
            <>
              <p>RingBooker offers monthly and annual subscription plans. All paid plans are billed in advance for the upcoming period.</p>
              <ul>
                <li><strong>Monthly plans:</strong> You may cancel at any time. Cancellation takes effect at the end of the current billing period. No partial-month refunds are issued for unused days.</li>
                <li><strong>Annual plans:</strong> If you cancel within 14 days of initial purchase and have not made more than 50 AI-handled calls during that period, you are eligible for a full refund. Cancellations after 14 days are not eligible for a refund; access continues until the end of the paid year.</li>
              </ul>
            </>
          ),
        },
        {
          title: 'Free Trial',
          content: (
            <>
              <p>Where a free trial is offered, no payment is collected during the trial period. If you do not cancel before the trial ends, your chosen plan activates and the first billing cycle begins. Trial-to-paid transitions are not refundable under the standard cancellation policy.</p>
            </>
          ),
        },
        {
          title: 'Add-Ons and Usage Fees',
          content: (
            <>
              <p>Usage-based charges (such as call overages, additional phone numbers, or SMS credits) are non-refundable once the usage has occurred. If an add-on is purchased but never activated, please contact support within 7 days of purchase for review.</p>
            </>
          ),
        },
        {
          title: 'Duplicate Charges',
          content: (
            <>
              <p>If you are charged more than once for the same billing period due to a technical error, RingBooker will issue a full refund for the duplicate charge. Contact support with your billing receipt and we will resolve it within 5 business days.</p>
            </>
          ),
        },
        {
          title: 'Service Unavailability',
          content: (
            <>
              <p>If RingBooker experiences a verified service outage that materially impacts your ability to use core features for more than 24 consecutive hours in a billing period, you may request a pro-rated credit for the affected time. Credits are applied to future billing cycles and are not issued as cash refunds.</p>
            </>
          ),
        },
        {
          title: 'How to Request a Refund',
          content: (
            <>
              <p>To request a refund, email <strong>support@ringbooker.com</strong> with your account email and a brief description of the issue. Include your payment receipt or transaction ID if available.</p>
              <p>Refund requests are reviewed within 5 business days. Approved refunds are returned to the original payment method and typically appear within 5–10 business days depending on your card issuer.</p>
            </>
          ),
        },
        {
          title: 'Chargebacks',
          content: (
            <>
              <p>If you initiate a chargeback with your card issuer before contacting RingBooker support, your account may be suspended pending resolution. We encourage you to contact us first — most billing issues can be resolved quickly without a chargeback dispute.</p>
            </>
          ),
        },
        {
          title: 'Changes to This Policy',
          content: (
            <>
              <p>RingBooker may update this Refund Policy from time to time. Changes will be posted on this page with an updated date. Continued use of the service after changes are posted constitutes acceptance of the revised policy.</p>
            </>
          ),
        },
        {
          title: 'Contact',
          content: (
            <>
              <p>For billing or refund questions, contact: <strong>support@ringbooker.com</strong>.</p>
            </>
          ),
        },
      ]}
    />
  );
}
