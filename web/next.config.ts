import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.0.0.2'],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
