import type { NextConfig } from 'next'

const s3PublicBaseUrl = process.env.AWS_S3_PUBLIC_BASE_URL
const s3PublicUrl = s3PublicBaseUrl ? new URL(s3PublicBaseUrl) : null

const nextConfig: NextConfig = {
  // 'standalone' is for Docker only — omit on Vercel to avoid webpack bundling errors
  ...(process.env.BUILD_STANDALONE === 'true' ? { output: 'standalone' as const } : {}),
  serverExternalPackages: ['@prisma/client', 'prisma', 'pdf-parse', 'sharp'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.amazonaws.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      ...(s3PublicUrl
        ? [{ protocol: s3PublicUrl.protocol.replace(':', '') as 'http' | 'https', hostname: s3PublicUrl.hostname }]
        : []),
    ],
  },
  webpack: (config) => {
    config.externals.push({ canvas: 'canvas' })
    return config
  },
}

export default nextConfig
