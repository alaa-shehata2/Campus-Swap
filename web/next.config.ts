import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Domain seams live in ../src with NodeNext-style `.js` import suffixes.
  // Map them to TypeScript sources for webpack (used by `next build`
  // and `next dev`); src itself stays untouched.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
