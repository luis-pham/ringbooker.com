'use client';

import { PhoneCallAudioMockup } from '@/components/marketing/phone-call-audio-mockup';

const HOME_DEMO_AUDIO = '/sound/hair_sound_demo.mp3';

export function HomeHeroPhoneMockup() {
  return <PhoneCallAudioMockup businessName="Blü Hair Studio" audioSrc={HOME_DEMO_AUDIO} shell="home" />;
}
