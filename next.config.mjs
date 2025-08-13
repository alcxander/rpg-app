/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['fabric']
  },
  webpack: (config) => {
    config.externals.push({
      'fabric': 'fabric'
    })
    return config
  }
}

export default nextConfig
