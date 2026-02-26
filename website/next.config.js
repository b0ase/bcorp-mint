/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  serverExternalPackages: ['@handcash/handcash-connect'],
};
module.exports = nextConfig;
