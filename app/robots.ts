import type { MetadataRoute } from 'next';

/** Declared explicitly for robots.txt `Host` / `Sitemap` (production canonical domain). */
const RINGBOOKER_ORIGIN = 'https://ringbooker.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/user/',
          '/admin/',
          '/api/',
          '/login',
          '/thank-you',
        ],
      },
    ],
    host: RINGBOOKER_ORIGIN,
    sitemap: `${RINGBOOKER_ORIGIN}/sitemap.xml`,
  };
}
