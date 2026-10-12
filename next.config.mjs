/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@node-rs/argon2', 'pg', '@react-pdf/renderer', 'pdfkit', 'exceljs'],
  outputFileTracingIncludes: {
    '/api/**/*': ['./node_modules/pdfkit/**/*', './node_modules/@react-pdf/**/*'],
  },
  experimental: {},
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
