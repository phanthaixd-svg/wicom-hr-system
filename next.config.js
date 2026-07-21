/** @type {import('next').NextConfig} */

// Header bảo mật cơ bản (áp cho mọi route). HSTS chỉ có hiệu lực khi chạy HTTPS.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // chống clickjacking (app nội bộ, không nhúng iframe ngoài)
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "geolocation=(), camera=(), microphone=()" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // ẩn header "X-Powered-By: Next.js"
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
