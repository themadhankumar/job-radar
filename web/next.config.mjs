/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pg", "mammoth"],
    // Never serve stale RSC payloads on client navigation — sort changes must
    // always show fresh data (the default 30s cache made sorting look broken).
    staleTimes: { dynamic: 0 },
  },
};
export default nextConfig;
