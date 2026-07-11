/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pg", "mammoth"],
    // Never serve stale RSC payloads on client navigation — sort changes must
    // always show fresh data (the default 30s cache made sorting look broken).
    staleTimes: { dynamic: 0 },
  },
  async headers() {
    // Baseline hardening. A full CSP is intentionally omitted for now: Next's
    // inline bootstrap + the theme-flash script would need nonces/hashes, and
    // getting that wrong silently breaks the app. These headers are pure wins.
    const security = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [{ source: "/:path*", headers: security }];
  },
};
export default nextConfig;
