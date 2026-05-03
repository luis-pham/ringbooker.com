export type BaseEmailInput = {
  title: string;
  previewText: string;
  heroTitle: string;
  heroSubtitleHtml?: string;
  greetingHtml?: string;
  bodyHtml: string;
  secondaryBodyHtml?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  signatureHtml?: string;
  securityNote?: string;
  footerNote?: string;
};
