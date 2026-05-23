'use client';

import { PhoneCallAudioMockup, VERTICAL_DEMO_AUDIO } from '@/components/marketing/phone-call-audio-mockup';

export function HomeHeroPhoneMockup() {
  return (
    <PhoneCallAudioMockup
      businessName="Blü Hair Studio"
      audioSrc={VERTICAL_DEMO_AUDIO['hair-salon']}
      shell="home"
    />
  );
}
