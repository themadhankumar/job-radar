/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ["pg", "mammoth", "pdf-parse"] },
};
export default nextConfig;
