/** Public R2 bucket for marketing demo call MP3s (used in CSP media-src + phone mockups). */
export const MARKETING_DEMO_AUDIO_CDN = 'https://pub-754ba2dca2ad4634a1dda0cf7b86608a.r2.dev';

export function marketingDemoAudioUrl(filename: string): string {
  return `${MARKETING_DEMO_AUDIO_CDN}/${filename}`;
}

export const VERTICAL_DEMO_AUDIO: Record<
  'nail-salon' | 'hair-salon' | 'spa' | 'med-spa' | 'beauty-clinic',
  string
> = {
  'nail-salon': marketingDemoAudioUrl('nail_sound_demo.mp3'),
  'hair-salon': marketingDemoAudioUrl('hair_sound_demo.mp3'),
  spa: marketingDemoAudioUrl('dayspa_sound_demo.mp3'),
  'med-spa': marketingDemoAudioUrl('medspa_sound_demo.mp3'),
  'beauty-clinic': marketingDemoAudioUrl('clinic_sound_demo.mp3'),
};
