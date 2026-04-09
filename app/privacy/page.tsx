import { MarketingLegalPage } from '@/components/marketing/marketing-legal';

export const metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <MarketingLegalPage
      badge="Privacy Policy"
      title="Privacy Policy"
      subtitle="This policy explains how RingBooker collects, uses, stores, and protects personal data when you use our website, demo flows, and AI phone agent platform."
      updatedAt="April 8, 2026"
      sections={[
        {
          title: 'Who We Are',
          content: (
            <>
              <p>RingBooker provides AI-powered phone receptionist software for salons, spas, and clinics. In most cases, RingBooker acts as a data processor for customer data handled on behalf of each shop.</p>
              <p>For account, billing, and platform administration data, RingBooker acts as a data controller.</p>
            </>
          ),
        },
        {
          title: 'Data We Collect',
          content: (
            <>
              <ul>
                <li>Account profile data: name, email, company/shop details, login metadata.</li>
                <li>Operational data: services, pricing, schedules, availability settings, booking preferences.</li>
                <li>Call-related data: caller phone, timestamps, call status, transcript segments, tool actions.</li>
                <li>Billing data: subscription status and payment metadata from billing providers.</li>
                <li>Security data: IP, device, session, audit logs, abuse/rate-limit events.</li>
              </ul>
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
                <li>Role-based access controls and tenant-level boundaries for shop data.</li>
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
              <p>For privacy requests, data subject inquiries, or security concerns, contact: <strong>privacy@ringbooker.com</strong>.</p>
            </>
          ),
        },
      ]}
    />
  );
}
