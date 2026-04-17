import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/after-hours-calls', destination: '/phone-booking-recovery/after-hours-calls', permanent: true },
      {
        source: '/peak-hour-overflow-calls',
        destination: '/phone-booking-recovery/peak-hour-overflow-calls',
        permanent: true,
      },
      { source: '/missed-call-recovery', destination: '/phone-booking-recovery/missed-call-recovery', permanent: true },
      { source: '/nail-salon', destination: '/industries/nail-salon', permanent: true },
      { source: '/hair-salon', destination: '/industries/hair-salon', permanent: true },
      { source: '/spa', destination: '/industries/spa', permanent: true },
      { source: '/med-spa', destination: '/industries/med-spa', permanent: true },
      { source: '/beauty-clinic', destination: '/industries/beauty-clinic', permanent: true },
    ];
  },
  images: {
    remotePatterns: [],
    deviceSizes: [320, 420, 640, 768, 1024, 1280],
    imageSizes: [64, 128, 256, 384],
  },
};

export default nextConfig;
