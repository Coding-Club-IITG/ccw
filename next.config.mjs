/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Limit for file upload API route
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
