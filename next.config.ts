import type { NextConfig } from 'next';

/** Canonical host for SEO: https://ringbooker.com (non-www). See redirects below. */
const WWW_HOST = 'www.ringbooker.com';
const APEX_HOST = 'ringbooker.com';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // --- Host canonicalization (production) ---
      // LIVE issue: https://www.ringbooker.com was returning 200 — must 301/308 to apex.
      // Legacy verticals on www: one hop to final /industries/* (avoid www → apex → legacy chain).
      {
        source: '/beauty-clinic',
        has: [{ type: 'host', value: WWW_HOST }],
        destination: `https://${APEX_HOST}/industries/beauty-clinic`,
        permanent: true,
      },
      {
        source: '/med-spa',
        has: [{ type: 'host', value: WWW_HOST }],
        destination: `https://${APEX_HOST}/industries/med-spa`,
        permanent: true,
      },
      {
        source: '/hair-salon',
        has: [{ type: 'host', value: WWW_HOST }],
        destination: `https://${APEX_HOST}/industries/hair-salon`,
        permanent: true,
      },
      {
        source: '/spa',
        has: [{ type: 'host', value: WWW_HOST }],
        destination: `https://${APEX_HOST}/industries/spa`,
        permanent: true,
      },
      {
        source: '/nail-salon',
        has: [{ type: 'host', value: WWW_HOST }],
        destination: `https://${APEX_HOST}/industries/nail-salon`,
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: WWW_HOST }],
        destination: `https://${APEX_HOST}/:path*`,
        permanent: true,
      },
      {
        source: '/:path*',
        has: [
          { type: 'host', value: APEX_HOST },
          { type: 'header', key: 'x-forwarded-proto', value: 'http' },
        ],
        destination: `https://${APEX_HOST}/:path*`,
        permanent: true,
      },

      {
        source: '/phone-booking-recovery',
        destination: '/missed-booking-protection',
        permanent: true,
      },
      {
        source: '/phone-booking-recovery/:path*',
        destination: '/missed-booking-protection/:path*',
        permanent: true,
      },
      { source: '/after-hours-calls', destination: '/missed-booking-protection/after-hours-calls', permanent: true },
      {
        source: '/peak-hour-overflow-calls',
        destination: '/missed-booking-protection/peak-hour-overflow-calls',
        permanent: true,
      },
      { source: '/missed-call-recovery', destination: '/missed-booking-protection/missed-call-recovery', permanent: true },
      { source: '/nail-salon', destination: '/industries/nail-salon', permanent: true },
      { source: '/hair-salon', destination: '/industries/hair-salon', permanent: true },
      { source: '/spa', destination: '/industries/spa', permanent: true },
      { source: '/med-spa', destination: '/industries/med-spa', permanent: true },
      { source: '/beauty-clinic', destination: '/industries/beauty-clinic', permanent: true },
      // Demo / prompts use `day-spa`, but the public industry hub is `/industries/spa` (see MARKETING_INDUSTRY_URL_SEGMENTS).
      { source: '/industries/day-spa', destination: '/industries/spa', permanent: true },
    ];
  },
  images: {
    remotePatterns: [],
    deviceSizes: [320, 420, 640, 768, 1024, 1280],
    imageSizes: [64, 128, 256, 384],
  },
};

export default nextConfig;
