import type { NextConfig } from 'next';
import path from 'path';

// Strip trailing slash and any trailing /api segment so that
// NEXT_PUBLIC_API_URL=https://api.eatlyy.ru and
// NEXT_PUBLIC_API_URL=https://api.eatlyy.ru/api both work.
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.eatlyy.ru';
const apiBaseUrl = rawApiUrl.replace(/\/$/, '').replace(/\/api$/, '');

console.log('[web] API rewrite destination:', `${apiBaseUrl}/api/:path*`);

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),

  // Proxy /api/* to the Express backend.
  // Same-origin proxy lets the browser send HttpOnly cookies regardless of
  // which Railway domain the web service is deployed on.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
