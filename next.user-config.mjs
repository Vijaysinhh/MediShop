/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Enabled for production best practices
  typescript: {
    ignoreBuildErrors: false, // Disabled to catch type errors in production
  },
  poweredByHeader: false, // Remove X-Powered-By header for security
  compress: true,
  experimental: {
    transitionIndicator: false,
  }
};

export default nextConfig;
