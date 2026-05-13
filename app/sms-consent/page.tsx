import { MarketingLegalPage } from '@/components/marketing/marketing-legal';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'SMS Consent',
  description:
    'How RingBooker handles SMS opt-in for appointment notifications sent on behalf of salons, spas, and beauty businesses.',
  path: '/sms-consent',
});

export default function SmsConsentPage() {
  return (
    <MarketingLegalPage
      breadcrumbLabel="SMS Consent"
      badge="SMS Consent"
      title="SMS Consent"
      subtitle="How RingBooker handles SMS opt-in for appointment notifications sent on behalf of salons, spas, and beauty businesses."
      updatedAt="May 13, 2026"
      sections={[
        {
          title: 'How Businesses Opt In',
          content: (
            <>
              <p>Business owners and staff receive SMS alerts for new bookings, missed calls, and handoff requests via RingBooker.</p>
              <p>Opt-in occurs when a business owner checks the SMS consent option during RingBooker account setup or Go Live activation. By opting in, the owner agrees to receive transactional SMS notifications related to their RingBooker account.</p>
            </>
          ),
        },
        {
          title: 'How Callers Opt In',
          content: (
            <>
              <p>When a caller contacts a RingBooker-powered business, the AI phone agent may offer to send a booking confirmation or follow-up link by SMS.</p>
              <p>By verbally agreeing or providing their phone number during the call interaction, the caller consents to receive SMS from that business via RingBooker.</p>
            </>
          ),
        },
        {
          title: 'Types of Messages',
          content: (
            <>
              <p>Messages sent through RingBooker include:</p>
              <ul>
                <li>Appointment request confirmations</li>
                <li>Booking links sent by SMS</li>
                <li>Missed-call follow-up notifications</li>
                <li>Appointment reminders</li>
                <li>Reschedule and cancellation confirmations</li>
                <li>Business owner alerts and handoff notifications</li>
              </ul>
            </>
          ),
        },
        {
          title: 'What We Do Not Send',
          content: (
            <>
              <p>RingBooker does not use SMS for cold outreach, unsolicited marketing, purchased contact lists, or third-party promotional content.</p>
            </>
          ),
        },
        {
          title: 'Message Frequency',
          content: (
            <>
              <p>Message frequency varies based on appointment activity and business settings. Owners may receive multiple alerts per day during busy periods.</p>
            </>
          ),
        },
        {
          title: 'Opt Out',
          content: (
            <>
              <p>Reply <strong>STOP</strong> to any message to opt out immediately. Reply <strong>HELP</strong> for support information.</p>
            </>
          ),
        },
        {
          title: 'Rates',
          content: (
            <>
              <p>Message and data rates may apply depending on your mobile carrier plan.</p>
            </>
          ),
        },
        {
          title: 'Contact',
          content: (
            <>
              <p>For questions about SMS communications, contact <strong>support@ringbooker.com</strong> or visit <strong>ringbooker.com/contact</strong>.</p>
            </>
          ),
        },
      ]}
    />
  );
}
