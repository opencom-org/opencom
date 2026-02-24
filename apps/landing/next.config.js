/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@opencom/ui"],
  output: "export",
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
