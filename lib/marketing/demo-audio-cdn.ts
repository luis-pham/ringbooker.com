/** Public R2 bucket for marketing demo call MP3s (used in CSP media-src + phone mockups). */
export const MARKETING_DEMO_AUDIO_CDN = 'https://pub-754ba2dca2ad4634a1dda0cf7b86608a.r2.dev';

export function marketingDemoAudioUrl(filename: string): string {
  return `${MARKETING_DEMO_AUDIO_CDN}/${filename}`;
}
