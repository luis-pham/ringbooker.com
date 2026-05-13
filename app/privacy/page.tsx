import { MarketingLegalPage } from '@/components/marketing/marketing-legal';
import type { MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import { buildMetadata } from '@/lib/site';

const privacyPolicyFaqs: MarketingFaqItem[] = [
  {
    q: 'Who is responsible for my data when I use RingBooker?',
    a: 'For customer data handled on calls, RingBooker typically acts as a processor on behalf of your business. For account, billing, and platform administration, RingBooker acts as a controller as described in this policy.',
  },
  {
    q: 'Does RingBooker sell my personal information?',
    a: 'RingBooker does not sell personal information. Data is used to operate the service, improve reliability and safety, comply with law, and communicate with you about your account.',
  },
  {
    q: 'What data is collected from demo calls?',
    a: 'Demo flows may collect contact details and call-related metadata needed to place the demo and improve the product experience. Details are described in the sections above.',
  },
  {
    q: 'How can I request access or deletion of my data?',
    a: 'You can contact support@ringbooker.com for privacy requests. Depending on your location, you may have additional rights such as access, correction, deletion, or export.',
  },
  {
    q: 'Where is data stored?',
    a: 'Data is processed and stored using infrastructure providers with appropriate safeguards. The policy describes categories of data and purposes of use.',
  },
];

export const metadata = buildMetadata({
  title: 'Privacy Policy',
  description:
    'How RingBooker collects, uses, stores, and protects personal data when you use our website, demos, and AI phone agent platform.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <MarketingLegalPage
      breadcrumbLabel="Privacy Policy"
      badge="Privacy Policy"
      title="Privacy Policy"
      subtitle="This policy explains how RingBooker collects, uses, stores, and protects personal data when you use our website, demo flows, and AI phone agent platform."
      updatedAt="May 11, 2026"
      sections={[
        {
          title: 'Who We Are',
          content: (
            <>
              <p>RingBooker provides AI-powered phone receptionist software for salons, spas, and clinics. In most cases, RingBooker acts as a data processor for customer data handled on behalf of each business.</p>
              <p>For account, billing, and platform administration data, RingBooker acts as a data controller.</p>
            </>
          ),
        },
        {
          title: 'Data We Collect',
          content: (
            <>
              <ul>
                <li>Account profile data: name, email, company/business details, login metadata.</li>
                <li>Operational data: services, pricing, schedules, availability settings, booking preferences.</li>
                <li>Call-related data: caller phone, timestamps, call status, transcript segments, tool actions.</li>
                <li>Billing data: subscription status and payment metadata from billing providers.</li>
                <li>Security data: IP, device, session, audit logs, abuse/rate-limit events.</li>
              </ul>
            </>
          ),
        },
        {
          title: 'SMS Communications',
          content: (
            <>
              <p>RingBooker sends SMS messages on behalf of businesses using our platform to support appointment workflows.</p>
              <p>
                <strong>Who receives SMS:</strong>
              </p>
              <ul>
                <li>Callers who contacted the business and provided their phone number during a call or booking interaction</li>
                <li>Business owners and staff who opted in during RingBooker account setup or onboarding</li>
              </ul>
              <p>
                <strong>Types of messages sent:</strong>
              </p>
              <ul>
                <li>Appointment request confirmations</li>
                <li>Booking links and scheduling follow-ups</li>
                <li>Missed-call follow-up notifications</li>
                <li>Appointment reminders and reschedule confirmations</li>
                <li>Cancellation confirmations</li>
                <li>Owner alerts and handoff notifications</li>
                <li>Customer support replies</li>
              </ul>
              <p>
                <strong>What we do not do:</strong>
              </p>
              <p>
                RingBooker does not use SMS for cold outreach, unsolicited marketing, purchased contact lists, or third-party promotional blasts.
              </p>
              <p>
                <strong>Opt-out:</strong>
              </p>
              <p>
                Reply <strong>STOP</strong> to any message to opt out immediately. Reply <strong>HELP</strong> for support information. Message and data rates may apply. Message frequency varies based on appointment activity.
              </p>
            </>
          ),
        },
        {
          title: 'How We Use Data',
          content: (
            <>
              <ul>
                <li>Deliver core services including call handling, booking flows, reminders, and analytics.</li>
                <li>Operate integrations (for example telephony, calendar, and payment providers).</li>
                <li>Protect the service through fraud detection, abuse controls, and security monitoring.</li>
                <li>Support customers, troubleshoot incidents, and improve product quality.</li>
              </ul>
            </>
          ),
        },
        {
          title: 'Legal Bases (EU/EEA/UK)',
          content: (
            <>
              <ul>
                <li>Performance of contract for delivering paid or trial services.</li>
                <li>Legitimate interests for service security, reliability, and fraud prevention.</li>
                <li>Legal obligations where required by law, tax, accounting, or regulatory rules.</li>
                <li>Consent where required for specific communications or optional processing.</li>
              </ul>
            </>
          ),
        },
        {
          title: 'Sharing and Subprocessors',
          content: (
            <>
              <p>We share data only as needed to provide the service and run the platform. Typical subprocessors include hosting/database, telephony, realtime AI, calendar, SMS, and billing providers.</p>
              <p>We require vendors to apply appropriate security controls and contractual data protection obligations.</p>
            </>
          ),
        },
        {
          title: 'International Transfers',
          content: (
            <>
              <p>Where personal data is transferred internationally, RingBooker uses recognized safeguards such as contractual protections and equivalent security controls.</p>
            </>
          ),
        },
        {
          title: 'Retention',
          content: (
            <>
              <p>We retain data for as long as needed to provide the service, comply with legal obligations, resolve disputes, and enforce agreements. Retention periods vary by data type and customer settings.</p>
            </>
          ),
        },
        {
          title: 'Security Measures',
          content: (
            <>
              <ul>
                <li>Role-based access controls and tenant-level boundaries for business data.</li>
                <li>Signed and protected sessions, webhook signature verification, and replay controls.</li>
                <li>Rate limiting, abuse monitoring, and structured audit logging.</li>
                <li>Encryption in transit and provider-level protections for stored credentials/secrets.</li>
              </ul>
            </>
          ),
        },
        {
          title: 'Your Rights',
          content: (
            <>
              <p>Depending on your location, you may have rights to access, correct, delete, restrict, object, or export your personal data. You may also lodge a complaint with a supervisory authority where applicable.</p>
            </>
          ),
        },
        {
          title: 'Contact',
          content: (
            <>
              <p>For privacy requests, data subject inquiries, or security concerns, contact: <strong>support@ringbooker.com</strong>.</p>
            </>
          ),
        },
      ]}
      faqs={privacyPolicyFaqs}
    />
  );
}
