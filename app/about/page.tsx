import { MarketingLegalPage } from '@/components/marketing/marketing-legal';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'About',
  description:
    'Learn about RingBooker — the AI phone answering and call forwarding service built for nail salons, hair salons, day spas, med spas, and beauty clinics across the US.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <MarketingLegalPage
      breadcrumbLabel="About"
      title="About RingBooker"
      subtitle="RingBooker is an AI phone answering and call forwarding service built for beauty and aesthetic businesses across the United States — including nail salons, hair salons, day spas, med spas, and beauty clinics."
      intro={
        <>
          <p>
            We started with a simple observation: small beauty businesses miss calls every day — during services,
            after hours, and at peak hours — and every missed call is a missed booking. RingBooker solves that by
            answering calls automatically with an AI receptionist, capturing appointment inquiries, and recovering
            revenue that would otherwise be lost.
          </p>
          <p>
            RingBooker works on your existing phone number. No new hardware, no staff changes. Customers call the
            same number they always have — RingBooker handles the rest.
          </p>
        </>
      }
      sections={[
        {
          title: 'Our Company',
          content: (
            <>
              <p>
                RingBooker is operated by RINGBOOKER LLC, a limited liability company registered in the State of
                Wyoming, United States.
              </p>
              <p>
                For inquiries, contact us at <strong>support@ringbooker.com</strong>.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
