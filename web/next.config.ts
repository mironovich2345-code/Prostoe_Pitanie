import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Point file-tracing root to this directory to avoid monorepo lockfile warnings.
  outputFileTracingRoot: path.join(__dirname),
  // All API calls go to the existing Express backend.
  // Set NEXT_PUBLIC_API_URL in .env.local when backend is on a different host.
};

export default nextConfig;
