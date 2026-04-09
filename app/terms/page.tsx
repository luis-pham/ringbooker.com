import { MarketingLegalPage } from '@/components/marketing/marketing-legal';

export const metadata = {
  title: 'Terms of Service',
};

export default function TermsPage() {
  return (
    <MarketingLegalPage
      badge="Terms of Service"
      title="Terms of Service"
      subtitle="These terms govern your use of RingBooker services, including website access, AI phone agent features, and paid subscription plans."
      updatedAt="April 8, 2026"
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
              <p>For legal or contract inquiries, contact: <strong>legal@ringbooker.com</strong>.</p>
            </>
          ),
        },
      ]}
    />
  );
}
