import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
    deviceSizes: [320, 420, 640, 768, 1024, 1280],
    imageSizes: [64, 128, 256, 384],
  },
};

export default nextConfig;
