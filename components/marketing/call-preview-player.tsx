'use client';

import { IPHONE_CALL_MOCKUP_CSS } from '@/components/marketing/iphone-call-mockup-css';
import { PHONE_CALL_AUDIO_MOCKUP_CSS, PhoneCallAudioMockup } from '@/components/marketing/phone-call-audio-mockup';

const CALL_PREVIEW_MOCKUP_CSS = `${IPHONE_CALL_MOCKUP_CSS}\n${PHONE_CALL_AUDIO_MOCKUP_CSS}`;

export type CallLine = { role: 'ai' | 'caller'; text: string };

function resolveAccentClass(accent: string): string {
  if (accent === '#B45309') return 'cp-accent-hair';
  if (accent === '#0D9488') return 'cp-accent-spa';
  if (accent === '#4F46E5') return 'cp-accent-med';
  if (accent === '#A21CAF') return 'cp-accent-clinic';
  return 'cp-accent-nail';
}

export function CallPreviewPlayer({
  businessName,
  accent,
  audioSrc,
  variant = 'default',
}: {
  businessName: string;
  accent: string;
  audioSrc: string;
  /** Vertical landings use home-style incoming-call audio mockup. */
  variant?: 'default' | 'vertical';
}) {
  const accentClass = resolveAccentClass(accent);

  if (variant === 'vertical') {
    return (
      <div className={`cp ${accentClass} cp-vertical`}>
        <PhoneCallAudioMockup businessName={businessName} audioSrc={audioSrc} shell="vertical" />
        <style dangerouslySetInnerHTML={{ __html: CALL_PREVIEW_MOCKUP_CSS }} />
      </div>
    );
  }

  return (
    <div className={`cp ${accentClass}`}>
      <PhoneCallAudioMockup businessName={businessName} audioSrc={audioSrc} shell="vertical" />
      <style dangerouslySetInnerHTML={{ __html: CALL_PREVIEW_MOCKUP_CSS }} />
    </div>
  );
}
