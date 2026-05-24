import { MarketingLegalPage } from '@/components/marketing/marketing-legal';
import type { MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import { buildMetadata } from '@/lib/site';

const refundPolicyFaqs: MarketingFaqItem[] = [
  {
    q: 'When am I eligible for a refund?',
    a: 'You may request a full refund within 30 days of the original transaction date. No questions asked.',
  },
  {
    q: 'How do I request a refund?',
    a: 'Email support@ringbooker.com with your account email and payment receipt or transaction ID.',
  },
  {
    q: 'How long do approved refunds take?',
    a: 'Approved refunds are returned to the original payment method and typically appear within 5–10 business days depending on your card issuer.',
  },
  {
    q: 'What if I was charged twice?',
    a: 'If you are charged more than once for the same billing period due to a technical error, RingBooker will issue a full refund for the duplicate charge. Contact support with your billing receipt and we will resolve it within 5 business days.',
  },
  {
    q: 'Should I file a chargeback?',
    a: 'Contact RingBooker support first. If you initiate a chargeback before reaching out, your account may be suspended pending resolution.',
  },
];

export const metadata = buildMetadata({
  title: 'Refund Policy',
  description:
    'When and how RingBooker issues refunds for subscription plans and add-ons purchased through the platform.',
  path: '/refund',
});

export default function RefundPage() {
  return (
    <MarketingLegalPage
      breadcrumbLabel="Refund Policy"
      badge="Refund Policy"
      title="Refund Policy"
      subtitle="This policy explains when and how RingBooker issues refunds for paid subscription plans and add-ons purchased through our platform."
      updatedAt="May 24, 2026"
      sections={[
        {
          title: '30-Day Refund Guarantee',
          content: (
            <>
              <p>
                If you are not satisfied with your purchase, you may request a full refund within 30 days of the
                original transaction date. No questions asked.
              </p>
              <p>
                To request a refund, email <strong>support@ringbooker.com</strong> with your account email and payment
                receipt or transaction ID. Approved refunds are returned to the original payment method and typically
                appear within 5–10 business days depending on your card issuer.
              </p>
            </>
          ),
        },
        {
          title: 'Duplicate Charges',
          content: (
            <>
              <p>
                If you are charged more than once for the same billing period due to a technical error, RingBooker will
                issue a full refund for the duplicate charge. Contact support with your billing receipt and we will
                resolve it within 5 business days.
              </p>
            </>
          ),
        },
        {
          title: 'Chargebacks',
          content: (
            <>
              <p>
                If you initiate a chargeback with your card issuer before contacting RingBooker support, your account
                may be suspended pending resolution. We encourage you to contact us first — most billing issues can be
                resolved quickly without a chargeback dispute.
              </p>
            </>
          ),
        },
        {
          title: 'Changes to This Policy',
          content: (
            <>
              <p>
                RingBooker may update this Refund Policy from time to time. Changes will be posted on this page with an
                updated date. Continued use of the service after changes are posted constitutes acceptance of the revised
                policy.
              </p>
            </>
          ),
        },
        {
          title: 'Contact',
          content: (
            <>
              <p>
                For billing or refund questions, contact: <strong>support@ringbooker.com</strong>.
              </p>
            </>
          ),
        },
      ]}
      faqs={refundPolicyFaqs}
    />
  );
}
