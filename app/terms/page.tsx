import { MarketingLegalPage } from '@/components/marketing/marketing-legal';
import type { MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import { buildMetadata } from '@/lib/site';

const termsOfServiceFaqs: MarketingFaqItem[] = [
  {
    q: 'By using RingBooker, what am I agreeing to?',
    a: 'You agree to these Terms of Service, acceptable use rules, billing terms for paid plans, and the related policies linked from the site, including the Privacy Policy where applicable.',
  },
  {
    q: 'Can RingBooker change pricing or features?',
    a: 'RingBooker may update services, features, and pricing with reasonable notice as described in your subscription terms. Material changes are communicated through account notices or email where appropriate.',
  },
  {
    q: 'What happens if I stop paying for a subscription?',
    a: 'Non-payment may result in suspension or cancellation of paid features according to these terms and your plan. Data handling after termination follows the Privacy Policy and contractual obligations.',
  },
  {
    q: 'Can my account be suspended?',
    a: 'Yes. Accounts may be suspended or terminated for material breach, abuse, non-payment, or legal risk, as described in the Termination section of these terms.',
  },
  {
    q: 'Who do I contact for legal questions about these terms?',
    a: 'Contact support@ringbooker.com for contract or legal inquiries related to RingBooker services.',
  },
];

export const metadata = buildMetadata({
  title: 'Terms of Service',
  description: 'RingBooker terms of service, acceptable use, and subscription rules for the AI receptionist and answering service platform.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <MarketingLegalPage
      breadcrumbLabel="Terms of Service"
      badge="Terms of Service"
      title="Terms of Service"
      subtitle="These terms govern your use of RingBooker services, including website access, AI phone agent features, and paid subscription plans."
      updatedAt="May 11, 2026"
      sections={[
        {
          title: 'Acceptance',
          content: (
            <>
              <p>By creating an account, accessing the website, or using RingBooker services, you agree to these Terms of Service and related policies.</p>
            </>
          ),
        },
        {
          title: 'Service Scope',
          content: (
            <>
              <ul>
                <li>Answer inbound calls with AI voice workflows.</li>
                <li>Support booking flows, callback handling, reminders, and transcript records.</li>
                <li>Connect with supported providers for telephony, billing, and calendar operations.</li>
              </ul>
              <p>Features may vary by subscription plan and integration availability.</p>
            </>
          ),
        },
        {
          title: 'Accounts and Security',
          content: (
            <>
              <ul>
                <li>You are responsible for account credentials, access control, and user permissions in your workspace.</li>
                <li>You must provide accurate information and keep settings and authorized users up to date.</li>
                <li>You agree to notify RingBooker promptly of unauthorized access or suspected security incidents.</li>
              </ul>
            </>
          ),
        },
        {
          title: 'Acceptable Use',
          content: (
            <>
              <p>You may not use RingBooker to break laws, violate telemarketing/call recording rules, abuse third-party systems, or process data without a valid legal basis. You are responsible for your business compliance in each jurisdiction.</p>
            </>
          ),
        },
        {
          title: 'SMS Messaging',
          content: (
            <>
              <p>RingBooker sends SMS messages as part of its core appointment and call-handling service.</p>
              <p>
                <strong>Authorization:</strong>
              </p>
              <p>
                By activating live answering or SMS features in RingBooker, businesses authorize RingBooker to send SMS messages to:
              </p>
              <ul>
                <li>Callers who contact the business via the AI phone agent and provide their phone number</li>
                <li>Business owners and staff who opt in during account setup</li>
              </ul>
              <p>
                <strong>Permitted use:</strong>
              </p>
              <p>
                SMS is used only for transactional and operational messages directly related to appointments, missed calls, and business notifications. SMS is not used for unsolicited marketing or promotional campaigns.
              </p>
              <p>
                <strong>Opt-out:</strong>
              </p>
              <p>
                Recipients may opt out at any time by replying STOP to any message. Reply HELP for support contact information. Message and data rates may apply.
              </p>
              <p>
                <strong>Business responsibility:</strong>
              </p>
              <p>
                Businesses using RingBooker are responsible for ensuring their use of SMS features complies with applicable laws including TCPA, CAN-SPAM, and relevant state regulations.
              </p>
            </>
          ),
        },
        {
          title: 'Trials, Billing, and Plan Changes',
          content: (
            <>
              <p>Trial access, paid plans, and add-ons are shown in your billing experience. Billing is processed by authorized payment providers. Subscription renewals, upgrades, downgrades, and cancellations follow plan terms displayed at checkout and in account billing.</p>
            </>
          ),
        },
        {
          title: 'Third-Party Integrations',
          content: (
            <>
              <p>When you connect external providers (for example telephony, calendar, AI model providers, or payment gateways), your use is also subject to those provider terms and policies.</p>
            </>
          ),
        },
        {
          title: 'Data and Intellectual Property',
          content: (
            <>
              <p>Your business data remains yours. RingBooker retains rights in its software, platform, and service materials. You grant RingBooker limited rights to process data required to deliver and secure the service.</p>
            </>
          ),
        },
        {
          title: 'Disclaimers and Liability',
          content: (
            <>
              <p>Services are provided on an “as available” basis. To the maximum extent permitted by law, RingBooker disclaims implied warranties and is not liable for indirect or consequential damages. Total liability is limited as required by applicable contract law and mandatory consumer protections.</p>
            </>
          ),
        },
        {
          title: 'Termination',
          content: (
            <>
              <p>You may stop using the service at any time. RingBooker may suspend or terminate accounts for material breach, non-payment, abuse, or legal risk. Data handling after termination follows the Privacy Policy and contractual obligations.</p>
            </>
          ),
        },
        {
          title: 'Contact',
          content: (
            <>
              <p>For legal or contract inquiries, contact: <strong>support@ringbooker.com</strong>.</p>
            </>
          ),
        },
      ]}
      faqs={termsOfServiceFaqs}
    />
  );
}
