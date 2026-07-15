import { Suspense } from 'react';

import { SignupThankYou } from '@/components/auth/signup-thank-you';

export const metadata = {
  title: 'Account created.',
};

const signupConversionScript = String.raw`
window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function(){dataLayer.push(arguments);};
gtag('event', 'conversion', {'send_to': 'AW-18285870762/-ZAMCNHCxckcEKr9sI9E'});
`;

export default function SignupThankYouPage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: signupConversionScript }} />
      <Suspense fallback={null}>
        <SignupThankYou />
      </Suspense>
    </>
  );
}
