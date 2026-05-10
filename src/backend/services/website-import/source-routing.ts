import type { ImportSourceType } from './types';

export function detectImportSource(url: URL): ImportSourceType {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'g.co' || host.includes('google.') || host.includes('maps.google.')) return 'google_maps';
  if (host.endsWith('yelp.com')) return 'yelp';
  if (host.endsWith('facebook.com') || host.endsWith('fb.com')) return 'facebook';
  if (host.endsWith('instagram.com')) return 'instagram';
  if (host.endsWith('vagaro.com')) return 'vagaro';
  if (host.endsWith('booksy.com')) return 'booksy';
  if (host.endsWith('glossgenius.com')) return 'glossgenius';
  if (host.endsWith('fresha.com')) return 'fresha';
  if (host.endsWith('styleseat.com')) return 'styleseat';
  if (host.endsWith('square.site')) return 'square_site';
  if (host.endsWith('linktr.ee')) return 'linktree';
  return 'normal_website';
}

export function shouldDeepCrawlSource(source: ImportSourceType): boolean {
  return source === 'normal_website';
}
