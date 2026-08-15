import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Default bottom-left sits on top of the nav's media-plane / concurrency card.
  devIndicators: { position: 'bottom-right' },
  serverExternalPackages: ['node:sqlite'],
}

export default nextConfig
