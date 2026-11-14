/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/Public_Index.html',
      },
      {
        source: '/admin',
        destination: '/Admin_Index.html',
      },
    ];
  },
};

module.exports = nextConfig;
